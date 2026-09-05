class FakeCall {
  constructor() {
    this.callerNameInput = document.getElementById('fake-caller-name');
    this.delayChips = document.querySelectorAll('.chip-btn');
    this.scheduleBtn = document.getElementById('schedule-call-btn');
    this.modal = document.getElementById('incoming-call-modal');
    this.modalCallerName = document.getElementById('incoming-caller-name');
    this.callStatusLabel = document.getElementById('call-status-label');
    this.declineBtn = document.getElementById('decline-call-btn');
    this.acceptBtn = document.getElementById('accept-call-btn');

    this.selectedDelay = 5;
    this.ringInterval = null;
    this.speechSynthUtterance = null;

    this.init();
  }

  init() {
    if (!this.scheduleBtn || !this.modal) return;

    this.delayChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        this.delayChips.forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        this.selectedDelay = parseInt(chip.dataset.delay, 10);
      });
    });

    this.scheduleBtn.addEventListener('click', () => this.scheduleCall());
    if (this.declineBtn) this.declineBtn.addEventListener('click', () => this.endCall());
    if (this.acceptBtn) this.acceptBtn.addEventListener('click', () => this.answerCall());
  }

  scheduleCall() {
    const caller = (this.callerNameInput ? this.callerNameInput.value.trim() : '') || 'Chefe da Empresa';
    this.scheduleBtn.disabled = true;
    this.scheduleBtn.textContent = `⏳ Chamada programada para daqui a ${this.selectedDelay}s...`;

    if (window.triggerHaptic) window.triggerHaptic(40);

    setTimeout(() => {
      this.triggerIncomingCall(caller);
    }, this.selectedDelay * 1000);
  }

  triggerIncomingCall(caller) {
    this.scheduleBtn.disabled = false;
    this.scheduleBtn.textContent = '🚀 Programar Chamada Falsa';
    if (this.modalCallerName) this.modalCallerName.textContent = caller;
    if (this.callStatusLabel) this.callStatusLabel.textContent = 'Chamada Recebida...';
    this.modal.classList.remove('hidden');

    // Ringtone audio loop via Web Audio API + vibration
    this.ringInterval = setInterval(() => {
      if (window.triggerHaptic) window.triggerHaptic([400, 200, 400]);
      if (window.playPhoneRing) window.playPhoneRing();
    }, 2000);
    if (window.playPhoneRing) window.playPhoneRing();
  }

  answerCall() {
    if (this.ringInterval) clearInterval(this.ringInterval);
    if (this.callStatusLabel) this.callStatusLabel.textContent = '00:04 - Em Chamada...';
    if (this.declineBtn) this.declineBtn.style.display = 'none';
    if (this.acceptBtn) {
      this.acceptBtn.style.background = '#ff3b30';
      this.acceptBtn.innerHTML = '<span>🚪</span> Desconectar';
      this.acceptBtn.onclick = () => this.endCall();
    }

    // Voice simulation using SpeechSynthesis (if supported) or Audio Synth
    if ('speechSynthesis' in window) {
      const phrases = [
        "Alô? Preciso que você venha para o escritório imediatamente, é uma emergência!",
        "Oi, o gato subiu no telhado e está miando sem parar, venha logo!",
        "Você ainda está aí? A reunião começou há 5 minutos e só falta você!"
      ];
      const randomText = phrases[Math.floor(Math.random() * phrases.length)];
      this.speechSynthUtterance = new SpeechSynthesisUtterance(randomText);
      this.speechSynthUtterance.lang = 'pt-BR';
      window.speechSynthesis.speak(this.speechSynthUtterance);
    }
  }

  endCall() {
    if (this.ringInterval) clearInterval(this.ringInterval);
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();

    if (this.modal) this.modal.classList.add('hidden');
    if (this.declineBtn) this.declineBtn.style.display = 'flex';
    if (this.acceptBtn) {
      this.acceptBtn.style.background = '#34c759';
      this.acceptBtn.innerHTML = '<span>📞</span> Atender';
      this.acceptBtn.onclick = () => this.answerCall();
    }
  }

  deactivate() {
    this.endCall();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.fakeCall = new FakeCall();
});
