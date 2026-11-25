/** Grants everything (the system super-admin role). */
export const ALL = '*';

/** Does a permission set include `permission`? */
export const can = (permissions: readonly string[], permission: string): boolean =>
  permissions.includes(ALL) || permissions.includes(permission);

/** Any one of `required` (empty = any signed-in staff member). */
export const canAny = (permissions: readonly string[], required: readonly string[]): boolean =>
  required.length === 0 || required.some((p) => can(permissions, p));

/**
 * May someone holding `actor` hand out (or manage someone holding) `target`? Only when every
 * target permission is one they have — the API's anti-escalation rule, used to grey out choices.
 */
export function covers(actor: readonly string[], target: readonly string[]): boolean {
  if (actor.includes(ALL)) return true;
  return target.every((code) => code !== ALL && actor.includes(code));
}
