-- Source-only P12 prerequisite. No key is inserted or enabled; no hosted apply.
BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_extension e JOIN pg_catalog.pg_namespace n ON n.oid=e.extnamespace
    WHERE e.extname='pgcrypto' AND n.nspname='extensions') THEN RAISE EXCEPTION 'GUEST_REQUIRES_PGCRYPTO_IN_EXTENSIONS'; END IF;
END $$;
CREATE TABLE IF NOT EXISTS hearth_private.guest_authority_keys (
  key_id text PRIMARY KEY CHECK(key_id ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$'),
  environment text NOT NULL CHECK(environment='development'),
  secret bytea NOT NULL CHECK(octet_length(secret)=32),
  enabled boolean NOT NULL DEFAULT false,
  not_before timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  CHECK(expires_at>not_before)
);
ALTER TABLE hearth_private.guest_authority_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON hearth_private.guest_authority_keys FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.hearthside_guest_authority(
  p_environment text,p_household_id text,p_key_id text,p_issued_at bigint,p_token_sha256 text,p_signature text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE caller uuid:=auth.uid();checked timestamptz:=clock_timestamp();header text;token_hash text;
  material text;secret_key bytea;actual bytea;expected bytea;mismatch integer:=0;
  principals jsonb:='[]'::jsonb;actor text:=NULL;
BEGIN
  -- The visitor authenticates as themself. Host membership is deliberately not a
  -- prerequisite; this server-only result contains no household snapshot.
  IF p_environment IS DISTINCT FROM 'development' OR caller IS NULL OR NOT hearth_private.session_is_live()
    OR (p_household_id IS NOT NULL AND p_household_id !~ '^HH-[A-Za-z0-9_-]{1,96}$')
    OR p_key_id IS NULL OR p_key_id !~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$'
    OR p_issued_at IS NULL OR p_issued_at<floor(extract(epoch FROM checked))-30 OR p_issued_at>floor(extract(epoch FROM checked))+5
    OR p_token_sha256 IS NULL OR p_token_sha256 !~ '^[0-9a-f]{64}$'
    OR p_signature IS NULL OR p_signature !~ '^[0-9a-f]{64}$'
  THEN RAISE EXCEPTION 'GUEST_AUTHORITY_DENIED' USING ERRCODE='42501'; END IF;
  header:=coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'authorization','');
  IF octet_length(header)>8199 OR header !~ '^Bearer [A-Za-z0-9._~-]+$' THEN RAISE EXCEPTION 'GUEST_AUTHORITY_DENIED' USING ERRCODE='42501'; END IF;
  token_hash:=encode(sha256(convert_to(substring(header FROM 8),'UTF8')),'hex');
  IF token_hash IS DISTINCT FROM p_token_sha256 THEN RAISE EXCEPTION 'GUEST_AUTHORITY_DENIED' USING ERRCODE='42501'; END IF;
  SELECT k.secret INTO secret_key FROM hearth_private.guest_authority_keys k WHERE k.key_id=p_key_id
    AND k.environment=p_environment AND k.enabled AND k.not_before<=checked AND k.expires_at>checked;
  IF secret_key IS NULL THEN RAISE EXCEPTION 'GUEST_AUTHORITY_DENIED' USING ERRCODE='42501'; END IF;
  material:=concat_ws(E'\n','hearthside-guest-authority-v1',p_key_id,p_environment,coalesce(p_household_id,''),p_issued_at::text,p_token_sha256);
  expected:=extensions.hmac(convert_to(material,'UTF8'),secret_key,'sha256');actual:=decode(p_signature,'hex');
  FOR i IN 0..31 LOOP mismatch:=mismatch | (get_byte(actual,i) # get_byte(expected,i)); END LOOP;
  IF mismatch<>0 THEN RAISE EXCEPTION 'GUEST_AUTHORITY_DENIED' USING ERRCODE='42501'; END IF;
  IF p_household_id IS NOT NULL THEN
    IF EXISTS(SELECT 1 FROM hearth_private.ledger_sync_cutovers c WHERE c.environment=p_environment AND c.household_id=p_household_id AND c.deleted_at IS NOT NULL)
      THEN RAISE EXCEPTION 'GUEST_AUTHORITY_DENIED' USING ERRCODE='42501'; END IF;
    SELECT coalesce(jsonb_agg(jsonb_build_object('memberId',m.member_id,'subject',m.auth_user_id) ORDER BY m.member_id),'[]'::jsonb)
      INTO principals FROM public.continuity_memberships m WHERE m.environment=p_environment AND m.household_id=p_household_id
      AND m.active IS TRUE AND m.revoked_at IS NULL AND m.auth_user_id IS NOT NULL;
    IF jsonb_array_length(principals)<2 OR jsonb_array_length(principals)>16 THEN RAISE EXCEPTION 'GUEST_AUTHORITY_DENIED' USING ERRCODE='42501'; END IF;
    actor:=hearth_private.own_member_id(p_household_id,p_environment);
  END IF;
  PERFORM set_config('response.headers','[{"Cache-Control":"private, no-store"}]',true);
  RETURN jsonb_build_object('version',1,'environment',p_environment,'householdId',p_household_id,'subject',caller,
    'checkedAt',floor(extract(epoch FROM checked)*1000)::bigint,'actorMemberId',actor,'principals',principals);
END;
$$;
REVOKE ALL ON FUNCTION public.hearthside_guest_authority(text,text,text,bigint,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hearthside_guest_authority(text,text,text,bigint,text,text) TO authenticated;
INSERT INTO public.schema_migrations(id,applied_at) VALUES(24,clock_timestamp()::text) ON CONFLICT DO NOTHING;
COMMIT;
NOTIFY pgrst,'reload schema';
