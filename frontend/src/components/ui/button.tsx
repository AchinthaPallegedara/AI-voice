"use client";

import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        primary:   "bg-accent text-white hover:bg-accent/90 shadow-sm shadow-accent/20",
        secondary: "bg-surface-2 text-text border border-white/10 hover:bg-surface-3 hover:border-white/15",
        ghost:     "text-muted hover:bg-white/6 hover:text-text",
        danger:    "bg-danger/10 text-danger border border-danger/20 hover:bg-danger/18",
        outline:   "border border-white/12 text-text hover:bg-white/5",
      },
      size: {
        sm: "h-7 px-3 text-xs rounded-md",
        md: "h-8 px-4",
        lg: "h-10 px-5 text-sm rounded-xl",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  icon?: React.ReactNode;
}

export function Button({
  variant,
  size,
  loading,
  icon,
  children,
  disabled,
  className,
  style,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size }), className)}
      style={style}
      {...props}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}
      {children}
    </button>
  );
}
