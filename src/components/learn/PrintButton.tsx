"use client";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";

/** Opens the browser's print dialog (the page's print styles hide the app chrome). */
export function PrintButton({ label = "Print", className }: { label?: string; className?: string }) {
  return (
    <Button onClick={() => window.print()} className={className}>
      <Printer aria-hidden className="h-4 w-4" /> {label}
    </Button>
  );
}
