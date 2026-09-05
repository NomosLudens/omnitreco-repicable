/**
 * OmniTreco Identity & Device Discovery Engine
 * Handles user authentication (name + word), persistent device registration,
 * authenticated WebSocket presence via HttpOnly cookies, and deterministic P2P device requests (0 QR codes).
 */
class IdentityEngine {
  constructor() {
    this.apiBase = this._resolveApiBase();
    this.wsBase = this._resolveWsBase();
    this.installationId = this._getInstallationId();

    this.user = null;
    this.currentDevice = null;
    this.devices = [];
    this.ws = null;
    this.pendingRequests = new Map();
    this.initializedStatus = true;

    this.init();
  }

  _resolveApiBase() {
    if (window.OMNITRECO_API_BASE) return window.OMNITRECO_API_BASE;
    return `${location.origin}/api/identity`;
  }

  _resolveWsBase() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    if (window.OMNITRECO_WS_BASE) return window.OMNITRECO_WS_BASE;
    return `${proto}//${location.host}/api/identity`;
  }

  _getInstallationId() {
    let id = localStorage.getItem('omnitreco.installationId');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('omnitreco.installationId', id);
    }
    return id;
  }

  async init() {
    this._bindUIEvents();
    await this.checkBootstrapStatus();
    await this.checkAuthStatus();
  }

  _bindUIEvents() {
    const accountBtn = document.getElementById('header-account-btn');
    if (accountBtn) {
      accountBtn.addEventListener('click', () => {
        if (this.user) {
          this.openMyDevicesModal();
        } else {
          this.openAuthModal();
        }
      });
    }

    const authForm = document.getElementById('auth-form');
    if (authForm) {
      authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('auth-name-input');
        const wordInput = document.getElementById('auth-word-input');
        const name = nameInput ? nameInput.value.trim() : '';
        const word = wordInput ? wordInput.value.trim() : '';
        if (!name || !word) return;
        await this.login(name, word);
      });
    }

    const closeAuthBtn = document.getElementById('close-auth-modal-btn');
    if (closeAuthBtn) {
      closeAuthBtn.addEventListener('click', () => this.closeAuthModal());
    }

    const closeDevModalBtn = document.getElementById('close-my-devices-modal-btn');
    if (closeDevModalBtn) {
      closeDevModalBtn.addEventListener('click', () => this.closeMyDevicesModal());
    }

    const logoutBtn = document.getElementById('auth-logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.logout());
    }
  }

  async apiFetch(endpoint, options = {}) {
    options.credentials = 'include';
    options.headers = options.headers || {};
    
    if (this.currentDevice && this.currentDevice.id) {
      options.headers['X-Omnitreco-Device-Id'] = this.currentDevice.id;
    }

    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    try {
      const res = await fetch(`${this.apiBase}${endpoint}`, options);
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Serviço backend indisponível ou DNS pendente (HTTP ${res.status}).`);
      }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    } catch (err) {
      console.warn(`API Fetch Error (${endpoint}):`, err.message);
      throw err;
    }
  }

  async checkBootstrapStatus() {
    try {
      const data = await this.apiFetch('/auth/bootstrap-status');
      if (data && typeof data.initialized === 'boolean') {
        this.initializedStatus = data.initialized;
        this._updateAuthModalSubmitLabel();
      }
    } catch {}
  }

  _updateAuthModalSubmitLabel() {
    const submitBtn = document.querySelector('#auth-form button[type="submit"]');
    if (submitBtn) {
      submitBtn.textContent = this.initializedStatus ? 'ENTRAR NA CONTA 🚀' : 'CRIAR PRIMEIRA IDENTIDADE 🚀';
    }
  }

  async checkAuthStatus() {
    try {
      const data = await this.apiFetch('/auth/me');
      if (data && data.user) {
        this.user = data.user;
        await this.registerDevice();
        await this.fetchDevices();
        this.connectPresence();
        this.updateHeaderUI();
      }
    } catch {
      this.user = null;
      this.currentDevice = null;
      this.updateHeaderUI();
    }
  }

  async login(name, word) {
    const errorEl = document.getElementById('auth-error-msg');
    if (errorEl) errorEl.textContent = '';

    try {
      let data;
      try {
        data = await this.apiFetch('/auth/login', { method: 'POST', body: { name, word } });
      } catch (err) {
        if (err.message.includes('incorretos') || err.message.includes('401')) {
          try {
            data = await this.apiFetch('/auth/bootstrap', { method: 'POST', body: { name, word } });
          } catch (bootErr) {
            throw err;
          }
        } else {
          throw err;
        }
      }

      if (data && data.user) {
        this.user = data.user;
        await this.registerDevice();
        await this.fetchDevices();
        this.connectPresence();
        this.updateHeaderUI();
        this.closeAuthModal();
        if (window.showToast) window.showToast(`👤 Bem-vindo(a), ${this.user.name}!`);
      }
    } catch (err) {
      if (errorEl) errorEl.textContent = `⚠️ ${err.message}`;
    }
  }

  async logout() {
    try {
      await this.apiFetch('/auth/logout', { method: 'POST' });
    } catch {}

    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }

    this.user = null;
    this.currentDevice = null;
    this.devices = [];
    this.updateHeaderUI();
    this.closeMyDevicesModal();
    if (window.showToast) window.showToast('👤 Sessão encerrada.');
  }

  async registerDevice() {
    const defaultName = this._detectDeviceDefaultName();
    try {
      const data = await this.apiFetch('/devices/register', {
        method: 'POST',
        body: {
          installationId: this.installationId,
          displayName: defaultName,
          deviceType: this._detectDeviceType()
        }
      });
      if (data && data.device) {
        this.currentDevice = data.device;
      }
    } catch (err) {
      console.error('Failed to register device:', err);
    }
  }

  async fetchDevices() {
    if (!this.user) return;
    try {
      const data = await this.apiFetch('/devices');
      if (data && data.devices) {
        this.devices = data.devices;
        this.renderDevicesUI();
      }
    } catch (err) {
      console.error('Failed to fetch devices:', err);
    }
  }

  async renameDevice(deviceId, newName) {
    if (!newName || !newName.trim()) return;
    try {
      const data = await this.apiFetch(`/devices/${deviceId}`, {
        method: 'PATCH',
        body: { displayName: newName.trim() }
      });
      if (data && data.device) {
        if (this.currentDevice && this.currentDevice.id === deviceId) {
          this.currentDevice.display_name = data.device.display_name;
        }
        await this.fetchDevices();
        if (window.showToast) window.showToast('✅ Dispositivo renomeado!');
      }
    } catch (err) {
      alert(`⚠️ ${err.message}`);
    }
  }

  async revokeDevice(deviceId) {
    if (!confirm('Deseja revogar o acesso deste aparelho?')) return;
    try {
      await this.apiFetch(`/devices/${deviceId}`, { method: 'DELETE' });
      await this.fetchDevices();
      if (window.showToast) window.showToast('🗑️ Aparelho revogado.');
    } catch (err) {
      alert(`⚠️ ${err.message}`);
    }
  }

  connectPresence() {
    if (this.ws || !this.currentDevice) return;

    const wsUrl = `${this.wsBase}/ws/device?deviceId=${this.currentDevice.id}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.fetchDevices();
    };

    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'device-request') {
          this._handleIncomingDeviceRequest(msg.request);
        } else if (msg.type === 'device-request-accepted') {
          this._handleDeviceRequestAccepted(msg);
        } else if (msg.type === 'device-request-declined') {
          this._handleDeviceRequestDeclined(msg);
        } else if (msg.type === 'presence-update') {
          this.fetchDevices();
        }
      } catch (err) {
        console.error('WS Parse error:', err);
      }
    };

    this.ws.onclose = () => {
      this.ws = null;
      if (this.user) {
        setTimeout(() => this.connectPresence(), 5000);
      }
    };
  }

  async sendDeviceRequest(toDeviceId, action, roomId, fileMeta = null) {
    if (!this.currentDevice) {
      alert('👉 Registre seu aparelho primeiro fazendo login.');
      return false;
    }

    try {
      const body = {
        fromDeviceId: this.currentDevice.id,
        toDeviceId,
        action,
        roomId
      };

      if (fileMeta) {
        body.fileName = fileMeta.fileName;
        body.totalBytes = fileMeta.totalBytes;
        body.mimeType = fileMeta.mimeType;
      }

      const data = await this.apiFetch('/device-requests', {
        method: 'POST',
        body
      });
      return data && data.status === 'ok';
    } catch (err) {
      alert(`⚠️ ${err.message}`);
      return false;
    }
  }

  _handleIncomingDeviceRequest(reqInfo) {
    const { id, fromDevice, action, roomId, fileMeta } = reqInfo;
    this.pendingRequests.set(id, reqInfo);

    const overlay = document.createElement('div');
    overlay.className = 'teleport-modal-overlay';
    overlay.id = `request-modal-${id}`;

    const card = document.createElement('div');
    card.className = 'pocket-modal-card';
    card.style.maxWidth = '420px';

    const h3 = document.createElement('h3');
    const isCamera = action === 'macgyver-camera';
    h3.textContent = isCamera ? '📷 SOLICITAÇÃO DE CÂMERA P2P' : '🌀 TELEPORTE P2P';

    const p = document.createElement('p');
    p.style.margin = '12px 0';
    p.style.fontSize = '0.95rem';

    const devSpan = document.createElement('strong');
    devSpan.textContent = fromDevice ? fromDevice.display_name : 'Outro aparelho';

    if (isCamera) {
      p.appendChild(devSpan);
      p.appendChild(document.createTextNode(' quer usar a câmera deste dispositivo para fotografar.'));
    } else {
      p.appendChild(devSpan);
      p.appendChild(document.createTextNode(' quer enviar um arquivo P2P.'));
    }

    card.appendChild(h3);
    card.appendChild(p);

    if (!isCamera && fileMeta && fileMeta.fileName) {
      const metaBox = document.createElement('div');
      metaBox.style.cssText = 'margin-top:10px;padding:10px;background:var(--bg-dark);border:1px solid var(--border-glass);border-radius:var(--radius-sm);font-size:0.85rem;';
      
      const fileSpan = document.createElement('div');
      fileSpan.style.fontWeight = '700';
      fileSpan.textContent = `📄 Arquivo: ${fileMeta.fileName}`;
      
      const sizeSpan = document.createElement('div');
      sizeSpan.style.color = 'var(--text-muted)';
      sizeSpan.style.marginTop = '2px';
      const sizeFormatted = window.fileInspector ? window.fileInspector.formatBytes(fileMeta.totalBytes) : `${fileMeta.totalBytes} B`;
      sizeSpan.textContent = `Tamanho: ${sizeFormatted}`;

      metaBox.appendChild(fileSpan);
      metaBox.appendChild(sizeSpan);
      card.appendChild(metaBox);
    }

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '10px';
    actions.style.marginTop = '16px';

    const acceptBtn = document.createElement('button');
    acceptBtn.className = 'btn btn-primary';
    acceptBtn.style.flex = '1';
    acceptBtn.textContent = isCamera ? 'PERMITIR CÂMERA 📷' : 'ACEITAR RECEBIMENTO 📥';

    const declineBtn = document.createElement('button');
    declineBtn.className = 'btn btn-secondary';
    declineBtn.style.flex = '1';
    declineBtn.textContent = 'NEGAR ❌';

    acceptBtn.onclick = async () => {
      try {
        await this.apiFetch(`/device-requests/${id}/accept`, { method: 'POST' });
        overlay.remove();
        this.pendingRequests.delete(id);

        if (window.webrtcTeleport) {
          window.webrtcTeleport.joinRoomByCode(roomId);
        }
      } catch (err) {
        alert(`Erro: ${err.message}`);
      }
    };

    declineBtn.onclick = async () => {
      try {
        await this.apiFetch(`/device-requests/${id}/decline`, { method: 'POST' });
      } catch {}
      overlay.remove();
      this.pendingRequests.delete(id);
    };

    actions.appendChild(acceptBtn);
    actions.appendChild(declineBtn);
    card.appendChild(actions);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    if (window.triggerHaptic) window.triggerHaptic([100, 100, 200]);
  }

  _handleDeviceRequestAccepted(msg) {
    if (window.showToast) window.showToast('✅ Solicitação aceita! Conectando P2P...');
  }

  _handleDeviceRequestDeclined(msg) {
    if (window.showToast) window.showToast('⚠️ A solicitação foi recusada no aparelho alvo.');
  }

  updateHeaderUI() {
    const btn = document.getElementById('header-account-btn');
    if (!btn) return;

    btn.textContent = '';
    const span = document.createElement('span');

    if (this.user) {
      span.textContent = `👤 ${this.user.name}`;
      btn.appendChild(span);
      btn.title = `Conectado como ${this.user.name} (Meus Aparelhos)`;
      btn.classList.add('btn-success');
      btn.classList.remove('btn-secondary');
    } else {
      span.textContent = '👤 Entrar';
      btn.appendChild(span);
      btn.title = 'Entrar na conta (Sem email)';
      btn.classList.remove('btn-success');
      btn.classList.add('btn-secondary');
    }
  }

  renderDevicesUI() {
    const listEl = document.getElementById('my-devices-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (this.devices.length === 0) {
      const p = document.createElement('p');
      p.style.cssText = 'color:var(--text-muted);font-style:italic;';
      p.textContent = 'Nenhum outro aparelho registrado.';
      listEl.appendChild(p);
      return;
    }

    this.devices.forEach(d => {
      const isCurrent = this.currentDevice && this.currentDevice.id === d.id;
      const item = document.createElement('div');
      item.className = 'device-item-card';
      item.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:10px 14px;margin-bottom:8px;background:var(--bg-dark);border:1px solid var(--border-glass);border-radius:var(--radius-sm);';

      const left = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = `${this._getDeviceIcon(d.device_type)} ${d.display_name}`;
      if (isCurrent) {
        const badge = document.createElement('span');
        badge.style.cssText = 'font-size:0.7rem;color:var(--neon-cyan);margin-left:8px;text-transform:uppercase;font-weight:700;';
        badge.textContent = '(ESTE APARELHO)';
        title.appendChild(badge);
      }

      const statusP = document.createElement('div');
      statusP.style.cssText = 'font-size:0.78rem;margin-top:2px;color:var(--text-muted);';
      if (d.online) {
        statusP.innerHTML = '<span style="color:#00ff88;font-weight:700;">● online</span>';
      } else {
        const timeAgo = d.last_seen_at ? this._formatTimeAgo(new Date(d.last_seen_at)) : 'offline';
        statusP.textContent = `○ ${timeAgo}`;
      }

      left.appendChild(title);
      left.appendChild(statusP);

      const right = document.createElement('div');
      right.style.display = 'flex';
      right.style.gap = '6px';

      const renameBtn = document.createElement('button');
      renameBtn.className = 'btn btn-secondary btn-sm';
      renameBtn.style.padding = '4px 8px';
      renameBtn.style.fontSize = '0.75rem';
      renameBtn.textContent = '✏️ Renomear';
      renameBtn.onclick = () => {
        const name = prompt('Novo nome para este aparelho:', d.display_name);
        if (name) this.renameDevice(d.id, name);
      };

      right.appendChild(renameBtn);

      if (!isCurrent) {
        const revokeBtn = document.createElement('button');
        revokeBtn.className = 'btn btn-secondary btn-sm';
        revokeBtn.style.padding = '4px 8px';
        revokeBtn.style.fontSize = '0.75rem';
        revokeBtn.style.color = '#ff4466';
        revokeBtn.textContent = '🗑️ Revogar';
        revokeBtn.onclick = () => this.revokeDevice(d.id);
        right.appendChild(revokeBtn);
      }

      item.appendChild(left);
      item.appendChild(right);
      listEl.appendChild(item);
    });

    this.renderTrustedDevicesSelector();
  }

  renderTrustedDevicesSelector() {
    const teleportTargetContainer = document.getElementById('teleport-trusted-devices-container');
    if (teleportTargetContainer) {
      teleportTargetContainer.innerHTML = '';
      if (this.user && this.devices.length > 0) {
        const onlineOtherDevices = this.devices.filter(d => d.online && (!this.currentDevice || d.id !== this.currentDevice.id));

        const wrapper = document.createElement('div');
        wrapper.className = 'trusted-devices-box';
        wrapper.style.cssText = 'margin-bottom:12px;padding:12px;background:var(--bg-card-solid);border:1px solid var(--neon-cyan);border-radius:var(--radius-md);';

        const label = document.createElement('label');
        label.style.cssText = 'font-size:0.8rem;color:var(--neon-cyan);display:block;margin-bottom:8px;font-weight:700;letter-spacing:0.5px;';
        label.textContent = '⚡ ENVIAR PARA SEUS APARELHOS DA MESMA CONTA:';
        wrapper.appendChild(label);

        if (onlineOtherDevices.length === 0) {
          const empty = document.createElement('p');
          empty.style.cssText = 'font-size:0.8rem;color:var(--text-muted);font-style:italic;margin:0;';
          empty.textContent = 'Nenhum dos seus outros aparelhos está online no momento.';
          wrapper.appendChild(empty);
        } else {
          const btnGrid = document.createElement('div');
          btnGrid.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;';
          onlineOtherDevices.forEach(d => {
            const devBtn = document.createElement('button');
            devBtn.className = 'btn btn-primary btn-sm';
            
            const iconSpan = document.createElement('span');
            iconSpan.textContent = `${this._getDeviceIcon(d.device_type)} ${d.display_name}`;
            
            const dotSpan = document.createElement('span');
            dotSpan.style.color = '#00ff88';
            dotSpan.textContent = ' ●';

            devBtn.appendChild(iconSpan);
            devBtn.appendChild(dotSpan);

            devBtn.onclick = async () => {
              if (window.webrtcTeleport) {
                try {
                  const isCameraAction = window.webrtcTeleport.pendingControlAction === 'macgyver-camera';
                  const action = isCameraAction ? 'macgyver-camera' : 'file-transfer';

                  // Deterministic WebRTC Host creation: MUST reach waiting state BEFORE issuing request
                  const roomId = await window.webrtcTeleport.openTeleportAndWaitForHost();

                  let fileMeta = null;
                  if (action === 'file-transfer' && window.webrtcTeleport.pendingFile instanceof File) {
                    const f = window.webrtcTeleport.pendingFile;
                    fileMeta = { fileName: f.name, totalBytes: f.size, mimeType: f.type };
                  }

                  const ok = await this.sendDeviceRequest(d.id, action, roomId, fileMeta);
                  if (ok && window.showToast) window.showToast(`📤 Enviando solicitação para ${d.display_name}...`);
                } catch (err) {
                  alert(`⚠️ Erro ao preparar sala P2P: ${err.message}`);
                }
              }
            };
            btnGrid.appendChild(devBtn);
          });
          wrapper.appendChild(btnGrid);
        }
        teleportTargetContainer.appendChild(wrapper);
      }
    }
  }

  openAuthModal() {
    this.checkBootstrapStatus();
    const modal = document.getElementById('auth-modal');
    if (modal) modal.classList.remove('hidden');
  }

  closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.classList.add('hidden');
  }

  openMyDevicesModal() {
    this.renderDevicesUI();
    const modal = document.getElementById('my-devices-modal');
    if (modal) modal.classList.remove('hidden');
  }

  closeMyDevicesModal() {
    const modal = document.getElementById('my-devices-modal');
    if (modal) modal.classList.add('hidden');
  }

  _detectDeviceDefaultName() {
    const ua = navigator.userAgent;
    if (/iPhone/i.test(ua)) return 'iPhone';
    if (/iPad/i.test(ua)) return 'iPad';
    if (/Android/i.test(ua)) return 'Celular Android';
    if (/Macintosh/i.test(ua)) return 'MacBook';
    if (/Windows/i.test(ua)) return 'PC Windows';
    if (/Linux/i.test(ua)) return 'Notebook Linux';
    return 'Dispositivo';
  }

  _detectDeviceType() {
    const ua = navigator.userAgent;
    if (/Mobile|Android|iPhone|iPad/i.test(ua)) return 'Mobile';
    return 'Desktop';
  }

  _getDeviceIcon(type) {
    if (type === 'Mobile') return '📱';
    return '💻';
  }

  _formatTimeAgo(date) {
    const sec = Math.floor((new Date() - date) / 1000);
    if (sec < 60) return 'agora há pouco';
    const min = Math.floor(sec / 60);
    if (min < 60) return `há ${min}m`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `há ${hr}h`;
    const days = Math.floor(hr / 24);
    return `há ${days}d`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.identityEngine = new IdentityEngine();
});
