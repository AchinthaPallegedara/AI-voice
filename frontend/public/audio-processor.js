// AudioWorklet processor — runs in its own thread, converts float32 mic
// samples to PCM16 and posts the buffer to the main thread for WS send.
class PCMProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel) return true;
    const int16 = new Int16Array(channel.length);
    for (let i = 0; i < channel.length; i++) {
      int16[i] = Math.max(-32768, Math.min(32767, channel[i] * 32767));
    }
    // Transfer the buffer (zero-copy) to the main thread
    this.port.postMessage(int16.buffer, [int16.buffer]);
    return true;
  }
}
registerProcessor('pcm-processor', PCMProcessor);
