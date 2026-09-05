class Soundboard {
  constructor() {
    this.soundCards = document.querySelectorAll('.sound-card');
    this.init();
  }

  init() {
    if (this.soundCards.length === 0) return;
    this.soundCards.forEach((card) => {
      card.addEventListener('click', () => {
        const soundType = card.dataset.sound;
        this.playSound(soundType);
        if (window.triggerHaptic) window.triggerHaptic(40);
      });
    });
  }

  playSound(type) {
    if (window.audioEngine) {
      window.audioEngine.playAsset(type);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.soundboard = new Soundboard();
  window.playSoundEffect = (name) => window.soundboard.playSound(name);
});
