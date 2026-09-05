/**
 * OmniTreco — WebRTC Teleport Engine (Real P2P)
 *
 * Signaling: WebSocket to Cloudflare Durable Object per room
 * Fallback: No fallback — if WebSocket fails, shows BLOCKED status
 *
 * Protocol:
 *   Sender (host):
 *     1. createOffer → setLocalDescription → send {type:'offer', sdp}
 *     2. receive {type:'answer', sdp} → setRemoteDescription
 *     3. send/receive {type:'candidate', candidate}
 *
 *   Receiver (remote):
 *     1. receive {type:'offer', sdp} → setRemoteDescription
 *     2. createAnswer → setLocalDescription → send {type:'answer', sdp}
 *     3. send/receive {type:'candidate', candidate}
 *
 * File transfer protocol over DataChannel:
 *   { type:'header', fileName, totalBytes, mimeType, sha256 }
 *   [ArrayBuffer chunks...]
 *   { type:'eof' }
 *   receiver → { type:'ack', receivedBytes, sha256ok }
 */

class WebRTCTeleport {
  constructor() {
    this.modal = document.getElementById('teleport-modal');
    this.qrCanvas = document.getElementById('teleport-qr-canvas');
    this.roomUrlDisplay = document.getElementById('teleport-room-url');
    this.channelContainer = document.getElementById('multidevice-channel');
    this.transferStatus = document.getElementById('teleport-transfer-status');
    this.progressBarOuter = document.getElementById('teleport-progress-container');
    this.progressBarInner = document.getElementById('teleport-progress-bar');

    this.roomId = null;
    this.role = null; // 'host' | 'remote'
    this.ws = null;
    this.pc = null;
    this.dataChannel = null;
    this.pendingFile = null;
    this.pendingControlAction = null;

    // Receiver state
    this.receivedChunks = [];
    this.receivedBytes = 0;
    this.incomingFileInfo = null;

    // Determine signaling URL
    this.signalingBase = this._resolveSignalingBase();

    this.CHUNK_SIZE = 16384; // 16KB per chunk

    this._initHashUrl();
    this._initCodeInputBindings();
    this._initFileInputBindings();
  }

  _initCodeInputBindings() {
    const joinCodeBtn = document.getElementById('teleport-join-code-btn');
    const joinCodeInput = document.getElementById('teleport-join-code-input');
    if (joinCodeBtn && joinCodeInput) {
      joinCodeBtn.onclick = () => this.joinRoomByCode(joinCodeInput.value);
      joinCodeInput.onkeydown = (e) => {
        if (e.key === 'Enter') this.joinRoomByCode(joinCodeInput.value);
      };
    }
  }

  _initFileInputBindings() {
    const fileInput = document.getElementById('teleport-file-input');
    const infoDisplay = document.getElementById('teleport-selected-file-info');

    if (fileInput) {
      fileInput.addEventListener('change', () => {
        if (!fileInput.files || fileInput.files.length === 0) return;
        const file = fileInput.files[0];

        if (infoDisplay) {
          infoDisplay.style.display = 'block';
          infoDisplay.textContent = `📦 ${file.name} (${this.formatBytes(file.size)}) — Aguardando outro aparelho...`;
        }

        if (this.dataChannel && this.dataChannel.readyState === 'open') {
          this.sendFile(file);
        } else {
          this.openTeleport(file);
        }
      });
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
  }

  _toCrockfordBase32(bytes) {
    const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    let num = 0n;
    for (let i = 0; i < bytes.length; i++) {
      num = (num << 8n) | BigInt(bytes[i]);
    }
    let str = '';
    for (let i = 15; i >= 0; i--) {
      const shift = BigInt(i * 5);
      const val = Number((num >> shift) & 0x1Fn);
      str += alphabet[val];
    }
    return str;
  }

  _generateFriendlyRoomId() {
    const words = [
      'treco', 'gato', 'cafe', 'solar', 'nuvem', 'fogo', 'radio', 'farol',
      'pixel', 'turbo', 'bancada', 'bolso', 'porta', 'chave', 'vapor', 'motor',
      'onda', 'lanterna', 'bateria', 'radar', 'bussola', 'prisma', 'antena'
    ];

    const wordIndexBuf = new Uint32Array(1);
    crypto.getRandomValues(wordIndexBuf);
    const word = words[wordIndexBuf[0] % words.length];

    const bytes = new Uint8Array(10);
    crypto.getRandomValues(bytes);

    const token = this._toCrockfordBase32(bytes);
    const grouped = token.match(/.{1,4}/g).join('-');

    return `${word}-${grouped.toLowerCase()}`;
  }

  _validateRoomId(roomId) {
    if (typeof roomId !== 'string') return false;
    const clean = roomId.trim().toLowerCase();
    const regex = /^[a-z]+-[0-9a-hjkmnp-tv-z]{4}(?:-[0-9a-hjkmnp-tv-z]{4}){3}$/;
    return regex.test(clean);
  }

  joinRoomByCode(code) {
    const raw = (code || '').trim().toLowerCase();
    const cleanCode = raw.replace(/^#?teleport-/, '');
    if (!this._validateRoomId(cleanCode)) {
      alert('⚠️ Código de sala inválido. O formato deve ser: palavra-XXXX-XXXX-XXXX-XXXX (ex: farol-J8KD-2QMT-7X4P-N6RW)');
      return;
    }
    this._cleanup();
    this.role = 'remote';
    this.roomId = cleanCode;
    window.location.hash = `#teleport-${cleanCode}`;
    if (this.modal) this.modal.classList.remove('hidden');

    const codeBadge = document.getElementById('teleport-room-code-badge');
    if (codeBadge) codeBadge.textContent = cleanCode.toUpperCase();

    this._setStatus(`🌀 Entrando na sala '${cleanCode.toUpperCase()}'...`);
    this._renderMultiDeviceChannel();
    this._connectSignaling(cleanCode);
  }

  _resolveSignalingBase() {
    // If deployed on Cloudflare Workers, use same origin
    // For local dev (http://localhost), signaling will FAIL and show BLOCKED status
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.host}`;
  }

  /** Called on page load — join room if URL has #teleport-<roomId> */
  _initHashUrl() {
    const hash = window.location.hash;
    if (hash.startsWith('#teleport-')) {
      const roomId = hash.replace('#teleport-', '').trim().toLowerCase();
      if (this._validateRoomId(roomId)) {
        this.role = 'remote';
        this.roomId = roomId;
        if (this.modal) this.modal.classList.remove('hidden');
        const codeBadge = document.getElementById('teleport-room-code-badge');
        if (codeBadge) codeBadge.textContent = roomId.toUpperCase();
        this._setStatus('🌀 Entrando na sala P2P como receptor...');
        this._connectSignaling(roomId);
      } else {
        console.warn('Hash teleport invalid format:', roomId);
      }
    }
  }

  openTeleport(fileOrText, options = {}) {
    if (fileOrText !== undefined) this.pendingFile = fileOrText;
    if (options && options.controlAction) {
      this.pendingControlAction = options.controlAction;
    }

    if (!this.roomId || this.role !== 'host') {
      // Generate friendly room ID with 80 bits of cryptographic entropy
      this.roomId = this._generateFriendlyRoomId();
      this.role = 'host';
    }

    const roomUrl = `${location.origin}${location.pathname}#teleport-${this.roomId}`;

    if (this.modal) this.modal.classList.remove('hidden');

    const codeBadge = document.getElementById('teleport-room-code-badge');
    if (codeBadge) codeBadge.textContent = this.roomId.toUpperCase();

    // Generate real QR
    if (this.qrCanvas && window.QRCode) {
      try {
        // Clear previous QR code if any
        this.qrCanvas.innerHTML = '';
        new QRCode(this.qrCanvas, {
          text: roomUrl,
          width: 256,
          height: 256,
          colorDark: '#000000',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.M
        });
      } catch (e) {
        this._setStatus('⚠️ QR Code falhou: ' + e.message);
      }
    }

    if (this.roomUrlDisplay) this.roomUrlDisplay.value = roomUrl;
    
    // Wire up copy button
    const copyBtn = document.getElementById('teleport-copy-url-btn');
    if (copyBtn) {
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(roomUrl).then(() => {
          const originalText = copyBtn.innerText;
          copyBtn.innerText = 'COPIADO!';
          setTimeout(() => copyBtn.innerText = originalText, 2000);
        });
      };
    }

    this._renderMultiDeviceChannel();
    this._connectSignaling(this.roomId);
  }

  hideTeleportModal() {
    if (this.modal) this.modal.classList.add('hidden');
  }

  closeTeleport() {
    this.hideTeleportModal();
    this._cleanup();
  }

  openTeleportAndWaitForHost(fileOrText, options = {}) {
    this.openTeleport(fileOrText, options);

    if (this.isWaitingForPeer && this.ws && this.ws.readyState === 1) {
      return Promise.resolve(this.roomId);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this._onWaitingResolver = null;
        reject(new Error('Timeout aguardando criação da sala no signaling.'));
      }, 10000);

      this._onWaitingResolver = () => {
        clearTimeout(timeout);
        resolve(this.roomId);
      };
    });
  }

  _cleanup() {
    this.isWaitingForPeer = false;
    if (this._onWaitingResolver) {
      this._onWaitingResolver = null;
    }
    if (this.ws) { try { this.ws.close(); } catch (e) {} this.ws = null; }
    if (this.dataChannel) { try { this.dataChannel.close(); } catch (e) {} this.dataChannel = null; }
    if (this.pc) { try { this.pc.close(); } catch (e) {} this.pc = null; }
    this.receivedChunks = [];
    this.receivedBytes = 0;
    this.incomingFileInfo = null;
  }

  _connectSignaling(roomId) {
    this.isWaitingForPeer = false;
    const wsUrl = `${this.signalingBase}/api/room/${roomId}/ws`;
    this._setStatus(`📡 Conectando ao signaling: ${wsUrl}`);

    try {
      this.ws = new WebSocket(wsUrl);
    } catch (e) {
      this._setStatus('🔴 STATUS: BLOCKED — WebSocket falhou. Deploy no Cloudflare é necessário para P2P entre redes.');
      return;
    }

    this.ws.onopen = () => {
      this._setStatus('📡 WebSocket conectado. Aguardando peer...');
    };

    this.ws.onmessage = (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }
      this._handleSignal(msg);
    };

    this.ws.onerror = () => {
      this._setStatus('🔴 STATUS: BLOCKED — Signaling WebSocket com erro. Redes locais: use HTTPS ou deploy no Cloudflare.');
    };

    this.ws.onclose = (e) => {
      if (e.code !== 1000) {
        this._setStatus(`🔴 WebSocket fechado (código ${e.code}). P2P indisponível.`);
      }
    };
  }

  async _handleSignal(msg) {
    switch (msg.type) {
      case 'waiting':
        this.peerCount = 1;
        this.isWaitingForPeer = true;
        if (this._onWaitingResolver) {
          this._onWaitingResolver();
          this._onWaitingResolver = null;
        }
        this._renderMultiDeviceChannel();
        this._setStatus('⏳ ' + msg.message);
        break;

      case 'peer-ready':
        this.peerCount = msg.peerCount || 2;
        this._renderMultiDeviceChannel();
        this._setStatus(`✅ Peer conectado! Você é: ${msg.role === 'host' ? '💻 Host' : '📱 Receptor'}`);
        this.role = msg.role;
        if (msg.role === 'host') {
          await this._initPeerConnection();
          await this._startOffer();
        } else {
          await this._initPeerConnection();
        }
        break;

      case 'offer':
        if (!this.pc) await this._initPeerConnection();
        await this.pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: msg.sdp }));
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        this._sendSignal({ type: 'answer', sdp: answer.sdp });
        this._setStatus('📤 Answer enviado. Aguardando ICE...');
        break;

      case 'answer':
        if (this.pc) {
          await this.pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: msg.sdp }));
          this._setStatus('📨 Answer recebido. Trocando ICE candidates...');
        }
        break;

      case 'candidate':
        if (this.pc && msg.candidate) {
          try { await this.pc.addIceCandidate(new RTCIceCandidate(msg.candidate)); } catch (e) {}
        }
        break;

      case 'peer-left':
        this._setStatus('📴 Peer desconectou.');
        break;

      case 'error':
        this._setStatus('🔴 Erro signaling: ' + msg.message);
        break;
    }
  }

  async _initPeerConnection() {
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    this.pc.onicecandidate = (e) => {
      if (e.candidate) {
        this._sendSignal({ type: 'candidate', candidate: e.candidate.toJSON() });
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      this._setStatus(`🔗 ICE: ${this.pc.iceConnectionState}`);
      if (this.pc.iceConnectionState === 'failed') {
        this._setStatus('🔴 STATUS: BLOCKED BY NETWORK — NAT impediu conexão direta. TURN não implementado nesta versão.');
      }
    };

    this.pc.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this._setupDataChannelReceiver(this.dataChannel);
    };
  }

  async _startOffer() {
    if (!this.pc) return;
    this.dataChannel = this.pc.createDataChannel('teleport', { ordered: true });
    this._setupDataChannelSender(this.dataChannel);

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this._sendSignal({ type: 'offer', sdp: offer.sdp });
    this._setStatus('📤 Offer enviado. Aguardando answer...');
  }

  _setupDataChannelSender(channel) {
    channel.bufferedAmountLowThreshold = 65536;

    channel.onopen = () => {
      this._setStatus('✅ DataChannel OPEN! Conexão P2P estabelecida.');
      this._renderMultiDeviceChannel();
      if (window.triggerHaptic) window.triggerHaptic([50, 50, 100]);

      if (this.pendingControlAction === 'macgyver-camera') {
        try {
          channel.send(JSON.stringify({
            type: 'control',
            action: 'macgyver-camera'
          }));
        } catch (e) {
          console.error('Failed to send control action:', e);
        }
        this.pendingControlAction = null;
      }

      if (this.pendingFile) this.sendFile(this.pendingFile);
    };

    channel.onclose = () => {
      this._setStatus('📴 DataChannel fechado.');
      this._renderMultiDeviceChannel();
    };

    channel.onerror = (e) => {
      this._setStatus('🔴 Erro no DataChannel: ' + (e.error ? e.error.message : 'desconhecido'));
      this._renderMultiDeviceChannel();
    };

    channel.onmessage = (e) => {
      // Sender receiving ACK from receiver
      if (typeof e.data === 'string') {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'ack') {
            if (msg.sha256ok) {
              this._setStatus(`✅ TELEPORTE CONCLUÍDO! ${msg.receivedBytes} bytes recebidos e verificados pelo receptor.`);
            } else {
              this._setStatus(`⚠️ Arquivo recebido mas hash SHA-256 divergiu. Integridade comprometida.`);
            }
            if (window.triggerHaptic) window.triggerHaptic([100, 50, 200]);
          }
        } catch {}
      }
    };
  }

  _setupDataChannelReceiver(channel) {
    channel.binaryType = 'arraybuffer';

    channel.onopen = () => {
      this._setStatus('✅ DataChannel OPEN! Pronto para receber.');
      this._renderMultiDeviceChannel();
    };

    channel.onclose = () => {
      this._setStatus('📴 DataChannel (receptor) fechado.');
      this._renderMultiDeviceChannel();
    };

    channel.onmessage = async (e) => {
      if (typeof e.data === 'string') {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'control' && msg.action === 'macgyver-camera') {
            this._setStatus('📷 Este aparelho foi solicitado como câmera.');
            this.hideTeleportModal();

            if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
              this._setStatus('🔴 Conexão P2P foi perdida antes de abrir a câmera.');
              return;
            }

            if (window.app) {
              window.app.switchTab(
                'tool-outro-aparelho',
                document.querySelector('[data-target="tool-outro-aparelho"]')
              );
            }

            if (window.macgyverEngine) {
              window.macgyverEngine.startCameraCaptureMobile();
            }

            return;
          }
          if (msg.type === 'header') {
            this.incomingFileInfo = msg;
            this.receivedChunks = [];
            this.receivedBytes = 0;
            if (this.progressBarOuter) this.progressBarOuter.classList.remove('hidden');
            this._setStatus(`📥 Recebendo: ${msg.fileName} (${msg.totalBytes} bytes)...`);
          } else if (msg.type === 'eof') {
            await this._finishReceiving();
          }
        } catch {}
      } else if (e.data instanceof ArrayBuffer) {
        this.receivedChunks.push(e.data);
        this.receivedBytes += e.data.byteLength;
        const pct = this.incomingFileInfo && this.incomingFileInfo.totalBytes > 0
          ? Math.round((this.receivedBytes / this.incomingFileInfo.totalBytes) * 100) : 0;
        if (this.progressBarInner) this.progressBarInner.style.width = `${pct}%`;
        this._setStatus(`📥 Recebendo P2P: ${this.receivedBytes} / ${this.incomingFileInfo ? this.incomingFileInfo.totalBytes : '?'} bytes (${pct}%)`);
      }
    };

    channel.onerror = (e) => {
      this._setStatus('🔴 Erro no DataChannel (receptor): ' + (e.error ? e.error.message : ''));
      this._renderMultiDeviceChannel();
    };
  }

  async _finishReceiving() {
    if (!this.incomingFileInfo) return;

    // Validate byte count
    if (this.receivedBytes !== this.incomingFileInfo.totalBytes) {
      this._setStatus(`🔴 ERRO: Esperava ${this.incomingFileInfo.totalBytes} bytes, recebi ${this.receivedBytes}. Arquivo corrompido.`);
      this.dataChannel.send(JSON.stringify({ type: 'ack', receivedBytes: this.receivedBytes, sha256ok: false }));
      return;
    }

    const blob = new Blob(this.receivedChunks, { type: this.incomingFileInfo.mimeType || 'application/octet-stream' });

    // Verify SHA-256 if provided
    let sha256ok = true;
    if (this.incomingFileInfo.sha256) {
      const buf = await blob.arrayBuffer();
      const hashBuf = await crypto.subtle.digest('SHA-256', buf);
      const hashHex = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
      sha256ok = hashHex === this.incomingFileInfo.sha256;
    }

    // Send ACK to sender (real confirmation)
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify({
        type: 'ack',
        receivedBytes: this.receivedBytes,
        sha256ok
      }));
    }

    // Trigger download or preview
    const fileName = this.incomingFileInfo.fileName || 'arquivo_recebido';
    const blobUrl = URL.createObjectURL(blob);

    // If it's an image (MacGyver camera scenario), show preview in page
    if (blob.type.startsWith('image/') && this.incomingFileInfo.source === 'macgyver-camera') {
      if (window.macgyverEngine) {
        window.macgyverEngine.showReceivedPhoto(blob, fileName);
      }
    } else {
      // Default: attempt programmatic download
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    // Render explicit download/use card for user tap gesture on mobile & desktop
    const receivedContainer = document.getElementById('teleport-received-actions');
    if (receivedContainer) {
      receivedContainer.innerHTML = '';
      
      const card = document.createElement('div');
      card.className = 'teleport-file-card';
      card.style.marginTop = '12px';
      card.style.padding = '12px 16px';
      card.style.background = 'var(--bg-card-solid)';
      card.style.border = '1px solid var(--neon-green)';
      card.style.borderRadius = 'var(--radius-md)';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.gap = '10px';

      const info = document.createElement('div');
      info.style.fontWeight = '700';
      info.style.fontSize = '0.9rem';
      info.style.color = 'var(--neon-green)';
      const sizeStr = window.fileInspector ? window.fileInspector.formatBytes(this.receivedBytes) : `${this.receivedBytes} B`;
      info.textContent = `📦 ${fileName} (${sizeStr})`;

      const btnGroup = document.createElement('div');
      btnGroup.style.display = 'flex';
      btnGroup.style.gap = '8px';
      btnGroup.style.flexWrap = 'wrap';

      const downloadBtn = document.createElement('a');
      downloadBtn.className = 'btn btn-success btn-sm';
      downloadBtn.href = blobUrl;
      downloadBtn.download = fileName;
      downloadBtn.textContent = '💾 Baixar Arquivo';

      const useBtn = document.createElement('button');
      useBtn.className = 'btn btn-primary btn-sm';
      useBtn.textContent = '🪄 Usar no OmniTreco';
      useBtn.onclick = () => {
        const file = new File([blob], fileName, { type: blob.type || 'text/plain' });
        if (window.smartDrop) {
          window.smartDrop.handleFile(file);
          this.closeTeleport();
        }
      };

      btnGroup.appendChild(downloadBtn);
      btnGroup.appendChild(useBtn);

      card.appendChild(info);
      card.appendChild(btnGroup);
      receivedContainer.appendChild(card);
    }

    this._setStatus(`✅ Arquivo recebido! ${this.receivedBytes} bytes. SHA-256 ${sha256ok ? '✅ verificado' : '⚠️ divergente'}.`);
    if (window.triggerHaptic) window.triggerHaptic([200, 100, 200]);
  }

  async sendFile(fileOrText) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      this._setStatus('🔴 DataChannel não está aberto. Aguarde a conexão P2P.');
      return;
    }

    let buffer, fileName, mimeType, source;
    if (fileOrText instanceof File || fileOrText instanceof Blob) {
      buffer = await fileOrText.arrayBuffer();
      fileName = fileOrText.name || 'arquivo';
      mimeType = fileOrText.type || 'application/octet-stream';
      source = fileOrText._source || null;
    } else if (typeof fileOrText === 'string') {
      buffer = new TextEncoder().encode(fileOrText).buffer;
      fileName = 'texto.txt';
      mimeType = 'text/plain';
    } else {
      this._setStatus('🔴 Tipo de dado não suportado para envio.');
      return;
    }

    // Calculate SHA-256 of the file before sending
    const hashBuf = await crypto.subtle.digest('SHA-256', buffer);
    const sha256 = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

    const totalBytes = buffer.byteLength;

    // Send header
    this.dataChannel.send(JSON.stringify({
      type: 'header',
      fileName,
      totalBytes,
      mimeType,
      sha256,
      source: source || null
    }));

    if (this.progressBarOuter) this.progressBarOuter.classList.remove('hidden');

    // Send chunks with backpressure control
    const uint8 = new Uint8Array(buffer);
    let sentBytes = 0;
    const THRESHOLD = this.dataChannel.bufferedAmountLowThreshold || 65536;

    for (let offset = 0; offset < totalBytes; offset += this.CHUNK_SIZE) {
      const chunk = uint8.subarray(offset, Math.min(offset + this.CHUNK_SIZE, totalBytes));

      // Backpressure: wait if buffer is too full
      while (this.dataChannel.bufferedAmount > THRESHOLD * 4) {
        await new Promise(r => {
          this.dataChannel.onbufferedamountlow = r;
          setTimeout(r, 100); // Safety timeout
        });
      }

      if (this.dataChannel.readyState !== 'open') {
        this._setStatus('🔴 DataChannel fechou durante o envio.');
        return;
      }

      this.dataChannel.send(chunk);
      sentBytes += chunk.byteLength;

      const pct = Math.round((sentBytes / totalBytes) * 100);
      if (this.progressBarInner) this.progressBarInner.style.width = `${pct}%`;
      this._setStatus(`🚀 Enviando P2P: ${sentBytes} / ${totalBytes} bytes (${pct}%)`);
    }

    // Send EOF — do NOT show success yet; wait for ACK from receiver
    this.dataChannel.send(JSON.stringify({ type: 'eof' }));
    this._setStatus('⏳ Aguardando confirmação (ACK) do receptor...');
  }

  sendText(text) {
    return this.sendFile(text);
  }

  _sendSignal(msg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  _setStatus(msg) {
    if (this.transferStatus) this.transferStatus.textContent = msg;
  }

  _renderMultiDeviceChannel() {
    if (!this.channelContainer) return;
    this.channelContainer.innerHTML = '';

    const list = document.createElement('div');
    list.className = 'teleport-status-steps';

    const isRoomCreated = !!this.roomId;
    const isPeerReady = this.peerCount >= 2;
    const isDataChannelOpen = this.dataChannel && this.dataChannel.readyState === 'open';

    const steps = [
      { label: 'Sala criada', done: isRoomCreated },
      { label: isPeerReady ? 'Outro dispositivo apareceu' : 'Aguardando outro dispositivo', done: isPeerReady },
      { label: isDataChannelOpen ? 'P2P conectado & DataChannel aberto' : 'Conexão P2P negociando...', done: isDataChannelOpen }
    ];

    steps.forEach(s => {
      const stepItem = document.createElement('div');
      stepItem.className = 'teleport-step-item' + (s.done ? ' step-done' : ' step-pending');
      
      const dot = document.createElement('span');
      dot.className = 'step-dot';
      dot.textContent = s.done ? '● ' : '○ ';

      const label = document.createElement('span');
      label.className = 'step-label';
      label.textContent = s.label;

      stepItem.appendChild(dot);
      stepItem.appendChild(label);
      list.appendChild(stepItem);
    });

    this.channelContainer.appendChild(list);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.webrtcTeleport = new WebRTCTeleport();
});
