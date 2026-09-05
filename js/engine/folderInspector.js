class FolderInspector {
  constructor() {
    this.selectFolderBtn = document.getElementById('select-folder-btn');
    this.folderInputFallback = document.getElementById('folder-input-fallback');
    this.resultsContainer = document.getElementById('folder-results-container');
    this.snapshotBtn = document.getElementById('create-snapshot-btn');
    this.compareBtn = document.getElementById('compare-snapshot-btn');

    this.currentManifest = null;
    this.currentFolderName = '';

    this.init();
  }

  init() {
    if (this.selectFolderBtn) {
      this.selectFolderBtn.addEventListener('click', () => this.pickFolder());
    }

    if (this.folderInputFallback) {
      this.folderInputFallback.addEventListener('change', (e) => this.handleFolderInput(e));
    }

    if (this.snapshotBtn) {
      this.snapshotBtn.addEventListener('click', () => this.saveSnapshot());
    }

    if (this.compareBtn) {
      this.compareBtn.addEventListener('click', () => this.compareSnapshot());
    }
  }

  async pickFolder() {
    if ('showDirectoryPicker' in window) {
      try {
        const dirHandle = await window.showDirectoryPicker();
        this.currentFolderName = dirHandle.name;
        const files = await this.scanDirectoryHandle(dirHandle);
        await this.processFilesList(files);
      } catch (err) {
        if (err.name !== 'AbortError') alert('Erro ao acessar a pasta.');
      }
    } else if (this.folderInputFallback) {
      this.folderInputFallback.click();
    }
  }

  async handleFolderInput(e) {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      const pathParts = files[0].webkitRelativePath.split('/');
      this.currentFolderName = pathParts[0] || 'Minha Pasta';
      await this.processFilesList(files);
    }
  }

  async scanDirectoryHandle(dirHandle, path = '') {
    const files = [];
    for await (const entry of dirHandle.values()) {
      const entryPath = path ? `${path}/${entry.name}` : entry.name;
      if (entry.kind === 'file') {
        const file = await entry.getFile();
        Object.defineProperty(file, 'relativePath', { value: entryPath, writable: false });
        files.push(file);
      } else if (entry.kind === 'directory') {
        const subFiles = await this.scanDirectoryHandle(entry, entryPath);
        files.push(...subFiles);
      }
    }
    return files;
  }

  async processFilesList(files) {
    if (window.triggerHaptic) window.triggerHaptic(50);

    const fileMap = new Map();
    const categories = { video: 0, image: 0, pdf: 0, text: 0, archive: 0, other: 0 };
    let totalSize = 0;

    // Step 1: Build basic info, group candidates by exact size
    const sizeGroups = new Map();
    for (const file of files) {
      totalSize += file.size;
      const relPath = file.relativePath || file.webkitRelativePath || file.name;
      const ext = file.name.split('.').pop().toLowerCase();
      categories[this.getCategoryByExt(ext)] += file.size;

      const fileInfo = {
        name: file.name,
        path: relPath,
        size: file.size,
        sizeFormatted: window.fileInspector ? window.fileInspector.formatBytes(file.size) : `${file.size} B`,
        lastModified: file.lastModified,
        ext,
        sha256Full: null,
        _file: file
      };
      fileMap.set(relPath, fileInfo);
      if (!sizeGroups.has(file.size)) sizeGroups.set(file.size, []);
      sizeGroups.get(file.size).push(fileInfo);
    }

    // Step 2: Full SHA-256 only for files sharing the same size
    const duplicatesGroup = [];
    for (const [, group] of sizeGroups) {
      if (group.length < 2) { group.forEach(f => { if (f._file) delete f._file; }); continue; }

      for (const info of group) {
        if (info._file && window.fileInspector) {
          const buf = await info._file.arrayBuffer();
          info.sha256Full = await window.fileInspector.calculateHash('SHA-256', buf);
        }
        delete info._file;
      }

      const hashBuckets = new Map();
      for (const info of group) {
        const hashKey = info.sha256Full || `${info.size}_${info.lastModified}`;
        if (!hashBuckets.has(hashKey)) hashBuckets.set(hashKey, []);
        hashBuckets.get(hashKey).push(info);
      }
      for (const [, bucket] of hashBuckets) {
        if (bucket.length > 1) duplicatesGroup.push(bucket);
      }
    }

    // Clean remaining refs
    for (const info of fileMap.values()) { if (info._file) delete info._file; }

    const duplicateSize = duplicatesGroup.reduce((acc, group) =>
      acc + group.slice(1).reduce((s, f) => s + f.size, 0), 0);

    const fmtBytes = (b) => window.fileInspector ? window.fileInspector.formatBytes(b) : `${b} B`;

    this.currentManifest = {
      folderName: this.currentFolderName,
      scanTime: Date.now(),
      totalFiles: files.length,
      totalSize,
      totalSizeFormatted: fmtBytes(totalSize),
      duplicateSize,
      duplicateSizeFormatted: fmtBytes(duplicateSize),
      categories,
      fileMap: Object.fromEntries(fileMap),
      duplicatesGroup
    };

    this.renderFolderDashboard();
  }

  getCategoryByExt(ext) {
    if (['mp4', 'mkv', 'avi', 'mov', 'webm'].includes(ext)) return 'video';
    if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) return 'image';
    if (['pdf'].includes(ext)) return 'pdf';
    if (['txt', 'md', 'json', 'csv', 'js', 'html', 'css'].includes(ext)) return 'text';
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive';
    return 'other';
  }

  renderFolderDashboard() {
    if (!this.resultsContainer || !this.currentManifest) return;
    const m = this.currentManifest;
    this.resultsContainer.innerHTML = '';
    this.resultsContainer.classList.remove('hidden');

    const card = document.createElement('div');
    card.className = 'folder-dashboard-card';

    const headerDiv = document.createElement('div');
    headerDiv.className = 'folder-header-info';
    const h3 = document.createElement('h3');
    h3.textContent = '📁 Pasta: ';
    const highlight = document.createElement('span');
    highlight.className = 'highlight';
    highlight.textContent = m.folderName;
    h3.appendChild(highlight);
    const infoPara = document.createElement('p');
    infoPara.textContent = `${m.totalFiles} arquivos • ${m.totalSizeFormatted} total`;
    headerDiv.appendChild(h3);
    headerDiv.appendChild(infoPara);
    card.appendChild(headerDiv);

    const fmtBytes = (b) => window.fileInspector ? window.fileInspector.formatBytes(b) : `${b} B`;

    const breakdownSection = document.createElement('div');
    breakdownSection.className = 'storage-breakdown-section';
    const bh4 = document.createElement('h4');
    bh4.textContent = '📊 Armazenamento & Categorias:';
    breakdownSection.appendChild(bh4);
    const barsDiv = document.createElement('div');
    barsDiv.className = 'breakdown-bars';
    [['Vídeos', m.categories.video], ['Imagens', m.categories.image],
     ['PDFs', m.categories.pdf], ['Duplicatas confirmadas', m.duplicateSize]].forEach(([label, size]) => {
      const barItem = document.createElement('div');
      barItem.className = 'bar-item';
      const sp = document.createElement('span');
      sp.textContent = `${label}: ${fmtBytes(size)}`;
      if (label === 'Duplicatas confirmadas') sp.style.color = 'var(--neon-pink)';
      barItem.appendChild(sp);
      barsDiv.appendChild(barItem);
    });
    breakdownSection.appendChild(barsDiv);
    card.appendChild(breakdownSection);

    const dupAlert = document.createElement('div');
    dupAlert.className = 'duplicates-alert-card';
    const dh4 = document.createElement('h4');
    dh4.textContent = '🔍 Diagnóstico de Conteúdo:';
    dupAlert.appendChild(dh4);
    const dupSummary = document.createElement('p');
    dupSummary.textContent = `Encontrados ${m.duplicatesGroup.length} grupos de arquivos idênticos por SHA-256 completo (${m.duplicateSizeFormatted} economizáveis).`;
    dupAlert.appendChild(dupSummary);

    if (m.duplicatesGroup.length > 0) {
      const dupList = document.createElement('div');
      dupList.className = 'duplicates-list';
      m.duplicatesGroup.forEach(group => {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'dup-group';
        const strong = document.createElement('strong');
        strong.textContent = 'Arquivos idênticos (SHA-256 completo confirmado):';
        groupDiv.appendChild(strong);
        const ul = document.createElement('ul');
        group.forEach(f => {
          const li = document.createElement('li');
          li.textContent = `📄 ${f.path} (${f.sizeFormatted})`;
          ul.appendChild(li);
        });
        groupDiv.appendChild(ul);
        dupList.appendChild(groupDiv);
      });
      dupAlert.appendChild(dupList);
    }
    card.appendChild(dupAlert);

    this.resultsContainer.appendChild(card);
    if (this.snapshotBtn) this.snapshotBtn.style.display = 'inline-flex';
    if (this.compareBtn) this.compareBtn.style.display = 'inline-flex';
  }

  saveSnapshot() {
    if (!this.currentManifest) return;
    const key = `omni_snapshot_${this.currentFolderName}`;
    localStorage.setItem(key, JSON.stringify(this.currentManifest));
    alert(`⏳ SNAPSHOT DE ESTADO SALVO para "${this.currentFolderName}"!`);
    if (window.triggerHaptic) window.triggerHaptic(60);
  }

  compareSnapshot() {
    if (!this.currentManifest) return;
    const key = `omni_snapshot_${this.currentFolderName}`;
    const saved = localStorage.getItem(key);
    if (!saved) {
      alert(`Nenhum snapshot prévio encontrado para "${this.currentFolderName}". Salve um snapshot primeiro!`);
      return;
    }

    const prev = JSON.parse(saved);
    const currFiles = this.currentManifest.fileMap;
    const prevFiles = prev.fileMap;

    let added = 0, removed = 0, modified = 0, unchanged = 0;

    const getFileSig = (f) => f ? (f.sha256Full || `${f.size}_${f.lastModified}`) : '';

    for (let path in currFiles) {
      if (!prevFiles[path]) {
        added++;
      } else if (getFileSig(prevFiles[path]) !== getFileSig(currFiles[path])) {
        modified++;
      } else {
        unchanged++;
      }
    }

    for (let path in prevFiles) {
      if (!currFiles[path]) {
        removed++;
      }
    }

    alert(`⏳ SNAPSHOT COMPARADO:

Diferenças desde o Snapshot (${new Date(prev.scanTime).toLocaleString('pt-BR')}):
• 🆕 Novos arquivos: ${added}
• ✏️ Modificados: ${modified}
• ❌ Removidos: ${removed}
• 🔒 Inalterados: ${unchanged}`);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.folderInspector = new FolderInspector();
});
