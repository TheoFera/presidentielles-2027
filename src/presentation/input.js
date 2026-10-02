export class BrowserInput {
  constructor(canvas, human, onAction, anchorRatio, touchPauseRadius, doubleTapWindow = 300) {
    this.doubleTapWindow = doubleTapWindow; this.lastTap = null; this.lastHeld = {};
    this.attackSources = new Set(); this.keys = new Set(); this.pointerAxis = 0; this.pointers = new Map();
    this.human = human; this.onAction = onAction; this.canvas = canvas; this.anchorRatio = anchorRatio;
    window.addEventListener('keydown', event => {
      if (document.getElementById('game')?.inert) return;
      if (event.target.closest?.('#campaign-styles')) return;
      if (document.getElementById('help')?.hidden === false) {
        if (['h', 'escape'].includes(event.key.toLowerCase()) && !event.repeat) onAction(event.key.toLowerCase());
        return;
      }
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName) && !['Escape', 'F3'].includes(event.key)) return;
      const key = event.key.toLowerCase();
      if ([' ', 'arrowup', 'arrowdown'].includes(key)) event.preventDefault();
      if (key === 'z' && !event.repeat) { onAction('arrowup'); return; }
      if ([' ', 'j'].includes(key)) { if (!event.repeat) this.pressAttack(key); return; }
      if (['arrowleft', 'arrowright', 'q', 'a', 'd'].includes(key)) event.preventDefault();
      if (['arrowleft', 'arrowright', 'q', 'a', 'd'].includes(key)) { this.keys.add(key); this.update(); }
      else if (!event.repeat) {
        if (/^f[3-9]$/.test(key)) event.preventDefault();
        onAction(key);
      }
    });
    window.addEventListener('keyup', event => { const key = event.key.toLowerCase(); if ([' ', 'j'].includes(key)) this.releaseAttack(key); this.keys.delete(key); this.update(); });
    window.addEventListener('blur', () => this.clear());
    document.getElementById('ultimate-touch')?.addEventListener('pointerdown', event => { event.preventDefault(); onAction('ultimate'); });
    document.getElementById('jump-touch')?.addEventListener('pointerdown', event => { event.preventDefault(); onAction('arrowup'); });
    const attackButton = document.getElementById('attack-touch');
    attackButton.addEventListener('pointerdown', event => { if (event.button !== 0) return; event.preventDefault(); attackButton.setPointerCapture(event.pointerId); this.pressAttack(`pointer:${event.pointerId}`); });
    attackButton.addEventListener('pointerup', event => this.releaseAttack(`pointer:${event.pointerId}`));
    for (const type of ['pointercancel', 'lostpointercapture']) attackButton.addEventListener(type, event => {
      if (this.attackSources.has(`pointer:${event.pointerId}`)) { this.attackSources.clear(); onAction('attack-cancel'); }
    });
    attackButton.addEventListener('contextmenu', event => event.preventDefault());
    const release = event => {
      if (event.type !== 'pointerup' && this.pointers.has(event.pointerId)) this.lastTap = null;
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
        if (event.button !== 0 || this.pointers.has(event.pointerId)) return;
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
    // Un appui compte seulement quand une direction vient d’être enfoncée :
    // relâcher la direction opposée ne doit pas passer pour un nouvel appui.
    const pointing = [...this.pointers.values()];
    const held = { [-1]: left || pointing.includes(-1), [1]: right || pointing.includes(1) };
    for (const axis of [-1, 1]) if (held[axis] && !this.lastHeld[axis]) {
      const now = performance.now();
      if (this.lastTap?.axis === axis && now - this.lastTap.time <= this.doubleTapWindow) { this.onAction(axis < 0 ? 'dash-left' : 'dash-right'); this.lastTap = null; }
      else this.lastTap = { axis, time: now };
    }
    this.lastHeld = held;
    if (left && right && !this.pointerAxis) this.human.setAxis(0);
    else this.human.setAxis(this.pointerAxis || Number(right) - Number(left));
  }
  pressAttack(source) {
    if (this.attackSources.has(source)) return;
    if (!this.attackSources.size) this.onAction('attack-press');
    this.attackSources.add(source);
  }
  releaseAttack(source) {
    if (!this.attackSources.delete(source)) return;
    if (!this.attackSources.size) this.onAction('attack-release');
  }
  clear() { this.attackSources.clear(); this.lastTap = null; this.lastHeld = {}; this.keys.clear(); this.pointers.clear(); this.pointerAxis = 0; this.human.reset(); }
}
