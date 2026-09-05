class PaidToilet {
  constructor() {
    this.salaryInput = document.getElementById('monthly-salary');
    this.earnedAmountDisplay = document.getElementById('earned-amount');
    this.timerText = document.getElementById('toilet-timer-text');
    this.startBtn = document.getElementById('start-toilet-btn');
    this.stopBtn = document.getElementById('stop-toilet-btn');
    this.monthlyTotalDisplay = document.getElementById('monthly-poop-total');

    this.timerInterval = null;
    this.secondsElapsed = 0;
    this.earnedSoFar = 0.0;
    this.monthlyEarnings = parseFloat(localStorage.getItem('omni_monthly_poop') || '0.00');

    this.init();
  }

  init() {
    if (!this.startBtn || !this.salaryInput) return;
    this.updateMonthlyTotalUI();

    this.startBtn.addEventListener('click', () => this.startSession());
    if (this.stopBtn) this.stopBtn.addEventListener('click', () => this.stopSession());
  }

  updateMonthlyTotalUI() {
    this.monthlyTotalDisplay.textContent = `R$ ${this.monthlyEarnings.toFixed(2).replace('.', ',')}`;
  }

  startSession() {
    const salary = parseFloat(this.salaryInput.value) || 3500;
    // Salary per second calculation (Assuming 22 working days, 8h/day = 176h = 633,600 seconds)
    const ratePerSecond = salary / (22 * 8 * 3600);

    this.secondsElapsed = 0;
    this.earnedSoFar = 0.0;

    this.startBtn.classList.add('hidden');
    this.stopBtn.classList.remove('hidden');

    if (window.triggerHaptic) window.triggerHaptic(60);

    this.timerInterval = setInterval(() => {
      this.secondsElapsed++;
      this.earnedSoFar += ratePerSecond;

      this.earnedAmountDisplay.textContent = this.earnedSoFar.toFixed(2);

      const hrs = String(Math.floor(this.secondsElapsed / 3600)).padStart(2, '0');
      const mins = String(Math.floor((this.secondsElapsed % 3600) / 60)).padStart(2, '0');
      const secs = String(this.secondsElapsed % 60).padStart(2, '0');
      this.timerText.textContent = `${hrs}:${mins}:${secs}`;
    }, 1000);
  }

  stopSession() {
    clearInterval(this.timerInterval);
    this.startBtn.classList.remove('hidden');
    this.stopBtn.classList.add('hidden');

    this.monthlyEarnings += this.earnedSoFar;
    localStorage.setItem('omni_monthly_poop', this.monthlyEarnings.toFixed(2));
    this.updateMonthlyTotalUI();

    if (window.triggerHaptic) window.triggerHaptic([100, 50, 200]);
    if (window.playSoundEffect) window.playSoundEffect('applause');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.paidToilet = new PaidToilet();
});
