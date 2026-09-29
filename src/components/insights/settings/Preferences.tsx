"use client";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Segmented";
import { useSetting, useUserData } from "@/lib/userdata/hooks";
import { useStorageValue } from "@/lib/useStorage";
import type { ExplanationLevel } from "@/components/question/SolutionPanel";
import { Switch } from "./Switch";

/** Same key and behaviour as the header theme button (src/components/layout/ThemeToggle.tsx). */
const THEME_KEY = "gate-da-theme";
type Theme = "system" | "light" | "dark";

const LEVEL_HELP: Record<ExplanationLevel, string> = {
  quick: "A 2–4 line summary: the key idea and the result.",
  detailed: "The complete step-by-step derivation (recommended).",
  teaching: "Explains the concept from first principles, then the steps. Questions without a teaching explanation fall back to Detailed.",
};

export function Preferences() {
  const { db, demo } = useUserData();
  const [level, setLevel] = useSetting<ExplanationLevel>("explanationLevel", "detailed");
  const [autoErrorLog, setAutoErrorLog] = useSetting<boolean>("autoErrorLog", true);
  const [stored, setStored] = useStorageValue(THEME_KEY);
  const theme: Theme = stored === "light" || stored === "dark" ? stored : "system";

  const setTheme = (t: Theme) => {
    if (t === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
    setStored(t === "system" ? null : t);
  };

  return (
    <Card>
      <CardHeader
        title="Study preferences"
        description={demo ? "Stored in the demo database while demo mode is on; your own preferences are kept unchanged." : "Saved on this device with your progress, and included in backups."}
      />
      <CardBody className="space-y-6">
        <div className="space-y-2">
          <p className="font-medium text-fg">
            Default explanation level
          </p>
          <Segmented
            label="Default explanation level"
            value={level === "quick" || level === "teaching" ? level : "detailed"}
            onChange={(v) => setLevel(v)}
            options={[
              { value: "quick", label: "Quick" },
              { value: "detailed", label: "Detailed" },
              { value: "teaching", label: "Teaching" },
            ]}
          />
          <p className="text-sm text-fg-3" aria-live="polite">
            {LEVEL_HELP[level === "quick" || level === "teaching" ? level : "detailed"]} Changing the level on any solution also updates this default.
          </p>
        </div>

        <Switch
          checked={autoErrorLog}
          onChange={setAutoErrorLog}
          disabled={!db}
          label="Add incorrect answers to the error log automatically"
          description="Every wrong answer (in practice and in submitted mocks) gets an error-log entry that you can classify later. Wrong answers always go to the revision queue either way."
        />

        <div className="space-y-2 border-t border-border pt-5">
          <p className="font-medium text-fg">
            Theme
          </p>
          <Segmented
            label="Theme"
            value={theme}
            onChange={setTheme}
            options={[
              { value: "system", label: "Match system" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />
          <p className="text-sm text-fg-3">
            The same setting as the theme button in the header. It is remembered by this browser only, so it is not part of backups and does not change in demo mode.
          </p>
        </div>
      </CardBody>
    </Card>
  );
}
