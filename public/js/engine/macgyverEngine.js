class MacGyverEngine {
  constructor() {
    this.signatureCanvas = document.getElementById('signature-canvas');
    this.signatureCtx = this.signatureCanvas ? this.signatureCanvas.getContext('2d') : null;
    this.colorSampleBtn = document.getElementById('sample-color-btn');
    this.colorDisplayHex = document.getElementById('color-hex-display');
    this.colorDisplayRgb = document.getElementById('color-rgb-display');
    this.colorDisplayHsl = document.getElementById('color-hsl-display');
    this.copyCssBtn = document.getElementById('copy-color-css-btn');
    this.improvisarModal = document.getElementById('improvisar-modal');
    this.improvisarBtn = document.getElementById('improvisar-hero-btn');

    // Presenter buttons
    this.prevBtn = document.getElementById('presenter-prev-btn');
    this.laserBtn = document.getElementById('presenter-laser-btn');
    this.nextBtn = document.getElementById('presenter-next-btn');
    this.presenterLog = document.getElementById('presenter-log');
    this.slideDisplay = document.getElementById('presenter-slide-display');

    this.isDrawing = false;
    this.signaturePaths = [];
    this.currentSlide = 1;
    this.totalSlides = 10;

    // NO hardcoded capabilities object — capabilities are detected at use-time

    this._activeStream = null;

    this.init();
  }

  init() {
    if (this.signatureCanvas) this.initSignaturePad();
    if (this.colorSampleBtn) this.initWorldColorPicker();
    this.initPresenterControls();

    if (this.improvisarBtn) {
      this.improvisarBtn.addEventListener('click', () => this.openImprovisarWizard());
    }

    const closeImpBtn = document.getElementById('close-improvisar-btn');
    if (closeImpBtn) {
      closeImpBtn.addEventListener('click', () => {
        if (this.improvisarModal) this.improvisarModal.classList.add('hidden');
      });
    }

    const runImpBtn = document.getElementById('run-improvisar-bridge-btn');
    if (runImpBtn) {
      runImpBtn.addEventListener('click', () => this.executeImprovisation());
    }
  }

  // ─── ✍️ 1. ASSINATURA (local — funciona sem P2P) ───

  initSignaturePad() {
    const canvas = this.signatureCanvas;
    const ctx = this.signatureCtx;
    canvas.width = canvas.parentElement ? (canvas.parentElement.clientWidth || 340) : 340;
    canvas.height = 180;

    ctx.strokeStyle = '#00f3ff';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const src = e.touches ? e.touches[0] : e;
      return { x: src.clientX - rect.left, y: src.clientY - rect.top };
    };

    const startDraw = (e) => {
      e.preventDefault();
      this.isDrawing = true;
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      this.signaturePaths.push([{ x: pos.x, y: pos.y }]);
    };

    const draw = (e) => {
      if (!this.isDrawing) return;
      e.preventDefault();
      const pos = getPos(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      if (this.signaturePaths.length > 0) {
        this.signaturePaths[this.signaturePaths.length - 1].push({ x: pos.x, y: pos.y });
      }
    };

    const stopDraw = () => {
      if (this.isDrawing) { this.isDrawing = false; ctx.closePath(); }
    };

    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    window.addEventListener('mouseup', stopDraw);
    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDraw, { passive: false });

    const clearBtn = document.getElementById('clear-signature-btn');
    if (clearBtn) clearBtn.addEventListener('click', () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      this.signaturePaths = [];
    });

    const exportBtn = document.getElementById('export-signature-btn');
    if (exportBtn) exportBtn.addEventListener('click', () => this.exportSignatureSvg());
  }

  exportSignatureSvg() {
    let svgPath = '';
    this.signaturePaths.forEach(path => {
      if (path.length > 0) {
        svgPath += `M ${path[0].x.toFixed(1)} ${path[0].y.toFixed(1)} `;
        for (let i = 1; i < path.length; i++) {
          svgPath += `L ${path[i].x.toFixed(1)} ${path[i].y.toFixed(1)} `;
        }
      }
    });

    if (!svgPath.trim()) { alert('Desenhe a assinatura primeiro!'); return; }

    const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.signatureCanvas.width} ${this.signatureCanvas.height}" width="${this.signatureCanvas.width}" height="${this.signatureCanvas.height}"><path d="${svgPath}" fill="none" stroke="#00f3ff" stroke-width="3" stroke-linecap="round"/></svg>`;

    navigator.clipboard.writeText(svgString).then(() => {
      alert('✍️ Assinatura SVG transparente copiada!\nPode colar em qualquer editor de imagem ou documento.');
    }).catch(() => {
      alert('Assinatura SVG gerada:\n' + svgString.substring(0, 200) + '...');
    });
    if (window.triggerHaptic) window.triggerHaptic([60, 60, 100]);
  }

  // ─── 🎨 2. COR DO MUNDO REAL (local — câmera deste dispositivo) ───

  initWorldColorPicker() {
    if (!this.colorSampleBtn) return;
    const video = document.getElementById('color-video-feed');
    const sampleCanvas = document.createElement('canvas');
    const sampleCtx = sampleCanvas.getContext('2d');
    let samplingInterval = null;

    this.colorSampleBtn.addEventListener('click', async () => {
      if (this._activeStream) {
        // Stop camera
        this._activeStream.getTracks().forEach(t => t.stop());
        this._activeStream = null;
        if (video) video.srcObject = null;
        if (samplingInterval) clearInterval(samplingInterval);
        this.colorSampleBtn.textContent = '📷 Ligar Câmera';
        return;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('🔴 Câmera não disponível neste navegador/contexto. Use HTTPS.');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } }
        });
        this._activeStream = stream;
        if (video) {
          video.srcObject = stream;
          video.play();
        }
        this.colorSampleBtn.textContent = '⏹️ Parar Câmera';

        samplingInterval = setInterval(() => {
          if (!video || video.videoWidth === 0) return;
          sampleCanvas.width = video.videoWidth;
          sampleCanvas.height = video.videoHeight;
          sampleCtx.drawImage(video, 0, 0);

          const cx = Math.floor(video.videoWidth / 2);
          const cy = Math.floor(video.videoHeight / 2);
          const px = sampleCtx.getImageData(cx - 3, cy - 3, 6, 6).data;

          let r = 0, g = 0, b = 0, count = 0;
          for (let i = 0; i < px.length; i += 4) {
            r += px[i]; g += px[i + 1]; b += px[i + 2]; count++;
          }
          r = Math.round(r / count);
          g = Math.round(g / count);
          b = Math.round(b / count);

          const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
          if (this.colorDisplayHex) this.colorDisplayHex.textContent = hex;
          if (this.colorDisplayRgb) this.colorDisplayRgb.textContent = `RGB ${r} ${g} ${b}`;
          if (this.colorDisplayHsl) this.colorDisplayHsl.textContent = this._rgbToHsl(r, g, b);
          const swatch = document.getElementById('color-swatch');
          if (swatch) swatch.style.backgroundColor = hex;
        }, 200);

      } catch (e) {
        alert(`🔴 Câmera indisponível: ${e.name}. ${e.name === 'NotAllowedError' ? 'Permissão negada.' : 'Verifique o navegador.'}`);
      }
    });

    if (this.copyCssBtn) {
      this.copyCssBtn.addEventListener('click', () => {
        const hexVal = this.colorDisplayHex ? this.colorDisplayHex.textContent : '';
        if (!hexVal || hexVal === 'Nenhuma cor capturada') { alert('Ligue a câmera primeiro!'); return; }
        navigator.clipboard.writeText(`background-color: ${hexVal};`);
        alert(`🎨 Copiado: background-color: ${hexVal};`);
      });
    }
  }

  _rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s;
    const l = (max + min) / 2;
    if (max === min) { h = s = 0; } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return `HSL ${Math.round(h * 360)}° ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  }

  // ─── 🖥️ 3. PRESENTER (local events) ───

  initPresenterControls() {
    this.updateSlideDisplay();

    if (this.prevBtn) this.prevBtn.addEventListener('click', () => {
      if (this.currentSlide > 1) this.currentSlide--;
      this._logPresenterEvent('◀ ANTERIOR');
      this.updateSlideDisplay();
    });

    if (this.nextBtn) this.nextBtn.addEventListener('click', () => {
      this.currentSlide++;
      this._logPresenterEvent('▶ PRÓXIMO');
      this.updateSlideDisplay();
    });

    if (this.laserBtn) this.laserBtn.addEventListener('click', () => {
      this._logPresenterEvent('● LASER TOGGLE');
      if (window.triggerHaptic) window.triggerHaptic(50);
    });
  }

  updateSlideDisplay() {
    if (this.slideDisplay) this.slideDisplay.textContent = `slide ${this.currentSlide} / ${this.totalSlides}`;
  }

  _logPresenterEvent(msg) {
    if (!this.presenterLog) return;
    const t = new Date().toLocaleTimeString('pt-BR');
    this.presenterLog.textContent = `[${t}] ${msg} (local — P2P não ativo)`;
    if (window.triggerHaptic) window.triggerHaptic(30);
  }

  // ─── 📷 MACGYVER: CÂMERA CELULAR → PC (O fluxo real) ───

  /**
   * Called on mobile (remote peer) after DataChannel opens.
   * Requests camera, shows preview, captures photo and sends via Teleport.
   */
  async startCameraCaptureMobile() {
    const container = document.getElementById('tool-macgyver');
    if (!container) return;

    const oldCard = document.getElementById('macgyver-camera-capture');
    if (oldCard) oldCard.remove();

    // Build mobile camera UI dynamically
    const cameraSection = document.createElement('div');
    cameraSection.className = 'macgyver-card';
    cameraSection.id = 'macgyver-camera-capture';

    const title = document.createElement('h3');
    title.textContent = '📷 Capturar Foto e Enviar ao PC';
    cameraSection.appendChild(title);

    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.style.cssText = 'width:100%;max-height:240px;object-fit:cover;border-radius:14px;background:#000;';
    cameraSection.appendChild(video);

    const captureBtn = document.createElement('button');
    captureBtn.className = 'btn btn-success btn-lg';
    captureBtn.textContent = '📷 CAPTURAR FOTO';
    captureBtn.style.marginTop = '12px';
    cameraSection.appendChild(captureBtn);

    const statusEl = document.createElement('p');
    statusEl.style.cssText = 'color:var(--text-muted);font-size:0.82rem;margin-top:8px;';
    statusEl.textContent = 'Aguardando câmera...';
    cameraSection.appendChild(statusEl);

    container.appendChild(cameraSection);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      statusEl.textContent = '🔴 getUserMedia não disponível. Use HTTPS.';
      return;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } }
      });
      video.srcObject = stream;
      statusEl.textContent = '📷 Câmera ativa. Posicione e capture.';
    } catch (e) {
      statusEl.textContent = `🔴 Câmera negada: ${e.name}`;
      return;
    }

    captureBtn.addEventListener('click', async () => {
      if (video.videoWidth === 0) { statusEl.textContent = 'Câmera ainda carregando...'; return; }

      // Capture frame to canvas
      const captureCanvas = document.createElement('canvas');
      captureCanvas.width = video.videoWidth;
      captureCanvas.height = video.videoHeight;
      captureCanvas.getContext('2d').drawImage(video, 0, 0);

      captureBtn.disabled = true;
      statusEl.textContent = '📤 Comprimindo e enviando via WebRTC P2P...';

      const blob = await new Promise(res => captureCanvas.toBlob(res, 'image/jpeg', 0.9));
      if (!blob) { statusEl.textContent = '🔴 Erro ao capturar frame.'; captureBtn.disabled = false; return; }

      // Tag the blob so receiver knows it's a MacGyver camera capture
      const file = new File([blob], `foto_macgyver_${Date.now()}.jpg`, { type: 'image/jpeg' });
      file._source = 'macgyver-camera';

      // Stop camera after capture
      stream.getTracks().forEach(t => t.stop());
      video.srcObject = null;

      if (window.webrtcTeleport) {
        await window.webrtcTeleport.sendFile(file);
        statusEl.textContent = '✅ Foto enviada! Aguardando confirmação do PC...';
      } else {
        statusEl.textContent = '🔴 Teleporte P2P não inicializado.';
        captureBtn.disabled = false;
      }
    });
  }

  /**
   * Called on PC (host) when a MacGyver camera photo is received.
   * Shows preview and download options.
   */
  showReceivedPhoto(blob, fileName) {
    const container = document.getElementById('tool-macgyver');
    if (!container) return;

    // Remove existing preview if any
    const old = document.getElementById('macgyver-photo-preview');
    if (old) old.remove();

    const previewCard = document.createElement('div');
    previewCard.className = 'macgyver-card';
    previewCard.id = 'macgyver-photo-preview';

    const title = document.createElement('h3');
    title.textContent = '📸 Foto Recebida do Celular via WebRTC P2P';
    previewCard.appendChild(title);

    const img = document.createElement('img');
    img.src = URL.createObjectURL(blob);
    img.alt = 'Foto recebida pelo MacGyver';
    img.style.cssText = 'width:100%;border-radius:14px;margin:8px 0;';
    previewCard.appendChild(img);

    const actionsRow = document.createElement('div');
    actionsRow.className = 'macgyver-card-actions';

    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'btn btn-success';
    downloadBtn.textContent = '⬇️ Baixar Foto';
    downloadBtn.onclick = () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fileName || 'foto_macgyver.jpg';
      a.click();
    };

    const useBtn = document.createElement('button');
    useBtn.className = 'btn btn-primary';
    useBtn.textContent = '🪄 Usar no OmniTreco';
    useBtn.onclick = () => {
      // Drop the received photo into Smart Drop for further processing
      const file = new File([blob], fileName || 'foto_macgyver.jpg', { type: 'image/jpeg' });
      if (window.smartDrop) {
        window.smartDrop.handleFile(file);
        if (window.app) window.app.switchTab('tool-smart-drop', document.querySelector('[data-target="tool-smart-drop"]'));
      }
    };

    actionsRow.appendChild(downloadBtn);
    actionsRow.appendChild(useBtn);
    previewCard.appendChild(actionsRow);

    container.appendChild(previewCard);

    // Switch to Outro Aparelho tab to show preview
    if (window.app) window.app.switchTab('tool-outro-aparelho', document.querySelector('[data-target="tool-outro-aparelho"]'));
    if (window.triggerHaptic) window.triggerHaptic([200, 100, 200]);
  }

  // ─── 🪄 IMPROVISAR WIZARD ───

  openImprovisarWizard() {
    if (this.improvisarModal) this.improvisarModal.classList.remove('hidden');
  }

  executeImprovisation() {
    const goal = document.querySelector('input[name="imp-goal"]:checked');
    const goalVal = goal ? goal.value : 'sign';

    if (this.improvisarModal) this.improvisarModal.classList.add('hidden');

    if (goalVal === 'sign') {
      if (window.app) window.app.switchTab('tool-outro-aparelho', document.querySelector('[data-target="tool-outro-aparelho"]'));
      // No alert as substitute — user can interact directly with signature pad
    } else if (goalVal === 'color') {
      if (window.app) window.app.switchTab('tool-outro-aparelho', document.querySelector('[data-target="tool-outro-aparelho"]'));
    } else if (goalVal === 'scan') {
      // THE CORE FLOW: Start P2P room for camera capture
      this._startCameraP2PFlow();
    } else if (goalVal === 'presenter') {
      if (window.app) window.app.switchTab('tool-outro-aparelho', document.querySelector('[data-target="tool-outro-aparelho"]'));
    }
  }

  /**
   * Starts the real MacGyver Camera → PC flow:
   * 1. Opens Teleport modal with real QR
   * 2. When remote joins, mobile shows camera capture UI
   * 3. Photo comes back via DataChannel → showReceivedPhoto()
   */
  _startCameraP2PFlow() {
    if (!window.webrtcTeleport) { alert('Motor WebRTC não carregado.'); return; }
    window.webrtcTeleport.openTeleport(undefined, { controlAction: 'macgyver-camera' });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.macgyverEngine = new MacGyverEngine();
});
