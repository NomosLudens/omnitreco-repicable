class StrobeMorse {
  constructor() {
    this.tabs = document.querySelectorAll('[data-strobe-mode]');
    this.flashPanel = document.getElementById('strobe-flash-panel');
    this.morsePanel = document.getElementById('strobe-morse-panel');
    this.speedInput = document.getElementById('strobe-speed');
    this.toggleBtn = document.getElementById('toggle-strobe-btn');
    this.morseTextInput = document.getElementById('morse-text');
    this.morseDisplay = document.getElementById('morse-code-display');
    this.playMorseBtn = document.getElementById('play-morse-btn');
    this.overlay = document.getElementById('full-strobe-overlay');
    this.closeOverlayBtn = document.getElementById('close-strobe-btn');

    this.isFlashing = false;
    this.flashInterval = null;

    this.morseCodeMap = {
      'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.',
      'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..',
      'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.',
      'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
      'Y': '-.--', 'Z': '--..', '0': '-----', '1': '.----', '2': '..---',
      '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...',
      '8': '---..', '9': '----.', ' ': '/'
    };

    this.init();
  }

  init() {
    if (!this.toggleBtn || !this.overlay) return;

    this.tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        this.tabs.forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        const mode = tab.dataset.strobeMode;

        if (mode === 'flash') {
          if (this.flashPanel) this.flashPanel.classList.remove('hidden');
          if (this.morsePanel) this.morsePanel.classList.add('hidden');
        } else {
          if (this.flashPanel) this.flashPanel.classList.add('hidden');
          if (this.morsePanel) this.morsePanel.classList.remove('hidden');
        }
      });
    });

    this.toggleBtn.addEventListener('click', () => this.startStrobe());
    if (this.closeOverlayBtn) this.closeOverlayBtn.addEventListener('click', () => this.stopStrobe());

    if (this.morseTextInput) {
      this.morseTextInput.addEventListener('input', () => this.updateMorseDisplay());
      this.updateMorseDisplay();
    }

    if (this.playMorseBtn) {
      this.playMorseBtn.addEventListener('click', () => this.playMorseSequence());
    }
  }

  deactivate() {
    this.stopStrobe();
  }

  updateMorseDisplay() {
    const text = this.morseTextInput.value.toUpperCase();
    let morse = '';
    for (let char of text) {
      if (this.morseCodeMap[char]) {
        morse += this.morseCodeMap[char] + ' ';
      }
    }
    this.morseDisplay.textContent = morse.trim() || '...';
  }

  startStrobe() {
    this.isFlashing = true;
    this.overlay.classList.remove('hidden');

    const colors = ['#ffffff', '#00f3ff', '#ff007f', '#00ff66', '#ffcc00', '#9d00ff'];
    let idx = 0;

    const delay = 1000 / parseInt(this.speedInput.value, 10);

    this.flashInterval = setInterval(() => {
      this.overlay.style.backgroundColor = colors[idx % colors.length];
      idx++;
    }, delay);
  }

  stopStrobe() {
    this.isFlashing = false;
    if (this.flashInterval) clearInterval(this.flashInterval);
    this.overlay.classList.add('hidden');
  }

  async playMorseSequence() {
    const morseStr = this.morseDisplay.textContent;
    this.overlay.classList.remove('hidden');
    this.overlay.style.backgroundColor = '#000';

    for (let char of morseStr) {
      if (char === '.') {
        this.overlay.style.backgroundColor = '#fff';
        if (window.playBeep) window.playBeep(800, 0.1);
        await this.sleep(120);
        this.overlay.style.backgroundColor = '#000';
        await this.sleep(120);
      } else if (char === '-') {
        this.overlay.style.backgroundColor = '#fff';
        if (window.playBeep) window.playBeep(800, 0.3);
        await this.sleep(360);
        this.overlay.style.backgroundColor = '#000';
        await this.sleep(120);
      } else if (char === ' ' || char === '/') {
        await this.sleep(300);
      }
    }

    this.overlay.classList.add('hidden');
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.strobeMorse = new StrobeMorse();
});
