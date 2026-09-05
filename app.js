window.OMNITRECO_BUILD = 'freeze-v1';

// OmniTreco Main App Controller (7 Pillars)
class App {
  constructor() {
    this.topTabs = document.querySelectorAll('.nav-tab');
    this.toolScreens = document.querySelectorAll('.tool-screen');
    this.mobileSubtabs = document.querySelectorAll('.mobile-subtab');
    this.subtoolContents = document.querySelectorAll('.subtool-content');
    this.hapticToggleBtn = document.getElementById('haptic-toggle');
    this.pocketTriggerBtn = document.getElementById('pocket-trigger-btn');
    this.teleportHeaderBtn = document.getElementById('teleport-header-btn');
    this.closeTeleportBtn = document.getElementById('close-teleport-btn');

    // Mobile Launcher & Tool View elements
    this.launcher = document.getElementById('mobile-tools-launcher');
    this.toolView = document.getElementById('mobile-tool-view');
    this.backBtn = document.getElementById('mobile-tool-back');
    this.launcherCards = document.querySelectorAll('.launcher-card');

    this.hapticEnabled = true;

    this.init();
  }

  init() {
    // Top Navigation Tabs
    this.topTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetId = tab.dataset.target;
        this.switchTab(targetId, tab);
      });
    });

    // Mobile Tools Launcher Cards
    this.launcherCards.forEach(card => {
      card.addEventListener('click', () => {
        const subtargetId = card.dataset.subtarget;
        this.openMobileTool(subtargetId);
      });
    });

    if (this.backBtn) {
      this.backBtn.addEventListener('click', () => this.closeMobileTool());
    }

    // Haptic Check & Toggle
    this.checkHapticSupport();
    if (this.hapticToggleBtn && typeof navigator.vibrate === 'function') {
      this.hapticToggleBtn.addEventListener('click', () => {
        this.hapticEnabled = !this.hapticEnabled;
        this.hapticToggleBtn.classList.toggle('active', this.hapticEnabled);
        const labelSpan = this.hapticToggleBtn.querySelector('span');
        if (labelSpan) {
          labelSpan.textContent = this.hapticEnabled ? '📳 Vibração Ativada' : '📴 Vibração Desativada';
        }
      });
    }

    // Outro Aparelho (Teleporte P2P integration)
    const outroSendBtn = document.getElementById('outro-send-btn');
    const outroReceiveBtn = document.getElementById('outro-receive-btn');

    if (outroSendBtn) {
      outroSendBtn.addEventListener('click', () => {
        if (window.webrtcTeleport) window.webrtcTeleport.openTeleport();
      });
    }

    if (outroReceiveBtn) {
      outroReceiveBtn.addEventListener('click', () => {
        if (window.webrtcTeleport) window.webrtcTeleport.openTeleport();
      });
    }

    // Teleport Modal Triggers
    if (this.teleportHeaderBtn) {
      this.teleportHeaderBtn.addEventListener('click', () => {
        if (window.webrtcTeleport) window.webrtcTeleport.openTeleport();
      });
    }

    if (this.closeTeleportBtn) {
      this.closeTeleportBtn.addEventListener('click', () => {
        if (window.webrtcTeleport) window.webrtcTeleport.closeTeleport();
      });
    }

    // Pocket Trigger Button (Ctrl+K)
    if (this.pocketTriggerBtn) {
      this.pocketTriggerBtn.addEventListener('click', () => {
        if (window.quickPocket) window.quickPocket.openModal();
      });
    }

    // Header Tiny Violin Action
    const headerViolinBtn = document.getElementById('header-violin-btn');
    if (headerViolinBtn) {
      headerViolinBtn.addEventListener('click', () => {
        if (window.quickPocket) window.quickPocket.playTinyViolin();
      });
    }

    // Header Hamburger Menu Toggle
    const headerMenuBtn = document.getElementById('header-menu-btn');
    const headerDropdownMenu = document.getElementById('header-dropdown-menu');

    if (headerMenuBtn && headerDropdownMenu) {
      headerMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        headerDropdownMenu.classList.toggle('hidden');
        this.triggerHaptic(40);
      });

      document.addEventListener('click', (e) => {
        if (!headerDropdownMenu.contains(e.target) && e.target !== headerMenuBtn) {
          headerDropdownMenu.classList.add('hidden');
        }
      });

      headerDropdownMenu.querySelectorAll('.dropdown-item').forEach(btn => {
        btn.addEventListener('click', () => {
          headerDropdownMenu.classList.add('hidden');
        });
      });
    }

    // Global Toast Notification System
    this.ensureToastContainer();
    window.showToast = (msg, type = 'info') => {
      const container = this.ensureToastContainer();
      const toast = document.createElement('div');
      toast.className = `toast-item toast-${type}`;
      toast.textContent = msg;

      container.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
      }, 4000);
    };

    // Global Raio-X renderer helper
    window.renderRaioX = (inspection) => this.renderRaioXReport(inspection);

    // Purge old cache storage if build ID changed
    const storedBuild = localStorage.getItem('omnitreco_build');
    if (storedBuild !== window.OMNITRECO_BUILD) {
      localStorage.setItem('omnitreco_build', window.OMNITRECO_BUILD);
      if ('caches' in window) {
        caches.keys().then((names) => {
          names.forEach((name) => caches.delete(name));
        });
      }
    }

    // Register Service Worker with Build Versioning
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js?v=freeze-v1').catch((err) => console.log('SW err:', err));
    }

    // Global helpers
    window.triggerHaptic = (pattern) => this.triggerHaptic(pattern);

    this.initAutoFix();
  }

  ensureToastContainer() {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  switchTab(targetId, activeTab) {
    if (targetId === 'tool-bolso') {
      if (window.quickPocket) window.quickPocket.openModal();
      return;
    }

    this.topTabs.forEach(t => t.classList.remove('active'));
    this.toolScreens.forEach(s => s.classList.remove('active'));

    if (activeTab) activeTab.classList.add('active');
    const targetScreen = document.getElementById(targetId);
    if (targetScreen) targetScreen.classList.add('active');

    this.triggerHaptic(30);
  }

  openMobileTool(subtargetId) {
    const targetSub = document.getElementById(subtargetId);
    if (!targetSub) {
      console.error(`Subtarget DOM não encontrado: #${subtargetId}`);
      if (window.showToast) window.showToast('Ferramenta indisponível', 'error');
      return;
    }

    this.deactivateAllMobileTools();

    if (this.launcher) this.launcher.classList.add('hidden');
    if (this.toolView) this.toolView.classList.remove('hidden');

    this.subtoolContents.forEach(sc => sc.classList.remove('active'));
    targetSub.classList.add('active');

    // Trigger tool activate lifecycle if available
    const toolMap = {
      'tool-finger-chooser': window.fingerChooser,
      'tool-capybara-level': window.capybaraLevel,
      'tool-lie-detector': window.lieDetector,
      'tool-ring-light': window.ringLight,
      'tool-decibel-meter': window.decibelMeter,
      'tool-pet-translator': window.petTranslator,
      'tool-fake-call': window.fakeCall,
      'tool-paid-toilet': window.paidToilet,
      'tool-soundboard': window.soundboard,
      'tool-strobe-morse': window.strobeMorse
    };

    const activeTool = toolMap[subtargetId];
    if (activeTool && typeof activeTool.activate === 'function') {
      try { activeTool.activate(); } catch (e) { console.error('Error activating tool:', e); }
    }

    if (this.toolView) this.toolView.scrollTop = 0;
    window.scrollTo(0, 0);

    this.triggerHaptic(30);
  }

  closeMobileTool() {
    this.deactivateAllMobileTools();

    this.subtoolContents.forEach(sc => sc.classList.remove('active'));

    if (this.toolView) this.toolView.classList.add('hidden');
    if (this.launcher) this.launcher.classList.remove('hidden');

    window.scrollTo(0, 0);
    this.triggerHaptic(30);
  }

  switchMobileSubtab(subtargetId) {
    this.openMobileTool(subtargetId);
  }

  deactivateAllMobileTools() {
    [window.ringLight, window.decibelMeter, window.strobeMorse, window.fakeCall, window.paidToilet].forEach(tool => {
      if (tool && typeof tool.deactivate === 'function') {
        try { tool.deactivate(); } catch (e) { console.error('Error deactivating tool:', e); }
      }
    });
  }

  renderRaioXReport(inspection) {
    const container = document.getElementById('raio-x-results');
    if (!container) return;

    container.innerHTML = '';

    const card = document.createElement('div');
    card.className = 'inspection-card';

    const heading = document.createElement('h3');
    heading.textContent = '🔬 Laudo de Inspeção Forense';
    card.appendChild(heading);

    if (inspection.mismatch) {
      const alertDiv = document.createElement('div');
      alertDiv.className = 'mismatch-alert';
      alertDiv.textContent = inspection.mismatch;
      card.appendChild(alertDiv);
    }

    const rows = [
      { label: 'Nome do Arquivo:', val: inspection.name },
      { label: 'Tamanho:', val: `${inspection.sizeFormatted} (${inspection.size} bytes)` },
      { label: 'Tipo Detectado (Magic Bytes):', val: inspection.detectedType },
      { label: 'Assinatura Hex (Magic Bytes):', val: inspection.magicHex },
      { label: 'Hash SHA-256:', val: inspection.sha256 },
      { label: 'Hash MD5:', val: inspection.md5 },
      { label: 'Última Modificação:', val: inspection.lastModified }
    ];

    if (inspection.metadata && inspection.metadata.dimensions) {
      rows.push({ label: 'Dimensões da Imagem:', val: inspection.metadata.dimensions });
      rows.push({ label: 'Status EXIF:', val: inspection.metadata.hasExif });
    }

    rows.forEach(r => {
      const rowDiv = document.createElement('div');
      rowDiv.className = 'inspection-row';

      const labelSpan = document.createElement('span');
      labelSpan.className = 'label';
      labelSpan.textContent = r.label;

      const valSpan = document.createElement('span');
      valSpan.className = 'val';
      valSpan.textContent = r.val;

      rowDiv.appendChild(labelSpan);
      rowDiv.appendChild(valSpan);
      card.appendChild(rowDiv);
    });

    const actionsRow = document.createElement('div');
    actionsRow.className = 'actions-row mt-12';

    const certBtn = document.createElement('button');
    certBtn.className = 'btn btn-primary';
    certBtn.textContent = '📜 Baixar Certificado de Identidade Digital (SHA-256)';
    certBtn.onclick = () => {
      if (window.smartDrop) window.smartDrop.downloadCertificate(inspection);
    };

    const teleportBtn = document.createElement('button');
    teleportBtn.className = 'btn btn-secondary';
    teleportBtn.textContent = '🌀 Teleportar Este Arquivo P2P';
    teleportBtn.onclick = () => {
      if (window.webrtcTeleport) window.webrtcTeleport.openTeleport(inspection.rawBytes ? new File([inspection.rawBytes], inspection.name) : inspection.name);
    };

    actionsRow.appendChild(certBtn);
    actionsRow.appendChild(teleportBtn);
    card.appendChild(actionsRow);

    container.appendChild(card);
  }

  checkHapticSupport() {
    const hapticSupported = typeof navigator.vibrate === 'function';
    if (!hapticSupported && this.hapticToggleBtn) {
      this.hapticEnabled = false;
      this.hapticToggleBtn.classList.remove('active');
      this.hapticToggleBtn.style.opacity = '0.6';
      this.hapticToggleBtn.title = 'Vibração indisponível neste navegador';
      const labelSpan = this.hapticToggleBtn.querySelector('span');
      if (labelSpan) labelSpan.textContent = '📳 Vibração indisponível';
    }
  }

  triggerHaptic(pattern) {
    if (!this.hapticEnabled) return;
    if (typeof navigator.vibrate === 'function') {
      try { navigator.vibrate(pattern); } catch (e) {}
    }
  }

  initAutoFix() {
    const inputEl = document.getElementById('autofix-input-text');
    const diagnoseBtn = document.getElementById('autofix-diagnose-btn');
    const fixAllBtn = document.getElementById('autofix-run-all-btn');
    const summaryBadge = document.getElementById('autofix-summary-badge');
    const issuesList = document.getElementById('autofix-issues-list');

    if (!diagnoseBtn || !inputEl) return;

    diagnoseBtn.addEventListener('click', () => {
      const text = inputEl.value;
      if (!text.trim()) { alert('Cole um texto primeiro!'); return; }
      if (!window.autoFixer) return;
      const issues = window.autoFixer.diagnoseText(text);
      this.renderAutofixIssues(issues, summaryBadge, issuesList);
    });

    if (fixAllBtn) {
      fixAllBtn.addEventListener('click', () => {
        const text = inputEl.value;
        if (!text.trim()) { alert('Cole um texto primeiro!'); return; }
        if (!window.autoFixer) return;
        const fixed = window.autoFixer.fixAll(text);
        inputEl.value = fixed;
        if (summaryBadge) {
          summaryBadge.classList.remove('hidden');
          summaryBadge.textContent = `✅ Texto corrigido. Revise o resultado na entrada acima.`;
        }
        if (issuesList) issuesList.innerHTML = '';
      });
    }
  }

  renderAutofixIssues(issues, summaryBadge, issuesList) {
    if (summaryBadge) {
      summaryBadge.classList.remove('hidden');
      summaryBadge.textContent = issues.length === 0
        ? '✅ Nenhum problema detectado. Texto limpo!'
        : `⚠️ ${issues.length} problema(s) detectado(s).`;
    }
    if (!issuesList) return;
    issuesList.innerHTML = '';
    issues.forEach(issue => {
      const card = document.createElement('div');
      card.className = 'issue-item-card';
      const title = document.createElement('strong');
      title.textContent = issue.title;
      const desc = document.createElement('p');
      desc.style.marginTop = '4px';
      desc.textContent = issue.desc;
      card.appendChild(title);
      card.appendChild(desc);
      issuesList.appendChild(card);
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
