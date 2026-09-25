// ---- Procedural audio: SFX synth + generative ambient music -----------------
class AudioSys {
  constructor() {
    this.ctx = null; this.master = null; this.sfxGain = null; this.musicGain = null;
    this.enabled = true; this.area = null; this.musicTimer = null; this.chordIdx = 0; this.boss = false;
    this.musicVol = 0.5; this.sfxVol = 0.6;
  }
  init() {
    if (this.ctx || !IS_BROWSER) return;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.8; this.master.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = this.sfxVol; this.sfxGain.connect(this.master);
    this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = this.musicVol; this.musicGain.connect(this.master);
    // simple feedback delay for space
    this.delay = this.ctx.createDelay(1.0); this.delay.delayTime.value = 0.38;
    this.delayGain = this.ctx.createGain(); this.delayGain.gain.value = 0.28;
    this.delayFilter = this.ctx.createBiquadFilter(); this.delayFilter.type = 'lowpass'; this.delayFilter.frequency.value = 1800;
    this.delay.connect(this.delayFilter); this.delayFilter.connect(this.delayGain); this.delayGain.connect(this.delay); this.delayGain.connect(this.master);
    this.startMusic();
  }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  // --- SFX primitives
  tone({ f = 440, f2 = null, type = 'sine', dur = 0.1, vol = 0.3, attack = 0.005, decay = null, delay = 0, pan = 0, send = 0 }) {
    if (!this.ctx || !this.enabled) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t0);
    if (f2 !== null) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (decay || dur));
    let node = g;
    if (pan && this.ctx.createStereoPanner) { const p = this.ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); g.connect(p); node = p; }
    o.connect(g); node.connect(this.sfxGain); if (send > 0) { const s = this.ctx.createGain(); s.gain.value = send; node.connect(s); s.connect(this.delay); }
    o.start(t0); o.stop(t0 + (decay || dur) + 0.05);
  }
  noise({ dur = 0.1, vol = 0.2, hp = 200, lp = 4000, delay = 0, attack = 0.002 }) {
    if (!this.ctx || !this.enabled) return;
    const t0 = this.ctx.currentTime + delay; const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const h = this.ctx.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = hp;
    const l = this.ctx.createBiquadFilter(); l.type = 'lowpass'; l.frequency.value = lp;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(h); h.connect(l); l.connect(g); g.connect(this.sfxGain); src.start(t0);
  }
  // --- Named SFX
  play(name, opt = {}) {
    if (!this.ctx || !this.enabled) return;
    const r = (a, b) => a + Math.random() * (b - a);
    switch (name) {
      case 'jump': this.tone({ f: 300, f2: 620, type: 'triangle', dur: 0.14, vol: 0.18 }); this.noise({ dur: 0.06, vol: 0.05, hp: 800 }); break;
      case 'djump': this.tone({ f: 500, f2: 900, type: 'sine', dur: 0.16, vol: 0.2 }); this.tone({ f: 750, f2: 1300, type: 'sine', dur: 0.2, vol: 0.1, delay: 0.03 }); break;
      case 'walljump': this.tone({ f: 240, f2: 520, type: 'triangle', dur: 0.12, vol: 0.18 }); this.noise({ dur: 0.08, vol: 0.08, hp: 400 }); break;
      case 'land': this.noise({ dur: 0.08, vol: 0.12 * (opt.strength || 1), hp: 80, lp: 900 }); this.tone({ f: 90, f2: 50, type: 'sine', dur: 0.08, vol: 0.15 * (opt.strength || 1) }); break;
      case 'step': this.noise({ dur: 0.03, vol: 0.035, hp: 300, lp: 1500 }); break;
      case 'dash': this.noise({ dur: 0.18, vol: 0.18, hp: 900, lp: 6000 }); this.tone({ f: 800, f2: 200, type: 'sawtooth', dur: 0.15, vol: 0.06 }); break;
      case 'slash': this.noise({ dur: 0.09, vol: 0.16, hp: 1500, lp: 9000 }); this.tone({ f: r(900, 1100), f2: 300, type: 'square', dur: 0.05, vol: 0.05 }); break;
      case 'hit': this.noise({ dur: 0.08, vol: 0.2, hp: 300, lp: 3000 }); this.tone({ f: 200, f2: 80, type: 'square', dur: 0.08, vol: 0.14 }); break;
      case 'pogo': this.tone({ f: 350, f2: 700, type: 'triangle', dur: 0.1, vol: 0.16 }); this.noise({ dur: 0.05, vol: 0.1, hp: 600 }); break;
      case 'kill': this.noise({ dur: 0.25, vol: 0.22, hp: 200, lp: 2500 }); this.tone({ f: 300, f2: 60, type: 'sawtooth', dur: 0.22, vol: 0.12 }); this.tone({ f: 1200, f2: 1800, type: 'sine', dur: 0.3, vol: 0.06, delay: 0.05, send: 0.5 }); break;
      case 'hurt': this.tone({ f: 220, f2: 90, type: 'sawtooth', dur: 0.25, vol: 0.22 }); this.noise({ dur: 0.2, vol: 0.2, hp: 100, lp: 1200 }); break;
      case 'death': this.tone({ f: 400, f2: 40, type: 'sawtooth', dur: 0.9, vol: 0.25 }); this.noise({ dur: 0.6, vol: 0.2, hp: 60, lp: 800 }); this.tone({ f: 1400, f2: 200, type: 'sine', dur: 1.2, vol: 0.1, send: 0.6 }); break;
      case 'pickup': [0, 4, 7, 12].forEach((s, i) => this.tone({ f: 660 * Math.pow(2, s / 12), type: 'sine', dur: 0.35, vol: 0.12, delay: i * 0.07, send: 0.5 })); break;
      case 'ability': [0, 4, 7, 11, 14, 19].forEach((s, i) => this.tone({ f: 330 * Math.pow(2, s / 12), type: 'triangle', dur: 0.8, vol: 0.13, delay: i * 0.11, send: 0.7 })); this.noise({ dur: 1.2, vol: 0.06, hp: 2000, lp: 9000 }); break;
      case 'heal': this.tone({ f: 520, f2: 1040, type: 'sine', dur: 0.5, vol: 0.14, send: 0.6 }); this.tone({ f: 780, f2: 1560, type: 'sine', dur: 0.5, vol: 0.08, delay: 0.05, send: 0.6 }); break;
      case 'focus': this.tone({ f: 180, f2: 260, type: 'sine', dur: 0.9, vol: 0.06 }); break;
      case 'bench': [0, 7, 12, 16].forEach((s, i) => this.tone({ f: 220 * Math.pow(2, s / 12), type: 'triangle', dur: 1.2, vol: 0.1, delay: i * 0.15, send: 0.7 })); break;
      case 'break': this.noise({ dur: 0.35, vol: 0.3, hp: 100, lp: 2500 }); this.tone({ f: 120, f2: 40, type: 'square', dur: 0.25, vol: 0.15 }); break;
      case 'spit': this.tone({ f: 500, f2: 250, type: 'square', dur: 0.12, vol: 0.08 }); this.noise({ dur: 0.1, vol: 0.06, hp: 1000 }); break;
      case 'charge': this.tone({ f: 100, f2: 260, type: 'sawtooth', dur: 0.4, vol: 0.1 }); break;
      case 'roar': this.tone({ f: 90, f2: 45, type: 'sawtooth', dur: 1.1, vol: 0.3 }); this.noise({ dur: 1.0, vol: 0.25, hp: 60, lp: 700 }); this.tone({ f: 140, f2: 70, type: 'square', dur: 0.9, vol: 0.12, delay: 0.05 }); break;
      case 'slam': this.noise({ dur: 0.35, vol: 0.35, hp: 40, lp: 600 }); this.tone({ f: 70, f2: 30, type: 'sine', dur: 0.4, vol: 0.35 }); break;
      case 'gate': this.noise({ dur: 0.5, vol: 0.25, hp: 80, lp: 1200 }); this.tone({ f: 150, f2: 60, type: 'square', dur: 0.5, vol: 0.12 }); break;
      case 'bossdeath': this.tone({ f: 200, f2: 30, type: 'sawtooth', dur: 2.2, vol: 0.3 }); this.noise({ dur: 2.0, vol: 0.3, hp: 40, lp: 900 }); [0, 7, 12, 19, 24].forEach((s, i) => this.tone({ f: 220 * Math.pow(2, s / 12), type: 'sine', dur: 1.5, vol: 0.1, delay: 0.8 + i * 0.12, send: 0.8 })); break;
      case 'cast': this.tone({ f: 600, f2: 1400, type: 'sine', dur: 0.18, vol: 0.16 }); this.noise({ dur: 0.12, vol: 0.1, hp: 1500 }); break;
      case 'flare': this.tone({ f: 300, f2: 1200, type: 'triangle', dur: 0.5, vol: 0.22, send: 0.5 }); this.noise({ dur: 0.4, vol: 0.2, hp: 400, lp: 5000 }); [0, 7, 12].forEach((s, i) => this.tone({ f: 520 * Math.pow(2, s / 12), type: 'sine', dur: 0.6, vol: 0.1, delay: 0.05 + i * 0.06, send: 0.5 })); break;
      case 'bounce': this.tone({ f: 200, f2: 700, type: 'sine', dur: 0.22, vol: 0.2 }); this.tone({ f: 100, f2: 300, type: 'triangle', dur: 0.15, vol: 0.12 }); break;
      case 'blocked': this.tone({ f: 1400, f2: 900, type: 'square', dur: 0.07, vol: 0.09 }); this.noise({ dur: 0.06, vol: 0.14, hp: 2500 }); break;
      case 'bell': this.tone({ f: 196, type: 'sine', dur: 2.2, vol: 0.25, send: 0.8 }); this.tone({ f: 196 * 2.76, type: 'sine', dur: 1.4, vol: 0.1, send: 0.8 }); this.tone({ f: 196 * 5.4, type: 'sine', dur: 0.8, vol: 0.05, send: 0.8 }); this.noise({ dur: 0.15, vol: 0.15, hp: 300, lp: 3000 }); break;
      case 'thorns': this.noise({ dur: 0.25, vol: 0.25, hp: 200, lp: 2500 }); this.tone({ f: 120, f2: 380, type: 'sawtooth', dur: 0.2, vol: 0.12 }); break;
      case 'lash': this.noise({ dur: 0.3, vol: 0.2, hp: 800, lp: 6000 }); this.tone({ f: 900, f2: 200, type: 'sine', dur: 0.3, vol: 0.1 }); break;
      case 'rumble': this.noise({ dur: 1.2, vol: 0.25, hp: 30, lp: 300 }); this.tone({ f: 40, f2: 30, type: 'sine', dur: 1.2, vol: 0.3 }); break;
      case 'hop': this.tone({ f: 260, f2: 520, type: 'triangle', dur: 0.12, vol: 0.09 }); break;
      case 'swing': this.noise({ dur: 0.14, vol: 0.2, hp: 700, lp: 5000 }); this.tone({ f: 500, f2: 180, type: 'sawtooth', dur: 0.14, vol: 0.08 }); break;
      case 'upgrade': [0, 5, 7, 12, 16, 19, 24].forEach((s, i) => this.tone({ f: 220 * Math.pow(2, s / 12), type: 'triangle', dur: 0.7, vol: 0.12, delay: i * 0.09, send: 0.7 })); this.noise({ dur: 0.8, vol: 0.08, hp: 3000 }); break;
      case 'ui': this.tone({ f: 880, type: 'sine', dur: 0.06, vol: 0.08 }); break;
      case 'text': this.tone({ f: r(1200, 1500), type: 'sine', dur: 0.02, vol: 0.02 }); break;
      case 'shard': [0, 3, 7, 10, 14].forEach((s, i) => this.tone({ f: 440 * Math.pow(2, s / 12), type: 'sine', dur: 0.5, vol: 0.1, delay: i * 0.09, send: 0.6 })); break;
    }
  }
  // --- Generative music: slow pads following a per-area chord progression + sparse melody
  setArea(area) { if (this.area !== area) { this.area = area; this.chordIdx = 0; } }
  setBoss(on) { this.boss = on; }
  startMusic() {
    if (this.musicTimer) return;
    const step = () => { this.musicStep(); this.musicTimer = setTimeout(step, this.boss ? 1700 : 3400); };
    this.musicTimer = setTimeout(step, 300);
  }
  musicStep() {
    if (!this.ctx || !this.enabled || !this.area) return;
    const M = MUSIC_THEMES[this.boss ? 'boss' : this.area] || MUSIC_THEMES.rootshade;
    const chord = M.chords[this.chordIdx % M.chords.length]; this.chordIdx++;
    const t0 = this.ctx.currentTime; const dur = this.boss ? 1.8 : 3.6;
    // pad voices
    chord.forEach((semi, i) => {
      const f = M.root * Math.pow(2, semi / 12);
      const o = this.ctx.createOscillator(); o.type = M.padType || 'triangle'; o.frequency.value = f;
      const o2 = this.ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 1.003;
      const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(M.padVol, t0 + dur * 0.45); g.gain.linearRampToValueAtTime(0.0001, t0 + dur * 1.15);
      const fl = this.ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = M.filter || 900;
      o.connect(g); o2.connect(g); g.connect(fl); fl.connect(this.musicGain); fl.connect(this.delay);
      o.start(t0); o2.start(t0); o.stop(t0 + dur * 1.2); o2.stop(t0 + dur * 1.2);
    });
    // bass
    if (M.bass) {
      const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = M.root * Math.pow(2, chord[0] / 12) / 2;
      const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(M.bass, t0 + 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(this.musicGain); o.start(t0); o.stop(t0 + dur);
    }
    // sparse melody: plucked notes from the chord/scale
    const n = this.boss ? 4 : (Math.random() < 0.6 ? 1 + Math.floor(Math.random() * 3) : 0);
    for (let i = 0; i < n; i++) {
      const semi = pick(M.scale) + 12 * (Math.random() < 0.5 ? 1 : 2);
      const f = M.root * Math.pow(2, semi / 12); const d = t0 + Math.random() * dur * 0.8;
      const o = this.ctx.createOscillator(); o.type = M.leadType || 'sine'; o.frequency.value = f;
      const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, d); g.gain.linearRampToValueAtTime(M.leadVol, d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, d + 1.4);
      o.connect(g); g.connect(this.musicGain); g.connect(this.delay); o.start(d); o.stop(d + 1.5);
    }
    // boss percussion
    if (this.boss) for (let i = 0; i < 4; i++) { const d = i * 0.45; this.noise({ dur: 0.12, vol: i % 2 ? 0.08 : 0.16, hp: 60, lp: i % 2 ? 3000 : 500, delay: d }); this.tone({ f: 80, f2: 35, type: 'sine', dur: 0.2, vol: i % 2 ? 0.05 : 0.2, delay: d }); }
  }
}
const MUSIC_THEMES = {
  rootshade: { root: 110, chords: [[0, 7, 12, 16], [-2, 5, 10, 14], [-4, 3, 8, 12], [-2, 5, 10, 15]], scale: [0, 2, 4, 7, 9, 11], padVol: 0.05, leadVol: 0.05, filter: 800, bass: 0.06 },
  fernwake: { root: 130.81, chords: [[0, 4, 7, 11], [2, 5, 9, 12], [-3, 0, 4, 7], [-5, -1, 2, 7]], scale: [0, 2, 4, 5, 7, 9, 11], padVol: 0.045, leadVol: 0.06, filter: 1200, bass: 0.05, leadType: 'triangle' },
  drownwell: { root: 82.41, chords: [[0, 3, 7, 10], [-4, 0, 3, 7], [-2, 1, 5, 8], [0, 3, 7, 14]], scale: [0, 3, 5, 7, 10], padVol: 0.05, leadVol: 0.035, filter: 500, bass: 0.07, padType: 'sine' },
  chimeglass: { root: 164.81, chords: [[0, 4, 7, 14], [-3, 2, 4, 9], [-5, -1, 2, 7], [-7, 0, 4, 7]], scale: [0, 2, 4, 7, 9, 12, 14], padVol: 0.04, leadVol: 0.06, filter: 1600, bass: 0.03, leadType: 'sine' },
  bramblehush: { root: 98, chords: [[0, 3, 7, 10], [-2, 2, 5, 9], [-4, 0, 3, 7], [-5, -2, 2, 5]], scale: [0, 3, 5, 7, 8, 10], padVol: 0.045, leadVol: 0.04, filter: 700, bass: 0.05, padType: 'triangle' },
  puffcap: { root: 146.83, chords: [[0, 4, 7, 9], [2, 5, 9, 11], [-3, 0, 4, 9], [-1, 2, 7, 11]], scale: [0, 2, 4, 7, 9], padVol: 0.04, leadVol: 0.06, filter: 1400, bass: 0.04, leadType: 'triangle' },
  lanternry: { root: 123.47, chords: [[0, 4, 7, 11], [-3, 0, 4, 7], [-5, -1, 2, 7], [-7, -3, 0, 4]], scale: [0, 2, 4, 5, 7, 9, 11], padVol: 0.045, leadVol: 0.05, filter: 1000, bass: 0.05, padType: 'sine', leadType: 'sine' },
  cinderthroat: { root: 98, chords: [[0, 3, 7, 12], [-1, 3, 6, 10], [0, 5, 8, 12], [-2, 1, 5, 12]], scale: [0, 1, 3, 5, 7, 8, 10], padVol: 0.05, leadVol: 0.04, filter: 700, bass: 0.08, padType: 'sawtooth' },
  boss: { root: 73.42, chords: [[0, 3, 7], [0, 3, 6], [-1, 2, 6], [0, 3, 7]], scale: [0, 1, 3, 6, 7, 10], padVol: 0.06, leadVol: 0.05, filter: 900, bass: 0.1, padType: 'sawtooth', leadType: 'square' },
};
