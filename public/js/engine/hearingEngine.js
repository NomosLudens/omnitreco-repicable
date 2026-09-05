// OmniTreco Hearing Engine - Sensory5 Final Microfix
class OmniHearingEngine {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.stream = null;
    this.isRecording = false;

    this.whisperPipeline = null;
    this.isModelLoaded = false;
    this.isDownloadingModel = false;
    this.modelName = 'Xenova/whisper-tiny';
    this.downloadedBytesActual = 0;
    this.TRANSFORMERS_CACHE_PRESENT = false;

    this.init();
  }

  init() {
    this._checkModelStorage();
  }

  // Consolidated WASM SIMD Feature Detector (wasm-feature-detect / TensorFlow.js standard)
  checkWasmSimd() {
    try {
      return WebAssembly.validate(new Uint8Array([
        0, 97, 115, 109, 1, 0, 0, 0,
        1, 4, 1, 96, 0, 0,
        3, 2, 1, 0,
        10, 9, 1, 7, 0, 65, 0, 253, 15, 26, 11
      ]));
    } catch (e) {
      return false;
    }
  }

  // Capability Gate Detection
  checkCapabilities() {
    const hasWasm = typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function';
    const hasAudioCtx = !!(window.AudioContext || window.webkitAudioContext);
    const hasWorker = typeof Worker !== 'undefined';
    const hasSimd = this.checkWasmSimd();

    return {
      supported: hasWasm && hasAudioCtx && hasWorker,
      hasWasm,
      hasAudioCtx,
      hasWorker,
      hasSimd
    };
  }

  // Check if transformers-cache storage exists
  async _checkModelStorage() {
    try {
      if ('caches' in window) {
        this.TRANSFORMERS_CACHE_PRESENT = await caches.has('transformers-cache');
        if (this.TRANSFORMERS_CACHE_PRESENT) this.isModelLoaded = true;
      }
    } catch (e) {
      console.warn('[HEARING] Cache storage check error:', e);
    }
  }

  // Remove local model assets from Cache Storage
  async removeLocalModel() {
    try {
      if ('caches' in window) {
        const deleted = await caches.delete('transformers-cache');
        if (deleted) {
          this.whisperPipeline = null;
          this.isModelLoaded = false;
          this.TRANSFORMERS_CACHE_PRESENT = false;
          if (window.showToast) window.showToast('🗑️ Modelo local removido do cache.', 'info');
          return true;
        }
      }
      return false;
    } catch (e) {
      console.error('[HEARING] Error removing model:', e);
      return false;
    }
  }

  // Download & Initialize Transformers.js WASM Pipeline
  async loadWhisperModel(onProgress) {
    const caps = this.checkCapabilities();
    if (!caps.supported) {
      return {
        success: false,
        error: 'WASM_UNSUPPORTED',
        message: 'Este dispositivo não suporta WebAssembly ou Web Audio necessários.'
      };
    }

    if (this.whisperPipeline) {
      return { success: true };
    }

    this.isDownloadingModel = true;
    const latestLoadedByFile = new Map();

    try {
      if (!window.transformers || !window.transformers.pipeline) {
        return {
          success: false,
          error: 'TRANSFORMERS_BUNDLE_ABSENT',
          message: 'O motor (transformers.min.js) não está carregado.'
        };
      }

      if (window.transformers.env) {
        window.transformers.env.allowRemoteModels = true;
        window.transformers.env.useBrowserCache = true;
      }

      if (onProgress) onProgress(5, 'Iniciando verificação do modelo Xenova/whisper-tiny...');

      this.whisperPipeline = await window.transformers.pipeline(
        'automatic-speech-recognition',
        this.modelName,
        {
          progress_callback: (p) => {
            if (p.status === 'progress' && p.file && p.loaded) {
              latestLoadedByFile.set(p.file, Math.max(latestLoadedByFile.get(p.file) || 0, p.loaded));

              let currentTotal = 0;
              for (const b of latestLoadedByFile.values()) currentTotal += b;

              const loadedMb = (currentTotal / (1024 * 1024)).toFixed(1);
              const pct = p.progress ? Math.round(p.progress) : 50;
              if (onProgress) onProgress(pct, `Baixando modelo local: ${loadedMb} MB (${pct}%)...`);
            }
          }
        }
      );

      let calculatedBytes = 0;
      for (const b of latestLoadedByFile.values()) calculatedBytes += b;

      this.downloadedBytesActual = calculatedBytes || 39120485;
      this.isModelLoaded = true;
      this.TRANSFORMERS_CACHE_PRESENT = true;
      this.isDownloadingModel = false;

      if (onProgress) onProgress(100, '✓ Ouvido instalado neste aparelho!');
      return { success: true, downloadedBytesActual: this.downloadedBytesActual };
    } catch (err) {
      console.error('[HEARING] WASM model load error:', err);
      this.isDownloadingModel = false;
      return {
        success: false,
        error: 'MODEL_LOAD_FAILED',
        message: err.message || 'Falha ao carregar modelo WASM local.'
      };
    }
  }

  // Extract 16kHz PCM Float32Array Waveform
  async extract16kPcm(file) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContextClass();
      const decoded = await audioCtx.decodeAudioData(arrayBuffer);
      audioCtx.close();

      const targetSampleRate = 16000;
      const offlineCtx = new OfflineAudioContext(
        1,
        Math.ceil(decoded.duration * targetSampleRate),
        targetSampleRate
      );

      const source = offlineCtx.createBufferSource();
      source.buffer = decoded;
      source.connect(offlineCtx.destination);
      source.start(0);

      const resampled = await offlineCtx.startRendering();
      const pcmFloat32 = resampled.getChannelData(0); // 16kHz mono Float32Array

      return {
        sampleRate: 16000,
        duration: decoded.duration,
        length: pcmFloat32.length,
        pcm: pcmFloat32
      };
    } catch (err) {
      console.error('[HEARING] 16k PCM extraction error:', err);
      return null;
    }
  }

  // Real Audio File Transcription via Transformers.js WASM
  async transcribeAudioFile(file, onProgress) {
    const caps = this.checkCapabilities();
    if (!caps.supported) {
      return {
        success: false,
        error: 'UNSUPPORTED_DEVICE',
        isMobileUnsupported: true,
        message: '🎙️ Este aparelho não é forte o bastante para ouvir localmente. Envie o áudio para o computador via Teleporte.'
      };
    }

    if (!this.whisperPipeline) {
      const loadRes = await this.loadWhisperModel(onProgress);
      if (!loadRes.success) return loadRes;
    }

    if (onProgress) onProgress(20, 'Decodificando áudio para PCM 16kHz mono...');

    const pcmData = await this.extract16kPcm(file);
    if (!pcmData || !pcmData.pcm || pcmData.pcm.length === 0) {
      return {
        success: false,
        error: 'AUDIO_DECODE_FAILED',
        message: 'Não foi possível decodificar PCM do áudio.'
      };
    }

    if (pcmData.duration > 120) {
      return {
        success: false,
        error: 'AUDIO_TOO_LONG',
        message: 'A versão inicial limita áudios a no máximo 2 minutos.'
      };
    }

    if (onProgress) onProgress(60, 'Executando inferência WASM local...');

    try {
      const result = await this.whisperPipeline(pcmData.pcm, {
        language: 'portuguese',
        task: 'transcribe'
      });

      const extractedText = result && result.text ? result.text.trim() : '';

      if (!extractedText) {
        return {
          success: false,
          error: 'NO_SPEECH_DETECTED',
          message: 'Nenhuma fala foi reconhecida.'
        };
      }

      if (onProgress) onProgress(100, 'Transcrição concluída!');

      return {
        success: true,
        text: extractedText,
        language: 'pt-BR',
        durationSec: pcmData.duration.toFixed(1),
        engine: 'Transformers.js 2.17.2 / ONNX Runtime Web'
      };
    } catch (err) {
      console.error('[HEARING] WASM transcription error:', err);
      return {
        success: false,
        error: 'INFERENCE_FAILED',
        message: 'Erro durante a inferência local.'
      };
    }
  }

  // Real Microphone Recording & WASM Transcription
  async startMicRecording(onChunk) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Acesso ao microfone não suportado neste navegador.');
      return false;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(this.stream);

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          this.audioChunks.push(e.data);
          if (onChunk) onChunk(e.data);
        }
      };

      this.mediaRecorder.start(250);
      this.isRecording = true;
      return true;
    } catch (err) {
      console.error('[HEARING] Mic access denied:', err);
      alert('Permissão de microfone negada ou indisponível.');
      return false;
    }
  }

  async stopMicRecording(onProgress) {
    if (!this.mediaRecorder || !this.isRecording) return null;

    return new Promise((resolve) => {
      this.mediaRecorder.onstop = async () => {
        this.isRecording = false;

        if (this.stream) {
          this.stream.getTracks().forEach(t => t.stop());
          this.stream = null;
        }

        if (this.audioChunks.length === 0) {
          resolve({ success: false, error: 'MIC_RECORDING_EMPTY', message: 'Nenhum áudio foi capturado.' });
          return;
        }

        const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
        const file = new File([blob], 'gravacao_microfone.webm', { type: 'audio/webm' });
        const result = await this.transcribeAudioFile(file, onProgress);
        resolve({ blob, file, result });
      };

      this.mediaRecorder.stop();
    });
  }
}

// Global Singleton Initialization
window.hearingEngine = new OmniHearingEngine();
