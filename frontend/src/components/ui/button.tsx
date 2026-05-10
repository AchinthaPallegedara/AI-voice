"use client";

import React from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
}

const variantStyles: Record<Variant, React.CSSProperties> = {
  primary: {
    background: "var(--color-accent)",
    color: "#fff",
    border: "none",
  },
  secondary: {
    background: "var(--color-surface-2)",
    color: "var(--color-text)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  ghost: {
    background: "transparent",
    color: "var(--color-muted)",
    border: "none",
  },
  danger: {
    background: "rgba(239,35,60,0.15)",
    color: "var(--color-danger)",
    border: "1px solid rgba(239,35,60,0.3)",
  },
};

const sizeStyles: Record<Size, React.CSSProperties> = {
  sm: { padding: "5px 12px", fontSize: "0.8rem", borderRadius: 6 },
  md: { padding: "8px 16px", fontSize: "0.875rem", borderRadius: 8 },
  lg: { padding: "11px 20px", fontSize: "0.95rem", borderRadius: 10 },
};

export function Button({
  variant = "primary",
  size = "md",
  loading,
  icon,
  children,
  disabled,
  style,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        fontWeight: 500,
        cursor: disabled || loading ? "not-allowed" : "pointer",
        opacity: disabled || loading ? 0.6 : 1,
        transition: "opacity 0.15s",
        ...variantStyles[variant],
        ...sizeStyles[size],
        ...style,
      }}
      {...props}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      style={{ animation: "spin 0.75s linear infinite" }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}
