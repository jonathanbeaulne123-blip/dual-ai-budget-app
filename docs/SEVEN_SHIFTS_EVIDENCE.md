# 7shifts Evidence Mesh and deterministic reconciliation

Status: D-158/D-159 merged foundation plus D-160 full-release packet and local D-163 direct-Gmail/Hercules review packet. Risk: **Release**. Development and Production have separate Evidence D1/private R2/Queue/DLQ resources and wrapping keys; the Production Evidence and 7shifts schemas are applied. Development/Production capture and the read-only official adapter are enabled by the D-160 release config, while automation still requires an explicit member/job policy. Cloudflare Email Routing remains disabled and is no longer required for Jonathan's Gmail flow. D-163 uses explicit short-lived Gmail read-only consent in the PWA and does not store a server refresh token. A real official provider smoke still requires a restaurant-administrator access token entered by the authenticated member.

## Data path

`explicit capture → authenticated/quarantined Evidence Worker → encrypted member raw object → bounded derivation → canonical evidence bundle → eligible automation job → postWorkShift/reconcileWorkWeekFromEvidence → acceptHouseholdWrite → PGlite + authenticated continuity → Evidence receipt`

The Evidence Worker has distinct `EVIDENCE_DB`/`EVIDENCE_PRODUCTION_DB`, private `EVIDENCE_RAW`/`EVIDENCE_PRODUCTION_RAW`, and environment-specific Queue/DLQ bindings. It does not reuse D-155's `FLINKS_DB`, household snapshots, PGlite, or command events. Encryption and mail secrets never enter the file. Both R2 buckets are private with no public URL or custom domain.

Each environment vault has an application-enforced R2 ceiling well below Cloudflare's included allowance: 1 GiB stored, 100,000 objects, 10,000 puts per UTC month, and 100,000 gets per UTC month. Reservations happen in that environment's D1 before its R2 is touched and fail closed. Deletion releases stored bytes; cleanup deletes are never blocked. These are safety ceilings, not an activation signal, and Cloudflare billing alerts remain a separate operational control.

## Deterministic extraction

The Queue decrypts one owner-scoped object, rechecks its digest and encryption context, then derives bounded facts without a model call. Supported inputs are official-shape 7shifts punch/timesheet JSON, RFC4180-style CSV, employee Timesheet and Tip Report text/CSV, ICS schedule events, and bounded RFC822 MIME with structured text/JSON/CSV/ICS attachments. Local OCR and a disclosed cloud-vision result are accepted as separate JSON observations; matching material fields become corroborated and differences become explicit conflicts. A raw screenshot or PDF remains encrypted and `ready_to_review` with no invented facts until those independent extraction results are supplied.

Recognized observations preserve value, unit, source location, confidence, finality, extraction method, and conflict state. Unknown provider fields are written to `evidence_schema_drift` with their exact owner/evidence/revision/canonical-shift scope and digest. They are visible only through the authenticated member's extracted-facts review and never become authority observations, bundles, household state, Hercules facts, or command inputs. Name-only rows remain unmapped; exact provider subject plus an explicit Hearth job/role mapping is required before automation eligibility.

## Ownership and encryption

Every authenticated route derives the Supabase/Google subject from the bearer JWT and resolves an active `continuity_memberships` row for the exact environment/household/member. Clients cannot assert `auth_user_id`. Raw bytes use a random 256-bit data key and AES-GCM. The additional authenticated data binds environment, authenticated subject, household, member, evidence id, plaintext SHA-256, and cipher version. The data key is separately wrapped under the environment-specific versioned Evidence key. Raw reads reauthorize, stream with `no-store`, and never return a public/presigned R2 URL. Delete nulls the wrapped key before deleting R2.

Queue messages contain only `{ evidenceId, revision }`. Raw filenames, private calendar URLs, mail sender/recipient/subject/body, provider keys, tokens, names, notes, object keys, and hashes are never household/model facts. Raw evidence defaults to no expiry until the member exports/deletes it or a later approved retention policy changes.

## Capture channels

- PWA: one selected JSON/CSV/ICS/PDF/image at a time. Selected ICS and an on-demand private 7shifts link can refresh only the member's Personal schedule outlook. The private URL is cleared and never stored; scope, URL, navigation, and unmount abort the request.
- Chromium companion: Manifest V3; exact `app.7shifts.com` and one Evidence upload endpoint only; `activeTab`, scripting, and session storage only. Capture requires a popup gesture, top frame, and session enablement. Passwords, cookies, headers, tokens, other origins, and background broad scraping are excluded. One five-minute member capability authorizes one upload and is burned first.
- iPhone companion: SwiftUI/Share Extension/App Intent scaffold accepts one selected file/image/text/URL, uses security-scoped access, Keychain cleanup, account-bound capability validation, nonce replay protection, and bounded URLSession upload. It has no Photos/Contacts/Mail/notification entitlement. Xcode/device/TestFlight proof requires macOS and a separate gate.
- Direct Gmail (D-163): an authenticated member clicks **Connect Gmail and scrub**. The PWA requests only `gmail.readonly`, runs the fixed `from:(7shifts.com)` query with bounded pagination, fetches raw RFC822, verifies that the actual From mailbox is `7shifts.com` or a subdomain, and uploads it into the same encrypted member vault. A server-computed owner-scoped raw digest makes repeated scrubs idempotent without retaining Gmail message ids or subjects. No Gmail token reaches the Worker/Hercules, and no send/modify/label/archive/forward operation exists.
- Forwarded Email Routing remains dormant legacy scaffolding behind its independent flag/domain. It is not part of the D-163 direct-Gmail path.
- OCR/vision: the existing local layout/OCR and disclosed provider paths remain independent. The selected artifact is retained only through the Evidence vault; the document client no longer sends its local filename. A screen cannot become eligible unless local and cloud extraction agree at high confidence on every material time/money field.
- Official API: D-155 remains an optional administrator/company adapter in either environment. It is read-only, exact-member/job mapped, separately encrypted per environment, and not a prerequisite for employee-selected channels. No provider call occurs until an authenticated member enters a restaurant-administrator token.

## Evidence and authority

`SevenShiftsEvidenceBundle` is versioned and binds every reference to one environment, household, member, mapped Hearth job, provider subject, canonical shift, and exact time window. Canonical sorting and a material hash cover all envelopes, observations, authority choices, conflicts, and revisions. Command identity, financial audit facts, and PGlite integrity facts include the whole bundle.

An eligible bundle is never trusted from client JSON. The Worker resolves every evidence id against the authenticated owner's immutable D1 item, digest, capture kind, capture time, canonical-shift derivative, parser/schema version, and exact complete observation set. The same proof is rerun at stage, claim, and immediately before posting. Client-only facts may be retained only in quarantine; they cannot create an automation job.

Calendar, schedules, trades, open shifts, notifications, and email cannot establish worked money. D-163 can extract published schedule times from genuine 7shifts RFC822 only as `outlook` observations. Structured approved/final worked rows can be eligible immediately; provisional rows wait the configured stability window. Screens require matching independent extraction. Conflicts, unknown money meaning, missing role/job mapping, changed scope, and arithmetic mismatch quarantine. Missing sales/covers/staffing/tips remain absent; no zero or inference is introduced.

Hearth's effective-dated job rules remain wage/overtime/account/visibility/tip-out authority. Provider money is carried as attributed evidence; final wage/tip reclassification and closed-period variance require configured semantics and cannot silently overwrite an accrual or payroll settlement.

## Automation and correction

Automation is hard-off by default and enabled per exact member/job. An authenticated awake Hearth runner claims at most a bounded number of jobs. `s7:<member>:<canonical-shift>:<revision>:<action>:<material-hash>` becomes the command confirmation/idempotency id. The runner uses ordinary `postWorkShift` and `acceptHouseholdWrite`; PGlite/hash verification occurs before a member-scoped receipt is acknowledged. A crash after append retries the same id and acknowledges the existing receipt.

Evidence acknowledgement writes the receipt, posted bundle marker, and terminal job state in one D1 batch. If the authenticated command append succeeded but the Worker acknowledgement was lost, claim-time recovery reads the exact member-visible Supabase command event by deterministic id, verifies its identity/audit receipt, repairs D1 atomically, and reclassifies any newer revision as reconciliation. Until that hosted receipt is visible, a changed-evidence conflict remains pending instead of being quarantined.

Provider revisions create `reconcile_week` jobs. `reconcileWorkWeekFromEvidence` requires the complete active evidence-backed payroll week, refuses mixed scopes, closed periods, paid deferred tip-outs, missing shift revisions, and conflicts, creates exactly one component-faithful reversal per original, then posts replacements chronologically so weekly overtime is recomputed. It links original and replacement shifts and commits the composite once. `workShiftIsReversed` recognizes only exact one-for-one reversals including accounts, categories, splits, visibility, and amounts.

Only the newest eligible revision can be claimed. Older pending work is superseded, a revision arriving behind an in-flight post is reclassified at claim, the exact policy/membership/lease is revalidated immediately before the money command, and corrections beyond the configured horizon become variance review. Any wage or card-tip receivable settlement in the affected period also blocks automatic reversal.

Settled/closed periods do not reopen. The local packet deliberately routes them to visible variance review; activating automatic current-period variance entries requires a later approved account/mapping policy and synthetic accounting proof.

## Hercules and model boundary

Tool execution scopes internally for every call. D-163 adds `scrub_my_7shifts_email`, which reads only reduced Gmail-derived observations, and a separate `shift_write_options`/sealed prepare/explicit-confirm pair for already eligible non-email worked bundles. Shift/tip tools can retain only the requesting member's legitimate legacy household-posted shifts; a `member` argument cannot reach partner Personal rows. All evidence bundles/digests are stripped before reduced confirmed shift facts reach tools or model prompts. Calendar projections additionally remove source-derived ids, provenance, notes flags, source timestamps, and capture metadata. Raw vault routes, identifiers, source paths, hashes, filenames, URLs, mail content, coworker names, and pending/quarantined rows have no Hercules contract.

## D-160 release state

1. **Complete:** separate Development and Production D1/R2/Queue/DLQ resources, schemas, queue routing, ownership AAD, client scope, UI scope, and Worker secret names.
2. **Complete locally:** synthetic capture, extraction, cross-member/environment denial, migration application, tamper/deletion, duplicate queue, accounting correction, Hercules stripping, TypeScript, and build proof.
3. **Release config:** selected capture, official connector, Production Evidence, and Production continuity are enabled. Automation remains off until a member explicitly saves a job policy; no default policy is created.
4. **D-163 replacement:** no Cloudflare email domain is required for direct Gmail. Jonathan must grant Gmail read-only on Google's consent screen; broader distribution may require Google's restricted-scope verification.
5. **External prerequisite:** enter a valid restaurant-administrator 7shifts access token through Shift → Jobs before any official provider call or real provider smoke.
6. **Post-deploy proof:** authenticated selected capture/list/derive/export/delete in both environments, exact status/binding inspection, then one explicitly chosen job's automation/retry/correction smoke. Any failure uses the global flags and per-job policy as kill switches.
