/**
 * 轻量音效：Web Audio 合成，不加载音频文件。
 * 读取全站偏好 noomings_sound；顶栏声音开关变化时实时同步。
 */
(function () {
  'use strict';

  var ctx = null;
  var master = null;
  var noiseBuffer = null;
  var enabled = readEnabled();
  var reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function readEnabled() {
    try {
      var stored = localStorage.getItem('noomings_sound');
      if (stored === '0' || stored === 'false') return false;
      if (stored === '1' || stored === 'true') return true;
    } catch (e) { /* ignore */ }
    return true;
  }

  function syncEnabled() {
    try {
      if (window.noomingsPrefs && typeof window.noomingsPrefs.getSound === 'function') {
        enabled = !!window.noomingsPrefs.getSound();
        return;
      }
    } catch (e) { /* ignore */ }
    enabled = readEnabled();
  }

  document.documentElement.addEventListener('noomings:prefs', function (event) {
    if (event && event.detail && typeof event.detail.sound === 'boolean') {
      enabled = event.detail.sound;
    }
  });

  window.addEventListener('storage', function (event) {
    if (event.key === 'noomings_sound') enabled = readEnabled();
  });

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(function () {});
      return ctx;
    }
    var Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch (e) {
      return null;
    }
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);

    var length = Math.floor(ctx.sampleRate * 0.2);
    noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
    var data = noiseBuffer.getChannelData(0);
    for (var i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3);
    }
    return ctx;
  }

  function unlock() {
    if (!enabled) return;
    var ac = ensure();
    if (ac && ac.state === 'suspended') ac.resume().catch(function () {});
  }

  document.addEventListener('pointerdown', unlock, true);
  document.addEventListener('keydown', unlock, true);

  function tone(freq, duration, type, volume, delay, endFreq) {
    if (!enabled) return;
    var ac = ensure();
    if (!ac) return;
    var start = ac.currentTime + (delay || 0);
    var osc = ac.createOscillator();
    var gain = ac.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, start);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume || 0.08, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  function noise(duration, center, volume, delay) {
    if (!enabled) return;
    var ac = ensure();
    if (!ac || !noiseBuffer) return;
    var start = ac.currentTime + (delay || 0);
    var source = ac.createBufferSource();
    source.buffer = noiseBuffer;
    var filter = ac.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = center || 900;
    filter.Q.value = 0.8;
    var gain = ac.createGain();
    gain.gain.setValueAtTime(volume || 0.03, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(start);
    source.stop(start + duration);
  }

  function arpeggio(notes, step, volume) {
    notes.forEach(function (freq, index) {
      tone(freq, 0.16, 'triangle', volume || 0.06, index * step);
    });
  }

  var sounds = {
    stone: function () {
      tone(176, 0.075, 'triangle', 0.12);
      tone(88, 0.1, 'sine', 0.07, 0.008);
      noise(0.035, 1000, 0.025);
    },
    capture: function () {
      noise(0.07, 1500, 0.05);
      tone(280, 0.09, 'triangle', 0.08, 0.02);
      tone(140, 0.12, 'sine', 0.05, 0.035);
    },
    pass: function () {
      tone(330, 0.07, 'sine', 0.045);
      tone(247, 0.09, 'sine', 0.04, 0.055);
    },
    undo: function () {
      tone(340, 0.06, 'sine', 0.045);
      tone(240, 0.08, 'sine', 0.035, 0.045);
    },
    flip: function () {
      noise(0.12, 1200, 0.045);
      tone(520, 0.06, 'triangle', 0.045, 0.08, 760);
    },
    card: function () {
      noise(0.055, 1800, 0.035);
      tone(420, 0.04, 'triangle', 0.025, 0.01);
    },
    coin: function () {
      tone(880, 0.07, 'sine', 0.055);
      tone(1320, 0.09, 'sine', 0.035, 0.06);
      noise(0.04, 2400, 0.02, 0.02);
    },
    tick: function () {
      tone(1180, 0.018, 'square', 0.014);
    },
    click: function () {
      tone(600, 0.025, 'sine', 0.025);
    },
    error: function () {
      tone(130, 0.1, 'sawtooth', 0.035);
      tone(110, 0.12, 'sawtooth', 0.025, 0.06);
    },
    reveal: function () {
      tone(660, 0.08, 'triangle', 0.055);
      tone(990, 0.1, 'triangle', 0.045, 0.075);
    },
    win: function () {
      arpeggio([523.25, 659.25, 783.99, 1046.5], 0.085, 0.055);
    },
    draw: function () {
      tone(392, 0.14, 'sine', 0.045);
      tone(330, 0.18, 'sine', 0.04, 0.1);
    },
    lose: function () {
      tone(392, 0.12, 'sine', 0.04);
      tone(311, 0.14, 'sine', 0.035, 0.09);
      tone(247, 0.2, 'sine', 0.03, 0.18);
    }
  };

  function play(name) {
    if (!enabled) return false;
    var fn = sounds[name];
    if (!fn) return false;
    if (!ensure()) return false;
    if (ctx.state === 'suspended') ctx.resume().catch(function () {});
    fn();
    return true;
  }

  window.SoundFX = {
    play: play,
    unlock: unlock,
    setEnabled: function (value) {
      enabled = !!value;
      if (enabled) ensure();
    },
    getEnabled: function () { return enabled; },
    reducedMotion: function () { return reducedMotion; }
  };

  syncEnabled();
})();
