// Runs in the browser audio thread. Downsamples mono input to 16 kHz PCM.
class VaaniCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.sum = 0; this.count = 0; this.phase = 0; this.frame = new Int16Array(512); this.index = 0; this.energy = 0;
  }
  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;
    for (let i = 0; i < input.length; i++) {
      this.sum += input[i]; this.count++; this.phase += 16000;
      if (this.phase >= sampleRate) {
        const sample = Math.max(-1, Math.min(1, this.sum / this.count));
        this.frame[this.index++] = sample < 0 ? sample * 32768 : sample * 32767;
        this.energy += sample * sample;
        this.phase -= sampleRate; this.sum = 0; this.count = 0;
        if (this.index === 512) {
          const frame = this.frame;
          this.port.postMessage({ type: "frame", pcm: frame.buffer, rms: Math.sqrt(this.energy / 512) }, [frame.buffer]);
          this.frame = new Int16Array(512); this.index = 0; this.energy = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor("vaani-capture", VaaniCapture);
