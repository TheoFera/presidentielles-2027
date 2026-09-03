export class BrowserInput {
  constructor(canvas, human, onAction, anchorRatio, touchPauseRadius) {
    this.keys = new Set(); this.pointerAxis = 0;
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
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.clear(); });
    canvas.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse') { canvas.focus(); return; }
      event.preventDefault(); canvas.setPointerCapture(event.pointerId);
      const rect = canvas.getBoundingClientRect();
      const relative = (event.clientX - rect.left) / rect.width;
      if (Math.abs(relative - anchorRatio) < touchPauseRadius) onAction('h');
      else this.pointerAxis = relative < anchorRatio ? -1 : 1;
      this.update();
    });
    const release = () => { this.pointerAxis = 0; this.update(); };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('lostpointercapture', release);
  }
  update() {
    const left = ['arrowleft', 'q', 'a'].some(k => this.keys.has(k));
    const right = ['arrowright', 'd'].some(k => this.keys.has(k));
    if (left && right && !this.pointerAxis) this.human.reset();
    else this.human.setAxis(this.pointerAxis || Number(right) - Number(left));
  }
  clear() { this.keys.clear(); this.pointerAxis = 0; this.human.reset(); }
}
