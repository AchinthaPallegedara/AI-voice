import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  background: "var(--color-surface-2)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 8,
  color: "var(--color-text)",
  fontSize: "0.875rem",
  outline: "none",
  boxSizing: "border-box",
};

export function Input({ label, error, hint, style, ...props }: InputProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {label && (
        <label style={{ fontSize: "0.8rem", color: "var(--color-muted)", fontWeight: 500 }}>
          {label}
        </label>
      )}
      <input style={{ ...fieldStyle, borderColor: error ? "var(--color-danger)" : undefined, ...style }} {...props} />
      {hint && !error && <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--color-muted)" }}>{hint}</p>}
      {error && <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--color-danger)" }}>{error}</p>}
    </div>
  );
}

export function Textarea({ label, error, hint, style, ...props }: TextareaProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {label && (
        <label style={{ fontSize: "0.8rem", color: "var(--color-muted)", fontWeight: 500 }}>
          {label}
        </label>
      )}
      <textarea
        style={{ ...fieldStyle, resize: "vertical", minHeight: 80, borderColor: error ? "var(--color-danger)" : undefined, ...style }}
        {...props}
      />
      {hint && !error && <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--color-muted)" }}>{hint}</p>}
      {error && <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--color-danger)" }}>{error}</p>}
    </div>
  );
}
