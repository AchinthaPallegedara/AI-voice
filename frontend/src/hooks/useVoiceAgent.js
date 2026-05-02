import { useState, useRef, useCallback, useEffect } from 'react';

const VAD_INTERVAL_MS   = 50;
const SPEECH_THRESHOLD  = 0.008;  // lowered for easier detection
const SILENCE_FRAMES    = 30;     // 30 × 50ms = 1.5 s silence → send
const MIN_SPEECH_FRAMES = 5;      //  5 × 50ms = 250ms minimum to count as speech

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
  const ringCtxRef     = useRef(null);
  const ringStopRef    = useRef(false);
  const pingIntervalRef = useRef(null);
  const sessionIdRef   = useRef(null);
  const callIdRef      = useRef(null);

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

  // streaming playback refs
  const playCtxRef       = useRef(null);   // AudioContext for AI speech
  const nextPlayTimeRef  = useRef(0);      // scheduled end of last chunk

  useEffect(() => { mutedRef.current    = muted;     }, [muted]);
  useEffect(() => { callStateRef.current = callState; }, [callState]);

  // ── ringtone (Web Audio, no file needed) ──────────────────────────

  const startRingtone = useCallback(() => {
    ringStopRef.current = false;
    const ctx = new AudioContext();
    ringCtxRef.current = ctx;

    const ring = () => {
      if (ringStopRef.current) return;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      osc1.frequency.value = 440;
      osc2.frequency.value = 480;
      osc1.connect(gain); osc2.connect(gain);
      gain.connect(ctx.destination);
      // fade in → hold → fade out
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.07, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.07, ctx.currentTime + 1.8);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 2.0);
      osc1.start(ctx.currentTime); osc1.stop(ctx.currentTime + 2.0);
      osc2.start(ctx.currentTime); osc2.stop(ctx.currentTime + 2.0);
      // repeat every 4 s (2 s ring + 2 s silence)
      setTimeout(() => ring(), 4000);
    };
    ring();
  }, []);

  const stopRingtone = useCallback(() => {
    ringStopRef.current = true;
    ringCtxRef.current?.close().catch(() => {});
    ringCtxRef.current = null;
  }, []);

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

  // ── streaming audio playback ───────────────────────────────────────

  const ensurePlayCtx = useCallback(() => {
    if (!playCtxRef.current || playCtxRef.current.state === 'closed') {
      playCtxRef.current = new AudioContext();
      nextPlayTimeRef.current = 0;
    }
    return playCtxRef.current;
  }, []);

  const scheduleChunk = useCallback(async (b64) => {
    const ctx = ensurePlayCtx();

    // If this is the first chunk, mark AI as speaking now
    if (!aiSpeakingRef.current) {
      aiSpeakingRef.current = true;
      setCallState('speaking');
      setStatusText('Speaking…');
    }

    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    let audioBuffer;
    try {
      audioBuffer = await ctx.decodeAudioData(bytes.buffer);
    } catch (e) {
      console.error('chunk decode error', e);
      return;
    }

    const startAt = Math.max(ctx.currentTime + 0.01, nextPlayTimeRef.current);
    nextPlayTimeRef.current = startAt + audioBuffer.duration;

    const src = ctx.createBufferSource();
    src.buffer = audioBuffer;
    src.connect(ctx.destination);
    src.start(startAt);
  }, [ensurePlayCtx]);

  const onAudioDone = useCallback(() => {
    const ctx = playCtxRef.current;
    if (!ctx) {
      aiSpeakingRef.current    = false;
      vadStateRef.current      = 'idle';
      silenceFramesRef.current = 0;
      speechFramesRef.current  = 0;
      setCallState('idle');
      setStatusText('Connected');
      return;
    }
    // Wait until the last scheduled chunk finishes, then mark idle
    const remaining = (nextPlayTimeRef.current - ctx.currentTime) * 1000;
    setTimeout(() => {
      aiSpeakingRef.current    = false;
      vadStateRef.current      = 'idle';
      silenceFramesRef.current = 0;
      speechFramesRef.current  = 0;
      setCallState('idle');
      setStatusText('Connected');
    }, Math.max(0, remaining) + 150);
  }, []);

  const stopPlayback = useCallback(() => {
    playCtxRef.current?.close().catch(() => {});
    playCtxRef.current  = null;
    nextPlayTimeRef.current = 0;
    aiSpeakingRef.current = false;
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

  // ── call lifecycle ─────────────────────────────────────────────────

  const endCallCleanup = useCallback(() => {
    stopRingtone();
    stopPlayback();
    clearInterval(pingIntervalRef.current);
    pingIntervalRef.current = null;
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
  }, [stopRingtone, stopPlayback]);

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
      case 'transcription':          addMessage('user', msg.text); break;
      case 'reply':                  addMessage('ai',   msg.text); break;
      case 'audio_chunk':            scheduleChunk(msg.data); break;
      case 'audio_done':             onAudioDone(); break;
      case 'ping_response':          break; // heartbeat ack — no-op
      case 'call_disconnect_response': endCallCleanup(); break;
      case 'error':
        showToast(msg.text || 'Error');
        if (!aiSpeakingRef.current) { setCallState('idle'); setStatusText('Connected'); }
        break;
    }
  }, [addMessage, showToast, scheduleChunk, onAudioDone, endCallCleanup]);

  const startCall = useCallback(async ({ character = 'Aria', timezone = '' } = {}) => {
    // Request mic early so browser permission prompt doesn't delay the call
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch {
      showToast('Microphone access denied');
      return;
    }
    streamRef.current = stream;

    callStateRef.current = 'ringing'; // sync immediately — useEffect is too late for the loop below
    setCallState('ringing');
    setStatusText('Ringing…');
    startRingtone();

    // Poll /api/health until models are ready (max 3 min)
    const MAX_POLLS = 60;
    let ready = false;
    for (let i = 0; i < MAX_POLLS; i++) {
      // Cancelled mid-ring (user pressed cancel)
      if (callStateRef.current !== 'ringing') return;
      try {
        const r = await fetch('/api/health');
        const data = await r.json();
        if (data.ready) { ready = true; break; }
      } catch { /* server not up yet — keep ringing */ }
      await new Promise(r => setTimeout(r, 3000));
    }

    stopRingtone();

    if (!ready || callStateRef.current !== 'ringing') {
      if (!ready) showToast('Server unavailable — try again');
      stream.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      setCallState('ready');
      setStatusText('Ready to call');
      return;
    }

    setCallState('connecting');
    setStatusText('Connecting…');

    const proto  = location.protocol === 'https:' ? 'wss' : 'ws';
    const params = new URLSearchParams({
      character,
      usercontext: JSON.stringify({ timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone }),
    });
    const ws = new WebSocket(`${proto}://${location.host}/ws?${params}`);
    wsRef.current = ws;

    sessionIdRef.current = crypto.randomUUID();
    callIdRef.current    = Math.floor(Math.random() * 1e9);

    ws.onopen = () => {
      setCallState('idle');
      setStatusText('Connected');
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
      startVAD(stream);

      // heartbeat — keep connection alive on serverless (Modal drops idle WS)
      pingIntervalRef.current = setInterval(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type:       'ping',
            session_id: sessionIdRef.current,
            call_id:    callIdRef.current,
            request_id: crypto.randomUUID(),
            content:    'ping',
          }));
        }
      }, 750);
    };

    ws.onmessage = (e) => handleMessage(JSON.parse(e.data));
    ws.onclose   = ()  => { if (callStateRef.current !== 'ready') endCallCleanup(); };
    ws.onerror   = ()  => { showToast('Connection failed'); endCallCleanup(); };
  }, [handleMessage, showToast, startVAD, endCallCleanup, startRingtone, stopRingtone]);

  const endCall = useCallback(() => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      // graceful hang-up — server will respond with call_disconnect_response → cleanup
      ws.send(JSON.stringify({
        type:       'call_disconnect',
        session_id: sessionIdRef.current,
        call_id:    callIdRef.current,
        request_id: crypto.randomUUID(),
        content:    { reason: 'user_request' },
      }));
      // fallback: if no response in 1.5 s, clean up anyway
      setTimeout(() => { if (wsRef.current) endCallCleanup(); }, 1500);
    } else {
      endCallCleanup();
    }
  }, [endCallCleanup]);

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
