import { Howl, Howler } from 'howler';

class AudioSystem {
  constructor() {
    this.sounds = {};
    this.musicVolume = 0.3;
    this.sfxVolume = 0.6;
    this.bgm = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;

    // For MVP: generate simple procedural sounds using Web Audio via Howler
    // These are tiny placeholder beeps/noises - replace with real .wav files later
    this.sounds = {
      hit: this._createToneSound(400, 0.08, 'square'),
      pocket: this._createToneSound(800, 0.15, 'sine'),
      wall: this._createToneSound(200, 0.05, 'square'),
      explosion: this._createNoiseSound(0.2),
      lightning: this._createToneSound(1200, 0.1, 'sawtooth'),
      portal: this._createToneSound(600, 0.15, 'sine', true),
      purchase: this._createToneSound(1000, 0.1, 'sine'),
      'ui-click': this._createToneSound(500, 0.05, 'square'),
      'level-complete': this._createToneSound(700, 0.3, 'sine'),
    };
  }

  _createToneSound(freq, duration, type, sweep = false) {
    // Create a tiny audio buffer as a data URI for Howler
    const sampleRate = 22050;
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = new Float32Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const envelope = 1 - (i / numSamples); // linear decay
      const f = sweep ? freq + (freq * 0.5 * t) : freq;
      let sample;
      switch (type) {
        case 'square':
          sample = Math.sin(2 * Math.PI * f * t) > 0 ? 1 : -1;
          break;
        case 'sawtooth':
          sample = 2 * ((f * t) % 1) - 1;
          break;
        default: // sine
          sample = Math.sin(2 * Math.PI * f * t);
      }
      buffer[i] = sample * envelope * 0.3;
    }

    const wav = this._floatToWav(buffer, sampleRate);
    const blob = new Blob([wav], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);

    return new Howl({
      src: [url],
      format: ['wav'],
      volume: this.sfxVolume,
    });
  }

  _createNoiseSound(duration) {
    const sampleRate = 22050;
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = new Float32Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
      const envelope = 1 - (i / numSamples);
      buffer[i] = (Math.random() * 2 - 1) * envelope * 0.3;
    }

    const wav = this._floatToWav(buffer, sampleRate);
    const blob = new Blob([wav], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);

    return new Howl({
      src: [url],
      format: ['wav'],
      volume: this.sfxVolume,
    });
  }

  _floatToWav(samples, sampleRate) {
    const numSamples = samples.length;
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);

    const writeString = (offset, str) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, numSamples * 2, true);

    for (let i = 0; i < numSamples; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }

    return buffer;
  }

  play(name, rateVariance = 0.1) {
    const sound = this.sounds[name];
    if (!sound) return;
    const rate = 1 + (Math.random() * 2 - 1) * rateVariance;
    const id = sound.play();
    sound.rate(rate, id);
    return id;
  }

  playMusic() { this.bgm?.play(); }
  stopMusic() { this.bgm?.stop(); }

  setMusicVolume(v) {
    this.musicVolume = v;
    this.bgm?.volume(v);
  }

  setSfxVolume(v) {
    this.sfxVolume = v;
    Object.values(this.sounds).forEach(s => s.volume(v));
  }
}

export const audio = new AudioSystem();
