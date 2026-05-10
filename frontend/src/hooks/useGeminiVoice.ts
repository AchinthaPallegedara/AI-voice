"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { wsUrl } from "@/lib/api";

const MIC_SAMPLE_RATE = 16000;
const PLAY_SAMPLE_RATE = 24000;
const SPEECH_THRESHOLD = 0.008;
const SPEECH_FRAMES = 5;
const SILENCE_FRAMES = 10;

export type CallState =
  | "ready"
  | "connecting"
  | "idle"
  | "recording"
  | "speaking"
  | "error";

export interface VoiceHookResult {
  callState: CallState;
  transcript: string;
  error: string;
  startCall: () => Promise<void>;
  endCall: () => void;
}

export function useGeminiVoice(apiKey: string): VoiceHookResult {
  const [callState, setCallState] = useState<CallState>("ready");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");

  const wsRef = useRef<WebSocket | null>(null);
  const micCtxRef = useRef<AudioContext | null>(null);
  const playCtxRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const playQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const speechFramesRef = useRef(0);
  const silenceFramesRef = useRef(0);
  const isSpeakingRef = useRef(false);
  const stateRef = useRef<CallState>("ready");

  const setState = useCallback((s: CallState) => {
    stateRef.current = s;
    setCallState(s);
  }, []);

  function cleanup() {
    wsRef.current?.close();
    wsRef.current = null;
    workletNodeRef.current?.disconnect();
    workletNodeRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    micCtxRef.current?.close().catch(() => {});
    micCtxRef.current = null;
    playQueueRef.current = [];
    isPlayingRef.current = false;
    isSpeakingRef.current = false;
  }

  function playNext() {
    if (isPlayingRef.current || playQueueRef.current.length === 0) return;
    const ctx = playCtxRef.current;
    if (!ctx) return;

    isPlayingRef.current = true;
    setState("speaking");

    const buf = playQueueRef.current.shift()!;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.onended = () => {
      isPlayingRef.current = false;
      if (playQueueRef.current.length > 0) {
        playNext();
      } else if (stateRef.current === "speaking") {
        setState("idle");
      }
    };
    src.start();
  }

  function enqueueAudio(raw: ArrayBuffer) {
    const ctx = playCtxRef.current;
    if (!ctx) return;
    const samples = new Int16Array(raw);
    const buf = ctx.createBuffer(1, samples.length, PLAY_SAMPLE_RATE);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < samples.length; i++) ch[i] = samples[i] / 32768;
    playQueueRef.current.push(buf);
    playNext();
  }

  function onMessage(ev: MessageEvent) {
    if (ev.data instanceof ArrayBuffer) {
      enqueueAudio(ev.data);
      return;
    }
    if (ev.data instanceof Blob) {
      ev.data.arrayBuffer().then(enqueueAudio);
      return;
    }
    try {
      const msg = JSON.parse(ev.data as string) as Record<string, string>;
      if (msg.type === "status" && msg.status === "ready") setState("idle");
      else if (msg.type === "turn_complete") {
        if (!isPlayingRef.current && playQueueRef.current.length === 0) setState("idle");
      } else if (msg.type === "interrupted") {
        playQueueRef.current = [];
        isPlayingRef.current = false;
        setState("idle");
      } else if (msg.type === "text") {
        setTranscript((p) => p + msg.text);
      } else if (msg.type === "error") {
        setError(msg.text ?? "Server error");
        setState("error");
      }
    } catch {
      /* binary handled above */
    }
  }

  const startCall = useCallback(async () => {
    if (stateRef.current !== "ready") return;
    setError("");
    setTranscript("");
    setState("connecting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const micCtx = new AudioContext({ sampleRate: MIC_SAMPLE_RATE });
      micCtxRef.current = micCtx;

      const playCtx = new AudioContext({ sampleRate: PLAY_SAMPLE_RATE });
      playCtxRef.current = playCtx;

      await micCtx.audioWorklet.addModule("/audio-processor.js");
      const source = micCtx.createMediaStreamSource(stream);
      const worklet = new AudioWorkletNode(micCtx, "pcm-processor");
      workletNodeRef.current = worklet;

      worklet.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) return;

        const s = new Int16Array(e.data);
        let sum = 0;
        for (let i = 0; i < s.length; i++) sum += Math.abs(s[i] / 32768);
        const rms = sum / s.length;

        if (rms > SPEECH_THRESHOLD) {
          speechFramesRef.current++;
          silenceFramesRef.current = 0;
        } else {
          silenceFramesRef.current++;
          speechFramesRef.current = 0;
        }
        if (!isSpeakingRef.current && speechFramesRef.current >= SPEECH_FRAMES) {
          isSpeakingRef.current = true;
          if (stateRef.current === "idle") setState("recording");
        }
        if (isSpeakingRef.current && silenceFramesRef.current >= SILENCE_FRAMES) {
          isSpeakingRef.current = false;
          if (stateRef.current === "recording") setState("idle");
        }

        ws.send(e.data);
      };

      source.connect(worklet);

      const ws = new WebSocket(wsUrl(apiKey));
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;
      ws.onmessage = onMessage;
      ws.onerror = () => {
        setError("WebSocket connection error");
        setState("error");
      };
      ws.onclose = () => {
        if (stateRef.current !== "ready") setState("ready");
        cleanup();
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start call");
      setState("error");
      cleanup();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  const endCall = useCallback(() => {
    cleanup();
    setState("ready");
    setTranscript("");
  }, [setState]);

  useEffect(() => () => cleanup(), []);

  return { callState, transcript, error, startCall, endCall };
}
