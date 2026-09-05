class RecipePipeline {
  constructor() {
    this.operations = {
      'fix-pdf-breaks': {
        name: 'Unificar Quebras PDF',
        run: (input) => window.autoFixer ? window.autoFixer.fixPdfBreaks(input) : input
      },
      'remove-invisible': {
        name: 'Remover Caracteres Invisíveis',
        run: (input) => window.autoFixer ? window.autoFixer.fixInvisibleChars(input) : input
      },
      'remove-duplicates': {
        name: 'Remover Linhas Duplicadas',
        run: (input) => window.autoFixer ? window.autoFixer.fixDuplicates(input) : input
      },
      'sort-lines': {
        name: 'Ordenar Linhas Alfabeticamente',
        run: (input) => typeof input === 'string' ? input.split('\n').sort().join('\n') : input
      },
      'uppercase': {
        name: 'CONVERTER PARA MAIÚSCULAS',
        run: (input) => typeof input === 'string' ? input.toUpperCase() : input
      },
      'lowercase': {
        name: 'converter para minúsculas',
        run: (input) => typeof input === 'string' ? input.toLowerCase() : input
      },
      'to-base64': {
        name: 'Codificar em Base64',
        run: (input) => typeof input === 'string' ? btoa(unescape(encodeURIComponent(input))) : input
      },
      'from-base64': {
        name: 'Decodificar de Base64',
        run: (input) => typeof input === 'string' ? decodeURIComponent(escape(atob(input))) : input
      },
      'json-beautify': {
        name: 'Formatar JSON (Beautify)',
        run: (input) => {
          try {
            const obj = typeof input === 'string' ? JSON.parse(input) : input;
            return JSON.stringify(obj, null, 2);
          } catch(e) { return input; }
        }
      },
      'normalize-spaces': {
        name: 'Normalizar Espaços',
        run: (input) => window.autoFixer ? window.autoFixer.normalizeSpaces(input) : input.replace(/ {2,}/g, ' ')
      }
    };

    this.currentPipeline = [];
  }

  getOperationsList() {
    return Object.keys(this.operations).map(id => ({
      id,
      name: this.operations[id].name
    }));
  }

  execute(input) {
    let result = input;
    for (let opId of this.currentPipeline) {
      if (this.operations[opId]) {
        result = this.operations[opId].run(result);
      }
    }
    return result;
  }

  addStep(opId) {
    if (this.operations[opId]) {
      this.currentPipeline.push(opId);
    }
  }

  removeStep(index) {
    if (index >= 0 && index < this.currentPipeline.length) {
      this.currentPipeline.splice(index, 1);
    }
  }

  initUI() {
    const addSelect = document.getElementById('add-step-select');
    const runBtn = document.getElementById('run-recipe-btn');
    const inputEl = document.getElementById('recipe-input-text');
    const outputEl = document.getElementById('recipe-output-text');

    if (!addSelect && !runBtn) return;

    if (addSelect) {
      addSelect.addEventListener('change', () => {
        const val = addSelect.value;
        if (!val) return;
        this.addStep(val);
        addSelect.value = '';
        this.renderPipeline();
      });
    }

    if (runBtn) {
      runBtn.addEventListener('click', () => {
        const input = inputEl ? inputEl.value : '';
        if (!input.trim()) { alert('Cole um texto de entrada primeiro!'); return; }
        if (this.currentPipeline.length === 0) { alert('Adicione pelo menos uma operação ao pipeline!'); return; }
        const result = this.execute(input);
        if (outputEl) outputEl.value = result;
      });
    }

    this.renderPipeline();
  }

  renderPipeline() {
    const listEl = document.getElementById('pipeline-steps-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (this.currentPipeline.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'pipeline-step-item';
      empty.style.opacity = '0.5';
      empty.style.fontStyle = 'italic';
      const span = document.createElement('span');
      span.textContent = 'Nenhuma operação. Adicione usando o menu acima.';
      empty.appendChild(span);
      listEl.appendChild(empty);
      return;
    }

    this.currentPipeline.forEach((opId, index) => {
      const item = document.createElement('div');
      item.className = 'pipeline-step-item';

      const stepNum = document.createElement('span');
      stepNum.className = 'step-num';
      stepNum.textContent = `${index + 1}. `;

      const nameSpan = document.createElement('span');
      nameSpan.textContent = this.operations[opId] ? this.operations[opId].name : opId;

      const removeBtn = document.createElement('button');
      removeBtn.className = 'btn btn-secondary btn-sm';
      removeBtn.style.padding = '4px 10px';
      removeBtn.style.fontSize = '0.75rem';
      removeBtn.textContent = '✕ Remover';
      removeBtn.onclick = () => {
        this.removeStep(index);
        this.renderPipeline();
      };

      item.appendChild(stepNum);
      item.appendChild(nameSpan);
      item.appendChild(removeBtn);
      listEl.appendChild(item);
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.recipePipeline = new RecipePipeline();
  window.recipePipeline.initUI();
});
