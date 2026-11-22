/**
 * 所有声音都是现场合成的：风、脚步、烛火的钟鸣、刻字的石屑。
 * 不放任何音频文件，既省体积，也让每台机器听到的墓园略有不同。
 */
export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.started = false;
    this.lastStep = 0;
    this.ambientKind = null;
    this.ambientGain = null;
    this.ambientStop = null;
    this.ambientLevel = -1;
    this.ambientPan = 0;
    this.ambientPanner = null;
    this.placeNodes = null;
    this.placeLevels = { water: 0, forest: 0, wind: 1, wet: 0 };
    this.muted = false;
  }

  /** 关掉所有声音，包括风、脚步和碑前的声音。 */
  setMuted(muted) {
    this.muted = !!muted;
    if (!this.started) return;
    this.master.gain.setTargetAtTime(this.muted ? 0.0001 : 0.9, this.ctx.currentTime, 0.15);
  }

  start() {
    if (this.started) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    // 所有声音都穿这一层；平时几乎全开，站进水里时整片墓园会闷下来。
    this.muffle = this.ctx.createBiquadFilter();
    this.muffle.type = "lowpass";
    this.muffle.frequency.value = 20000;
    this.muffle.Q.value = 0.7;
    this.master.connect(this.muffle).connect(this.ctx.destination);

    this.noiseBuffer = this.makeNoise(4);
    this.wind();
    this.drone();
    this.buildPlace();
    this.started = true;
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  makeNoise(seconds) {
    const rate = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, rate * seconds, rate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      // 略带棕噪，听起来更像穿过树林的风
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    return buffer;
  }

  wind() {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 420;
    lp.Q.value = 0.8;

    const hp = this.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 90;

    const gain = this.ctx.createGain();
    gain.gain.value = 0.055;

    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.055;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain).connect(lp.frequency);

    src.connect(hp).connect(lp).connect(gain).connect(this.master);
    src.start();
    lfo.start();
    this.windGain = gain;
  }

  drone() {
    const gain = this.ctx.createGain();
    gain.gain.value = 0.02;
    gain.connect(this.master);
    [43.65, 65.4, 87.3].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const g = this.ctx.createGain();
      g.gain.value = 1 / (i + 1.6);
      osc.connect(g).connect(gain);
      osc.start();
    });
  }

  setWind(level) {
    if (!this.windGain) return;
    this.windGain.gain.setTargetAtTime(0.04 + level * 0.05, this.ctx.currentTime, 0.6);
  }

  /**
   * 墓园自己的底噪：湖岸的水、林下的落叶、空地的风。
   * 三层常驻、只调音量，不来回新建节点；站在哪儿，闭着眼也听得出来。
   */
  buildPlace() {
    const ctx = this.ctx;
    const loopNoise = (rate) => {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true;
      src.playbackRate.value = rate;
      src.start();
      return src;
    };

    // 水：一层低低的白噪，被很慢的浪推着
    const waterOut = ctx.createGain();
    waterOut.gain.value = 0.0001;
    waterOut.connect(this.master);
    const waterSrc = loopNoise(0.62);
    const waterLp = ctx.createBiquadFilter();
    waterLp.type = "lowpass";
    waterLp.frequency.value = 620;
    waterLp.Q.value = 1.1;
    const waterLfo = ctx.createOscillator();
    waterLfo.frequency.value = 0.31;
    const waterLfoGain = ctx.createGain();
    waterLfoGain.gain.value = 150;
    waterLfo.connect(waterLfoGain).connect(waterLp.frequency);
    waterSrc.connect(waterLp).connect(waterOut);
    waterLfo.start();

    // 林：更细的噪声，像叶子偶尔擦在一起
    const forestOut = ctx.createGain();
    forestOut.gain.value = 0.0001;
    forestOut.connect(this.master);
    const forestSrc = loopNoise(0.92);
    const forestHp = ctx.createBiquadFilter();
    forestHp.type = "highpass";
    forestHp.frequency.value = 720;
    const forestLp = ctx.createBiquadFilter();
    forestLp.type = "lowpass";
    forestLp.frequency.value = 2500;
    forestLp.Q.value = 0.55;
    const forestLfo = ctx.createOscillator();
    forestLfo.frequency.value = 0.13;
    const forestLfoGain = ctx.createGain();
    forestLfoGain.gain.value = 260;
    forestLfo.connect(forestLfoGain).connect(forestLp.frequency);
    forestSrc.connect(forestHp).connect(forestLp).connect(forestOut);
    forestLfo.start();

    this.placeNodes = { waterOut, forestOut };
  }

  /** water / forest / wind 都是 0~1；wet 是站在水里的程度。 */
  place(water = 0, forest = 0, wind = 1, wet = 0) {
    if (!this.started || !this.placeNodes) return;
    const clamp = (v) => Math.max(0, Math.min(1, Number(v) || 0));
    const w = clamp(water);
    const f = clamp(forest);
    const a = clamp(wind);
    const wetness = clamp(wet);
    this.placeLevels = { water: w, forest: f, wind: a, wet: wetness };
    const now = this.ctx.currentTime;
    this.placeNodes.waterOut.gain.setTargetAtTime(0.0001 + w * 0.085, now, 0.45);
    this.placeNodes.forestOut.gain.setTargetAtTime(0.0001 + f * 0.05, now, 0.45);
    this.setWind(a);
    this.muffle.frequency.setTargetAtTime(20000 - wetness * 18500, now, 0.35);
  }

  step(speed = 1, crouch = false) {
    if (!this.started) return;
    const now = this.ctx.currentTime;
    if (now - this.lastStep < (crouch ? 0.62 : 0.34 / Math.max(speed, 0.4))) return;
    this.lastStep = now;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.playbackRate.value = 0.6 + Math.random() * 0.3;

    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 320 + Math.random() * 120;
    bp.Q.value = 1.4;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.028 * (crouch ? 0.5 : 1), now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

    src.connect(bp).connect(gain).connect(this.master);
    src.start(now, Math.random() * 3, 0.2);
  }

  /** 献光时的钟声：两个不成谐的音叠在一起，慢慢散掉。 */
  bell(root = 174, level = 1) {
    if (!this.started) return;
    const now = this.ctx.currentTime;
    [1, 2.76, 5.4].forEach((mult, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = root * mult;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime((0.06 * level) / (i + 1.4), now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 4.2 - i * 1.1);
      osc.connect(gain).connect(this.master);
      osc.start(now);
      osc.stop(now + 5);
    });
  }

  /** 刻字时短促的石屑声。 */
  chisel() {
    if (!this.started) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.playbackRate.value = 1.6;
    const hp = this.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 2200;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.02, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    src.connect(hp).connect(gain).connect(this.master);
    src.start(now, Math.random() * 3, 0.12);
  }

  /** 走近一座碑时，空气里多出一点低频的压迫感。 */
  near(level) {
    if (!this.started || this.muted) return;
    this.master.gain.setTargetAtTime(0.75 + level * 0.25, this.ctx.currentTime, 0.5);
  }

  /** 两个人同时在一座碑前站住时，一声很低的和声，像两口气叠在一起。 */
  chord(level = 1) {
    if (!this.started || this.muted) return;
    const now = this.ctx.currentTime;
    [98, 146.8].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime((0.028 * level) / (i + 1), now + 1.2);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 4.6);
      osc.connect(g).connect(this.master);
      osc.start(now);
      osc.stop(now + 5);
    });
  }

  /**
   * 碑的声音：只在三米内响，离开就淡掉。
   * 每块碑选的种类不同，走进去听到的东西就不同——这是碑上唯一一种不用文字的信息。
   */
  ambient(kind, level = 0, pan = 0) {
    if (!this.started) return;
    const side = Math.max(-1, Math.min(1, Number(pan) || 0));
    if (kind === this.ambientKind) {
      this.ambientPan = side;
      this.ambientPanner?.pan.setTargetAtTime(side, this.ctx.currentTime, 0.25);
      if (this.ambientGain && Math.abs(level - this.ambientLevel) > 0.04) {
        this.ambientLevel = level;
        this.ambientGain.gain.setTargetAtTime(0.42 * level, this.ctx.currentTime, 0.55);
      }
      return;
    }

    const now = this.ctx.currentTime;
    if (this.ambientGain) {
      const dying = this.ambientGain;
      const stop = this.ambientStop;
      dying.gain.setTargetAtTime(0.0001, now, 0.25);
      setTimeout(() => {
        try {
          stop?.();
        } catch {
          /* 节点可能已经被关掉了 */
        }
      }, 1400);
    }
    this.ambientKind = kind;
    this.ambientLevel = level;
    this.ambientPan = side;
    this.ambientGain = null;
    this.ambientPanner = null;
    this.ambientStop = null;
    if (!kind || kind === "none" || level <= 0.02) return;

    const built = this.buildAmbient(kind, side);
    if (!built) return;
    this.ambientGain = built.gain;
    this.ambientPanner = built.pan;
    this.ambientStop = built.stop;
    built.gain.gain.setValueAtTime(0.0001, now);
    built.gain.gain.setTargetAtTime(0.42 * level, now + 0.01, 0.6);
  }

  buildAmbient(kind, pan = 0) {
    const ctx = this.ctx;
    const out = ctx.createGain();
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    out.connect(panner).connect(this.master);
    const nodes = [];

    const loopNoise = (rate = 1) => {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true;
      src.playbackRate.value = rate;
      src.start();
      nodes.push(src);
      return src;
    };

    if (kind === "sewing") {
      // 踏板一下一下，针脚跟着抖
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = 84;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 760;
      const trem = ctx.createGain();
      trem.gain.value = 0.52;
      const lfo = ctx.createOscillator();
      lfo.type = "square";
      lfo.frequency.value = 6.4;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.44;
      lfo.connect(lfoGain).connect(trem.gain);
      osc.connect(lp).connect(trem).connect(out);
      osc.start();
      lfo.start();
      nodes.push(osc, lfo);
    }

    if (kind === "fan") {
      const src = loopNoise(1);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 820;
      src.connect(lp).connect(out);
    }

    if (kind === "ball") {
      // 球场：低频的一下一下
      const src = loopNoise(1);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 170;
      bp.Q.value = 2.0;
      const thump = ctx.createGain();
      thump.gain.value = 0.45;
      const lfo = ctx.createOscillator();
      lfo.type = "triangle";
      lfo.frequency.value = 1.15;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.34;
      lfo.connect(lfoGain).connect(thump.gain);
      src.connect(bp).connect(thump).connect(out);
      lfo.start();
      nodes.push(lfo);
    }

    if (kind === "cat") {
      // 呼噜：低频噪声加一层很密的颤
      const src = loopNoise(1);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 150;
      bp.Q.value = 1.1;
      const trem = ctx.createGain();
      trem.gain.value = 0.5;
      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = 21;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.38;
      lfo.connect(lfoGain).connect(trem.gain);
      src.connect(bp).connect(trem).connect(out);
      lfo.start();
      nodes.push(lfo);
    }

    if (kind === "tv") {
      // 老电视的雪花
      const src = loopNoise(2.3);
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 3400;
      src.connect(hp).connect(out);
    }

    return {
      gain: out,
      pan: panner,
      stop: () => {
        for (const node of nodes) {
          try {
            node.stop();
          } catch {
            /* 已停止 */
          }
        }
        try {
          out.disconnect();
          panner.disconnect();
        } catch {
          /* 已断开 */
        }
      },
    };
  }

  /**
   * 别人献光时从远处传来的那口钟。
   * pan 是左右方位（-1 左，1 右），level 随距离衰减——听见钟却看不见人，比看见人更像有人在场。
   */
  farBell(pan = 0, level = 1) {
    if (!this.started || level <= 0.02) return;
    const ctx = this.ctx;
    const now = ctx.currentTime + 0.06;

    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    panner.connect(this.master);

    [1, 2.76].forEach((mult, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = 152 * mult;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime((0.05 * level) / (i + 1.5), now + 0.25);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 5.4);
      osc.connect(g).connect(panner);
      osc.start(now);
      osc.stop(now + 6);
    });
  }

  hush() {
    if (!this.started || this.muted) return;
    this.master.gain.setTargetAtTime(0.15, this.ctx.currentTime, 0.8);
  }
}
