class IntentRouter {
  constructor() {
    this.promptInput = document.getElementById('intent-prompt-input');
    this.runBtn = document.getElementById('run-intent-btn');
    this.chips = document.querySelectorAll('.chip-prompt');

    this.init();
  }

  init() {
    if (this.runBtn) {
      this.runBtn.addEventListener('click', () => {
        const prompt = this.promptInput.value.trim();
        if (prompt) this.routeIntent(prompt);
      });
    }

    if (this.promptInput) {
      this.promptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const prompt = this.promptInput.value.trim();
          if (prompt) this.routeIntent(prompt);
        }
      });
    }

    this.chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const intent = chip.dataset.intent;
        if (this.promptInput) this.promptInput.value = intent;
        this.routeIntent(intent);
      });
    });
  }

  routeIntent(userPrompt) {
    const p = userPrompt.toLowerCase().trim();

    if (window.triggerHaptic) window.triggerHaptic(50);

    // 1. Image Compression / Resize intent ("menos de 1 mb", "comprimir", "reduzir")
    if (p.includes('1 mb') || p.includes('comprimir') || p.includes('reduzir') || p.includes('menor')) {
      if (window.smartDrop && window.smartDrop.currentData && window.smartDrop.currentData.file) {
        this.compressToTarget(window.smartDrop.currentData.file, 1_000_000);
      } else {
        alert('👉 Por favor, arraste uma imagem primeiro na área de soltura!');
      }
      return;
    }

    // 2. Anonymize / Strip EXIF intent ("tira tudo que identifica", "exif", "anonimizar", "autor")
    if (p.includes('identifica') || p.includes('exif') || p.includes('autor') || p.includes('anonimizar') || p.includes('limpar metadados')) {
      if (window.smartDrop && window.smartDrop.currentData && window.smartDrop.currentData.file) {
        window.fileInspector.inspectFile(window.smartDrop.currentData.file).then(inspection => {
          window.smartDrop.sanitizeExif(inspection);
          alert('🛡️ Intenção reconhecida: Metadados EXIF e informações de autoria removidos com sucesso!');
        });
      } else {
        alert('👉 Por favor, arraste a foto primeiro!');
      }
      return;
    }

    // 3. Table / CSV intent ("tabela", "csv")
    if (p.includes('tabela') || p.includes('csv')) {
      if (window.smartDrop && window.smartDrop.currentData && window.smartDrop.currentData.text) {
        const text = window.smartDrop.currentData.text;
        const lines = text.split('\n').filter(Boolean);
        const csv = lines.map(line => line.split(/\s+/).join(',')).join('\n');
        window.smartDrop.copyResult(csv);
        alert('📊 Intenção reconhecida: Texto convertido para tabela CSV e copiado!');
      } else {
        alert('👉 Por favor, cole um texto na caixa de entrada!');
      }
      return;
    }

    // 4. File Equality / Compare intent ("iguais", "comparar", "diferentes", "mesmo")
    if (p.includes('iguais') || p.includes('comparar') || p.includes('mesmo')) {
      if (window.quickPocket) {
        window.quickPocket.textDiffTool();
      }
      return;
    }

    // 5. PDF Line break fix intent ("quebras", "pdf", "frases")
    if (p.includes('pdf') || p.includes('quebras') || p.includes('unificar')) {
      if (window.smartDrop && window.smartDrop.currentData && window.smartDrop.currentData.text) {
        window.smartDrop.fixTextPdf(window.smartDrop.currentData.text);
      } else if (window.autoFixer) {
        const input = document.getElementById('autofix-input-text');
        if (input && input.value) {
          input.value = window.autoFixer.fixPdfBreaks(input.value);
          alert('📄 Intenção reconhecida: Quebras de linha de PDF unificadas!');
        } else {
          alert('👉 Cole o texto de PDF na entrada!');
        }
      }
      return;
    }

    // 6. JSON Beautify intent ("formatar json", "json", "beautify")
    if (p.includes('json') || p.includes('formatar')) {
      if (window.smartDrop && window.smartDrop.currentData && window.smartDrop.currentData.text) {
        window.smartDrop.beautifyJsonText(window.smartDrop.currentData.text);
      } else {
        alert('👉 Cole um JSON válido na caixa de texto!');
      }
      return;
    }

    // Default Fallback
    alert(`💡 Roteador de Intenção: Não reconheci um padrão exato para "${userPrompt}". Tente algo como "menos de 1 MB", "remover EXIF", "transformar em tabela" ou "formatar JSON".`);
  }

  compressToTarget(file, targetBytes) {
    if (!file.type.startsWith('image/')) {
      alert('⚠️ A compressão iterativa só funciona com imagens.');
      return;
    }
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = async () => {
      URL.revokeObjectURL(objectUrl);
      const MAX_ATTEMPTS = 8;
      let quality = 0.85;
      let width = img.width;
      let height = img.height;
      let resultBlob = null;
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));
        if (!blob) break;
        if (blob.size <= targetBytes) { resultBlob = blob; break; }
        if (quality > 0.4) {
          quality = Math.max(0.4, quality - 0.12);
        } else {
          width = Math.floor(width * 0.8);
          height = Math.floor(height * 0.8);
          if (width < 50 || height < 50) break;
        }
      }
      if (resultBlob && resultBlob.size <= targetBytes) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(resultBlob);
        a.download = 'comprimido_omnitreco.jpg';
        a.click();
        if (window.showToast) window.showToast(`✅ Arquivo abaixo de 1 MB! Tamanho final: ${(resultBlob.size / 1024).toFixed(1)} KB.`, 'success');
        else alert(`✅ Arquivo abaixo de 1 MB! Tamanho final: ${(resultBlob.size / 1024).toFixed(1)} KB.`);
      } else {
        const finalSize = resultBlob ? resultBlob.size : file.size;
        if (window.showToast) window.showToast(`⚠️ Não foi possível atingir menos de 1 MB sem comprometer a qualidade. Mínimo alcançado: ${(finalSize / 1024).toFixed(1)} KB.`, 'warning', true);
        else alert(`⚠️ Não foi possível atingir menos de 1 MB sem ultrapassar os limites de qualidade definidos. Mínimo alcançado: ${(finalSize / 1024).toFixed(1)} KB.`);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); alert('Erro ao carregar a imagem.'); };
    img.src = objectUrl;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.intentRouter = new IntentRouter();
});
