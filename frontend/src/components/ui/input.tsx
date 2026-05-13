import React from "react";
import { cn } from "@/lib/utils";

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

const baseField =
  "w-full px-3 py-2 bg-surface-2 border border-white/10 rounded-lg text-sm text-text placeholder:text-muted outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent/15 font-[inherit]";

export function Input({ label, error, hint, className, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-medium text-muted">{label}</label>
      )}
      <input
        className={cn(
          baseField,
          error && "border-danger/50 focus:border-danger focus:ring-danger/15",
          className
        )}
        {...props}
      />
      {hint && !error && <p className="text-xs text-muted leading-relaxed">{hint}</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

export function Textarea({ label, error, hint, className, ...props }: TextareaProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-medium text-muted">{label}</label>
      )}
      <textarea
        className={cn(
          baseField,
          "resize-y min-h-[80px]",
          error && "border-danger/50",
          className
        )}
        {...props}
      />
      {hint && !error && <p className="text-xs text-muted leading-relaxed">{hint}</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
