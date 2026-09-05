class FingerChooser {
  constructor() {
    this.stage = document.getElementById('finger-stage');
    this.canvas = document.getElementById('finger-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.resetBtn = document.getElementById('finger-reset-btn');
    this.prompt = this.stage.querySelector('.finger-prompt');

    this.touches = new Map();
    this.isCountingDown = false;
    this.selectedTouchId = null;
    this.countdownTimer = null;
    this.countdownValue = 3;

    this.colors = [
      '#00f3ff', '#ff007f', '#00ff66', '#ffcc00', '#9d00ff', '#ff5500'
    ];

    this.init();
  }

  init() {
    if (!this.stage || !this.canvas || !this.resetBtn) return;
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    this.stage.addEventListener('touchstart', (e) => this.handleTouch(e), { passive: false });
    this.stage.addEventListener('touchmove', (e) => this.handleTouch(e), { passive: false });
    this.stage.addEventListener('touchend', (e) => this.handleTouch(e), { passive: false });
    this.stage.addEventListener('touchcancel', (e) => this.handleTouch(e), { passive: false });

    // Support mouse clicks for testing on Desktop
    let isMouseDown = false;
    this.stage.addEventListener('mousedown', (e) => {
      isMouseDown = true;
      const rect = this.canvas.getBoundingClientRect();
      this.touches.set('mouse-1', {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        color: this.colors[0],
        id: 'mouse-1'
      });
      this.checkTouches();
    });

    this.stage.addEventListener('mousemove', (e) => {
      if (isMouseDown && this.touches.has('mouse-1')) {
        const rect = this.canvas.getBoundingClientRect();
        const t = this.touches.get('mouse-1');
        t.x = e.clientX - rect.left;
        t.y = e.clientY - rect.top;
      }
    });

    window.addEventListener('mouseup', () => {
      if (isMouseDown) {
        isMouseDown = false;
        this.touches.delete('mouse-1');
        this.checkTouches();
      }
    });

    this.resetBtn.addEventListener('click', () => this.reset());
    this.animate();
  }

  activate() {
    this.reset();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.resizeCanvas();
      });
    });
  }

  resizeCanvas() {
    if (!this.stage || !this.canvas || !this.ctx) return;
    const rect = this.stage.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  handleTouch(e) {
    e.preventDefault();
    if (this.selectedTouchId) return; // Frozen after selection

    const rect = this.canvas.getBoundingClientRect();
    const currentTouchIds = new Set();

    for (let i = 0; i < e.touches.length; i++) {
      const touch = e.touches[i];
      const id = touch.identifier;
      currentTouchIds.add(id);

      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      if (!this.touches.has(id)) {
        const color = this.colors[this.touches.size % this.colors.length];
        this.touches.set(id, { x, y, color, id, radius: 40 });
        if (window.triggerHaptic) window.triggerHaptic(30);
      } else {
        const existing = this.touches.get(id);
        existing.x = x;
        existing.y = y;
      }
    }

    // Delete released touches
    for (let id of this.touches.keys()) {
      if (typeof id === 'number' && !currentTouchIds.has(id)) {
        this.touches.delete(id);
      }
    }

    this.checkTouches();
  }

  checkTouches() {
    if (this.selectedTouchId) return;

    if (this.touches.size >= 2) {
      this.prompt.style.opacity = '0';
      if (!this.isCountingDown) {
        this.startCountdown();
      }
    } else {
      this.prompt.style.opacity = '1';
      this.cancelCountdown();
    }
  }

  startCountdown() {
    this.isCountingDown = true;
    this.countdownValue = 3;

    if (window.playBeep) window.playBeep(440, 0.1);

    this.countdownTimer = setInterval(() => {
      this.countdownValue--;
      if (window.triggerHaptic) window.triggerHaptic(50);

      if (this.countdownValue > 0) {
        if (window.playBeep) window.playBeep(440 + (3 - this.countdownValue) * 200, 0.1);
      } else {
        clearInterval(this.countdownTimer);
        this.selectWinner();
      }
    }, 1000);
  }

  cancelCountdown() {
    this.isCountingDown = false;
    if (this.countdownTimer) clearInterval(this.countdownTimer);
  }

  selectWinner() {
    const touchArray = Array.from(this.touches.values());
    if (touchArray.length === 0) return;

    const winner = touchArray[Math.floor(Math.random() * touchArray.length)];
    this.selectedTouchId = winner.id;

    if (window.triggerHaptic) window.triggerHaptic([100, 50, 200, 50, 300]);
    if (window.playWinnerSound) window.playWinnerSound();
  }

  reset() {
    this.selectedTouchId = null;
    this.touches.clear();
    this.cancelCountdown();
    if (this.prompt) this.prompt.style.opacity = '1';
  }

  animate() {
    const rect = this.canvas.getBoundingClientRect();
    this.ctx.clearRect(0, 0, rect.width || this.canvas.width, rect.height || this.canvas.height);

    const touchArray = Array.from(this.touches.values());

    touchArray.forEach((t) => {
      const isWinner = t.id === this.selectedTouchId;

      this.ctx.beginPath();
      this.ctx.arc(t.x, t.y, isWinner ? 65 : 45, 0, Math.PI * 2);
      this.ctx.fillStyle = t.color;
      this.ctx.globalAlpha = 0.3;
      this.ctx.fill();

      this.ctx.beginPath();
      this.ctx.arc(t.x, t.y, isWinner ? 50 : 30, 0, Math.PI * 2);
      this.ctx.fillStyle = t.color;
      this.ctx.globalAlpha = 0.8;
      this.ctx.fill();
      this.ctx.globalAlpha = 1.0;

      // Outer glowing ring
      this.ctx.beginPath();
      this.ctx.arc(t.x, t.y, isWinner ? 80 : 55, 0, Math.PI * 2);
      this.ctx.strokeStyle = isWinner ? '#ffffff' : t.color;
      this.ctx.lineWidth = isWinner ? 6 : 3;
      this.ctx.stroke();

      if (isWinner) {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 16px Outfit';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('PAGA A CONTA! 💸', t.x, t.y - 90);
      }
    });

    if (this.isCountingDown && !this.selectedTouchId) {
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = 'bold 48px Space Grotesk';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(this.countdownValue, (rect.width || this.canvas.width) / 2, (rect.height || this.canvas.height) / 2);
    }

    requestAnimationFrame(() => this.animate());
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.fingerChooser = new FingerChooser();
});
