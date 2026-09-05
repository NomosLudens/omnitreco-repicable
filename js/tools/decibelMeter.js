class DecibelMeter {
  constructor() {
    this.startBtn = document.getElementById('start-db-btn');
    this.dbNumber = document.getElementById('db-value');
    this.dbCircle = document.getElementById('db-circle');
    this.statusMsg = document.getElementById('db-status-msg');
    this.limitSlider = document.getElementById('db-limit-slider');
    this.limitDisplay = document.getElementById('db-limit-display');

    this.audioContext = null;
    this.analyser = null;
    this.microphone = null;
    this.isMonitoring = false;
    this.threshold = -20;
    this.calibrationOffset = null;

    this.init();
  }

  init() {
    if (!this.startBtn || !this.limitSlider) return;

    this.limitSlider.min = "-60";
    this.limitSlider.max = "-5";
    this.limitSlider.value = "-20";
    this.threshold = -20;
    if (this.limitDisplay) this.limitDisplay.textContent = `${this.threshold} dBFS`;

    this.limitSlider.addEventListener('input', () => {
      this.threshold = parseInt(this.limitSlider.value, 10);
      if (this.limitDisplay) this.limitDisplay.textContent = `${this.threshold} dBFS`;
    });

    this.startBtn.addEventListener('click', () => {
      if (!this.isMonitoring) {
        this.startMonitoring();
      } else {
        this.stopMonitoring();
      }
    });
  }

  async startMonitoring() {
    try {
      const audioOptions = {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      };
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: audioOptions });
      } catch {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.microphone = this.audioContext.createMediaStreamSource(this.stream);

      this.analyser.fftSize = 512;
      this.microphone.connect(this.analyser);

      this.isMonitoring = true;
      this.startBtn.textContent = 'Parar Monitoramento';
      this.startBtn.classList.remove('btn-primary');
      this.startBtn.classList.add('btn-secondary');
      if (this.statusMsg) this.statusMsg.textContent = 'Monitorando barulho em tempo real...';

      this.updateLoop();
    } catch (err) {
      alert('Não foi possível acessar o microfone para medir decibéis.');
    }
  }

  stopMonitoring() {
    this.isMonitoring = false;
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.startBtn) {
      this.startBtn.textContent = 'Ativar Monitor de Barulho';
      this.startBtn.classList.remove('btn-secondary');
      this.startBtn.classList.add('btn-primary');
    }
    if (this.dbNumber) this.dbNumber.textContent = '--';
    if (this.statusMsg) this.statusMsg.textContent = 'Microfone desligado';
    if (this.dbCircle) this.dbCircle.classList.remove('alert');
  }

  deactivate() {
    this.stopMonitoring();
  }

  updateLoop() {
    if (!this.isMonitoring) return;

    const timeData = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(timeData);

    let sumSq = 0;
    for (let i = 0; i < timeData.length; i++) {
      sumSq += timeData[i] * timeData[i];
    }
    const rms = Math.sqrt(sumSq / timeData.length);
    let dbfs = rms > 0 ? 20 * Math.log10(rms) : -100;
    dbfs = Math.max(-100, Math.min(0, dbfs));

    if (this.dbNumber) this.dbNumber.textContent = dbfs.toFixed(1);

    if (dbfs >= this.threshold) {
      if (this.dbCircle) this.dbCircle.classList.add('alert');
      if (this.statusMsg) {
        this.statusMsg.textContent = `🚨 LIMITE DE ${this.threshold} dBFS ULTRAPASSADO! SILÊNCIO!`;
        this.statusMsg.style.color = 'var(--neon-pink)';
      }
      if (window.triggerHaptic) window.triggerHaptic(50);
      if (window.playBeep) window.playBeep(900, 0.08);
    } else {
      if (this.dbCircle) this.dbCircle.classList.remove('alert');
      if (this.statusMsg) {
        this.statusMsg.textContent = 'Nível de ruído aceitável.';
        this.statusMsg.style.color = 'var(--neon-green)';
      }
    }

    requestAnimationFrame(() => this.updateLoop());
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.decibelMeter = new DecibelMeter();
});
