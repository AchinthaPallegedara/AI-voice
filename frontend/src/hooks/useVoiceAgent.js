import { useState, useRef, useCallback, useEffect } from 'react';

const VAD_INTERVAL_MS  = 50;
const SPEECH_THRESHOLD = 0.012;
const SILENCE_FRAMES   = 30;  // 30 × 50ms = 1.5 s silence → send
const MIN_SPEECH_FRAMES = 5;  //  5 × 50ms = 250ms minimum to count as speech

export function useVoiceAgent() {
  const [callState,  setCallState]  = useState('ready');
  const [statusText, setStatusText] = useState('Ready to call');
  const [messages,   setMessages]   = useState([]);
  const [muted,      setMuted]      = useState(false);
  const [elapsed,    setElapsed]    = useState(0);
  const [toast,      setToast]      = useState(null);
  const [audioLevel, setAudioLevel] = useState(0);

  const wsRef          = useRef(null);
  const streamRef      = useRef(null);
  const recorderRef    = useRef(null);
  const chunksRef      = useRef([]);
  const timerRef       = useRef(null);
  const toastTimerRef  = useRef(null);

  // mutable refs — safe to read inside intervals/callbacks
  const mutedRef         = useRef(false);
  const callStateRef     = useRef('ready');
  const aiSpeakingRef    = useRef(false);
  const analyserRef      = useRef(null);
  const audioCtxRef      = useRef(null);
  const vadIntervalRef   = useRef(null);
  const vadStateRef      = useRef('idle');   // 'idle' | 'recording'
  const silenceFramesRef = useRef(0);
  const speechFramesRef  = useRef(0);

  useEffect(() => { mutedRef.current    = muted;     }, [muted]);
  useEffect(() => { callStateRef.current = callState; }, [callState]);

  // ── helpers ────────────────────────────────────────────────────────

  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const addMessage = useCallback((role, text) => {
    setMessages(prev => [...prev, { role, text, id: Date.now() + Math.random() }]);
  }, []);

  // ── WAV encoding ──────────────────────────────────────────────────

  const resampleMono16k = (audioBuffer) => {
    const targetRate = 16000;
    const numFrames  = Math.ceil(audioBuffer.duration * targetRate);
    const ctx = new OfflineAudioContext(1, numFrames, targetRate);
    const src = ctx.createBufferSource();
    src.buffer = audioBuffer;
    src.connect(ctx.destination);
    src.start(0);
    return ctx.startRendering();
  };

  const encodeWav = (ab) => {
    const samples    = ab.getChannelData(0);
    const sampleRate = ab.sampleRate;
    const n   = samples.length;
    const buf = new ArrayBuffer(44 + n * 2);
    const v   = new DataView(buf);
    const s   = (off, str) => { for (let i = 0; i < str.length; i++) v.setUint8(off + i, str.charCodeAt(i)); };
    s(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true);
    s(8, 'WAVE'); s(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    s(36, 'data'); v.setUint32(40, n * 2, true);
    let off = 44;
    for (let i = 0; i < n; i++) {
      const x = Math.max(-1, Math.min(1, samples[i]));
      v.setInt16(off, x < 0 ? x * 0x8000 : x * 0x7FFF, true);
      off += 2;
    }
    return buf;
  };

  const toBase64 = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let bin = '';
    for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  };

  // ── audio playback ─────────────────────────────────────────────────

  const playAudio = useCallback(async (b64) => {
    aiSpeakingRef.current = true;
    setCallState('speaking');
    setStatusText('Speaking…');

    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const blob  = new Blob([bytes], { type: 'audio/wav' });
    const url   = URL.createObjectURL(blob);
    const audio = new Audio(url);

    const resume = () => {
      URL.revokeObjectURL(url);
      aiSpeakingRef.current    = false;
      vadStateRef.current      = 'idle';
      silenceFramesRef.current = 0;
      speechFramesRef.current  = 0;
      setCallState('idle');
      setStatusText('Connected');
    };

    audio.onended = resume;
    audio.onerror = resume;
    try { await audio.play(); } catch { resume(); }
  }, []);

  // ── process recorded audio ─────────────────────────────────────────

  const processAudio = useCallback(async () => {
    if (!chunksRef.current.length) {
      setCallState('idle');
      setStatusText('Connected');
      return;
    }
    const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || 'audio/webm' });
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const tmpCtx  = new AudioContext();
      const decoded = await tmpCtx.decodeAudioData(arrayBuffer);
      await tmpCtx.close();
      const resampled  = await resampleMono16k(decoded);
      const wavBuffer  = encodeWav(resampled);
      const b64        = toBase64(wavBuffer);
      wsRef.current?.send(JSON.stringify({ type: 'audio', data: b64 }));
    } catch (e) {
      console.error('Audio processing error:', e);
      showToast('Audio error — try again');
      setCallState('idle');
      setStatusText('Connected');
    }
  }, [showToast]);

  // ── VAD ────────────────────────────────────────────────────────────

  const stopVADRecording = useCallback(() => {
    vadStateRef.current      = 'idle';
    silenceFramesRef.current = 0;
    speechFramesRef.current  = 0;
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    setCallState('processing');
    setStatusText('Processing…');
  }, []);

  const startVAD = useCallback((stream) => {
    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;
    const source   = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    analyserRef.current = analyser;

    const dataArray = new Float32Array(analyser.fftSize);

    vadIntervalRef.current = setInterval(() => {
      if (!analyserRef.current) return;

      analyser.getFloatTimeDomainData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i] * dataArray[i];
      const rms = Math.sqrt(sum / dataArray.length);

      // Update level visualiser (0..1 normalised against threshold)
      setAudioLevel(Math.min(1, rms / SPEECH_THRESHOLD));

      // Block recording while AI speaks, muted, or busy
      const state = callStateRef.current;
      if (mutedRef.current || aiSpeakingRef.current ||
          state === 'processing' || state === 'speaking' ||
          state === 'connecting' || state === 'ready') return;

      if (vadStateRef.current !== 'recording') {
        // Waiting for speech
        if (rms > SPEECH_THRESHOLD) {
          speechFramesRef.current++;
          if (speechFramesRef.current >= MIN_SPEECH_FRAMES) {
            vadStateRef.current      = 'recording';
            silenceFramesRef.current = 0;
            chunksRef.current        = [];
            const recorder = new MediaRecorder(stream);
            recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
            recorder.onstop = () => processAudio();
            recorder.start(100);
            recorderRef.current = recorder;
            setCallState('recording');
            setStatusText('Listening…');
          }
        } else {
          speechFramesRef.current = Math.max(0, speechFramesRef.current - 1);
        }
      } else {
        // Recording — wait for silence
        if (rms < SPEECH_THRESHOLD) {
          silenceFramesRef.current++;
          if (silenceFramesRef.current >= SILENCE_FRAMES) stopVADRecording();
        } else {
          silenceFramesRef.current = 0;
        }
      }
    }, VAD_INTERVAL_MS);
  }, [processAudio, stopVADRecording]);

  // ── WS message handler ─────────────────────────────────────────────

  const handleMessage = useCallback((msg) => {
    switch (msg.type) {
      case 'status':
        if      (msg.status === 'transcribing') setStatusText('Transcribing…');
        else if (msg.status === 'thinking')     setStatusText('Thinking…');
        else if (msg.status === 'idle' && !aiSpeakingRef.current) {
          setCallState('idle');
          setStatusText('Connected');
        }
        break;
      case 'transcription': addMessage('user', msg.text); break;
      case 'reply':         addMessage('ai',   msg.text); break;
      case 'audio':         playAudio(msg.data); break;
      case 'error':
        showToast(msg.text || 'Error');
        if (!aiSpeakingRef.current) { setCallState('idle'); setStatusText('Connected'); }
        break;
    }
  }, [addMessage, showToast, playAudio]);

  // ── call lifecycle ─────────────────────────────────────────────────

  const endCallCleanup = useCallback(() => {
    clearInterval(vadIntervalRef.current);
    vadIntervalRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current  = null;
    analyserRef.current  = null;
    vadStateRef.current      = 'idle';
    aiSpeakingRef.current    = false;
    speechFramesRef.current  = 0;
    silenceFramesRef.current = 0;

    if (recorderRef.current?.state !== 'inactive') recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
    clearInterval(timerRef.current);
    timerRef.current = null;

    setElapsed(0);
    setMuted(false);
    mutedRef.current = false;
    setAudioLevel(0);
    setCallState('ready');
    setStatusText('Ready to call');
  }, []);

  const startCall = useCallback(async () => {
    setCallState('connecting');
    setStatusText('Connecting…');

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch {
      showToast('Microphone access denied');
      setCallState('ready');
      setStatusText('Ready to call');
      return;
    }
    streamRef.current = stream;

    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws    = new WebSocket(`${proto}://${location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      setCallState('idle');
      setStatusText('Connected');
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
      startVAD(stream);
    };

    ws.onmessage = (e) => handleMessage(JSON.parse(e.data));
    ws.onclose   = ()  => { if (callStateRef.current !== 'ready') endCallCleanup(); };
    ws.onerror   = ()  => { showToast('Connection failed'); endCallCleanup(); };
  }, [handleMessage, showToast, startVAD, endCallCleanup]);

  const endCall = useCallback(() => endCallCleanup(), [endCallCleanup]);

  const toggleMute = useCallback(() => {
    setMuted(m => {
      const next = !m;
      mutedRef.current = next;
      streamRef.current?.getAudioTracks().forEach(t => { t.enabled = !next; });
      if (next && vadStateRef.current === 'recording') {
        if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
        vadStateRef.current = 'idle';
        chunksRef.current   = [];
        setCallState('idle');
        setStatusText('Connected');
      }
      return next;
    });
  }, []);

  const resetConversation = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: 'reset' }));
    setMessages([]);
  }, []);

  return {
    callState, statusText, messages, muted, elapsed, toast, audioLevel,
    startCall, endCall, toggleMute, resetConversation,
  };
}
