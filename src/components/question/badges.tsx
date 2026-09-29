import { BadgeCheck, CircleAlert, CircleDashed } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { Difficulty, QuestionOrigin, QuestionType, VerificationStatus } from "@/lib/content/schema";
import { DIFFICULTY_LABEL, ORIGIN_LABEL, VERIFICATION_LABEL } from "@/lib/labels";

/** Mandatory origin label: OFFICIAL PYQ / ORIGINAL PRACTICE / MOCK TEST. */
export function OriginBadge({ origin }: { origin: QuestionOrigin }) {
  const tone = origin === "OFFICIAL_PYQ" ? "accent" : origin === "MOCK_TEST" ? "info" : "neutral";
  return (
    <Badge tone={tone} className="uppercase tracking-wide" title={origin === "OFFICIAL_PYQ" ? "Question from an official GATE DA paper" : "Original question written for this platform (not an official GATE question)"}>
      {ORIGIN_LABEL[origin]}
    </Badge>
  );
}

export function VerificationBadge({ status, compact = false }: { status: VerificationStatus; compact?: boolean }) {
  const Icon = status === "VERIFIED" ? BadgeCheck : status === "PARTIALLY_VERIFIED" ? CircleDashed : CircleAlert;
  const tone = status === "VERIFIED" ? "success" : status === "PARTIALLY_VERIFIED" ? "warning" : "danger";
  return (
    <Badge tone={tone} title={`Verification: ${VERIFICATION_LABEL[status]}`}>
      <Icon aria-hidden className="h-3 w-3" />
      {compact ? <span className="sr-only">{VERIFICATION_LABEL[status]}</span> : VERIFICATION_LABEL[status]}
    </Badge>
  );
}

export function DifficultyBadge({ difficulty, estimated = true }: { difficulty: Difficulty; estimated?: boolean }) {
  const tone = difficulty === "EASY" ? "success" : difficulty === "MODERATE" ? "info" : difficulty === "HARD" ? "warning" : "danger";
  return (
    <Badge tone={tone} title={estimated ? "Platform-estimated difficulty (GATE does not publish difficulty levels)" : undefined}>
      {DIFFICULTY_LABEL[difficulty]}
      {estimated ? <span className="sr-only"> (platform-estimated)</span> : null}
    </Badge>
  );
}

export function TypeBadge({ type, marks }: { type: QuestionType; marks: number }) {
  return (
    <Badge tone="outline">
      {type} · {marks} {marks === 1 ? "mark" : "marks"}
    </Badge>
  );
}
