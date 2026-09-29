/**
 * The admin area (content management) is a local authoring tool. It is only
 * enabled in development, or when ADMIN_ENABLED=true is set explicitly for a
 * trusted deployment. Otherwise every admin page and API route answers 404.
 */
export function isAdminEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.NODE_ENV === "development" || env.ADMIN_ENABLED === "true";
}
