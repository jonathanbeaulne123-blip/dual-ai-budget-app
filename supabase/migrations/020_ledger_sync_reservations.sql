-- D-238. Prepared only; Jonathan applies Development after review:
-- pnpm exec node scripts/apply-supabase-migration.mjs 020
-- Never run books:apply (the base schema) to apply this incremental migration.
BEGIN;
CREATE TABLE IF NOT EXISTS hearth_private.ledger_reservation_manifests (
  environment text NOT NULL,
  household_id text NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  authority_instance uuid NOT NULL,
  manifest_id uuid NOT NULL DEFAULT gen_random_uuid(),
  source_revision integer NOT NULL,
  total integer NOT NULL DEFAULT 0,
  PRIMARY KEY(environment, household_id), UNIQUE(manifest_id)
);
CREATE TABLE IF NOT EXISTS hearth_private.ledger_reservation_digests (
  manifest_id uuid NOT NULL REFERENCES hearth_private.ledger_reservation_manifests(manifest_id) ON DELETE CASCADE,
  digest text NOT NULL CHECK(digest ~ '^[0-9a-f]{64}$'),
  PRIMARY KEY(manifest_id, digest)
);
REVOKE ALL ON hearth_private.ledger_reservation_manifests, hearth_private.ledger_reservation_digests FROM PUBLIC, anon, authenticated;

-- Hash contract: UTF-8 of "ledger-reservation-v1\n" + environment + "\n" +
-- householdId + "\n" + identity. UUID identities are lowercase; other legacy
-- idempotency keys retain their exact bytes. Scope values cannot contain LF.
CREATE OR REPLACE FUNCTION public.ledger_sync_reservations_page(
  p_environment text, p_household_id text, p_member_id text,
  p_authority_instance uuid, p_after_digest text DEFAULT NULL, p_limit integer DEFAULT 1000
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cutover hearth_private.ledger_sync_cutovers%ROWTYPE;
        manifest hearth_private.ledger_reservation_manifests%ROWTYPE;
        page jsonb; last_digest text; more boolean;
BEGIN
  IF p_environment IS DISTINCT FROM 'development' OR p_household_id !~ '^HH-[a-zA-Z0-9_-]{1,96}$'
    OR auth.uid() IS NULL OR hearth_private.own_member_id(p_household_id,p_environment) IS DISTINCT FROM p_member_id
    OR p_member_id IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 1000 OR
    (p_after_digest IS NOT NULL AND p_after_digest !~ '^[0-9a-f]{64}$') THEN RAISE EXCEPTION 'INVALID_RESERVATION_PAGE'; END IF;
  PERFORM 1 FROM public.households WHERE id=p_household_id AND environment=p_environment FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'IMPORT_SOURCE_MISSING'; END IF;
  SELECT * INTO cutover FROM hearth_private.ledger_sync_cutovers
    WHERE environment=p_environment AND household_id=p_household_id;
  IF NOT FOUND OR cutover.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'CUTOVER_REQUIRED'; END IF;
  IF cutover.authority_instance IS DISTINCT FROM p_authority_instance THEN RAISE EXCEPTION 'AUTHORITY_RECOVERY_REQUIRED'; END IF;
  SELECT * INTO manifest FROM hearth_private.ledger_reservation_manifests
    WHERE environment=p_environment AND household_id=p_household_id;
  IF NOT FOUND THEN
    INSERT INTO hearth_private.ledger_reservation_manifests(environment,household_id,authority_instance,source_revision)
      VALUES(p_environment,p_household_id,p_authority_instance,cutover.source_revision) RETURNING * INTO manifest;
    -- Migration 019's household lock/fence makes all these retained sources
    -- immutable. Include both members' identities, never their financial data.
    WITH events AS (
      SELECT * FROM public.continuity_command_events WHERE environment=p_environment AND household_id=p_household_id
    ), identities AS (
      SELECT receipt->>'confirmationId' AS identity FROM jsonb_array_elements(coalesce(cutover.shared_payload::jsonb->'commandReceipts','[]'::jsonb)) receipt
      UNION SELECT confirmation_id FROM events
      UNION SELECT idempotency_key FROM events
      UNION SELECT jsonb_array_elements_text(coalesce(payload_json->'compactedConfirmationIds','[]'::jsonb)) FROM events
      UNION SELECT command->>'confirmationId' FROM events CROSS JOIN LATERAL jsonb_array_elements(coalesce(payload_json->'compactedCommands','[]'::jsonb)) command
    ), normalized AS (
      SELECT CASE WHEN identity ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN lower(identity) ELSE identity END AS identity
      FROM identities WHERE identity IS NOT NULL AND identity <> ''
    ) INSERT INTO hearth_private.ledger_reservation_digests(manifest_id,digest)
      SELECT DISTINCT manifest.manifest_id, encode(sha256(convert_to('ledger-reservation-v1' || chr(10) || p_environment || chr(10) || p_household_id || chr(10) || identity,'UTF8')),'hex') FROM normalized;
    UPDATE hearth_private.ledger_reservation_manifests SET total=(SELECT count(*) FROM hearth_private.ledger_reservation_digests WHERE manifest_id=manifest.manifest_id)
      WHERE manifest_id=manifest.manifest_id RETURNING * INTO manifest;
  END IF;
  IF manifest.authority_instance IS DISTINCT FROM p_authority_instance THEN RAISE EXCEPTION 'AUTHORITY_RECOVERY_REQUIRED'; END IF;
  SELECT coalesce(jsonb_agg(digest ORDER BY digest),'[]'::jsonb), max(digest) INTO page,last_digest
    FROM (SELECT digest FROM hearth_private.ledger_reservation_digests WHERE manifest_id=manifest.manifest_id
      AND (p_after_digest IS NULL OR digest > p_after_digest) ORDER BY digest LIMIT p_limit) ordered_page;
  SELECT EXISTS(SELECT 1 FROM hearth_private.ledger_reservation_digests WHERE manifest_id=manifest.manifest_id AND digest > last_digest) INTO more;
  RETURN jsonb_build_object('version',1,'manifestId',manifest.manifest_id,'authorityInstance',manifest.authority_instance,
    'sourceRevision',manifest.source_revision,'total',manifest.total,'digests',page,'next',CASE WHEN more THEN last_digest ELSE NULL END,'complete',NOT more);
END;
$$;
REVOKE ALL ON FUNCTION public.ledger_sync_reservations_page(text,text,text,uuid,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ledger_sync_reservations_page(text,text,text,uuid,text,integer) TO authenticated;
INSERT INTO public.schema_migrations(id,applied_at) VALUES(20,clock_timestamp()::text) ON CONFLICT DO NOTHING;
COMMIT;
NOTIFY pgrst, 'reload schema';
