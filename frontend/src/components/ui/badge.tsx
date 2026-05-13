import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium tracking-wide",
  {
    variants: {
      variant: {
        success: "bg-success/12 text-success border border-success/20",
        warning: "bg-warning/12 text-warning border border-warning/20",
        error:   "bg-danger/12 text-danger border border-danger/20",
        info:    "bg-accent/12 text-accent-light border border-accent/20",
        neutral: "bg-white/6 text-muted border border-white/8",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
);

interface BadgeProps extends VariantProps<typeof badgeVariants> {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Badge({ variant, children, className, style }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} style={style}>
      {children}
    </span>
  );
}
