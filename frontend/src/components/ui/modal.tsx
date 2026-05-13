"use client";

import * as Dialog from "@radix-ui/react-dialog";
import React from "react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}

export function Modal({ open, onOpenChange, title, children, footer, width = 520 }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/65 backdrop-blur-sm z-50" />
        <Dialog.Content
          style={{ width: `min(${width}px, 95vw)` }}
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-h-[90vh] overflow-y-auto bg-surface border border-white/10 rounded-xl z-[51] flex flex-col shadow-2xl shadow-black/60"
        >
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/8 flex-shrink-0">
            <Dialog.Title className="text-sm font-semibold text-text">{title}</Dialog.Title>
            <Dialog.Close className="text-muted hover:text-text transition-colors p-1 rounded-md hover:bg-white/6 cursor-pointer">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>

          <div className="p-5 flex-1">{children}</div>

          {footer && (
            <div className="px-5 py-3.5 border-t border-white/8 flex justify-end gap-2 flex-shrink-0">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
