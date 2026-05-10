"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const BAR_COUNT = 80;

export function WaveformPlayer({ src }: { src: string }) {
  const [bars, setBars] = useState<number[]>([]);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string>("");
  const rafRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        if (cancelled) return;

        // Blob URL lets the Audio element seek without range requests to our proxy
        const blobUrl = URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
        blobUrlRef.current = blobUrl;

        const audio = new Audio(blobUrl);
        audioRef.current = audio;
        audio.addEventListener("loadedmetadata", () => {
          if (!cancelled) setDuration(audio.duration);
        });
        audio.addEventListener("ended", () => {
          if (cancelled) return;
          setPlaying(false);
          setProgress(0);
          setCurrentTime(0);
          cancelAnimationFrame(rafRef.current);
        });

        // Decode waveform — AudioContext is only used for decoding, suspend state is fine
        const ctx = new AudioContext();
        // decodeAudioData detaches buf, so blob is created first above
        const decoded = await ctx.decodeAudioData(buf);
        ctx.close();
        if (cancelled) return;

        const ch = decoded.getChannelData(0);
        const step = Math.max(1, Math.floor(ch.length / BAR_COUNT));
        const computed: number[] = [];
        for (let i = 0; i < BAR_COUNT; i++) {
          let peak = 0;
          const start = i * step;
          for (let j = 0; j < step; j++) {
            const v = Math.abs(ch[start + j] ?? 0);
            if (v > peak) peak = v;
          }
          computed.push(peak);
        }
        const max = Math.max(...computed, 0.001);
        setBars(computed.map((v) => v / max));
        setReady(true);
      } catch (err) {
        console.error("[WaveformPlayer]", err);
        if (!cancelled) setError(true);
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      audioRef.current?.pause();
      audioRef.current = null;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = "";
      }
    };
  }, [src]);

  const tick = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    setCurrentTime(a.currentTime);
    setProgress(a.currentTime / (a.duration || 1));
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const togglePlay = useCallback(() => {
    const a = audioRef.current;
    if (!a || !ready) return;
    if (a.paused) {
      a.play();
      setPlaying(true);
      rafRef.current = requestAnimationFrame(tick);
    } else {
      a.pause();
      setPlaying(false);
      cancelAnimationFrame(rafRef.current);
    }
  }, [ready, tick]);

  const seek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    const el = containerRef.current;
    if (!a || !el) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const t = ratio * (a.duration || 0);
    a.currentTime = t;
    setProgress(ratio);
    setCurrentTime(t);
  }, []);

  const fmt = (s: number) => {
    if (!isFinite(s) || s < 0) return "0:00";
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
      <button
        onClick={togglePlay}
        disabled={!ready}
        style={{
          width: 38,
          height: 38,
          borderRadius: "50%",
          border: "none",
          background: ready ? "var(--color-accent)" : "var(--color-surface-2)",
          color: "#fff",
          cursor: ready ? "pointer" : "default",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          fontSize: "1rem",
        }}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? "⏸" : "▶"}
      </button>

      <div
        ref={containerRef}
        onClick={seek}
        style={{
          flex: 1,
          height: 52,
          display: "flex",
          alignItems: "center",
          gap: "2px",
          cursor: ready ? "pointer" : "default",
          paddingInline: 2,
        }}
      >
        {error ? (
          <span style={{ color: "var(--color-muted)", fontSize: "0.8rem" }}>Audio unavailable</span>
        ) : !ready ? (
          Array.from({ length: BAR_COUNT }, (_, i) => (
            <div
              key={i}
              style={{ flex: 1, height: 4, borderRadius: 2, background: "var(--color-surface-2)" }}
            />
          ))
        ) : (
          bars.map((amp, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: Math.max(3, Math.round(amp * 48)),
                borderRadius: 2,
                background:
                  i / BAR_COUNT <= progress
                    ? "var(--color-accent-light)"
                    : "rgba(136,136,170,0.3)",
                transition: "background 0.04s",
              }}
            />
          ))
        )}
      </div>

      <span
        style={{
          fontSize: "0.72rem",
          color: "var(--color-muted)",
          flexShrink: 0,
          minWidth: "5rem",
          textAlign: "right",
        }}
      >
        {fmt(currentTime)} / {fmt(duration)}
      </span>
    </div>
  );
}
