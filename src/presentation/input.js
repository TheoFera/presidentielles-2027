export class BrowserInput {
  constructor(canvas, human, onAction, anchorRatio, touchPauseRadius) {
    this.keys = new Set(); this.pointerAxis = 0; this.pointers = new Map();
    this.human = human; this.onAction = onAction; this.canvas = canvas; this.anchorRatio = anchorRatio;
    window.addEventListener('keydown', event => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName) && !['Escape', 'F3'].includes(event.key)) return;
      const key = event.key.toLowerCase();
      if (key === ' ') event.preventDefault();
      if (['arrowleft', 'arrowright', 'q', 'a', 'd'].includes(key)) event.preventDefault();
      if (['arrowleft', 'arrowright', 'q', 'a', 'd'].includes(key)) { this.keys.add(key); this.update(); }
      else if (!event.repeat) {
        if (/^f[3-9]$/.test(key)) event.preventDefault();
        onAction(key);
      }
    });
    window.addEventListener('keyup', event => { this.keys.delete(event.key.toLowerCase()); this.update(); });
    window.addEventListener('blur', () => this.clear());
    document.getElementById('attack-touch').addEventListener('pointerdown', event => { event.preventDefault(); onAction('attack'); });
    document.getElementById('pause-touch').addEventListener('click', () => onAction('h'));
    document.getElementById('fullscreen-touch').addEventListener('click', () => onAction('f'));
    const release = event => {
      this.pointers.delete(event.pointerId);
      this.updatePointers();
    };
    const bindRelease = element => {
      for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) element.addEventListener(type, release);
      element.addEventListener('contextmenu', event => event.preventDefault());
    };
    for (const [id, axis] of [['move-left', -1], ['move-right', 1]]) {
      const button = document.getElementById(id);
      button.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        event.preventDefault(); button.setPointerCapture(event.pointerId);
        this.pointers.set(event.pointerId, axis); this.updatePointers();
      });
      bindRelease(button);
    }
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.clear(); });
    canvas.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse') { canvas.focus(); return; }
      event.preventDefault(); canvas.setPointerCapture(event.pointerId);
      const rect = canvas.getBoundingClientRect();
      const relative = (event.clientX - rect.left) / rect.width;
      if (Math.abs(relative - anchorRatio) < touchPauseRadius) onAction('h');
      else { this.pointers.set(event.pointerId, relative < anchorRatio ? -1 : 1); this.updatePointers(); }
    });
    bindRelease(canvas);
  }
  updatePointers() {
    this.pointerAxis = Math.sign([...this.pointers.values()].reduce((sum, axis) => sum + axis, 0));
    this.update();
  }
  update() {
    const left = ['arrowleft', 'q', 'a'].some(k => this.keys.has(k));
    const right = ['arrowright', 'd'].some(k => this.keys.has(k));
    if (left && right && !this.pointerAxis) this.human.reset();
    else this.human.setAxis(this.pointerAxis || Number(right) - Number(left));
  }
  clear() { this.keys.clear(); this.pointers.clear(); this.pointerAxis = 0; this.human.reset(); }
}
