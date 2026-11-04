export function wavBlob(chunks: Float32Array[], sampleRate: number): Blob {
  const inputCount = chunks.reduce((n, part) => n + part.length, 0);
  const input = new Float32Array(inputCount); let cursor = 0;
  for (const part of chunks) { input.set(part, cursor); cursor += part.length; }
  const outputRate = 16000, count = Math.floor(inputCount * outputRate / sampleRate);
  const buffer = new ArrayBuffer(44 + count * 2), view = new DataView(buffer);
  const label = (offset: number, text: string) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)); };
  label(0, "RIFF"); view.setUint32(4, 36 + count * 2, true); label(8, "WAVE"); label(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, outputRate, true); view.setUint32(28, outputRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); label(36, "data"); view.setUint32(40, count * 2, true);
  for (let i = 0; i < count; i++) {
    const first = Math.floor(i * sampleRate / outputRate), end = Math.max(first + 1, Math.floor((i + 1) * sampleRate / outputRate));
    let total = 0; for (let n = first; n < end; n++) total += input[n] || 0;
    const s = Math.max(-1, Math.min(1, total / (end - first))); view.setInt16(44 + i * 2, s < 0 ? s * 32768 : s * 32767, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

