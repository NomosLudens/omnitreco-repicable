class PetTranslator {
  constructor() {
    this.petOpts = document.querySelectorAll('.pet-opt');
    this.recordBtn = document.getElementById('record-pet-btn');
    this.statusText = document.getElementById('record-status-text');
    this.resultCard = document.getElementById('translation-result');
    this.translatedText = document.getElementById('translated-text');

    this.selectedPet = 'dog';
    this.isRecording = false;

    this.translations = {
      dog: [
        "Se você não me der um pedaço dessa carne agora, vou mastigar seu chinelo esquerdo.",
        "Eu vi quem passou na rua há 3 horas e preciso gritar para avisar todo o bairro!",
        "Por favor, finja que jogou a bolinha para eu correr igual um bobo.",
        "Eu sei que você está conversando com a TV, mas eu sou o único ouvinte real aqui."
      ],
      cat: [
        "Humanos são apenas escravos que abrem sachês e limpam a caixa de areia.",
        "Miau significa: Olhe para a minha tigela com 90% de ração e encha até a borda imediatamente.",
        "Vou derrubar este copo da mesa apenas para testar as leis da gravidade.",
        "Às 3 horas da manhã eu preciso correr pela casa como se estivesse caçando espíritos."
      ],
      baby: [
        "Estou chorando apenas para ver a velocidade com que vocês entram no quarto em pânico.",
        "Minha fralda tem exatamente 2 gotas de xixi, troquem por favor!",
        "O aviãozinho de comida estava ótimo, mas decidi cuspir tudo na sua camisa limpa.",
        "Quero dormir, mas estou com raiva porque estou com sono, então vou gritar!"
      ],
      capybara: [
        "A vida é só água morna, capim fresco e zero estresse. Relaxe humano.",
        "Estou aqui filosofando sobre como o mundo seria melhor se todos fossem capivaras.",
        "Não estou brava, essa é apenas minha expressão facial padrão de paz absoluta."
      ]
    };

    this.init();
  }

  init() {
    if (!this.recordBtn || !this.resultCard) return;

    this.petOpts.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.petOpts.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedPet = btn.dataset.pet;
      });
    });

    this.recordBtn.addEventListener('click', () => this.recordAndTranslate());
  }

  async recordAndTranslate() {
    if (this.isRecording) return;
    this.isRecording = true;
    this.recordBtn.classList.add('recording');
    this.resultCard.classList.add('hidden');
    this.statusText.textContent = 'Ouvindo frequências sonoras...';

    let micStream = null;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      // Continue gracefully even if mic permission is denied
    }

    if (window.triggerHaptic) window.triggerHaptic(50);
    if (window.playBeep) window.playBeep(600, 0.2);

    setTimeout(() => {
      this.statusText.textContent = 'Decodificando ondas cerebrais...';
      if (window.playBeep) window.playBeep(800, 0.2);
    }, 1500);

    setTimeout(() => {
      if (micStream) {
        micStream.getTracks().forEach(t => t.stop());
      }
      this.isRecording = false;
      this.recordBtn.classList.remove('recording');
      this.statusText.textContent = 'Tradução Pronta!';

      const options = this.translations[this.selectedPet] || this.translations.dog;
      const randomQuote = options[Math.floor(Math.random() * options.length)];
      if (this.translatedText) this.translatedText.textContent = `"${randomQuote}"`;
      this.resultCard.classList.remove('hidden');

      if (window.triggerHaptic) window.triggerHaptic([50, 50, 100]);
      if (window.playSoundEffect) window.playSoundEffect('boing');
    }, 3000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.petTranslator = new PetTranslator();
});
