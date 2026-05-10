import React from "react";

type Variant = "success" | "warning" | "error" | "info" | "neutral";

interface BadgeProps {
  variant?: Variant;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

const styles: Record<Variant, React.CSSProperties> = {
  success: { background: "rgba(6,214,160,0.15)", color: "var(--color-success)" },
  warning: { background: "rgba(255,190,0,0.15)", color: "#ffbe00" },
  error:   { background: "rgba(239,35,60,0.15)", color: "var(--color-danger)" },
  info:    { background: "rgba(124,92,191,0.2)", color: "var(--color-accent-light)" },
  neutral: { background: "rgba(136,136,170,0.15)", color: "var(--color-muted)" },
};

export function Badge({ variant = "neutral", children, style }: BadgeProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 20,
        fontSize: "0.72rem",
        fontWeight: 600,
        letterSpacing: "0.02em",
        ...styles[variant],
        ...style,
      }}
    >
      {children}
    </span>
  );
}
