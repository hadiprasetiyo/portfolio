/* Suara latar: dengung organ dan detak jam samar yang dibangkitkan Web Audio, tanpa file audio.
   Tidak pernah berbunyi sendiri; tombol di navigasi memutar, menjeda, dan melanjutkan. */
export function startSound() {
  const soundButton = document.querySelector('.sound');
  if (!soundButton) return;
  const labels = { play: soundButton.dataset.play, pause: soundButton.dataset.pause };
  let sound = null;
  const createSound = () => {
    const context = new (window.AudioContext || window.webkitAudioContext)();
    const master = context.createGain();
    master.gain.value = 0;
    master.connect(context.destination);
    // gema panjang dari derau yang meluruh, memberi kesan ruang luas seperti katedral
    const reverb = context.createConvolver();
    const impulse = context.createBuffer(2, context.sampleRate * 5, context.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const samples = impulse.getChannelData(channel);
      for (let index = 0; index < samples.length; index++) samples[index] = (Math.random() * 2 - 1) * Math.pow(1 - index / samples.length, 3);
    }
    reverb.buffer = impulse;
    const tone = context.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 1500;
    const dry = context.createGain();
    dry.gain.value = 0.45;
    const wet = context.createGain();
    wet.gain.value = 0.75;
    tone.connect(dry).connect(master);
    tone.connect(reverb).connect(wet).connect(master);

    // akor A minor, F, C, E minor; berganti tiap 12 detik dengan peralihan 5 detik
    const chords = [[110, 164.81, 220, 261.63, 329.63], [87.31, 130.81, 174.61, 220, 261.63], [65.41, 130.81, 196, 261.63, 329.63], [82.41, 123.47, 164.81, 246.94, 329.63]];
    let voices = [];
    let chordIndex = 0;
    const playChord = () => {
      // selama dijeda waktu audio berhenti, jadi akor baru tidak boleh dibuat (tidak akan pernah berhenti)
      if (context.state !== 'running') return;
      const now = context.currentTime;
      voices.forEach((voice) => {
        voice.gain.gain.cancelScheduledValues(now);
        voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
        voice.gain.gain.linearRampToValueAtTime(0, now + 5);
        voice.oscillators.forEach((oscillator) => oscillator.stop(now + 5.2));
      });
      voices = chords[chordIndex % chords.length].map((frequency, index) => {
        const gain = context.createGain();
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(index === 0 ? 0.11 : 0.06, now + 5);
        gain.connect(tone);
        // dua osilator yang sedikit tidak selaras membuat nada berdenyut seperti pipa organ
        const oscillators = [0, 2.2].map((detune, layer) => {
          const oscillator = context.createOscillator();
          oscillator.type = layer ? 'triangle' : 'sine';
          oscillator.frequency.value = frequency;
          oscillator.detune.value = detune;
          oscillator.connect(gain);
          oscillator.start(now);
          return oscillator;
        });
        return { gain, oscillators };
      });
      chordIndex += 1;
    };
    setInterval(playChord, 12000);

    const tickBuffer = context.createBuffer(1, Math.round(context.sampleRate * 0.03), context.sampleRate);
    const tickSamples = tickBuffer.getChannelData(0);
    for (let index = 0; index < tickSamples.length; index++) tickSamples[index] = (Math.random() * 2 - 1) * Math.pow(1 - index / tickSamples.length, 4);
    const tickFilter = context.createBiquadFilter();
    tickFilter.type = 'bandpass';
    tickFilter.frequency.value = 2600;
    tickFilter.Q.value = 3;
    const tickGain = context.createGain();
    tickGain.gain.value = 0.16;
    tickFilter.connect(tickGain).connect(master);
    let nextTick = 0;
    setInterval(() => {
      if (context.state !== 'running') return;
      if (nextTick < context.currentTime) nextTick = context.currentTime + 0.1;
      while (nextTick < context.currentTime + 1) {
        const source = context.createBufferSource();
        source.buffer = tickBuffer;
        source.connect(tickFilter);
        source.start(nextTick);
        nextTick += 1.2;
      }
    }, 250);
    return { context, master, playChord, started: false };
  };
  const fadeTo = (value, seconds) => {
    const now = sound.context.currentTime;
    sound.master.gain.cancelScheduledValues(now);
    sound.master.gain.setValueAtTime(sound.master.gain.value, now);
    sound.master.gain.linearRampToValueAtTime(value, now + seconds);
  };
  const setSound = (on) => {
    soundButton.setAttribute('aria-pressed', String(on));
    soundButton.setAttribute('aria-label', on ? labels.pause : labels.play);
    if (on) {
      if (!sound) sound = createSound();
      sound.context.resume().then(() => {
        if (!sound.started) {
          sound.started = true;
          sound.playChord();
        }
        fadeTo(0.5, 2);
      });
    } else if (sound) {
      fadeTo(0, 0.8);
      // jeda sesungguhnya setelah suara memudar, kecuali sempat dinyalakan lagi
      setTimeout(() => {
        if (soundButton.getAttribute('aria-pressed') === 'false') sound.context.suspend();
      }, 900);
    }
  };
  soundButton.addEventListener('click', () => setSound(soundButton.getAttribute('aria-pressed') !== 'true'));
}
