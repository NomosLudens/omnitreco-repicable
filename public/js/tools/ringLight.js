class RingLight {
  constructor() {
    this.video = document.getElementById('mirror-video');
    this.ringFrame = document.getElementById('ring-frame');
    this.startBtn = document.getElementById('start-mirror-btn');
    this.intensityInput = document.getElementById('ring-intensity');
    this.zoomInput = document.getElementById('mirror-zoom');
    this.colorDots = document.querySelectorAll('.color-dot');

    this.stream = null;

    this.init();
  }

  init() {
    if (!this.startBtn || !this.video || !this.ringFrame) return;

    this.startBtn.addEventListener('click', () => this.startCamera());

    if (this.intensityInput) {
      this.intensityInput.addEventListener('input', () => {
        const val = this.intensityInput.value;
        this.ringFrame.style.opacity = val / 100;
        this.ringFrame.style.borderWidth = `${Math.max(10, (val / 100) * 30)}px`;
      });
    }

    if (this.zoomInput) {
      this.zoomInput.addEventListener('input', () => {
        const scale = this.zoomInput.value / 10;
        this.video.style.transform = `scaleX(-1) scale(${scale})`;
      });
    }

    this.colorDots.forEach((dot) => {
      dot.addEventListener('click', () => {
        this.colorDots.forEach((d) => d.classList.remove('active'));
        dot.classList.add('active');
        const colorType = dot.dataset.color;
        let borderCol = '#ffffff';

        if (colorType === 'warm') borderCol = '#ffaa55';
        else if (colorType === 'pink') borderCol = '#ff55bb';
        else if (colorType === 'cyan') borderCol = '#00e5ff';

        this.ringFrame.style.borderColor = borderCol;
        this.ringFrame.style.boxShadow = `inset 0 0 35px ${borderCol}`;
      });
    });
  }

  async startCamera() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      this.video.srcObject = this.stream;
      this.startBtn.style.display = 'none';
      if (window.triggerHaptic) window.triggerHaptic(50);
    } catch (err) {
      alert('Não foi possível acessar a câmera frontal. Verifique as permissões do Safari/Chrome.');
    }
  }

  deactivate() {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.startBtn) this.startBtn.style.display = 'inline-flex';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.ringLight = new RingLight();
});
