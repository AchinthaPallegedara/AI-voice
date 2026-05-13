import React from "react";
import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Card({ children, className, style }: CardProps) {
  return (
    <div
      className={cn(
        "bg-surface border border-white/10 rounded-xl overflow-hidden",
        className
      )}
      style={style}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className, style }: CardProps) {
  return (
    <div
      className={cn(
        "px-5 py-3.5 border-b border-white/8 flex items-center justify-between",
        className
      )}
      style={style}
    >
      {children}
    </div>
  );
}

export function CardBody({ children, className, style }: CardProps) {
  return (
    <div className={cn("p-5", className)} style={style}>
      {children}
    </div>
  );
}
