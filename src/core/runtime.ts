/** Shared runtime selection. Business modules must not own session types. */
export type RuntimeMode = "live" | "demo";
export const SESSION_EXPIRED_EVENT = "mes:session-expired";
export function userScope(mode: RuntimeMode, username: string): string {
  return `${mode}:${username}`;
}
