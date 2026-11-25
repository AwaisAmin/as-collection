/* The activity (audit) log (`/admin/audit-logs`). Entries are append-only. */

export type AuditActorType = 'SYSTEM' | 'CUSTOMER' | 'STAFF';

export interface AdminAuditEntryDto {
  id: string;
  actorType: AuditActorType;
  /** Null for system actions, or when the staff account was removed. */
  actorStaff: { id: string; name: string; email: string } | null;
  /** `order.ship`, `product.update`, `staff.login.failed`… */
  action: string;
  /** `order`, `product`, `contact_message`… */
  entityType: string;
  entityId: string | null;
  /** What changed (shape depends on the action; often `{ before, after }`). */
  changes: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  createdAt: string;
}

/** Newest first; pass `nextCursor` as `before` for the next page (null: no more). */
export interface AdminAuditListDto {
  items: AdminAuditEntryDto[];
  nextCursor: string | null;
}
