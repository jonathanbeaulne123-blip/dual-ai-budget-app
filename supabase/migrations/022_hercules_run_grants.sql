-- Prepared migration only. Applying schema is a separately authorized Release step.
BEGIN;
CREATE TABLE IF NOT EXISTS hearth_private.hercules_run_grants (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), environment text NOT NULL CHECK(environment='development'),
 household_id text NOT NULL, member_id text NOT NULL, auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 session_id uuid NOT NULL, run_id uuid NOT NULL, project_id uuid NOT NULL,
 token_sha256 text NOT NULL UNIQUE CHECK(token_sha256 ~ '^[0-9a-f]{64}$'),
 permitted_reads text[] NOT NULL, budget jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), expires_at timestamptz NOT NULL, revoked_at timestamptz,
 UNIQUE(environment,household_id,member_id,run_id),
 FOREIGN KEY(environment,household_id,member_id) REFERENCES public.continuity_memberships(environment,household_id,member_id) ON DELETE CASCADE,
 CHECK(expires_at>created_at AND expires_at<=created_at+interval '24 hours')
);
ALTER TABLE hearth_private.hercules_run_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON hearth_private.hercules_run_grants FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION hearth_private.hercules_run_grant_is_live(g hearth_private.hercules_run_grants)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT g.environment='development' AND g.revoked_at IS NULL AND g.expires_at>clock_timestamp()
 AND EXISTS(SELECT 1 FROM auth.sessions s WHERE s.id=g.session_id AND s.user_id=g.auth_user_id)
 AND EXISTS(SELECT 1 FROM public.continuity_memberships m WHERE m.environment=g.environment AND m.household_id=g.household_id
   AND m.member_id=g.member_id AND m.auth_user_id=g.auth_user_id AND m.active IS TRUE AND m.revoked_at IS NULL)
 AND (NOT EXISTS(SELECT 1 FROM public.hearth_member_sessions s WHERE s.environment=g.environment AND s.household_id=g.household_id AND s.member_id=g.member_id)
   OR EXISTS(SELECT 1 FROM public.hearth_member_sessions s WHERE s.environment=g.environment AND s.household_id=g.household_id AND s.member_id=g.member_id
     AND s.auth_user_id=g.auth_user_id AND s.session_id=g.session_id AND s.revoked_at IS NULL))
 AND NOT EXISTS(SELECT 1 FROM hearth_private.ledger_sync_cutovers c WHERE c.environment=g.environment AND c.household_id=g.household_id AND c.deleted_at IS NOT NULL);
$$;
REVOKE ALL ON FUNCTION hearth_private.hercules_run_grant_is_live(hearth_private.hercules_run_grants) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.hercules_issue_run_grant(p_environment text,p_household_id text,p_run_id uuid,p_project_id uuid,
 p_token_sha256 text,p_permitted_reads text[],p_budget jsonb,p_expires_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor text; caller uuid:=auth.uid(); sid uuid:=hearth_private.current_session_id(); issued timestamptz:=clock_timestamp();
 g hearth_private.hercules_run_grants%ROWTYPE;
BEGIN
 actor:=hearth_private.own_member_id(p_household_id,p_environment);
 IF p_environment IS DISTINCT FROM 'development' OR caller IS NULL OR actor IS NULL OR sid IS NULL OR NOT hearth_private.session_is_live()
 THEN RAISE EXCEPTION 'HERCULES_RUN_GRANT_DENIED' USING ERRCODE='42501'; END IF;
 IF p_run_id IS NULL OR p_project_id IS NULL OR p_token_sha256 IS NULL OR p_token_sha256 !~ '^[0-9a-f]{64}$'
 OR p_expires_at IS NULL OR p_expires_at<=issued OR p_expires_at>issued+interval '24 hours'
 OR p_permitted_reads IS NULL OR cardinality(p_permitted_reads)>80 OR array_position(p_permitted_reads,NULL) IS NOT NULL
 THEN RAISE EXCEPTION 'INVALID_HERCULES_RUN_GRANT'; END IF;
 -- Reads are only names; the Worker validates them against its static deterministic registry.
 -- No grant RPC performs a ledger command or exposes arbitrary table access.
 IF jsonb_typeof(p_budget) IS DISTINCT FROM 'object'
 OR jsonb_typeof(p_budget->'maxSteps') IS DISTINCT FROM 'number'
 OR jsonb_typeof(p_budget->'maxTokens') IS DISTINCT FROM 'number'
 OR jsonb_typeof(p_budget->'maxDurationMs') IS DISTINCT FROM 'number'
 OR (p_budget-'maxSteps'-'maxTokens'-'maxDurationMs') IS DISTINCT FROM '{}'::jsonb
 OR coalesce(p_budget->>'maxSteps','') !~ '^[1-9][0-9]{0,2}$'
 OR coalesce(p_budget->>'maxTokens','') !~ '^[1-9][0-9]{0,6}$'
 OR coalesce(p_budget->>'maxDurationMs','') !~ '^[1-9][0-9]{0,7}$'
 THEN RAISE EXCEPTION 'INVALID_HERCULES_BUDGET'; END IF;
 IF (p_budget->>'maxSteps')::integer>24 OR (p_budget->>'maxTokens')::integer>120000 OR (p_budget->>'maxDurationMs')::integer>1800000
 THEN RAISE EXCEPTION 'HERCULES_BUDGET_EXCEEDED'; END IF;
 INSERT INTO hearth_private.hercules_run_grants(environment,household_id,member_id,auth_user_id,session_id,run_id,project_id,token_sha256,permitted_reads,budget,created_at,expires_at)
 VALUES(p_environment,p_household_id,actor,caller,sid,p_run_id,p_project_id,p_token_sha256,p_permitted_reads,p_budget,issued,p_expires_at)
 ON CONFLICT(environment,household_id,member_id,run_id) DO NOTHING;
 SELECT * INTO g FROM hearth_private.hercules_run_grants r WHERE r.environment=p_environment AND r.household_id=p_household_id AND r.member_id=actor AND r.run_id=p_run_id;
 IF g.auth_user_id IS DISTINCT FROM caller OR g.session_id IS DISTINCT FROM sid OR g.project_id IS DISTINCT FROM p_project_id
 OR g.token_sha256 IS DISTINCT FROM p_token_sha256 OR g.permitted_reads IS DISTINCT FROM p_permitted_reads OR g.budget IS DISTINCT FROM p_budget
 OR g.expires_at IS DISTINCT FROM p_expires_at OR NOT hearth_private.hercules_run_grant_is_live(g)
 THEN RAISE EXCEPTION 'HERCULES_RUN_GRANT_CONFLICT' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('grantId',g.id,'runId',g.run_id,'projectId',g.project_id,'expiresAt',g.expires_at);
END;
$$;
REVOKE ALL ON FUNCTION public.hercules_issue_run_grant(text,text,uuid,uuid,text,text[],jsonb,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hercules_issue_run_grant(text,text,uuid,uuid,text,text[],jsonb,timestamptz) TO authenticated;
CREATE OR REPLACE FUNCTION public.hercules_lease_run_grant(p_token text,p_run_id uuid,p_project_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE g hearth_private.hercules_run_grants%ROWTYPE; member_role text; checked timestamptz;
BEGIN
 IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' OR p_run_id IS NULL OR p_project_id IS NULL
 THEN RAISE EXCEPTION 'HERCULES_RUN_GRANT_DENIED' USING ERRCODE='42501'; END IF;
 SELECT * INTO g FROM hearth_private.hercules_run_grants r WHERE r.token_sha256=encode(sha256(convert_to(p_token,'UTF8')),'hex') AND r.run_id=p_run_id AND r.project_id=p_project_id;
 IF NOT FOUND OR NOT hearth_private.hercules_run_grant_is_live(g) THEN RAISE EXCEPTION 'HERCULES_RUN_GRANT_DENIED' USING ERRCODE='42501'; END IF;
 SELECT role INTO member_role FROM public.continuity_memberships m WHERE m.environment=g.environment AND m.household_id=g.household_id AND m.member_id=g.member_id AND m.auth_user_id=g.auth_user_id AND m.active IS TRUE AND m.revoked_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'HERCULES_RUN_GRANT_DENIED' USING ERRCODE='42501'; END IF;
 checked:=clock_timestamp();
 RETURN jsonb_build_object('grantId',g.id,'runId',g.run_id,'projectId',g.project_id,'environment',g.environment,
 'householdId',g.household_id,'memberId',g.member_id,'subject',g.auth_user_id,'role',member_role,
 'permittedReads',g.permitted_reads,'budget',g.budget,'leaseExpiresAt',least(g.expires_at,checked+interval '60 seconds'));
END;
$$;
-- Capability authenticated; never anonymous table access or a financial command credential.
REVOKE ALL ON FUNCTION public.hercules_lease_run_grant(text,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hercules_lease_run_grant(text,uuid,uuid) TO anon;
CREATE OR REPLACE FUNCTION public.hercules_revoke_run_grant(p_environment text,p_household_id text,p_run_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT hearth_private.session_is_live() THEN RAISE EXCEPTION 'HERCULES_RUN_GRANT_DENIED' USING ERRCODE='42501'; END IF;
 UPDATE hearth_private.hercules_run_grants SET revoked_at=coalesce(revoked_at,clock_timestamp()) WHERE environment=p_environment AND household_id=p_household_id AND run_id=p_run_id AND auth_user_id=auth.uid();
 RETURN jsonb_build_object('revoked',true);
END;
$$;
REVOKE ALL ON FUNCTION public.hercules_revoke_run_grant(text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hercules_revoke_run_grant(text,text,uuid) TO authenticated;
INSERT INTO public.schema_migrations(id,applied_at) VALUES(22,clock_timestamp()::text) ON CONFLICT DO NOTHING;
COMMIT;
NOTIFY pgrst,'reload schema';
