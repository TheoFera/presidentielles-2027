/* Argent affiché en haut à gauche : le montant défile jusqu'à sa nouvelle valeur
   et une étiquette « +1,2 k € » (verte) ou « −3 k € » (rouge) s'envole à chaque gain ou dépense. */
const EASE_PER_SECOND = 7; // Plus grand = défilement plus rapide.
const MERGE_SECONDS = 0.7; // Deux gains rapprochés s'additionnent dans la même étiquette.
const POP_SECONDS = 1.3;

export class MoneyCounter {
  constructor(output, format) {
    this.output = output; this.format = format; this.container = output.parentElement;
    this.shown = null; this.target = null; this.owner = null; this.pop = null; this.text = '';
  }
  reset() { this.shown = null; this.target = null; this.owner = null; this.pop?.element.remove(); this.pop = null; }
  update(value, owner, elapsed) {
    // Nouvelle partie ou autre candidat suivi : on affiche directement la bonne valeur.
    if (this.owner !== owner || this.shown === null) {
      this.owner = owner; this.shown = value; this.target = value;
    } else if (value !== this.target) {
      const delta = value - this.target; this.target = value;
      this.announce(delta);
    }
    const gap = this.target - this.shown;
    this.shown = Math.abs(gap) < 0.0005 ? this.target : this.shown + gap * (1 - Math.exp(-EASE_PER_SECOND * elapsed));
    const text = this.format(Math.max(0, this.shown));
    if (text !== this.text) { this.text = text; this.output.textContent = text; }
    if (this.pop) {
      this.pop.age += elapsed;
      if (this.pop.age > POP_SECONDS) { this.pop.element.remove(); this.pop = null; }
    }
  }
  announce(delta) {
    const sign = delta > 0 ? 1 : -1;
    if (this.pop && this.pop.sign === sign && this.pop.age < MERGE_SECONDS) {
      this.pop.total += delta; this.pop.age = 0;
      this.pop.element.textContent = this.label(this.pop.total);
      this.restart(this.pop.element);
    } else {
      this.pop?.element.remove();
      const element = document.createElement('span');
      element.className = `money-pop ${sign > 0 ? 'is-gain' : 'is-loss'}`; element.setAttribute('aria-hidden', 'true');
      element.textContent = this.label(delta);
      this.container.append(element);
      this.pop = { element, sign, total: delta, age: 0 };
    }
    this.output.classList.remove('money-gain', 'money-loss');
    void this.output.offsetWidth; // Relance l'animation CSS même si la classe était déjà là.
    this.output.classList.add(sign > 0 ? 'money-gain' : 'money-loss');
  }
  label(total) { return `${total > 0 ? '+' : '−'}${this.format(Math.abs(total))}`; }
  restart(element) { element.style.animation = 'none'; void element.offsetWidth; element.style.animation = ''; }
}
