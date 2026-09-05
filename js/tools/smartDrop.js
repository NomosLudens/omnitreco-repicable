class SmartDrop {
  constructor() {
    this.dropzone = document.getElementById('universal-dropzone');
    this.fileInput = document.getElementById('universal-file-input');
    this.textInput = document.getElementById('universal-text-input');
    this.actionsContainer = document.getElementById('smart-actions-list');
    this.previewContainer = document.getElementById('smart-preview-content');

    this.currentData = null;

    this.init();
  }

  init() {
    if (!this.dropzone) return;

    ['dragenter', 'dragover'].forEach(eventName => {
      this.dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.dropzone.classList.add('drag-over');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      this.dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.dropzone.classList.remove('drag-over');
      }, false);
    });

    this.dropzone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files && files.length > 0) {
        if (files.length > 1 || files[0].webkitRelativePath) {
          this.handleFolder(Array.from(files));
        } else {
          this.handleFile(files[0]);
        }
      } else {
        const text = dt.getData('text');
        if (text) this.handleText(text);
      }
    });

    if (this.fileInput) {
      this.fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          if (e.target.files.length > 1) {
            this.handleFolder(Array.from(e.target.files));
          } else {
            this.handleFile(e.target.files[0]);
          }
        }
      });
    }

    if (this.textInput) {
      this.textInput.addEventListener('input', () => {
        const val = this.textInput.value.trim();
        if (val) this.handleText(val);
      });
    }

    // Microphone Listener
    const micBtn = document.getElementById('mic-record-btn');
    if (micBtn) {
      let isRecording = false;
      micBtn.addEventListener('click', async () => {
        if (!window.hearingEngine) return;
        if (!isRecording) {
          const ok = await window.hearingEngine.startMicRecording();
          if (ok) {
            isRecording = true;
            micBtn.textContent = '⏹️ Parar Gravação';
            micBtn.style.background = 'var(--neon-pink)';
          }
        } else {
          micBtn.textContent = '🎙️ Transcrevendo...';
          const { result } = await window.hearingEngine.stopMicRecording();
          isRecording = false;
          micBtn.textContent = '🎙️ Ouvir Microfone';
          micBtn.style.background = '';
          this.renderHearingResult(result);
        }
      });
    }
  }

  async handleFile(file) {
    this.currentData = { type: 'file', file };
    const inspection = window.fileInspector ? await window.fileInspector.inspectFile(file) : {
      name: file.name,
      size: file.size,
      sizeFormatted: `${(file.size / 1024).toFixed(1)} KB`,
      detectedType: file.type || 'Arquivo',
      magicHex: '—',
      sha256: '—',
      md5: '—',
      lastModified: new Date(file.lastModified).toLocaleString()
    };

    // Safe DOM construction for File Preview
    const chip = document.createElement('div');
    chip.className = 'file-summary-chip';

    const icon = document.createElement('span');
    icon.className = 'file-icon';
    icon.textContent = '📄';

    const details = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = inspection.name;

    const info = document.createElement('p');
    info.textContent = `${inspection.detectedType} • ${inspection.sizeFormatted}`;

    details.appendChild(title);
    details.appendChild(info);
    chip.appendChild(icon);
    chip.appendChild(details);

    this.renderPreviewNode(chip);

    // Contextual Actions
    const actions = [];

    if (inspection.detectedType.includes('Image') || file.type.startsWith('image/')) {
      actions.push(
        { label: '👁️ Ler texto (OCR)', action: () => this.runOcrOnImage(file) },
        { label: '▣ Ler QR / código', action: () => this.scanCodeOnImage(file) },
        { label: '🖼️ Converter para WebP', action: () => this.convertImageToFormat(file, 'image/webp', 'webp') },
        { label: '📦 Comprimir (JPEG 80%)', action: () => this.convertImageToFormat(file, 'image/jpeg', 'jpg', 0.8) },
        { label: '📐 Redimensionar (Máx 1200px)', action: () => this.resizeImage(file, 1200) },
        { label: '🛡️ Remover Metadados / EXIF', action: () => this.sanitizeExif(inspection) },
        { label: '🔬 Ver Raio-X', action: () => this.openInspector(inspection) },
        { label: '🌀 Teleportar P2P', action: () => window.webrtcTeleport && window.webrtcTeleport.openTeleport(file) }
      );
    } else if (inspection.detectedType.includes('Audio') || file.type.startsWith('audio/') || /\.(mp3|wav|m4a|ogg|webm)$/i.test(file.name)) {
      actions.push(
        { label: '🎙️ Transcrever áudio', action: () => this.transcribeAudio(file) },
        { label: '🔬 Ver Raio-X', action: () => this.openInspector(inspection) },
        { label: '🌀 Teleportar P2P', action: () => window.webrtcTeleport && window.webrtcTeleport.openTeleport(file) }
      );
    } else if (inspection.detectedType.includes('PDF') || file.name.endsWith('.pdf')) {
      actions.push(
        { label: '🔬 Ver Raio-X', action: () => this.openInspector(inspection) },
        { label: '📜 Gerar Certificado SHA-256', action: () => this.downloadCertificate(inspection) },
        { label: '🌀 Teleportar P2P', action: () => window.webrtcTeleport && window.webrtcTeleport.openTeleport(file) }
      );
    } else if (inspection.detectedType.includes('JSON') || file.name.endsWith('.json')) {
      actions.push(
        { label: '✨ Formatar / Beautify JSON', action: () => this.processJsonFile(file, 'beautify') },
        { label: '⚡ Minificar JSON', action: () => this.processJsonFile(file, 'minify') },
        { label: '🔬 Ver Raio-X', action: () => this.openInspector(inspection) },
        { label: '🌀 Teleportar P2P', action: () => window.webrtcTeleport && window.webrtcTeleport.openTeleport(file) }
      );
    } else {
      actions.push(
        { label: '🔬 Ver Raio-X', action: () => this.openInspector(inspection) },
        { label: '📜 Gerar Certificado SHA-256', action: () => this.downloadCertificate(inspection) },
        { label: '🌀 Teleportar P2P', action: () => window.webrtcTeleport && window.webrtcTeleport.openTeleport(file) }
      );
    }

    this.renderActions(actions);
  }

  async handleFolder(filesList) {
    this.currentData = { type: 'folder', files: filesList };
    if (window.folderInspector) {
      const folderName = filesList[0].webkitRelativePath ? filesList[0].webkitRelativePath.split('/')[0] : 'Pasta Carregada';
      window.folderInspector.currentFolderName = folderName;
      await window.folderInspector.processFilesList(filesList);
    }

    const chip = document.createElement('div');
    chip.className = 'file-summary-chip';
    const icon = document.createElement('span');
    icon.className = 'file-icon';
    icon.textContent = '📁';
    const details = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = `Pasta (${filesList.length} arquivos)`;
    details.appendChild(title);
    chip.appendChild(icon);
    chip.appendChild(details);
    this.renderPreviewNode(chip);

    const actions = [
      { label: '👁️ Analisar Pasta', action: () => this.showFolderContainer() },
      { label: '♊ Ver Duplicados Confirmados', action: () => this.showFolderContainer() },
      { label: '📸 Salvar Snapshot de Estado', action: () => window.folderInspector && window.folderInspector.saveSnapshot() },
      { label: '🔄 Comparar com Snapshot Anterior', action: () => window.folderInspector && window.folderInspector.compareSnapshot() }
    ];

    this.renderActions(actions);
  }

  handleText(text) {
    this.currentData = { type: 'text', text };

    const chip = document.createElement('div');
    chip.className = 'text-summary-chip';

    const title = document.createElement('strong');
    title.textContent = `Texto Detectado (${text.length} caracteres)`;

    const snippet = document.createElement('p');
    snippet.className = 'preview-snippet';
    snippet.textContent = `"${text.substring(0, 100)}..."`;

    chip.appendChild(title);
    chip.appendChild(snippet);

    this.renderPreviewNode(chip);

    const actions = [];
    const isUrl = /^https?:\/\//i.test(text.trim());
    const isJson = text.trim().startsWith('{') || text.trim().startsWith('[');

    // Run silent local diagnosis for AutoFixer
    const issues = window.autoFixer ? window.autoFixer.diagnoseText(text) : [];
    if (issues.length > 0) {
      actions.push({
        label: `🧹 Consertar (${issues.length} problema${issues.length > 1 ? 's' : ''} detectado${issues.length > 1 ? 's' : ''})`,
        action: () => this.showAutoFixContext(text, issues)
      });
    }

    if (isUrl) {
      actions.push(
        { label: '📱 Gerar QR Code Neon', action: () => this.openQrCode(text) },
        { label: '🔗 Decodificar URL', action: () => this.decodeUrl(text) }
      );
    } else if (isJson) {
      actions.push(
        { label: '✨ Formatar JSON', action: () => this.beautifyJsonText(text) },
        { label: '⚡ Minificar JSON', action: () => this.minifyJsonText(text) }
      );
    }

    actions.push(
      { label: '🔊 Ler em voz alta', action: () => this.readTextSpeech(text) },
      { label: '⚙️ Combinar Operações (Receita)', action: () => this.showRecipeContext(text) },
      { label: '🔠 MAIÚSCULAS', action: () => this.copyResult(text.toUpperCase()) },
      { label: '🔤 minúsculas', action: () => this.copyResult(text.toLowerCase()) },
      { label: '🔒 Codificar Base64', action: () => this.copyResult(btoa(unescape(encodeURIComponent(text)))) },
      { label: '🌀 Teleportar P2P', action: () => window.webrtcTeleport && window.webrtcTeleport.openTeleport(text) }
    );

    this.renderActions(actions);
  }

  renderPreviewNode(node) {
    if (!this.previewContainer) return;
    this.previewContainer.innerHTML = '';
    this.previewContainer.appendChild(node);
  }

  renderActions(actions) {
    if (!this.actionsContainer) return;
    this.actionsContainer.innerHTML = '';
    actions.forEach(act => {
      const btn = document.createElement('button');
      btn.className = 'btn btn-secondary action-chip';
      btn.textContent = act.label;
      btn.onclick = () => {
        if (window.triggerHaptic) window.triggerHaptic(40);
        act.action();
      };
      this.actionsContainer.appendChild(btn);
    });
  }

  showFolderContainer() {
    const el = document.getElementById('folder-results-container');
    if (el) {
      el.classList.remove('hidden');
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }

  showAutoFixContext(text, issues) {
    const card = document.getElementById('contextual-autofix-card');
    if (card) {
      card.classList.remove('hidden');
      const inputEl = document.getElementById('autofix-input-text');
      if (inputEl) inputEl.value = text;
      if (window.app) window.app.renderAutofixIssues(issues, document.getElementById('autofix-summary-badge'), document.getElementById('autofix-issues-list'));
      card.scrollIntoView({ behavior: 'smooth' });
    }
  }

  showRecipeContext(text) {
    const card = document.getElementById('contextual-recipe-card');
    if (card) {
      card.classList.remove('hidden');
      const inputEl = document.getElementById('recipe-input-text');
      if (inputEl) inputEl.value = text;
      card.scrollIntoView({ behavior: 'smooth' });
    }
  }

  openInspector(inspection) {
    const container = document.getElementById('raio-x-results');
    if (container) {
      container.classList.remove('hidden');
      if (window.renderRaioX) window.renderRaioX(inspection);
      container.scrollIntoView({ behavior: 'smooth' });
    }
  }

  convertImageToFormat(file, mimeType, ext, quality = 0.9) {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        this.downloadBlob(blob, `convertido.${ext}`);
      }, mimeType, quality);
    };
    img.src = url;
  }

  resizeImage(file, maxDim) {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => {
        this.downloadBlob(blob, `redimensionado_${w}x${h}.png`);
      }, 'image/png');
    };
    img.src = url;
  }

  sanitizeExif(inspection) {
    const cleanBytes = window.fileInspector.sanitizeImageExif(inspection.rawBytes);
    const blob = new Blob([cleanBytes], { type: 'image/jpeg' });
    this.downloadBlob(blob, `sanitizado_${inspection.name}`);
  }

  downloadCertificate(inspection) {
    const certText = window.fileInspector.generateCertificate(inspection);
    const blob = new Blob([certText], { type: 'text/plain;charset=utf-8' });
    this.downloadBlob(blob, `Certificado_Identidade_${inspection.name}.txt`);
  }

  async processJsonFile(file, mode) {
    const text = await file.text();
    try {
      const obj = JSON.parse(text);
      const output = mode === 'beautify' ? JSON.stringify(obj, null, 2) : JSON.stringify(obj);
      this.downloadBlob(new Blob([output], { type: 'application/json' }), `processado_${file.name}`);
    } catch(e) { alert('JSON inválido!'); }
  }

  beautifyJsonText(text) {
    try {
      const obj = JSON.parse(text);
      this.copyResult(JSON.stringify(obj, null, 2));
    } catch (e) { alert('JSON inválido!'); }
  }

  minifyJsonText(text) {
    try {
      const obj = JSON.parse(text);
      this.copyResult(JSON.stringify(obj));
    } catch (e) { alert('JSON inválido!'); }
  }

  copyResult(resText) {
    navigator.clipboard.writeText(resText);
    alert('✅ Resultado copiado para a área de transferência!');
  }

  downloadBlob(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  }

  // ─── 👁️ OMNITRECO VÊ (OCR & QR / BARCODE) ───

  async runOcrOnImage(file) {
    const card = document.getElementById('contextual-vision-card');
    const statusEl = document.getElementById('vision-status-progress');
    const contentEl = document.getElementById('vision-result-content');
    if (!card || !contentEl) return;

    card.classList.remove('hidden');
    card.scrollIntoView({ behavior: 'smooth' });
    if (statusEl) statusEl.textContent = '⏳ Iniciando leitura de imagem (OCR local)...';

    if (!window.visionEngine) {
      if (statusEl) statusEl.textContent = '❌ Motor de visão não disponível.';
      return;
    }

    const result = await window.visionEngine.readTextFromImage(file, (percent, msg) => {
      if (statusEl) statusEl.textContent = `⏳ ${percent}% - ${msg}`;
    });

    if (result.success) {
      if (statusEl) statusEl.textContent = '✅ Leitura concluída!';
      this.renderVisionResult(result);
    } else {
      if (statusEl) statusEl.textContent = `❌ ${result.message || result.error || 'Falha no OCR'}`;
      contentEl.innerHTML = `<p style="color: #ff4466; margin-top: 8px;">[${result.error || 'OCR_ERROR'}] ${result.message || 'Erro ao ler imagem.'}</p>`;
    }
  }

  async scanCodeOnImage(file) {
    const card = document.getElementById('contextual-vision-card');
    const statusEl = document.getElementById('vision-status-progress');
    if (!card) return;

    card.classList.remove('hidden');
    card.scrollIntoView({ behavior: 'smooth' });
    if (statusEl) statusEl.textContent = '⏳ Escaneando QR Code e Códigos de Barras...';

    if (!window.visionEngine) {
      if (statusEl) statusEl.textContent = '❌ Motor de visão não disponível.';
      return;
    }

    const res = await window.visionEngine.scanCodesFromImage(file);
    if (statusEl) statusEl.textContent = res.found ? '✅ Código detectado!' : '⚠️ Nenhum código detectado.';

    if (res.found) {
      this.renderCodeResult(res);
    } else {
      const contentEl = document.getElementById('vision-result-content');
      if (contentEl) {
        contentEl.innerHTML = '<p style="color: var(--text-muted); font-style: italic; margin-top: 8px;">Nenhum QR Code ou código de barras foi encontrado nesta imagem.</p>';
      }
    }
  }

  renderVisionResult(res) {
    const contentEl = document.getElementById('vision-result-content');
    if (!contentEl) return;
    contentEl.innerHTML = '';

    const box = document.createElement('div');
    box.style.background = 'rgba(0,0,0,0.3)';
    box.style.padding = '12px';
    box.style.borderRadius = '8px';
    box.style.marginTop = '8px';

    const p = document.createElement('p');
    p.style.whiteSpace = 'pre-wrap';
    p.style.fontFamily = 'monospace';
    p.style.fontSize = '0.9rem';
    p.textContent = res.text;
    box.appendChild(p);

    const btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.gap = '8px';
    btnRow.style.flexWrap = 'wrap';
    btnRow.style.marginTop = '12px';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn btn-primary btn-sm';
    copyBtn.textContent = '📋 Copiar Texto';
    copyBtn.onclick = () => this.copyResult(res.text);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-secondary btn-sm';
    saveBtn.textContent = '💾 Salvar .txt';
    saveBtn.onclick = () => this.downloadBlob(new Blob([res.text], { type: 'text/plain;charset=utf-8' }), 'texto_ocr.txt');

    const useBtn = document.createElement('button');
    useBtn.className = 'btn btn-secondary btn-sm';
    useBtn.textContent = '🪄 Usar na Bancada';
    useBtn.onclick = () => this.handleText(res.text);

    const ttsBtn = document.createElement('button');
    ttsBtn.className = 'btn btn-success btn-sm';
    ttsBtn.textContent = '🔊 Ler em voz alta';
    ttsBtn.onclick = () => this.readTextSpeech(res.text);

    btnRow.appendChild(copyBtn);
    btnRow.appendChild(saveBtn);
    btnRow.appendChild(useBtn);
    btnRow.appendChild(ttsBtn);
    box.appendChild(btnRow);

    contentEl.appendChild(box);
  }

  renderCodeResult(res) {
    const contentEl = document.getElementById('vision-result-content');
    if (!contentEl) return;
    contentEl.innerHTML = '';

    const box = document.createElement('div');
    box.style.background = 'rgba(0,0,0,0.3)';
    box.style.padding = '12px';
    box.style.borderRadius = '8px';
    box.style.marginTop = '8px';

    const header = document.createElement('strong');
    header.style.color = 'var(--neon-cyan)';
    header.textContent = res.type === 'QR' ? '▣ QR CODE ENCONTRADO' : `📊 CÓDIGO DE BARRAS (${res.format})`;
    box.appendChild(header);

    const p = document.createElement('p');
    p.style.fontFamily = 'monospace';
    p.style.fontSize = '1rem';
    p.style.marginTop = '6px';
    p.textContent = res.rawValue;
    box.appendChild(p);

    const btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.gap = '8px';
    btnRow.style.flexWrap = 'wrap';
    btnRow.style.marginTop = '12px';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn btn-primary btn-sm';
    copyBtn.textContent = '📋 Copiar Conteúdo';
    copyBtn.onclick = () => this.copyResult(res.rawValue);

    btnRow.appendChild(copyBtn);

    if (res.isUrl) {
      const openBtn = document.createElement('button');
      openBtn.className = 'btn btn-secondary btn-sm';
      openBtn.textContent = '🔗 Abrir Link';
      openBtn.onclick = () => window.open(res.rawValue, '_blank', 'noopener,noreferrer');
      btnRow.appendChild(openBtn);
    }

    const useBtn = document.createElement('button');
    useBtn.className = 'btn btn-secondary btn-sm';
    useBtn.textContent = '🪄 Jogar na Bancada';
    useBtn.onclick = () => this.handleText(res.rawValue);

    const teleBtn = document.createElement('button');
    teleBtn.className = 'btn btn-secondary btn-sm';
    teleBtn.textContent = '🌀 Teleportar';
    teleBtn.onclick = () => window.webrtcTeleport && window.webrtcTeleport.openTeleport(res.rawValue);

    btnRow.appendChild(useBtn);
    btnRow.appendChild(teleBtn);
    box.appendChild(btnRow);

    contentEl.appendChild(box);
  }

  // ─── 🎙️ OMNITRECO OUVE (TRANSCRIÇÃO) ───

  async transcribeAudio(file) {
    const card = document.getElementById('contextual-hearing-card');
    const statusEl = document.getElementById('hearing-status-progress');
    if (!card) return;

    card.classList.remove('hidden');
    card.scrollIntoView({ behavior: 'smooth' });
    if (statusEl) statusEl.textContent = '⏳ Processando áudio localmente...';

    if (!window.hearingEngine) {
      if (statusEl) statusEl.textContent = '❌ Motor de audição não disponível.';
      return;
    }

    const res = await window.hearingEngine.transcribeAudioFile(file, (percent, msg) => {
      if (statusEl) statusEl.textContent = `⏳ ${percent}% - ${msg}`;
    });

    if (res.isMobileUnsupported) {
      if (statusEl) statusEl.textContent = '⚠️ Limitação do Dispositivo Móvel';
      this.renderHearingResult(res);
      return;
    }

    if (res.success) {
      if (statusEl) statusEl.textContent = '✅ Transcrição concluída!';
      this.renderHearingResult(res);
    } else {
      if (statusEl) statusEl.textContent = `❌ ${res.message || res.error || 'Falha na transcrição'}`;
      const contentEl = document.getElementById('hearing-result-content');
      if (contentEl) {
        contentEl.innerHTML = `<p style="color: #ff4466; margin-top: 8px;">[${res.error || 'STT_ERROR'}] ${res.message || 'Erro na transcrição local.'}</p>`;
      }
    }
  }

  renderHearingResult(res) {
    const contentEl = document.getElementById('hearing-result-content');
    if (!contentEl) return;
    contentEl.innerHTML = '';

    const box = document.createElement('div');
    box.style.background = 'rgba(0,0,0,0.3)';
    box.style.padding = '12px';
    box.style.borderRadius = '8px';
    box.style.marginTop = '8px';

    if (res.isMobileUnsupported) {
      const msg = document.createElement('p');
      msg.textContent = res.message;
      box.appendChild(msg);

      const teleBtn = document.createElement('button');
      teleBtn.className = 'btn btn-primary btn-sm';
      teleBtn.style.marginTop = '10px';
      teleBtn.textContent = '🌀 Enviar áudio para outro aparelho';
      teleBtn.onclick = () => {
        if (this.currentData && this.currentData.file) {
          window.webrtcTeleport && window.webrtcTeleport.openTeleport(this.currentData.file);
        } else {
          window.webrtcTeleport && window.webrtcTeleport.openTeleport();
        }
      };
      box.appendChild(teleBtn);
      contentEl.appendChild(box);
      return;
    }

    const p = document.createElement('p');
    p.style.whiteSpace = 'pre-wrap';
    p.style.fontFamily = 'monospace';
    p.style.fontSize = '0.9rem';
    p.textContent = res.text;
    box.appendChild(p);

    const btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.gap = '8px';
    btnRow.style.flexWrap = 'wrap';
    btnRow.style.marginTop = '12px';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn btn-primary btn-sm';
    copyBtn.textContent = '📋 Copiar Transcrição';
    copyBtn.onclick = () => this.copyResult(res.text);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-secondary btn-sm';
    saveBtn.textContent = '💾 Salvar .txt';
    saveBtn.onclick = () => this.downloadBlob(new Blob([res.text], { type: 'text/plain;charset=utf-8' }), 'transcricao_audio.txt');

    const useBtn = document.createElement('button');
    useBtn.className = 'btn btn-secondary btn-sm';
    useBtn.textContent = '🪄 Usar na Bancada';
    useBtn.onclick = () => this.handleText(res.text);

    const ttsBtn = document.createElement('button');
    ttsBtn.className = 'btn btn-success btn-sm';
    ttsBtn.textContent = '🔊 Ler em voz alta';
    ttsBtn.onclick = () => this.readTextSpeech(res.text);

    btnRow.appendChild(copyBtn);
    btnRow.appendChild(saveBtn);
    btnRow.appendChild(useBtn);
    btnRow.appendChild(ttsBtn);
    box.appendChild(btnRow);

    contentEl.appendChild(box);
  }

  // ─── 🔊 OMNITRECO LÊ (TEXT-TO-SPEECH) ───

  readTextSpeech(text) {
    if (!window.speechEngine || !window.speechEngine.isSupported()) {
      alert('Leitura em voz alta não suportada neste navegador.');
      return;
    }

    if (window.speechEngine.isSpeaking) {
      window.speechEngine.stop();
      if (window.showToast) window.showToast('Leitura interrompida.', 'info');
    } else {
      window.speechEngine.speak(text, {
        onStart: () => {
          if (window.showToast) window.showToast('🔊 Lendo texto em voz alta...', 'info');
        },
        onEnd: () => {
          if (window.showToast) window.showToast('✅ Leitura em voz alta concluída.', 'success');
        }
      });
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.smartDrop = new SmartDrop();
});
