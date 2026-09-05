class CapybaraLevel {
  constructor() {
    this.bubble = document.getElementById('level-bubble');
    this.avatar = document.getElementById('capybara-avatar');
    this.angleXDisplay = document.getElementById('angle-x');
    this.angleYDisplay = document.getElementById('angle-y');
    this.statusMsg = document.getElementById('level-status-msg');
    this.requestBtn = document.getElementById('request-orientation-btn');

    this.tiltX = 0;
    this.tiltY = 0;
    this.isAligned = false;

    this.init();
  }

  init() {
    if (!this.bubble || !this.angleXDisplay) return;
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      if (!this.requestBtn) { /* skip iOS permission */ } else {
        this.requestBtn.style.display = 'block';
        this.requestBtn.addEventListener('click', () => {
          DeviceOrientationEvent.requestPermission().then(state => {
            if (state === 'granted') {
              this.requestBtn.style.display = 'none';
              window.addEventListener('deviceorientation', (e) => this.handleOrientation(e));
            }
          });
        });
      }
    } else if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', (e) => this.handleOrientation(e));
    } else {
      this.statusMsg.textContent = 'Giroscópio não suportado no seu navegador.';
    }

    // Fallback mouse control for Desktop testing
    const levelEl = document.getElementById('tool-capybara-level');
    if (levelEl) levelEl.addEventListener('mousemove', (e) => {
      if (!this.hasGyro) {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width - 0.5) * 60;
        const y = ((e.clientY - rect.top) / rect.height - 0.5) * 60;
        this.updateBubble(x, y);
      }
    });
  }

  handleOrientation(e) {
    this.hasGyro = true;
    const gamma = e.gamma || 0; // Left to right [-90, 90]
    const beta = e.beta || 0;   // Front to back [-180, 180]

    this.updateBubble(gamma, beta);
  }

  updateBubble(x, y) {
    if (!this.bubble || !this.angleXDisplay || !this.angleYDisplay) return;
    this.tiltX = Math.max(-45, Math.min(45, x));
    this.tiltY = Math.max(-45, Math.min(45, y));

    this.angleXDisplay.textContent = `${this.tiltX.toFixed(1)}°`;
    this.angleYDisplay.textContent = `${this.tiltY.toFixed(1)}°`;

    // Calculate pixel offsets for 220px container (max radius offset ~80px)
    const maxOffset = 80;
    const offsetX = (this.tiltX / 45) * maxOffset;
    const offsetY = (this.tiltY / 45) * maxOffset;

    this.bubble.style.transform = `translate(${offsetX}px, ${offsetY}px)`;

    const totalAngle = Math.sqrt(this.tiltX * this.tiltX + this.tiltY * this.tiltY);

    if (totalAngle < 2.5) {
      if (!this.isAligned) {
        this.isAligned = true;
        this.avatar.textContent = '🦫✨';
        this.avatar.style.transform = 'scale(1.2) rotate(0deg)';
        this.statusMsg.textContent = '100% RETO! Capivara aprovou com louvor!';
        this.statusMsg.style.color = 'var(--neon-green)';
        if (window.triggerHaptic) window.triggerHaptic(60);
        if (window.playBeep) window.playBeep(880, 0.2);
      }
    } else {
      this.isAligned = false;
      if (totalAngle > 20) {
        this.avatar.textContent = '🦫💢';
        this.avatar.style.transform = `scale(0.9) rotate(${this.tiltX * 0.5}deg)`;
        this.statusMsg.textContent = 'Tudo torto! A capivara está furiosa!';
        this.statusMsg.style.color = 'var(--neon-pink)';
      } else {
        this.avatar.textContent = '🦫';
        this.avatar.style.transform = 'scale(1.0)';
        this.statusMsg.textContent = 'Ajuste fino necessário...';
        this.statusMsg.style.color = 'var(--text-muted)';
      }
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.capybaraLevel = new CapybaraLevel();
});
