-- AlterTable
ALTER TABLE "staff_users" ADD COLUMN     "must_change_password" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "totp_last_step" INTEGER;

-- ─── Hand-written: integrity, partial indexes, append-only audit log ───

-- 2FA can only be "enabled" with a stored (encrypted) secret.
ALTER TABLE "staff_users" ADD CONSTRAINT "staff_users_totp_check"
  CHECK ("totp_enabled_at" IS NULL OR "totp_secret_encrypted" IS NOT NULL);
ALTER TABLE "staff_users" ADD CONSTRAINT "staff_users_totp_step_check"
  CHECK ("totp_last_step" IS NULL OR "totp_last_step" >= 0);

ALTER TABLE "roles" ADD CONSTRAINT "roles_key_format_check"
  CHECK ("key" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
-- "*" (everything) or dotted lowercase codes such as "orders.write".
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_format_check"
  CHECK ("permission" = '*' OR "permission" ~ '^[a-z]+(\.[a-z-]+)+$');

-- Active sessions per staff member (list, cap, revoke-all).
CREATE INDEX "staff_sessions_active_idx" ON "staff_sessions" ("staff_id", "created_at" DESC)
  WHERE "revoked_at" IS NULL;

-- The audit log is append-only. The only permitted update is the FK clearing actor_staff_id
-- (ON DELETE SET NULL); deletes need an explicit retention purge in the same transaction:
--   SET LOCAL app.audit_purge = 'on'; DELETE FROM audit_logs WHERE created_at < …;
CREATE OR REPLACE FUNCTION audit_logs_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.actor_staff_id IS NULL
     AND (to_jsonb(NEW) - 'actor_staff_id') = (to_jsonb(OLD) - 'actor_staff_id') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' AND current_setting('app.audit_purge', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'audit_logs is append-only (% denied)', TG_OP USING ERRCODE = 'insufficient_privilege';
END $$;

CREATE TRIGGER audit_logs_append_only
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only();
