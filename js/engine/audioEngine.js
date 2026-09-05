// OmniAudioEngine - Dual Backend Audio Engine (HTMLAudio Element for UX + WebAudio for Analysis)
class OmniAudioEngine {
  constructor() {
    this.ctx = null;
    this.audioPool = new Map();
    this.assetList = [
      'tiny-violin',
      'womp',
      'dramatic',
      'laugh',
      'applause',
      'horn',
      'cricket',
      'boing',
      'siren',
      'beep',
      'winner'
    ];

    this._initAudioPool();
  }

  getBuildVersion() {
    return window.OMNITRECO_BUILD || '20260901-d0093e15-hotfix5';
  }

  getAssetUrl(name) {
    return `assets/audio/${name}.wav?v=${this.getBuildVersion()}`;
  }

  _initAudioPool() {
    this.assetList.forEach((name) => {
      try {
        const audio = new Audio(this.getAssetUrl(name));
        audio.preload = 'auto';
        audio.setAttribute('playsinline', 'true');
        audio.setAttribute('webkit-playsinline', 'true');
        this.audioPool.set(name, audio);
      } catch (err) {
        console.warn(`[AUDIO] Failed to initialize audio asset: ${name}`, err);
      }
    });
  }

  // Primary HTMLAudioElement Play Method (Direct synchronous invocation in gesture stack)
  playAsset(name) {
    let audio = this.audioPool.get(name);
    if (!audio) {
      audio = new Audio(this.getAssetUrl(name));
      audio.preload = 'auto';
      audio.setAttribute('playsinline', 'true');
      audio.setAttribute('webkit-playsinline', 'true');
      this.audioPool.set(name, audio);
    }

    try {
      audio.currentTime = 0;
      const playPromise = audio.play();

      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn(`[AUDIO] asset=${name} backend=media-element play=FAIL error=`, err);
          if (window.showToast) {
            window.showToast('🔇 O iPhone bloqueou o áudio. Toque novamente.', 'warning');
          }
        });
      }
    } catch (err) {
      console.warn(`[AUDIO] asset=${name} backend=media-element play=EXCEPT error=`, err);
    }
  }

  // --- COMPATIBILITY APIS ---
  playTinyViolin() {
    this.playAsset('tiny-violin');
  }

  playSound(type) {
    this.playAsset(type);
  }

  playBeep(freq = 440, duration = 0.1) {
    this.playAsset('beep');
  }

  playWinnerSound() {
    this.playAsset('winner');
  }

  // --- WEBAUDIO ANALYSER BACKEND (DecibelMeter / Microphone) ---
  getAudioContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    return this.ctx;
  }

  async ensureReady(silent = false) {
    const ctx = this.getAudioContext();
    if (!ctx) return false;
    if (ctx.state === 'suspended') {
      try { await ctx.resume(); } catch (e) {}
    }
    return ctx.state === 'running';
  }
}

// Global Singleton Initialization
window.audioEngine = new OmniAudioEngine();

// Globals compatibility
window.playBeep = (freq, duration) => window.audioEngine.playBeep(freq, duration);
window.playWinnerSound = () => window.audioEngine.playWinnerSound();
