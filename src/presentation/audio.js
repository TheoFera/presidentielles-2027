/* Son du jeu : musique arcade et bruitages entièrement synthétisés (Web Audio), sans fichier audio.
   Le navigateur n'autorise le son qu'après un premier geste (clic, toucher, touche) : unlock() s'en charge. */
export const SOUND_KEY = 'presidentielles2027:sound:v1';

const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
// « C#5 » → numéro MIDI (La 4 = 69).
export function midi(name) {
  const match = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!match) throw new Error(`Note inconnue : ${name}`);
  return 12 * (Number(match[3]) + 1) + NOTE[match[1]] + (match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0);
}
const frequency = note => 440 * 2 ** ((note - 69) / 12);

// Une mélodie s'écrit en doubles croches : note, « - » prolonge, « . » silence.
export function parseMelody(text) {
  const notes = [];
  text.trim().split(/\s+/).filter(token => token !== '|').forEach((token, step) => {
    if (token === '-') { if (notes.at(-1)) notes.at(-1).length++; return; }
    if (token === '.') return;
    notes.push({ step, note: midi(token), length: 1 });
  });
  return notes;
}
// Accord « Am » : fondamentale entre La 2 et Sol# 3 pour une basse toujours audible.
function chord(name) {
  const [, root, minor] = /^([A-G][#b]?)(m?)$/.exec(name);
  const base = midi(`${root}3`);
  const note = base < 45 ? base + 12 : base > 56 ? base - 12 : base;
  return { root: note, tones: minor ? [0, 3, 7] : [0, 4, 7] };
}

const TRACKS = {
  menu: { bpm: 126, chords: ['C', 'Am', 'F', 'G'], lead: 0.1,
    melody: 'E5 - G5 - C6 - - - B5 - G5 - E5 - - - | A5 - - - C6 - B5 - A5 - E5 - - - . . | F5 - A5 - C6 - - - D6 - C6 - A5 - - - | G5 - B5 - D6 - - - B5 - A5 - G5 - D5 -',
    kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.' },
  campaign: { bpm: 104, chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G'], lead: 0.08, restingLoops: true,
    melody: 'A4 - C5 - E5 - - - D5 - C5 - B4 - C5 - | A4 - - - F4 - A4 - C5 - - - . . . . | G4 - C5 - E5 - G5 - E5 - D5 - C5 - - - | D5 - - - B4 - - - G4 - - - . . . . | E5 - - - E5 - D5 - C5 - - - A4 - - - | C5 - - - A4 - C5 - F5 - - - E5 - - - | E5 - G5 - - - E5 - C5 - D5 - E5 - - - | D5 - - - - - - - B4 - - - G4 - - -',
    kick: 'x.......x.x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' },
  sprint: { bpm: 160, chords: ['Dm', 'Bb', 'C', 'A'], lead: 0.09, drivingBass: true,
    melody: 'D5 . D5 . F5 . D5 . A5 - - - G5 - F5 - | F5 . F5 . D5 . F5 . Bb5 - - - A5 - G5 - | E5 . E5 . G5 . E5 . C6 - - - Bb5 - G5 - | A5 - - - C#6 - - - E6 - - - C#6 - A5 -',
    kick: 'x...x...x...x...', snare: '....x.......x.x.', hat: 'xxxxxxxxxxxxxxxx' },
  // En campagne, quand notre candidat se met en garde : riff mineur tendu, basse pulsée, batterie syncopée.
  combat: { bpm: 144, chords: ['Em', 'C', 'D', 'B'], lead: 0.085, drivingBass: true,
    melody: 'E5 . E5 . G5 . E5 . B5 - - - A5 - G5 - | E5 . E5 . G5 . E5 . C6 - - - B5 - G5 - | F#5 . F#5 . A5 . F#5 . D6 - - - C6 - A5 - | B5 - - - A5 - - - G5 - - - F#5 - D#5 -',
    kick: 'x..x..x.x..x..x.', snare: '....x.......x...', hat: 'x.xxx.xxx.xxx.xx' },
};
for (const track of Object.values(TRACKS)) { track.notes = parseMelody(track.melody); track.harmony = track.chords.map(chord); }

const JINGLES = {
  victory: { bpm: 150, melody: 'G4 . C5 . E5 . G5 - - - E5 . G5 - - - - - - - - - - -', bass: ['C', 'C', 'G', 'C'] },
  qualified: { bpm: 150, melody: 'E5 . G5 . C6 - - - D6 . E6 - - - - -', bass: ['C', 'G'] },
  defeat: { bpm: 96, melody: 'G4 - - F#4 - - F4 - - E4 - - - - - -', bass: ['C', 'C'] },
  eliminated: { bpm: 110, melody: 'C5 - A4 - F4 - - - D4 - - - - - - -', bass: ['F', 'Dm'] },
};
for (const jingle of Object.values(JINGLES)) jingle.notes = parseMelody(jingle.melody);

const PARTISAN_EVENTS = new Set(['NpcConverted']);
// Traduit les nouveaux événements de la simulation en bruitages pour le joueur local.
export function soundCues(events = [], since, localId, faction) {
  const cues = []; let last = since;
  for (const event of events) {
    const number = Number(String(event.id).slice(6));
    if (!(number > since)) continue;
    last = Math.max(last, number);
    const mine = event.candidate_id === localId;
    if (event.type === 'MoneyPickedUp' && mine) cues.push('coin');
    else if (event.type === 'FundingCollected' && mine) cues.push('cash');
    else if (PARTISAN_EVENTS.has(event.type) && event.faction_id === faction) cues.push('recruit');
    else if (['SiteCaptured', 'HeadquartersEstablished'].includes(event.type) && mine) cues.push('build');
    else if (['BuildingUpgraded', 'TractOrdered'].includes(event.type) && mine) cues.push('purchase');
    else if (event.type === 'PollPurchased' && event.faction_id === faction) cues.push('poll');
    else if (event.type === 'MeetingStarted' && mine) cues.push('cheer');
    else if (event.type === 'HitResolved' && event.source_id === localId) cues.push('hit');
    else if (event.type === 'HitResolved' && event.target_id === localId) cues.push('hurt');
    else if (event.type === 'CandidateKO' && mine) cues.push('ko');
    else if (event.type === 'DebateKnockout') cues.push('ko', 'cheer');
    else if (event.type === 'DebateFightStarted') cues.push('tick-final');
    else if (event.type === 'UltimateActivated' && mine) cues.push('ultimate');
    else if (event.type === 'UltimateReady' && mine) cues.push('ready');
    else if (event.type === 'StartCampaignEvent') cues.push('news');
    else if (event.type === 'DayChanged' && event.days_remaining > 0 && event.days_remaining <= 5) cues.push('tick');
  }
  return { cues, last };
}

export class GameAudio {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage; this.ctx = null; this.track = null; this.wanted = null; this.ducked = false; this.lastPlayed = new Map();
    try { this.muted = !!JSON.parse(storage?.getItem(SOUND_KEY) || '{}').muted; } catch { this.muted = false; }
  }
  /** À appeler lors d'un geste de l'utilisateur. */
  unlock() {
    const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Context) return;
    if (!this.ctx) {
      try { this.ctx = new Context(); } catch { return; }
      this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.8; this.master.connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain(); this.musicBus.gain.value = this.ducked ? 0.09 : 0.24; this.musicBus.connect(this.master);
      this.sfxBus = this.ctx.createGain(); this.sfxBus.gain.value = 0.55; this.sfxBus.connect(this.master);
      const length = this.ctx.sampleRate; this.noise = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0); for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      this.timer = setInterval(() => this.schedule(), 25);
      document.addEventListener('visibilitychange', () => { if (document.hidden) void this.ctx.suspend(); else void this.ctx.resume(); });
      if (this.wanted) this.music(this.wanted, true);
    }
    if (this.ctx.state === 'suspended' && !document.hidden) void this.ctx.resume();
  }
  setMuted(muted) {
    this.muted = muted;
    try { this.storage?.setItem(SOUND_KEY, JSON.stringify({ muted })); } catch { /* Stockage indisponible : réglage pour cette session seulement. */ }
    if (this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 0.8, this.ctx.currentTime, 0.03);
  }
  toggle() { this.setMuted(!this.muted); return this.muted; }
  /** Musique plus discrète pendant la pause. */
  duck(ducked) {
    if (this.ducked === ducked) return;
    this.ducked = ducked;
    if (this.ctx) this.musicBus.gain.setTargetAtTime(ducked ? 0.09 : 0.24, this.ctx.currentTime, 0.2);
  }
  /** Change de morceau : 'menu', 'campaign', 'combat', 'sprint' ou null pour le silence. */
  music(name, force = false) {
    if (this.wanted === name && !force) return;
    this.wanted = name;
    if (!this.ctx) return;
    this.track = TRACKS[name] || null; this.step = 0; this.loop = 0;
    this.nextStep = this.ctx.currentTime + 0.08;
  }
  schedule() {
    if (!this.track || this.ctx.state !== 'running') return;
    const track = this.track, sixteenth = 60 / track.bpm / 4, bars = track.harmony.length;
    // Après une longue pause de l'onglet, on repart de maintenant au lieu de rattraper.
    if (this.nextStep < this.ctx.currentTime - 0.2) this.nextStep = this.ctx.currentTime + 0.05;
    while (this.nextStep < this.ctx.currentTime + 0.12) {
      const step = this.step % (bars * 16), bar = Math.floor(step / 16), beat = step % 16, time = this.nextStep;
      const harmony = track.harmony[bar];
      // Basse : rebond d'octave en croches, ou pulsation fondamentale/quinte en doubles croches pour le sprint.
      if (track.drivingBass) this.tone(frequency(harmony.root - 12 + (beat % 4 === 2 ? 7 : 0)), time, sixteenth * 0.8, 'triangle', 0.3, this.musicBus);
      else if (beat % 2 === 0) this.tone(frequency(harmony.root - 12 + (beat % 4 === 2 ? 12 : 0)), time, sixteenth * 1.6, 'triangle', 0.3, this.musicBus);
      // Arpège discret des notes de l'accord.
      const tone = harmony.tones[[0, 1, 2, 1][beat % 4]];
      this.tone(frequency(harmony.root + 12 + tone), time, sixteenth * 0.7, 'square', 0.025, this.musicBus, 1800);
      // Mélodie ; en campagne, une boucle sur deux laisse respirer (arpège seul).
      if (!(track.restingLoops && this.loop % 2 === 1)) {
        for (const note of track.notes) if (note.step === step) this.tone(frequency(note.note), time, note.length * sixteenth * 0.92, 'square', track.lead, this.musicBus, 2600);
      }
      if (track.kick[beat] === 'x') this.kick(time, this.musicBus, 0.5);
      if (track.snare[beat] === 'x') this.snare(time, this.musicBus, 0.22);
      if (track.hat[beat] === 'x') this.hat(time, this.musicBus, beat % 4 === 0 ? 0.08 : 0.05);
      this.nextStep += sixteenth; this.step++;
      if (this.step % (bars * 16) === 0) this.loop++;
    }
  }
  tone(freq, time, duration, type, volume, destination, cutoff = 0, slideTo = 0) {
    const ctx = this.ctx, osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, time);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, time + duration);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    let output = osc;
    if (cutoff) { const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = cutoff; osc.connect(filter); output = filter; }
    output.connect(gain); gain.connect(destination);
    osc.start(time); osc.stop(time + duration + 0.02);
  }
  burst(time, duration, volume, destination, type, freq, attack = 0.002) {
    const ctx = this.ctx, source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    source.buffer = this.noise; filter.type = type; filter.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    source.connect(filter); filter.connect(gain); gain.connect(destination);
    source.start(time, Math.random() * 0.5); source.stop(time + duration + 0.02);
  }
  kick(time, destination, volume) { this.tone(150, time, 0.14, 'sine', volume, destination, 0, 42); }
  snare(time, destination, volume) { this.burst(time, 0.12, volume, destination, 'bandpass', 1800); this.tone(190, time, 0.06, 'triangle', volume * 0.5, destination); }
  hat(time, destination, volume) { this.burst(time, 0.035, volume, destination, 'highpass', 7000); }

  /** Petite musique de fin (victoire, qualification, défaite, élimination), après un délai en secondes. */
  jingle(name, delay = 0) {
    const jingle = JINGLES[name];
    if (!jingle || !this.ctx) return;
    const sixteenth = 60 / jingle.bpm / 4, start = this.ctx.currentTime + delay;
    for (const note of jingle.notes) this.tone(frequency(note.note), start + note.step * sixteenth, note.length * sixteenth * 0.95, 'square', 0.16, this.sfxBus, 3200);
    const barLength = jingle.notes.at(-1).step + jingle.notes.at(-1).length;
    jingle.bass.forEach((name, i, all) => {
      const harmony = chord(name), time = start + i * barLength / all.length * sixteenth;
      this.tone(frequency(harmony.root - 12), time, barLength / all.length * sixteenth, 'triangle', 0.35, this.sfxBus);
      if (i === all.length - 1) for (const tone of harmony.tones) this.tone(frequency(harmony.root + 12 + tone), time, barLength / all.length * sixteenth * 1.4, 'square', 0.04, this.sfxBus, 2200);
    });
  }
  /** Bruitage court. Un même son répété trop vite est ignoré pour ne pas saturer. */
  play(name) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime, previous = this.lastPlayed.get(name) ?? -1;
    if (now - previous < 0.07) return;
    this.lastPlayed.set(name, now);
    const bus = this.sfxBus, t = now + 0.005, f = frequency, n = midi;
    switch (name) {
      case 'ui': this.tone(660, t, 0.05, 'square', 0.08, bus, 3000, 990); break;
      case 'coin': this.tone(f(n('B5')), t, 0.06, 'square', 0.07, bus, 4000); this.tone(f(n('E6')), t + 0.06, 0.16, 'square', 0.07, bus, 4000); break;
      case 'cash': ['C6', 'E6', 'G6', 'C7'].forEach((note, i) => this.tone(f(n(note)), t + i * 0.05, 0.12, 'square', 0.06, bus, 5000)); break;
      case 'recruit': ['C5', 'E5', 'G5'].forEach((note, i) => this.tone(f(n(note)), t + i * 0.055, 0.14, 'triangle', 0.22, bus)); break;
      case 'build': this.kick(t, bus, 0.5); ['C5', 'G5', 'C6'].forEach((note, i) => this.tone(f(n(note)), t + 0.05 + i * 0.07, 0.3, 'square', 0.06, bus, 3000)); break;
      case 'purchase': this.tone(f(n('C5')), t, 0.06, 'square', 0.07, bus, 3000); this.tone(f(n('G5')), t + 0.06, 0.12, 'square', 0.07, bus, 3000); break;
      case 'poll': this.tone(f(n('E5')), t, 0.3, 'sine', 0.2, bus); this.tone(f(n('C5')), t + 0.22, 0.45, 'sine', 0.2, bus); break;
      case 'cheer': this.burst(t, 0.9, 0.12, bus, 'bandpass', 1300, 0.15); ['G4', 'C5', 'E5'].forEach((note, i) => this.tone(f(n(note)), t + i * 0.09, 0.25, 'square', 0.06, bus, 2800)); break;
      case 'hit': this.burst(t, 0.07, 0.25, bus, 'bandpass', 900); this.tone(220, t, 0.08, 'square', 0.06, bus, 1500, 110); break;
      case 'hurt': this.tone(330, t, 0.2, 'square', 0.1, bus, 1600, 90); this.burst(t, 0.1, 0.18, bus, 'lowpass', 700); break;
      case 'ko': this.tone(440, t, 0.7, 'sawtooth', 0.09, bus, 1800, 55); break;
      case 'ultimate': this.tone(200, t, 0.4, 'sawtooth', 0.08, bus, 2500, 1200); this.burst(t + 0.1, 0.4, 0.12, bus, 'highpass', 3000, 0.1); break;
      case 'ready': ['G5', 'B5', 'D6'].forEach((note, i) => this.tone(f(n(note)), t + i * 0.06, 0.16, 'sine', 0.16, bus)); break;
      // Jingle « flash info » : arpège montant puis double accord, façon générique de journal télévisé.
      case 'news': ['G5', 'C6', 'E6'].forEach((note, i) => this.tone(f(n(note)), t + i * 0.07, 0.09, 'square', 0.07, bus, 4000)); this.kick(t + 0.22, bus, 0.35); [0.22, 0.42].forEach(delay => ['C5', 'G5', 'C6'].forEach(note => this.tone(f(n(note)), t + delay, 0.16, 'square', 0.045, bus, 3200))); break;
      case 'tick': this.tone(1000, t, 0.05, 'sine', 0.16, bus); break;
      case 'tick-final': this.tone(1500, t, 0.08, 'sine', 0.2, bus); break;
      default: break;
    }
  }
}

/* Choisit la musique selon l'écran et la phase, et déclenche bruitages et jingles. */
export class SoundDirector {
  constructor(audio, hz) { this.audio = audio; this.hz = hz; this.reset(); }
  reset() { this.lastEvent = null; this.phase = null; this.second = null; this.combatUntil = -1; }
  /** combat : notre candidat est en position de combat (même détection que l'animation de garde). */
  update(state, { menu = false, paused = false, combat = false } = {}) {
    const audio = this.audio;
    if (menu) { audio.duck(false); audio.music('menu'); this.reset(); return; }
    audio.duck(paused || !!state.campaign_style_selection);
    const local = state.candidates.find(c => c.id === state.local_candidate_id), faction = local?.faction_id;
    if (state.phase !== this.phase) {
      const previous = this.phase; this.phase = state.phase;
      if (state.mode === 'DEBATE') {
        // Mode Débat : musique nerveuse pendant le combat, jingle à la fin.
        if (state.phase === 'OVER') { audio.music(null); if (previous !== null) audio.jingle(state.winner_id === state.local_candidate_id ? 'victory' : 'defeat', 0.4); }
        else audio.music('sprint');
      } else if (state.phase === 'SECOND_ROUND_SPRINT') audio.music(local?.eliminated ? 'campaign' : 'sprint');
      else if (['FIRST_ROUND_RESULTS', 'RESULTS'].includes(state.phase)) {
        audio.music(null);
        // Le jingle tombe avec le tampon « Qualifié / Élu » de la soirée électorale.
        const delay = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0.2 : 3.2;
        const success = state.phase === 'FIRST_ROUND_RESULTS' ? state.first_round_result?.ranking.slice(0, 2).includes(faction) : state.result?.winner === faction;
        if (previous !== null) audio.jingle(state.phase === 'FIRST_ROUND_RESULTS' ? success ? 'qualified' : 'eliminated' : success ? 'victory' : 'defeat', delay);
      }
    }
    if (state.mode !== 'DEBATE' && state.phase === 'CAMPAIGN') {
      // Musique de combat tant qu'on est en garde, gardée 2 s de plus pour ne pas alterner à chaque esquive.
      if (combat) this.combatUntil = state.tick + 2 * this.hz;
      audio.music(state.tick <= this.combatUntil ? 'combat' : 'campaign');
    }
    const newest = Math.max(0, ...(state.events || []).map(e => Number(String(e.id).slice(6)) || 0));
    // Nouvelle partie ou premier affichage : on ne rejoue pas les anciens événements.
    if (this.lastEvent === null || newest < this.lastEvent) this.lastEvent = newest;
    const { cues, last } = soundCues(state.events, this.lastEvent, state.local_candidate_id, faction);
    this.lastEvent = last;
    if (!paused) for (const cue of cues) audio.play(cue);
    if (state.mode === 'DEBATE' && state.phase === 'COUNTDOWN' && !paused) {
      const second = Math.ceil(state.countdown_ticks / this.hz);
      if (second !== this.second && second > 0) audio.play('tick');
      this.second = second;
    }
    if (state.phase === 'SECOND_ROUND_SPRINT' && !paused) {
      const second = Math.ceil((state.sprint_remaining_ticks || 0) / this.hz);
      if (second !== this.second && second > 0 && second <= 10) audio.play(second <= 3 ? 'tick-final' : 'tick');
      this.second = second;
    }
  }
}
