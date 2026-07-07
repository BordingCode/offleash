// Touch + keyboard input. LEFT half: floating virtual stick (pointer sets its
// own origin). RIGHT: A (attack), JUMP, DASH + three ability buttons.
// Edge flags are latched on pointerdown (react on touch-down, <100ms feedback)
// and consumed once per sim step by poll(). Keyboard mirrors everything so all
// milestones are testable headless/desktop:
//   WASD/arrows move · J or Space = attack · K = jump · L or Shift = dash
//   U/I/O = abilities 1-3
export class Input {
  constructor(stickZone, btnIds) {
    this._atk = false; this._jump = false; this._dash = false;
    this._ab = [false, false, false];

    this.stick = { id: -1, ox: 0, oy: 0, x: 0, y: 0 };
    stickZone.addEventListener('pointerdown', (e) => {
      if (this.stick.id !== -1) return;
      this.stick.id = e.pointerId;
      this.stick.ox = e.clientX; this.stick.oy = e.clientY;
      this.stick.x = e.clientX; this.stick.y = e.clientY;
      try { stickZone.setPointerCapture(e.pointerId); } catch (_) {}
      e.preventDefault();
    });
    stickZone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.stick.id) return;
      this.stick.x = e.clientX; this.stick.y = e.clientY;
      e.preventDefault();
    });
    const end = (e) => { if (e.pointerId === this.stick.id) this.stick.id = -1; };
    stickZone.addEventListener('pointerup', end);
    stickZone.addEventListener('pointercancel', end);

    const bind = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('pointerdown', (e) => { fn(); e.preventDefault(); });
    };
    bind(btnIds.atk, () => { this._atk = true; });
    bind(btnIds.jump, () => { this._jump = true; });
    bind(btnIds.dash, () => { this._dash = true; });
    btnIds.abilities.forEach((id, i) => bind(id, () => { this._ab[i] = true; }));

    this.keys = {};
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.repeat) return;
      if (e.code === 'KeyJ' || e.code === 'Space') this._atk = true;
      if (e.code === 'KeyK') this._jump = true;
      if (e.code === 'KeyL' || e.code === 'ShiftLeft') this._dash = true;
      if (e.code === 'KeyU') this._ab[0] = true;
      if (e.code === 'KeyI') this._ab[1] = true;
      if (e.code === 'KeyO') this._ab[2] = true;
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
  }

  poll() {
    let mx = 0, my = 0;
    if (this.stick.id !== -1) {
      mx = clamp01((this.stick.x - this.stick.ox) / 48);
      my = clamp01((this.stick.y - this.stick.oy) / 48);
      if (Math.abs(mx) < 0.18) mx = 0;
      if (Math.abs(my) < 0.3) my = 0;
    }
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) mx = -1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) mx = 1;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) my = -1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) my = 1;

    const out = {
      mx, my,
      atk: this._atk, jump: this._jump, dash: this._dash,
      ab1: this._ab[0], ab2: this._ab[1], ab3: this._ab[2],
    };
    this._atk = this._jump = this._dash = false;
    this._ab = [false, false, false];
    return out;
  }
}

const clamp01 = (v) => Math.max(-1, Math.min(1, v));
