/**
 * Role -> table access.
 *
 * Enforced in this API, not by Fabric: the backend connects with one service
 * identity, so Fabric sees a single privileged principal and every access
 * decision is made here before a query is built. If per-user enforcement in
 * Fabric is ever needed, that requires the on-behalf-of token flow instead.
 */
export const ROLES = ['staff', 'manager', 'admin'];

const ACCESS = {
  staff: ['credo_support_tickets', 'vendor_registry'],
  manager: ['credo_support_tickets', 'vendor_registry', 'credo_memos', 'credo_travel_details'],
  admin: [
    'credo_support_tickets',
    'vendor_registry',
    'credo_memos',
    'credo_travel_details',
    'craig_audit_logs',
  ],
};

export function isRole(role) {
  return ROLES.includes(role);
}

export function normalizeRole(role) {
  const value = String(role ?? '').trim().toLowerCase();
  return isRole(value) ? value : null;
}

/** Tables this role may read. Unknown role -> nothing. */
export function tablesFor(role) {
  return ACCESS[role] ?? [];
}

export function canRead(role, table) {
  return tablesFor(role).includes(String(table).toLowerCase());
}

export class AccessDeniedError extends Error {
  constructor(role, table) {
    super(`Role '${role}' is not permitted to read '${table}'`);
    this.name = 'AccessDeniedError';
    this.status = 403;
    this.role = role;
    this.table = table;
  }
}

export function assertCanRead(role, table) {
  if (!canRead(role, table)) throw new AccessDeniedError(role, table);
}
