/**
 * Settings of Today's GATE DA, stored with useSetting-compatible key
 * "dailyConfig" in the local user database.
 */

export const DAILY_CONFIG_KEY = "dailyConfig";
export const DAILY_COUNTS = [5, 10, 15, 20] as const;
export type DailyCount = (typeof DAILY_COUNTS)[number];

export interface DailyConfig {
  count: DailyCount;
  /** DA subjects to include; null = all of them. General Aptitude is controlled by includeGA. */
  subjects: string[] | null;
  includeGA: boolean;
}

export const DEFAULT_DAILY_CONFIG: DailyConfig = { count: 10, subjects: null, includeGA: true };

/** Validate a stored value (it may come from an older version or an imported backup). */
export function normalizeDailyConfig(raw: unknown): DailyConfig {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof DailyConfig, unknown>>;
  const count = DAILY_COUNTS.includes(r.count as DailyCount) ? (r.count as DailyCount) : DEFAULT_DAILY_CONFIG.count;
  const subjects = Array.isArray(r.subjects) ? r.subjects.filter((s): s is string => typeof s === "string" && s !== "ga") : null;
  const includeGA = typeof r.includeGA === "boolean" ? r.includeGA : DEFAULT_DAILY_CONFIG.includeGA;
  return { count, subjects, includeGA };
}

/** The subject ids the plan draws from. */
export function includedSubjects(cfg: DailyConfig, daSubjectIds: readonly string[]): Set<string> {
  const set = new Set(cfg.subjects === null ? daSubjectIds : daSubjectIds.filter((s) => cfg.subjects!.includes(s)));
  if (cfg.includeGA) set.add("ga");
  return set;
}
