import { useState, useRef, useCallback, useEffect } from 'react';

// VAD constants — used for UI feedback only.
// Interrupt decisions are made by Go (audio energy detection on the server).
const VAD_INTERVAL_MS   = 50;
const SPEECH_THRESHOLD  = 0.008;
const MIN_SPEECH_FRAMES = 5;   //  5 × 50ms = 250ms min to flip to 'recording'
const SILENCE_FRAMES    = 10;  // 10 × 50ms = 500ms silence  → flip to 'idle'

export function useVoiceAgent() {
  const [callState,  setCallState]  = useState('ready');
  const [statusText, setStatusText] = useState('Ready to call');
  const [messages,   setMessages]   = useState([]);
  const [muted,      setMuted]      = useState(false);
  const [elapsed,    setElapsed]    = useState(0);
  const [toast,      setToast]      = useState(null);
  const [audioLevel, setAudioLevel] = useState(0);

  // WebRTC
  const pcRef          = useRef(null);   // RTCPeerConnection
  const dataChannelRef = useRef(null);   // DataChannel for Go→browser events
  const streamRef      = useRef(null);   // local mic MediaStream
  const audioElRef     = useRef(null);   // <audio> element for remote TTS stream

  // Timers / bookkeeping
  const timerRef       = useRef(null);
  const toastTimerRef  = useRef(null);
  const ringCtxRef     = useRef(null);
  const ringStopRef    = useRef(false);
  const sessionIdRef   = useRef(null);

  // Mutable refs — safe to read inside intervals/event handlers
  const mutedRef         = useRef(false);
  const callStateRef     = useRef('ready');
  const aiSpeakingRef    = useRef(false);
  const analyserRef      = useRef(null);
  const audioCtxRef      = useRef(null);
  const vadIntervalRef   = useRef(null);
  const speechFramesRef  = useRef(0);
  const silenceFramesRef = useRef(0);

  useEffect(() => { mutedRef.current     = muted;     }, [muted]);
  useEffect(() => { callStateRef.current = callState; }, [callState]);

  // ── ringtone (Web Audio, no file needed) ─────────────────────────────

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
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.07, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.07, ctx.currentTime + 1.8);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 2.0);
      osc1.start(ctx.currentTime); osc1.stop(ctx.currentTime + 2.0);
      osc2.start(ctx.currentTime); osc2.stop(ctx.currentTime + 2.0);
      setTimeout(ring, 4000);
    };
    ring();
  }, []);

  const stopRingtone = useCallback(() => {
    ringStopRef.current = true;
    ringCtxRef.current?.close().catch(() => {});
    ringCtxRef.current = null;
  }, []);

  // ── helpers ──────────────────────────────────────────────────────────

  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const addMessage = useCallback((role, text) => {
    setMessages(prev => [...prev, { role, text, id: Date.now() + Math.random() }]);
  }, []);

  // ── DataChannel message handler (Go → browser) ───────────────────────
  //
  // Message types:
  //   {type:"transcript", text:"...", is_final:bool}  — user speech text
  //   {type:"reply",      text:"..."}                 — AI response text
  //   {type:"status",     status:"processing|speaking|idle"}
  //   {type:"error",      text:"..."}

  const handleDataMessage = useCallback((msg) => {
    switch (msg.type) {
      case 'transcript':
        // Show partial transcripts in real time; only commit final ones
        if (msg.is_final && msg.text) addMessage('user', msg.text);
        break;

      case 'reply':
        if (msg.text) addMessage('ai', msg.text);
        break;

      case 'status':
        if (msg.status === 'processing') {
          aiSpeakingRef.current = true;
          setCallState('processing');
          setStatusText('Thinking…');
        } else if (msg.status === 'speaking') {
          aiSpeakingRef.current = true;
          setCallState('speaking');
          setStatusText('Speaking…');
        } else if (msg.status === 'idle') {
          // Small delay — browser audio buffer may still be draining
          setTimeout(() => {
            aiSpeakingRef.current    = false;
            speechFramesRef.current  = 0;
            silenceFramesRef.current = 0;
            if (callStateRef.current !== 'ready') {
              setCallState('idle');
              setStatusText('Connected');
            }
          }, 200);
        }
        break;

      case 'error':
        showToast(msg.text || 'Error');
        aiSpeakingRef.current = false;
        setCallState('idle');
        setStatusText('Connected');
        break;
    }
  }, [addMessage, showToast]);

  // ── remote audio element ──────────────────────────────────────────────
  //
  // TTS audio arrives as a WebRTC remote audio track.
  // Playing it through an <audio> element is simpler than scheduling
  // base64 chunks manually — and eliminates the old chunk-scheduling latency.

  const setupRemoteAudio = useCallback(() => {
    const el = document.createElement('audio');
    el.autoplay   = true;
    el.playsInline = true;
    el.style.display = 'none';
    document.body.appendChild(el);
    audioElRef.current = el;
    return el;
  }, []);

  const teardownRemoteAudio = useCallback(() => {
    if (audioElRef.current) {
      audioElRef.current.srcObject = null;
      document.body.removeChild(audioElRef.current);
      audioElRef.current = null;
    }
  }, []);

  // ── VAD (UI-only) ─────────────────────────────────────────────────────
  //
  // The VAD monitors microphone energy to drive the visual level bar and
  // flip callState between 'idle' ↔ 'recording' for the UI animations.
  // It does NOT trigger audio send or interrupt — Go handles both.

  const startVAD = useCallback((stream) => {
    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;
    const source  = audioCtx.createMediaStreamSource(stream);
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

      setAudioLevel(Math.min(1, rms / SPEECH_THRESHOLD));

      const state = callStateRef.current;
      // Block VAD UI flips when AI owns the turn or call isn't active
      if (mutedRef.current || aiSpeakingRef.current ||
          state === 'processing' || state === 'speaking' ||
          state === 'connecting' || state === 'ringing' || state === 'ready') {
        speechFramesRef.current  = 0;
        silenceFramesRef.current = 0;
        return;
      }

      if (state !== 'recording') {
        if (rms > SPEECH_THRESHOLD) {
          speechFramesRef.current++;
          if (speechFramesRef.current >= MIN_SPEECH_FRAMES) {
            speechFramesRef.current  = 0;
            silenceFramesRef.current = 0;
            setCallState('recording');
            setStatusText('Listening…');
          }
        } else {
          speechFramesRef.current = Math.max(0, speechFramesRef.current - 1);
        }
      } else {
        if (rms < SPEECH_THRESHOLD) {
          silenceFramesRef.current++;
          if (silenceFramesRef.current >= SILENCE_FRAMES) {
            silenceFramesRef.current = 0;
            speechFramesRef.current  = 0;
            // Don't reset to idle here — Go will send status:idle when done
            setCallState('idle');
            setStatusText('Connected');
          }
        } else {
          silenceFramesRef.current = 0;
        }
      }
    }, VAD_INTERVAL_MS);
  }, []);

  // ── call lifecycle ────────────────────────────────────────────────────

  const endCallCleanup = useCallback(() => {
    stopRingtone();

    clearInterval(vadIntervalRef.current);
    vadIntervalRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;

    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;

    dataChannelRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;

    teardownRemoteAudio();

    clearInterval(timerRef.current);
    timerRef.current = null;

    aiSpeakingRef.current    = false;
    speechFramesRef.current  = 0;
    silenceFramesRef.current = 0;

    setElapsed(0);
    setMuted(false);
    mutedRef.current = false;
    setAudioLevel(0);
    setMessages([]);
    setCallState('ready');
    setStatusText('Ready to call');
  }, [stopRingtone, teardownRemoteAudio]);

  // ── startCall ─────────────────────────────────────────────────────────

  const startCall = useCallback(async ({ character = 'Aria', timezone = '' } = {}) => {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch {
      showToast('Microphone access denied');
      return;
    }
    streamRef.current = stream;

    callStateRef.current = 'ringing';
    setCallState('ringing');
    setStatusText('Ringing…');
    startRingtone();

    // Poll /api/health until models are loaded (max 3 min on cold GPU start)
    const MAX_POLLS = 60;
    let ready = false;
    for (let i = 0; i < MAX_POLLS; i++) {
      if (callStateRef.current !== 'ringing') return; // user cancelled
      try {
        const r = await fetch('/api/health');
        const data = await r.json();
        if (data.ready) { ready = true; break; }
      } catch { /* server not up yet */ }
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

    sessionIdRef.current = crypto.randomUUID();

    // ── WebRTC setup ──────────────────────────────────────────────────

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    pcRef.current = pc;

    // Add local mic track — continuous stream, no MediaRecorder needed
    stream.getAudioTracks().forEach(t => pc.addTrack(t, stream));

    // Remote TTS audio → hidden <audio> element
    const audioEl = setupRemoteAudio();
    pc.ontrack = (e) => {
      if (e.streams?.[0]) {
        audioEl.srcObject = e.streams[0];
        audioEl.play().catch(() => {});
      }
    };

    // DataChannel from Go: transcript, status, reply, error events
    pc.ondatachannel = (e) => {
      dataChannelRef.current = e.channel;
      e.channel.onmessage = (ev) => {
        try {
          handleDataMessage(JSON.parse(ev.data));
        } catch { /* ignore malformed */ }
      };
    };

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === 'failed' || s === 'disconnected' || s === 'closed') {
        if (callStateRef.current !== 'ready') {
          showToast('Connection lost');
          endCallCleanup();
        }
      }
    };

    // Create offer and wait for ICE gathering to complete before sending.
    // This avoids trickle ICE complexity while still working through STUN/TURN.
    const offer = await pc.createOffer({ offerToReceiveAudio: true });
    await pc.setLocalDescription(offer);

    await new Promise((resolve) => {
      if (pc.iceGatheringState === 'complete') { resolve(); return; }
      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === 'complete') resolve();
      };
      setTimeout(resolve, 4000); // fallback for unresponsive STUN
    });

    // Send offer to Go, receive answer
    let answer;
    try {
      const resp = await fetch('/signal', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          type:       pc.localDescription.type,
          sdp:        pc.localDescription.sdp,
          session_id: sessionIdRef.current,
        }),
      });
      if (!resp.ok) {
        const msg = resp.status === 429 ? 'Server at capacity' : 'Call rejected';
        showToast(msg);
        endCallCleanup();
        return;
      }
      answer = await resp.json();
    } catch {
      showToast('Could not reach server');
      endCallCleanup();
      return;
    }

    await pc.setRemoteDescription(new RTCSessionDescription(answer));

    // Connected — start timer and VAD
    setCallState('idle');
    setStatusText('Connected');
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    startVAD(stream);
  }, [
    showToast, startRingtone, stopRingtone, setupRemoteAudio,
    startVAD, endCallCleanup, handleDataMessage,
  ]);

  // ── endCall ───────────────────────────────────────────────────────────

  const endCall = useCallback(() => {
    endCallCleanup();
  }, [endCallCleanup]);

  // ── toggleMute ────────────────────────────────────────────────────────

  const toggleMute = useCallback(() => {
    setMuted(m => {
      const next = !m;
      mutedRef.current = next;
      // Mute the actual mic track — Go receives silence, its VAD ignores it
      streamRef.current?.getAudioTracks().forEach(t => { t.enabled = !next; });
      if (next) {
        // Reset VAD UI state so it doesn't stay on 'recording'
        speechFramesRef.current  = 0;
        silenceFramesRef.current = 0;
        if (callStateRef.current === 'recording') {
          setCallState('idle');
          setStatusText('Connected');
        }
      }
      return next;
    });
  }, []);

  // ── resetConversation ─────────────────────────────────────────────────

  const resetConversation = useCallback(() => {
    // Tell Go to clear conversation history for this session
    if (dataChannelRef.current?.readyState === 'open') {
      dataChannelRef.current.send(JSON.stringify({ type: 'reset' }));
    }
    setMessages([]);
  }, []);

  return {
    callState, statusText, messages, muted, elapsed, toast, audioLevel,
    startCall, endCall, toggleMute, resetConversation,
  };
}
