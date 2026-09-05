// OmniTreco Speech Engine - Strictly Local Text-to-Speech (voice.localService === true)
class OmniSpeechEngine {
  constructor() {
    this.synth = window.speechSynthesis || null;
    this.currentUtterance = null;
    this.isSpeaking = false;
    this.selectedVoice = null;
    this.hasLocalVoice = false;

    this.init();
  }

  init() {
    if (!this.synth) return;

    this._loadVoices();
    if (typeof this.synth.addEventListener === 'function') {
      this.synth.addEventListener('voiceschanged', () => this._loadVoices());
    } else if ('onvoiceschanged' in this.synth) {
      this.synth.onvoiceschanged = () => this._loadVoices();
    }
  }

  _loadVoices() {
    if (!this.synth) return;
    const voices = this.synth.getVoices() || [];

    // Strictly filter voices with voice.localService === true EXCLUSIVELY
    const localVoices = voices.filter(v => v.localService === true);

    if (localVoices.length > 0) {
      this.hasLocalVoice = true;
      // Prefer Portuguese local voice (pt-BR or pt)
      this.selectedVoice = localVoices.find(v => v.lang === 'pt-BR') ||
                          localVoices.find(v => v.lang.startsWith('pt')) ||
                          localVoices[0];
    } else {
      this.selectedVoice = null;
      this.hasLocalVoice = false;
    }
  }

  isSupported() {
    return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  }

  speak(text, options = {}) {
    if (!this.isSupported() || !text || !text.trim()) {
      if (options.onError) options.onError({ error: 'UNSUPPORTED_BROWSER' });
      return { success: false, error: 'UNSUPPORTED_BROWSER', message: 'Leitura em voz alta não suportada neste navegador.' };
    }

    this._loadVoices();

    if (!this.hasLocalVoice || !this.selectedVoice) {
      const errMsg = 'Voz local não disponível neste aparelho.';
      if (window.showToast) window.showToast(`⚠️ ${errMsg}`, 'warning');
      if (options.onError) options.onError({ error: 'LOCAL_VOICE_UNAVAILABLE' });
      return { success: false, error: 'LOCAL_VOICE_UNAVAILABLE', message: errMsg };
    }

    // Stop any ongoing speech
    this.stop();

    const utterance = new SpeechSynthesisUtterance(text.trim());
    utterance.voice = this.selectedVoice;
    utterance.lang = this.selectedVoice.lang || 'pt-BR';
    utterance.rate = options.rate || 1.0;
    utterance.pitch = options.pitch || 1.0;

    utterance.onstart = () => {
      this.isSpeaking = true;
      if (options.onStart) options.onStart();
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      this.currentUtterance = null;
      if (options.onEnd) options.onEnd();
    };

    utterance.onerror = (err) => {
      console.warn('[SPEECH] Local Utterance error:', err);
      this.isSpeaking = false;
      this.currentUtterance = null;
      if (options.onError) options.onError(err);
    };

    this.currentUtterance = utterance;
    this.synth.speak(utterance);
    return { success: true, voiceName: this.selectedVoice.name };
  }

  stop() {
    if (this.synth) {
      this.synth.cancel();
    }
    this.isSpeaking = false;
    this.currentUtterance = null;
  }
}

// Global Singleton Initialization
window.speechEngine = new OmniSpeechEngine();
