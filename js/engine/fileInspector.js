class FileInspector {
  constructor() {}

  async inspectFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const magicBytesHex = this.getHexSignature(bytes, 8);
    const detectedType = this.detectMagicType(bytes);
    const extension = file.name.split('.').pop().toLowerCase();

    // Hashes
    const sha256 = await this.calculateHash('SHA-256', arrayBuffer);
    const sha1 = await this.calculateHash('SHA-1', arrayBuffer);
    const md5 = this.calculateMD5(bytes);

    // Mismatch check
    const mismatch = this.checkMismatch(extension, detectedType);

    // Metadata extraction
    let metadata = {};
    if (detectedType.category === 'image') {
      metadata = await this.extractImageMetadata(file, bytes);
    } else if (detectedType.category === 'pdf') {
      metadata = this.extractPdfMetadata(bytes);
    } else if (detectedType.category === 'text') {
      metadata = this.extractTextMetadata(bytes);
    }

    return {
      name: file.name,
      size: file.size,
      sizeFormatted: this.formatBytes(file.size),
      mimeType: file.type || detectedType.mime,
      detectedType: detectedType.name,
      extension: extension,
      magicHex: magicBytesHex,
      sha256,
      sha1,
      md5,
      mismatch,
      metadata,
      lastModified: new Date(file.lastModified).toLocaleString('pt-BR'),
      rawBytes: bytes,
      rawBuffer: arrayBuffer
    };
  }

  getHexSignature(bytes, length = 8) {
    return Array.from(bytes.slice(0, length))
      .map(b => b.toString(16).padStart(2, '0').toUpperCase())
      .join(' ');
  }

  detectMagicType(bytes) {
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
      return { name: 'PNG Image', mime: 'image/png', category: 'image', ext: 'png' };
    }
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
      return { name: 'JPEG Image', mime: 'image/jpeg', category: 'image', ext: 'jpg' };
    }
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
      return { name: 'PDF Document', mime: 'application/pdf', category: 'pdf', ext: 'pdf' };
    }
    if (bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04) {
      return { name: 'ZIP / Office OpenXML Document', mime: 'application/zip', category: 'archive', ext: 'zip' };
    }
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
      return { name: 'GIF Image', mime: 'image/gif', category: 'image', ext: 'gif' };
    }
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
      return { name: 'RIFF (WEBP / WAV / AVI)', mime: 'image/webp', category: 'image', ext: 'webp' };
    }
    if (bytes[0] === 0x7B || bytes[0] === 0x5B) {
      return { name: 'JSON / Text Document', mime: 'application/json', category: 'text', ext: 'json' };
    }

    return { name: 'Arquivo Genérico / Binário', mime: 'application/octet-stream', category: 'binary', ext: '' };
  }

  checkMismatch(extension, detectedType) {
    if (!detectedType.ext) return null;
    const ext = extension.toLowerCase();
    if (detectedType.category === 'archive' && (ext === 'pdf' || ext === 'docx' || ext === 'xlsx')) {
      if (ext === 'pdf') {
        return `🚨 PERIGO DE SEGURANÇA: O arquivo é chamado .pdf mas internamente é um arquivo ZIP de arquivos (possível payload)!`;
      }
    }
    if (detectedType.ext && ext !== detectedType.ext && ext !== 'jpeg' && ext !== 'txt') {
      return `⚠️ INCOMPATIBILIDADE DE EXTENSÃO: O nome tem extensão .${ext}, mas os Magic Bytes indicam ${detectedType.name} (.${detectedType.ext}).`;
    }
    return null;
  }

  async calculateHash(algorithm, arrayBuffer) {
    const hashBuffer = await crypto.subtle.digest(algorithm, arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  calculateMD5(bytes) {
    // Quick JS MD5 hash calculation for local file integrity
    function md5cycle(x, k) {
      var a = x[0], b = x[1], c = x[2], d = x[3];
      a = ff(a, b, c, d, k[0], 7, -680876936); d = ff(d, a, b, c, k[1], 12, -389564586);
      c = ff(c, d, a, b, k[2], 17, 606105819); b = ff(b, c, d, a, k[3], 22, -1044525330);
      a = ff(a, b, c, d, k[4], 7, -176418897); d = ff(d, a, b, c, k[5], 12, 1200080426);
      c = ff(c, d, a, b, k[6], 17, -1473231341); b = ff(b, c, d, a, k[7], 22, -45705983);
      a = ff(a, b, c, d, k[8], 7, 1770035416); d = ff(d, a, b, c, k[9], 12, -1958414417);
      c = ff(c, d, a, b, k[10], 17, -42063); b = ff(b, c, d, a, k[11], 22, -1990404162);
      a = ff(a, b, c, d, k[12], 7, 1804603682); d = ff(d, a, b, c, k[13], 12, -40341101);
      c = ff(c, d, a, b, k[14], 17, -1502002290); b = ff(b, c, d, a, k[15], 22, 1236535329);
      a = gg(a, b, c, d, k[1], 5, -165796510); d = gg(d, a, b, c, k[6], 9, -1069501632);
      c = gg(c, d, a, b, k[11], 14, 643717713); b = gg(b, c, d, a, k[0], 20, -373897302);
      a = gg(a, b, c, d, k[5], 5, -701558691); d = gg(d, a, b, c, k[10], 9, 38016083);
      c = gg(c, d, a, b, k[15], 14, -660478335); b = gg(b, c, d, a, k[4], 20, -405537848);
      a = gg(a, b, c, d, k[9], 5, 568446438); d = gg(d, a, b, c, k[14], 9, -1019803690);
      c = gg(c, d, a, b, k[3], 14, -187363961); b = gg(b, c, d, a, k[8], 20, 1163531501);
      a = gg(a, b, c, d, k[13], 5, -1444680596); d = gg(d, a, b, c, k[2], 9, -51403784);
      c = gg(c, d, a, b, k[7], 14, 1735328473); b = gg(b, c, d, a, k[12], 20, -1926607734);
      a = hh(a, b, c, d, k[5], 4, -378558); d = hh(d, a, b, c, k[8], 11, -2022574463);
      c = hh(c, d, a, b, k[11], 16, 1839030562); b = hh(b, c, d, a, k[14], 23, -35309556);
      a = hh(a, b, c, d, k[1], 4, -1530992060); d = hh(d, a, b, c, k[4], 11, 1272893353);
      c = hh(c, d, a, b, k[7], 16, -155497632); b = hh(b, c, d, a, k[10], 23, -1094730640);
      a = hh(a, b, c, d, k[13], 4, 681279174); d = hh(d, a, b, c, k[0], 11, -358537222);
      c = hh(c, d, a, b, k[3], 16, -722521979); b = hh(b, c, d, a, k[6], 23, 76029189);
      a = hh(a, b, c, d, k[9], 4, -640364409); d = hh(d, a, b, c, k[12], 11, -321184037);
      c = hh(c, d, a, b, k[15], 16, 1826575687); b = hh(b, c, d, a, k[2], 23, -35309556);
      a = ii(a, b, c, d, k[0], 6, -198630844); d = ii(d, a, b, c, k[7], 10, 1126891415);
      c = ii(c, d, a, b, k[14], 15, -1416354905); b = ii(b, c, d, a, k[5], 21, -57434055);
      a = ii(a, b, c, d, k[12], 6, 1700485571); d = ii(d, a, b, c, k[3], 10, -1894980106);
      c = ii(c, d, a, b, k[10], 15, -1051523); b = ii(b, c, d, a, k[1], 21, -2054922799);
      a = ii(a, b, c, d, k[8], 6, 1873313359); d = ii(d, a, b, c, k[15], 10, -30611744);
      c = ii(c, d, a, b, k[6], 15, -1560198380); b = ii(b, c, d, a, k[13], 21, 1309151649);
      a = ii(a, b, c, d, k[4], 6, -145523070); d = ii(d, a, b, c, k[11], 10, -1120210379);
      c = ii(c, d, a, b, k[2], 15, 718787259); b = ii(b, c, d, a, k[9], 21, -343485551);
      x[0] = add32(a, x[0]); x[1] = add32(b, x[1]); x[2] = add32(c, x[2]); x[3] = add32(d, x[3]);
    }
    function cmn(q, a, b, x, s, t) { a = add32(add32(a, q), add32(x, t)); return add32((a << s) | (a >>> (32 - s)), b); }
    function ff(a, b, c, d, x, s, t) { return cmn((b & c) | ((~b) & d), a, b, x, s, t); }
    function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & (~d)), a, b, x, s, t); }
    function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
    function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | (~d)), a, b, x, s, t); }
    function add32(a, b) { return (a + b) & 0xFFFFFFFF; }

    var n = bytes.length, state = [1732584193, -271733879, -1732584194, 271733878], i;
    for (i = 64; i <= n; i += 64) {
      var block = [];
      for (var j = 0; j < 64; j += 4) {
        block.push(bytes[i - 64 + j] | (bytes[i - 64 + j + 1] << 8) | (bytes[i - 64 + j + 2] << 16) | (bytes[i - 64 + j + 3] << 24));
      }
      md5cycle(state, block);
    }
    var tail = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], left = n % 64;
    for (i = 0; i < left; i++) tail[i >> 2] |= bytes[n - left + i] << ((i % 4) * 8);
    tail[left >> 2] |= 0x80 << ((left % 4) * 8);
    if (left > 55) {
      md5cycle(state, tail);
      for (i = 0; i < 16; i++) tail[i] = 0;
    }
    tail[14] = n * 8;
    md5cycle(state, tail);

    var hex = "";
    for (i = 0; i < 4; i++) {
      for (var k = 0; k < 4; k++) {
        hex += ((state[i] >> (k * 8)) & 0xFF).toString(16).padStart(2, '0');
      }
    }
    return hex;
  }

  async extractImageMetadata(file, bytes) {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const dimensions = `${img.width} x ${img.height} px`;
        const hasExif = bytes[2] === 0xFF && bytes[3] === 0xE1;
        URL.revokeObjectURL(url);
        resolve({
          dimensions,
          width: img.width,
          height: img.height,
          aspectRatio: (img.width / img.height).toFixed(2),
          hasExif: hasExif ? 'Sim (Detectado Marker APP1)' : 'Não detectado / Sanitizado'
        });
      };
      img.onerror = () => resolve({ dimensions: 'Desconhecido' });
      img.src = url;
    });
  }

  extractPdfMetadata(bytes) {
    const text = new TextDecoder('latin1').decode(bytes.slice(0, 4096));
    const versionMatch = text.match(/%PDF-(\d+\.\d+)/);
    const pagesMatch = text.match(/\/Count\s+(\d+)/);

    return {
      pdfVersion: versionMatch ? versionMatch[1] : '1.4 (Padrão)',
      estimatedPages: pagesMatch ? pagesMatch[1] : 'Desconhecido'
    };
  }

  extractTextMetadata(bytes) {
    const text = new TextDecoder().decode(bytes);
    const lines = text.split('\n').length;
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    const chars = text.length;

    return { lines, words, chars };
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  sanitizeImageExif(bytes) {
    // Strip EXIF APP1 (0xFF 0xE1) marker from JPEG bytes
    if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) return bytes;

    let offset = 2;
    const result = [0xFF, 0xD8];

    while (offset < bytes.length) {
      if (bytes[offset] === 0xFF && bytes[offset + 1] === 0xE1) {
        // Skip EXIF marker block
        const length = (bytes[offset + 2] << 8) + bytes[offset + 3];
        offset += length + 2;
      } else {
        result.push(bytes[offset]);
        offset++;
      }
    }
    return new Uint8Array(result);
  }

  generateCertificate(inspectionData) {
    return `=====================================================
📜 FICHA DE CUSTÓDIA E IDENTIDADE DIGITAL (SHA-256)
=====================================================

NOME DO ARQUIVO   : ${inspectionData.name}
TAMANHO DO ARQUIVO: ${inspectionData.sizeFormatted} (${inspectionData.size} bytes)
TIPO DETECTADO    : ${inspectionData.detectedType}
MAGIC BYTES (HEX) : ${inspectionData.magicHex}
DATA DE MODIFICAÇÃO: ${inspectionData.lastModified}

-----------------------------------------------------
🔒 HASHES CRIPTOGRÁFICOS DE INTEGRIDADE
-----------------------------------------------------
SHA-256 : ${inspectionData.sha256}
SHA-1   : ${inspectionData.sha1}
MD5     : ${inspectionData.md5}

-----------------------------------------------------
Gerado via OmniTreco (Local-First In-Browser Engine)
Data do Certificado: ${new Date().toLocaleString('pt-BR')}
=====================================================`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.fileInspector = new FileInspector();
});
