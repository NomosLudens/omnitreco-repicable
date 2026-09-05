class LieDetector {
  constructor() {
    this.thumbBtn = document.getElementById('lie-thumb-btn');
    this.promptText = document.getElementById('lie-prompt-text');
    this.gaugeBar = document.getElementById('lie-gauge-bar');
    this.percentText = document.getElementById('lie-percent');
    this.verdictBox = document.getElementById('lie-verdict');
    this.verdictTitle = document.getElementById('verdict-title');
    this.verdictDesc = document.getElementById('verdict-desc');

    this.isScanning = false;
    this.scanInterval = null;
    this.stressLevel = 0;

    this.init();
  }

  init() {
    if (!this.thumbBtn || !this.gaugeBar || !this.percentText) return;
    const startScan = (e) => {
      e.preventDefault();
      if (this.isScanning) return;
      this.isScanning = true;
      this.thumbBtn.classList.add('scanning');
      this.verdictBox.classList.add('hidden');
      this.promptText.textContent = 'Analisando tremores e frequência...';
      this.stressLevel = 0;

      if (window.triggerHaptic) window.triggerHaptic(50);

      this.scanInterval = setInterval(() => {
        this.stressLevel += Math.floor(Math.random() * 8) + 4;
        if (this.stressLevel > 100) this.stressLevel = 100;

        this.gaugeBar.style.width = `${this.stressLevel}%`;
        this.percentText.textContent = `${this.stressLevel}%`;

        if (window.triggerHaptic) window.triggerHaptic(15);
        if (window.playBeep) window.playBeep(200 + this.stressLevel * 8, 0.05);

        if (this.stressLevel >= 100) {
          this.finishScan();
        }
      }, 100);
    };

    const stopScan = (e) => {
      e.preventDefault();
      if (!this.isScanning) return;
      if (this.stressLevel < 100) {
        clearInterval(this.scanInterval);
        this.isScanning = false;
        this.thumbBtn.classList.remove('scanning');
        this.promptText.textContent = 'Mantenha pressionado até o final!';
        this.gaugeBar.style.width = '0%';
        this.percentText.textContent = '0%';
      }
    };

    this.thumbBtn.addEventListener('mousedown', startScan);
    this.thumbBtn.addEventListener('mouseup', stopScan);
    this.thumbBtn.addEventListener('mouseleave', stopScan);

    this.thumbBtn.addEventListener('touchstart', startScan, { passive: false });
    this.thumbBtn.addEventListener('touchend', stopScan, { passive: false });
    this.thumbBtn.addEventListener('touchcancel', stopScan, { passive: false });
  }

  finishScan() {
    if (!this.verdictBox || !this.gaugeBar || !this.percentText) return;
    clearInterval(this.scanInterval);
    this.isScanning = false;
    this.thumbBtn.classList.remove('scanning');
    this.promptText.textContent = 'Análise Concluída!';

    const isLie = Math.random() < 0.65; // 65% chance of bizarre lie

    this.verdictBox.classList.remove('hidden');
    this.verdictBox.classList.remove('truth', 'lie');

    if (isLie) {
      this.verdictBox.classList.add('lie');
      this.verdictTitle.textContent = '🚨 MENTIRA DESCARADA!';
      const lies = [
        "Tremor detectado no polegar! Nível de cara de pau: 99.8%.",
        "O biossensor pegou a hesitação. Nem sua mãe acreditaria nisso!",
        "Frequência de suor elevada. Você está inventando essa história agora!",
        "Detectada anomalia neural grave. Suas narinas expandiram ao responder!"
      ];
      this.verdictDesc.textContent = lies[Math.floor(Math.random() * lies.length)];
      if (window.triggerHaptic) window.triggerHaptic([200, 100, 200, 100, 400]);
      if (window.playSoundEffect) window.playSoundEffect('siren');
    } else {
      this.verdictBox.classList.add('truth');
      this.verdictTitle.textContent = '✅ VERDADE ABSOLUTA!';
      const truths = [
        "Pulsação estável e tremores nulos. Veredito: Anjo sem pecados!",
        "Sincronia perfeita com o detector. Pode jurar pela avó!",
        "Nenhum indício de invenção. História pura e cristalina."
      ];
      this.verdictDesc.textContent = truths[Math.floor(Math.random() * truths.length)] + ' (*não é científico coisa nenhuma.)';
      if (window.triggerHaptic) window.triggerHaptic(100);
      if (window.playSoundEffect) window.playSoundEffect('applause');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.lieDetector = new LieDetector();
});
