class QuickPocket {
  constructor() {
    this.modal = document.getElementById('pocket-modal');
    this.closeBtn = document.getElementById('close-pocket-btn');
    this.searchInput = document.getElementById('pocket-search-input');
    this.toolsGrid = document.getElementById('pocket-tools-grid');

    this.tools = [
      { id: 'violin', name: '🎻 Tiny Violin', icon: '🎻', keywords: ['tiny violin', 'violino', 'triste', 'sad'], action: () => this.playTinyViolin() },
      { id: 'uuid', name: '🔑 Gerador de UUID v4', icon: '🆔', keywords: ['uuid', 'guid', 'id'], action: () => this.generateUuid() },
      { id: 'password', name: '🔒 Gerador de Senhas', icon: '🔑', keywords: ['senha', 'password', 'gerador'], action: () => this.generatePassword() },
      { id: 'timestamp', name: '⏰ Timestamp ↔ Data', icon: '📅', keywords: ['timestamp', 'data', 'unix', 'time'], action: () => this.timestampConverter() },
      { id: 'base64', name: '🔤 Base64 Encode / Decode', icon: '📦', keywords: ['base64', 'encode', 'decode'], action: () => this.base64Tool() },
      { id: 'rule-three', name: '🧮 Regra de Três', icon: '📐', keywords: ['regra de tres', 'calculo', 'proporcao'], action: () => this.ruleOfThree() },
      { id: 'percentage', name: '📊 Porcentagem', icon: '📈', keywords: ['porcentagem', 'percent'], action: () => this.percentageCalc() },
      { id: 'diff', name: '🔍 Comparador de Texto (Diff)', icon: '↔️', keywords: ['diff', 'comparar', 'diferenca'], action: () => this.textDiffTool() },
      { id: 'sha256', name: '🔒 Hash SHA-256 de Texto', icon: '🔑', keywords: ['hash', 'sha256', 'crypto'], action: () => this.sha256Text() },
      { id: 'lorem', name: '📝 Gerador de Lorem Ipsum', icon: '📄', keywords: ['lorem', 'ipsum', 'texto'], action: () => this.loremIpsum() },
      { id: 'scratchpad', name: '📋 Prancheta Temporária', icon: '✏️', keywords: ['prancheta', 'scratchpad', 'bloco', 'notas'], action: () => this.openScratchpad() }
    ];

    this.init();
  }

  init() {
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        this.openModal();
      }
    });

    if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.closeModal());
    if (this.searchInput) {
      this.searchInput.addEventListener('input', () => this.filterTools());
    }

    this.renderTools(this.tools);
  }

  openModal() {
    if (this.modal) {
      this.modal.classList.remove('hidden');
      if (this.searchInput) {
        this.searchInput.value = '';
        this.searchInput.focus();
        this.filterTools();
      }
    }
  }

  closeModal() {
    if (this.modal) this.modal.classList.add('hidden');
  }

  renderTools(toolList) {
    if (!this.toolsGrid) return;
    this.toolsGrid.innerHTML = '';
    toolList.forEach(t => {
      const card = document.createElement('button');
      card.className = 'pocket-card';
      
      const icon = document.createElement('span');
      icon.className = 'icon';
      icon.textContent = t.icon;

      const label = document.createElement('span');
      label.className = 'label';
      label.textContent = t.name;

      card.appendChild(icon);
      card.appendChild(label);

      card.onclick = () => {
        if (window.triggerHaptic) window.triggerHaptic(40);
        this.closeModal();
        t.action();
      };
      this.toolsGrid.appendChild(card);
    });
  }

  filterTools() {
    const q = this.searchInput.value.toLowerCase().trim();
    if (!q) {
      this.renderTools(this.tools);
      return;
    }
    const filtered = this.tools.filter(t => 
      t.name.toLowerCase().includes(q) || 
      (t.keywords && t.keywords.some(k => k.includes(q)))
    );
    this.renderTools(filtered);
  }

  playTinyViolin() {
    const overlay = document.getElementById('tiny-violin-overlay');
    if (overlay) overlay.classList.remove('hidden');

    if (window.audioEngine) {
      window.audioEngine.playAsset('tiny-violin');
    }

    setTimeout(() => {
      if (overlay) overlay.classList.add('hidden');
    }, 4500);

    if (overlay) {
      overlay.onclick = () => {
        overlay.classList.add('hidden');
      };
    }
  }

  generateUuid() {
    const uuid = crypto.randomUUID ? crypto.randomUUID() : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
    navigator.clipboard.writeText(uuid);
    alert(`🔑 UUID v4 Gerado e Copiado:\n${uuid}`);
  }

  generatePassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=';
    let pwd = '';
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    for (let i = 0; i < 16; i++) {
      pwd += chars[array[i] % chars.length];
    }
    navigator.clipboard.writeText(pwd);
    alert(`🔒 Senha Forte Gerada e Copiada (16 caracteres):\n${pwd}`);
  }

  timestampConverter() {
    const now = Math.floor(Date.now() / 1000);
    const dateStr = new Date().toLocaleString('pt-BR');
    alert(`⏰ Timestamp Atual (Unix): ${now}\n📅 Data Humana: ${dateStr}`);
  }

  base64Tool() {
    const input = prompt('Digite o texto para Codificar/Decodificar Base64:');
    if (!input) return;
    try {
      if (input.startsWith('aHR0') || input.endsWith('==') || input.length % 4 === 0) {
        const decoded = decodeURIComponent(escape(atob(input)));
        navigator.clipboard.writeText(decoded);
        alert(`Decodificado de Base64:\n${decoded}`);
      } else {
        const encoded = btoa(unescape(encodeURIComponent(input)));
        navigator.clipboard.writeText(encoded);
        alert(`Codificado em Base64:\n${encoded}`);
      }
    } catch(e) { alert('Erro no formato Base64'); }
  }

  async sha256Text() {
    const input = prompt('Digite o texto para calcular o Hash SHA-256:');
    if (!input) return;
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuf = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuf));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    navigator.clipboard.writeText(hashHex);
    alert(`🔒 Hash SHA-256 Copiado:\n${hashHex}`);
  }

  ruleOfThree() {
    const a = prompt('Se A (ex: 100):');
    const b = prompt('Está para B (ex: 50):');
    const c = prompt('Então C (ex: 200) está para quanto?');
    if (a && b && c) {
      const res = (parseFloat(b) * parseFloat(c)) / parseFloat(a);
      alert(`📐 Resultado da Regra de Três: X = ${res}`);
    }
  }

  percentageCalc() {
    const p = prompt('Quanto é a porcentagem % (ex: 15):');
    const v = prompt('Do valor total (ex: 200):');
    if (p && v) {
      const res = (parseFloat(p) / 100) * parseFloat(v);
      alert(`📊 ${p}% de ${v} = ${res}`);
    }
  }

  textDiffTool() {
    const t1 = prompt('Texto 1:');
    const t2 = prompt('Texto 2:');
    if (t1 !== null && t2 !== null) {
      if (t1 === t2) alert('✅ Os textos são 100% IDÊNTICOS!');
      else alert(`❌ Os textos são DIFERENTES.\nTamanho T1: ${t1.length} | Tamanho T2: ${t2.length}`);
    }
  }

  loremIpsum() {
    const lorem = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.";
    navigator.clipboard.writeText(lorem);
    alert('📝 Lorem Ipsum copiado para a área de transferência!');
  }

  openScratchpad() {
    const saved = localStorage.getItem('omni_scratchpad') || '';
    const note = prompt('✏️ Sua Prancheta Temporária (Autosave):', saved);
    if (note !== null) {
      localStorage.setItem('omni_scratchpad', note);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.quickPocket = new QuickPocket();
});
