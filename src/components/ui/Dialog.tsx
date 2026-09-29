"use client";
import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Dialog({ open, onOpenChange, title, description, children, className }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <D.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-surface p-5 shadow-xl",
            className,
          )}
        >
          <div className="mb-3 flex items-start justify-between gap-4">
            <D.Title className="text-lg font-semibold text-fg">{title}</D.Title>
            <D.Close className="rounded-md p-1 text-fg-3 hover:bg-surface-2 hover:text-fg" aria-label="Close">
              <X className="h-5 w-5" aria-hidden />
            </D.Close>
          </div>
          {description ? <D.Description className="mb-4 text-sm text-fg-2">{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}
          {children}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
