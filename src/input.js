// ---- Input: keyboard + gamepad → abstract actions --------------------------
const KEYMAP = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  jump: ['Space', 'KeyZ', 'KeyK'],
  attack: ['KeyX', 'KeyJ'],
  dash: ['KeyC', 'KeyL', 'ShiftLeft', 'ShiftRight'],
  focus: ['KeyV', 'KeyE', 'KeyQ'],
  map: ['KeyM', 'Tab'],
  pause: ['Escape', 'KeyP'],
  confirm: ['Enter', 'Space', 'KeyZ', 'KeyK', 'KeyX', 'KeyJ'],
  back: ['Escape', 'KeyX', 'KeyJ'],
};
const PAD_BUTTONS = { jump: [0], attack: [2], dash: [1, 5, 4], focus: [3, 7, 6], map: [8], pause: [9], confirm: [0, 2], back: [1] };

class Input {
  constructor() {
    this.held = {}; this.pressed = {}; this.released = {};
    this.padHeld = {}; this.anyKeyPressed = false; this.lastDevice = 'keyboard';
    this.codeToActions = {};
    for (const a in KEYMAP) for (const code of KEYMAP[a]) (this.codeToActions[code] ||= []).push(a);
    if (IS_BROWSER) {
      window.addEventListener('keydown', (e) => {
        if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
        if (e.repeat) return;
        this.anyKeyPressed = true; this.lastDevice = 'keyboard';
        const acts = this.codeToActions[e.code]; if (!acts) return;
        for (const a of acts) { if (!this.held[a]) this.pressed[a] = true; this.held[a] = true; }
      });
      window.addEventListener('keyup', (e) => {
        const acts = this.codeToActions[e.code]; if (!acts) return;
        for (const a of acts) { this.held[a] = false; this.released[a] = true; }
      });
      window.addEventListener('blur', () => { for (const a in this.held) this.held[a] = false; });
    }
  }
  pollGamepad() {
    if (!IS_BROWSER || !navigator.getGamepads) return;
    const pads = navigator.getGamepads(); let pad = null;
    for (const p of pads) if (p && p.connected) { pad = p; break; }
    if (!pad) return;
    const now = {};
    const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
    const b = (i) => pad.buttons[i] && pad.buttons[i].pressed;
    now.left = ax < -0.4 || b(14); now.right = ax > 0.4 || b(15);
    now.up = ay < -0.4 || b(12); now.down = ay > 0.4 || b(13);
    for (const a in PAD_BUTTONS) now[a] = PAD_BUTTONS[a].some(b);
    for (const a in now) {
      if (now[a] && !this.padHeld[a]) { this.pressed[a] = true; this.anyKeyPressed = true; this.lastDevice = 'gamepad'; }
      if (!now[a] && this.padHeld[a]) this.released[a] = true;
    }
    this.padHeld = now;
  }
  isHeld(a) { return !!(this.held[a] || this.padHeld[a]); }
  isPressed(a) { return !!this.pressed[a]; }
  isReleased(a) { return !!this.released[a]; }
  // Snapshot used by the (DOM-free) player simulation
  snapshot() {
    return {
      left: this.isHeld('left'), right: this.isHeld('right'), up: this.isHeld('up'), down: this.isHeld('down'),
      jump: this.isHeld('jump'), jumpPressed: this.isPressed('jump'), jumpReleased: this.isReleased('jump'),
      attack: this.isHeld('attack'), attackPressed: this.isPressed('attack'),
      dash: this.isHeld('dash'), dashPressed: this.isPressed('dash'),
      focus: this.isHeld('focus'),
    };
  }
  endTick() { this.pressed = {}; this.released = {}; this.anyKeyPressed = false; }
}
