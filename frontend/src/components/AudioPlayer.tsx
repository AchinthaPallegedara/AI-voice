"use client";

export function AudioPlayer({ src }: { src: string }) {
  return (
    <audio
      controls
      src={src}
      style={{ width: "100%", height: 36, accentColor: "var(--color-accent)" }}
    />
  );
}
