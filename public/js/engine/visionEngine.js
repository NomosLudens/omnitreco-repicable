// OmniTreco Vision Engine - Real Client-Side OCR (Tesseract.js) & QR / Barcode (jsQR)
class OmniVisionEngine {
  constructor() {
    this.tesseractWorker = null;
    this.init();
  }

  init() {
    this.hasNativeBarcode = 'BarcodeDetector' in window;
  }

  // Real QR Code & Barcode Scanner
  async scanCodesFromImage(imageFileOrCanvas) {
    let imageEl;
    try {
      if (imageFileOrCanvas instanceof HTMLCanvasElement || imageFileOrCanvas instanceof HTMLImageElement) {
        imageEl = imageFileOrCanvas;
      } else {
        imageEl = await this._fileToImage(imageFileOrCanvas);
      }
    } catch (e) {
      return { success: false, found: false, error: 'IMAGE_LOAD_FAILED' };
    }

    // Fast Path 1: Native BarcodeDetector if supported by browser
    if (this.hasNativeBarcode) {
      try {
        const detector = new window.BarcodeDetector({
          formats: ['qr_code', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39']
        });
        const barcodes = await detector.detect(imageEl);
        if (barcodes && barcodes.length > 0) {
          const b = barcodes[0];
          const isQr = b.format === 'qr_code';
          return {
            success: true,
            found: true,
            type: isQr ? 'QR' : 'BARCODE',
            format: isQr ? 'QR_CODE' : b.format.toUpperCase(),
            rawValue: b.rawValue,
            isUrl: /^https?:\/\//i.test(b.rawValue.trim())
          };
        }
      } catch (err) {
        console.warn('[VISION] Native BarcodeDetector error, attempting jsQR fallback:', err);
      }
    }

    // Fallback 2: Real jsQR Canvas Reader (STRICTLY FOR QR CODES ONLY)
    return this._scanQrJsQR(imageEl);
  }

  _scanQrJsQR(imageEl) {
    const canvas = document.createElement('canvas');
    const width = imageEl.naturalWidth || imageEl.width || 600;
    const height = imageEl.naturalHeight || imageEl.height || 600;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imageEl, 0, 0, width, height);

    if (window.jsQR) {
      try {
        const imageData = ctx.getImageData(0, 0, width, height);
        const code = window.jsQR(imageData.data, imageData.width, imageData.height);
        if (code && code.data && code.data.trim()) {
          // ALWAYS return type = 'QR' and format = 'QR_CODE' for jsQR results
          return {
            success: true,
            found: true,
            type: 'QR',
            format: 'QR_CODE',
            rawValue: code.data,
            isUrl: /^https?:\/\//i.test(code.data.trim())
          };
        }
      } catch (e) {
        console.warn('[VISION] jsQR error:', e);
      }
    }

    return {
      success: false,
      found: false,
      error: 'BARCODE_NOT_FOUND',
      nativeBarcodeSupported: this.hasNativeBarcode
    };
  }

  // Real Tesseract.js Client-Side OCR
  async readTextFromImage(imageFile, onProgress, lang = 'por') {
    if (!window.Tesseract) {
      return {
        success: false,
        error: 'OCR_ENGINE_UNAVAILABLE',
        message: 'O motor de OCR (tesseract.min.js) não está carregado.'
      };
    }

    try {
      if (onProgress) onProgress(10, 'Iniciando Tesseract worker local...');

      const worker = await window.Tesseract.createWorker(lang, 1, {
        logger: (m) => {
          if (m.status === 'recognizing text' && onProgress) {
            const pct = Math.round((m.progress || 0) * 100);
            onProgress(pct, `Reconhecendo caracteres (${pct}%)...`);
          }
        }
      });

      if (onProgress) onProgress(40, 'Processando matriz da imagem...');
      const ret = await worker.recognize(imageFile);
      await worker.terminate();

      const extractedText = ret && ret.data && ret.data.text ? ret.data.text.trim() : '';

      if (!extractedText) {
        return {
          success: false,
          error: 'NO_TEXT_FOUND',
          message: 'Nenhum texto legível foi detectado na imagem.'
        };
      }

      if (onProgress) onProgress(100, 'Leitura concluída!');

      return {
        success: true,
        text: extractedText,
        confidence: ret.data.confidence || 0
      };
    } catch (err) {
      console.error('[VISION] Tesseract OCR error:', err);
      return {
        success: false,
        error: 'OCR_PROCESSING_FAILED',
        message: err.message || 'Erro no processamento local de OCR.'
      };
    }
  }

  _fileToImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = (e) => {
        URL.revokeObjectURL(url);
        reject(e);
      };
      img.src = url;
    });
  }
}

// Global Singleton Initialization
window.visionEngine = new OmniVisionEngine();
