-- D-235. One-way, per-household transfer of financial write authority.
-- Apply after 018. Existing memberships and session revocation remain authoritative.
-- Do not delete cutover rows or re-enable old writers after a V2 command is accepted.
BEGIN;
CREATE TABLE IF NOT EXISTS hearth_private.ledger_sync_cutovers (
  environment text NOT NULL,
  household_id text NOT NULL,
  source_revision integer NOT NULL,
  authority_instance uuid NOT NULL,
  shared_payload text NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(environment, household_id)
);
CREATE TABLE IF NOT EXISTS hearth_private.ledger_sync_personal_imports (
  environment text NOT NULL, household_id text NOT NULL, member_id text NOT NULL,
  payload text NOT NULL,
  PRIMARY KEY(environment, household_id, member_id)
);
ALTER TABLE hearth_private.ledger_sync_cutovers ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE hearth_private.ledger_sync_cutovers ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
REVOKE ALL ON hearth_private.ledger_sync_cutovers, hearth_private.ledger_sync_personal_imports FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION hearth_private.fence_legacy_ledger_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE target_id text; target_environment text;
BEGIN
  IF TG_TABLE_NAME = 'households' THEN
    target_id := CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END;
    target_environment := CASE WHEN TG_OP='DELETE' THEN OLD.environment ELSE NEW.environment END;
  ELSE
    target_id := CASE WHEN TG_OP='DELETE' THEN OLD.household_id ELSE NEW.household_id END;
    SELECT h.environment INTO target_environment FROM public.households h WHERE h.id=target_id FOR UPDATE;
  END IF;
  -- The same household lock serializes the final legacy commit and the cutover.
  IF EXISTS (SELECT 1 FROM hearth_private.ledger_sync_cutovers c WHERE c.household_id=target_id AND c.environment=target_environment AND NOT (TG_OP='DELETE' AND c.deleted_at IS NOT NULL)) THEN
    RAISE EXCEPTION 'LEDGER_SYNC_V2_REQUIRED' USING ERRCODE='55000';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS ledger_sync_v2_household_fence ON public.households;
CREATE TRIGGER ledger_sync_v2_household_fence BEFORE UPDATE OR DELETE ON public.households FOR EACH ROW EXECUTE FUNCTION hearth_private.fence_legacy_ledger_write();
DROP TRIGGER IF EXISTS ledger_sync_v2_snapshot_fence ON public.household_snapshots;
CREATE TRIGGER ledger_sync_v2_snapshot_fence BEFORE INSERT OR UPDATE OR DELETE ON public.household_snapshots FOR EACH ROW EXECUTE FUNCTION hearth_private.fence_legacy_ledger_write();
DROP TRIGGER IF EXISTS ledger_sync_v2_personal_fence ON public.continuity_personal_snapshots;
CREATE TRIGGER ledger_sync_v2_personal_fence BEFORE INSERT OR UPDATE OR DELETE ON public.continuity_personal_snapshots FOR EACH ROW EXECUTE FUNCTION hearth_private.fence_legacy_ledger_write();
DROP TRIGGER IF EXISTS ledger_sync_v2_events_fence ON public.continuity_command_events;
CREATE TRIGGER ledger_sync_v2_events_fence BEFORE INSERT OR UPDATE OR DELETE ON public.continuity_command_events FOR EACH ROW EXECUTE FUNCTION hearth_private.fence_legacy_ledger_write();

CREATE OR REPLACE FUNCTION public.ledger_sync_scope(p_environment text,p_household_id text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor text;
BEGIN
  actor:=hearth_private.own_member_id(p_household_id,p_environment);
  IF auth.uid() IS NULL OR actor IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object('memberId',actor,'subject',auth.uid(),'identity',(SELECT jsonb_build_object('subject',m.google_subject,'email',m.google_email) FROM public.continuity_memberships m WHERE m.household_id=p_household_id AND m.environment=p_environment AND m.member_id=actor),'role',CASE WHEN hearth_private.is_household_owner(p_household_id,p_environment) THEN 'owner' ELSE 'member' END,
    'members',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',m.member_id,'name',m.display_name,'active',m.active AND m.revoked_at IS NULL,'role',m.role)),'[]'::jsonb) FROM public.continuity_memberships m WHERE m.household_id=p_household_id AND m.environment=p_environment));
END;
$$;
REVOKE ALL ON FUNCTION public.ledger_sync_scope(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ledger_sync_scope(text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_ledger_sync_v2(p_environment text,p_household_id text,p_member_id text,p_authority_instance uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE source_revision integer; shared text; personal text;
BEGIN
  IF p_environment <> 'development' THEN RAISE EXCEPTION 'PRODUCTION_DISABLED' USING ERRCODE='42501'; END IF;
  IF auth.uid() IS NULL OR hearth_private.own_member_id(p_household_id,p_environment) IS DISTINCT FROM p_member_id THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';
  END IF;
  SELECT h.revision INTO source_revision FROM public.households h WHERE h.id=p_household_id AND h.environment=p_environment FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'IMPORT_SOURCE_MISSING'; END IF;
  IF NOT EXISTS(SELECT 1 FROM hearth_private.ledger_sync_cutovers c WHERE c.household_id=p_household_id AND c.environment=p_environment) THEN
    SELECT s.payload INTO shared FROM public.household_snapshots s WHERE s.household_id=p_household_id AND s.environment=p_environment FOR UPDATE;
    IF shared IS NULL THEN RAISE EXCEPTION 'IMPORT_SOURCE_MISSING'; END IF;
    -- Freeze every Personal scope in this transaction, return only the caller's.
    INSERT INTO hearth_private.ledger_sync_personal_imports SELECT s.environment,s.household_id,s.member_id,s.payload FROM public.continuity_personal_snapshots s WHERE s.household_id=p_household_id AND s.environment=p_environment;
    INSERT INTO hearth_private.ledger_sync_cutovers(environment,household_id,source_revision,shared_payload,authority_instance) VALUES(p_environment,p_household_id,source_revision,shared,p_authority_instance);
  END IF;
  IF EXISTS(SELECT 1 FROM hearth_private.ledger_sync_cutovers c WHERE c.environment=p_environment AND c.household_id=p_household_id AND c.authority_instance IS DISTINCT FROM p_authority_instance) THEN RAISE EXCEPTION 'AUTHORITY_RECOVERY_REQUIRED'; END IF;
  SELECT c.shared_payload INTO shared FROM hearth_private.ledger_sync_cutovers c WHERE c.environment=p_environment AND c.household_id=p_household_id;
  SELECT s.payload INTO personal FROM hearth_private.ledger_sync_personal_imports s WHERE s.environment=p_environment AND s.household_id=p_household_id AND s.member_id=p_member_id;
  RETURN jsonb_build_object('shared',shared,'personal',personal);
END;
$$;
REVOKE ALL ON FUNCTION public.claim_ledger_sync_v2(text,text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.claim_ledger_sync_v2(text,text,text,uuid) TO authenticated;
-- New ledgers register a frozen bootstrap and membership atomically. There is
-- no legacy financial publication, CAS, or outbox involved in this endpoint.
CREATE OR REPLACE FUNCTION public.create_ledger_sync_v2(p_household_id text,p_member_id text,p_authority_instance uuid,p_shared jsonb,p_personal jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE caller uuid:=auth.uid(); google_subject text; google_email text;
BEGIN
 IF caller IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
 IF length(p_shared::text)+length(p_personal::text)>33554432 THEN RAISE EXCEPTION 'IMPORT_TOO_LARGE'; END IF;
 IF NOT hearth_private.payload_is_member_personal(p_personal::text,p_member_id) THEN RAISE EXCEPTION 'PERSONAL_SCOPE_MISMATCH'; END IF;
 IF NOT hearth_private.payload_is_shared(p_shared::text) THEN RAISE EXCEPTION 'PERSONAL_DATA_IN_SHARED'; END IF;
 IF p_shared->>'environment'<>'development' OR p_shared->>'householdId' IS DISTINCT FROM p_household_id OR p_personal->>'memberId' IS DISTINCT FROM p_member_id
 OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_shared->'members') m WHERE m->>'id'=p_member_id AND (m->>'active')::boolean) THEN RAISE EXCEPTION 'INVALID_CREATE'; END IF;
 SELECT i.provider_id,lower(i.identity_data->>'email') INTO google_subject,google_email FROM auth.identities i WHERE i.user_id=caller AND i.provider='google' LIMIT 1;
 IF google_subject IS NULL THEN RAISE EXCEPTION 'GOOGLE_IDENTITY_REQUIRED'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('development/'||p_household_id,0));
 IF EXISTS(SELECT 1 FROM hearth_private.ledger_sync_cutovers WHERE household_id=p_household_id AND deleted_at IS NOT NULL) THEN RAISE EXCEPTION 'LEDGER_DELETED'; END IF;
 IF EXISTS(SELECT 1 FROM public.households WHERE id=p_household_id) THEN
   IF NOT hearth_private.is_household_owner(p_household_id,'development') OR NOT EXISTS(SELECT 1 FROM hearth_private.ledger_sync_cutovers c WHERE c.household_id=p_household_id AND c.authority_instance=p_authority_instance AND c.shared_payload=p_shared::text) THEN RAISE EXCEPTION 'HOUSEHOLD_ALREADY_EXISTS'; END IF;
   RETURN jsonb_build_object('created',true);
 END IF;
 INSERT INTO public.households(id,name,timezone,currency,environment,invite_phrase,linked,revision,last_committed_at)
 VALUES(p_household_id,p_shared->>'name',p_shared->>'timezone','CAD','development',p_shared->>'inviteCode',true,(p_shared->>'revision')::integer,p_shared->>'lastCommittedAt');
 -- Immutable seat metadata keeps the existing invite control plane compatible.
 INSERT INTO public.household_snapshots(household_id,invite_phrase,environment,payload,updated_at,revision,snapshot_hash)
 VALUES(p_household_id,p_shared->>'inviteCode','development',jsonb_build_object('householdId',p_household_id,'environment','development','members',p_shared->'members')::text,clock_timestamp()::text,(p_shared->>'revision')::integer,'v2-control-metadata');
 INSERT INTO public.continuity_memberships(environment,household_id,member_id,google_subject,google_email,display_name,active,updated_at,auth_user_id,role,revoked_at)
 VALUES('development',p_household_id,p_member_id,google_subject,google_email,coalesce((SELECT m->>'name' FROM jsonb_array_elements(p_shared->'members') m WHERE m->>'id'=p_member_id),''),true,clock_timestamp()::text,caller,'owner',NULL);
 INSERT INTO hearth_private.ledger_sync_cutovers(environment,household_id,source_revision,authority_instance,shared_payload)
 VALUES('development',p_household_id,(p_shared->>'revision')::integer,p_authority_instance,p_shared::text);
 INSERT INTO hearth_private.ledger_sync_personal_imports VALUES('development',p_household_id,p_member_id,p_personal::text);
 RETURN jsonb_build_object('created',true);
END;
$$;
REVOKE ALL ON FUNCTION public.create_ledger_sync_v2(text,text,uuid,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_ledger_sync_v2(text,text,uuid,jsonb,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_ledger_sync_v2(p_household_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE caller uuid:=auth.uid();
BEGIN
 IF caller IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
 IF EXISTS(SELECT 1 FROM hearth_private.ledger_sync_cutovers WHERE household_id=p_household_id AND environment='development' AND deleted_by=caller AND deleted_at IS NOT NULL) THEN RETURN jsonb_build_object('deleted',true,'subject',caller); END IF;
 IF NOT hearth_private.is_household_owner(p_household_id,'development') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 PERFORM 1 FROM public.households WHERE id=p_household_id AND environment='development' FOR UPDATE;
 UPDATE hearth_private.ledger_sync_cutovers SET deleted_by=caller,deleted_at=clock_timestamp(),shared_payload='{}' WHERE household_id=p_household_id AND environment='development';
 IF NOT FOUND THEN RAISE EXCEPTION 'CUTOVER_REQUIRED'; END IF;
 DELETE FROM hearth_private.ledger_sync_personal_imports WHERE household_id=p_household_id AND environment='development';
 DELETE FROM public.households WHERE id=p_household_id AND environment='development';
 RETURN jsonb_build_object('deleted',true,'subject',caller);
END;
$$;
REVOKE ALL ON FUNCTION public.delete_ledger_sync_v2(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.delete_ledger_sync_v2(text) TO authenticated;

INSERT INTO public.schema_migrations(id,applied_at) VALUES(19,clock_timestamp()::text) ON CONFLICT DO NOTHING;
COMMIT;

NOTIFY pgrst, 'reload schema';
