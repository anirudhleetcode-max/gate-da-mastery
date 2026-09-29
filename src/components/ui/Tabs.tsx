"use client";
import * as T from "@radix-ui/react-tabs";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Tabs = T.Root;
export function TabsList({ children, className, label }: { children: ReactNode; className?: string; label: string }) {
  return (
    <T.List aria-label={label} className={cn("flex gap-1 overflow-x-auto border-b border-border", className)}>
      {children}
    </T.List>
  );
}
export function TabsTrigger({ value, children }: { value: string; children: ReactNode }) {
  return (
    <T.Trigger
      value={value}
      className="-mb-px whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-sm font-medium text-fg-3 hover:text-fg data-[state=active]:border-accent data-[state=active]:text-fg"
    >
      {children}
    </T.Trigger>
  );
}
export const TabsContent = T.Content;
