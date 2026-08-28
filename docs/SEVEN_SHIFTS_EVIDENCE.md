# 7shifts Evidence Mesh and deterministic reconciliation

Status: local D-158/D-159 implementation on `codex/7shifts-evidence-mesh`. Risk: **Release**. The dedicated Development D1, private R2, Queue/DLQ, encryption key, both Evidence migrations, and an inert Worker deployment were completed under explicit approval on 2026-08-28. Every activation flag remains off. Email routing, extension/TestFlight distribution, Development capture/automation activation, real-evidence smoke, push, merge, and Production remain separately gated.

## Data path

`explicit capture → authenticated/quarantined Evidence Worker → encrypted member raw object → bounded derivation → canonical evidence bundle → eligible automation job → postWorkShift/reconcileWorkWeekFromEvidence → acceptHouseholdWrite → PGlite + authenticated continuity → Evidence receipt`

The Evidence Worker has its own `EVIDENCE_DB`, private `EVIDENCE_RAW`, and `EVIDENCE_DERIVE`/DLQ design. It does not reuse D-155's `FLINKS_DB`, household snapshots, PGlite, or command events. `wrangler.jsonc` records the dedicated Development D1, R2, and Queue bindings while every activation flag stays hard-off; encryption and mail secrets never enter the file. The R2 bucket has no public development URL or custom domain.

The Development vault has an application-enforced R2 ceiling well below Cloudflare's included allowance: 1 GiB stored, 100,000 objects, 10,000 puts per UTC month, and 100,000 gets per UTC month. Reservations happen in D1 before R2 is touched and fail closed. Deletion releases stored bytes; cleanup deletes are never blocked. These are safety ceilings, not an activation signal, and Cloudflare billing alerts remain a separate operational control.

## Deterministic extraction

The Queue decrypts one owner-scoped object, rechecks its digest and encryption context, then derives bounded facts without a model call. Supported inputs are official-shape 7shifts punch/timesheet JSON, RFC4180-style CSV, employee Timesheet and Tip Report text/CSV, ICS schedule events, and bounded RFC822 MIME with structured text/JSON/CSV/ICS attachments. Local OCR and a disclosed cloud-vision result are accepted as separate JSON observations; matching material fields become corroborated and differences become explicit conflicts. A raw screenshot or PDF remains encrypted and `ready_to_review` with no invented facts until those independent extraction results are supplied.

Recognized observations preserve value, unit, source location, confidence, finality, extraction method, and conflict state. Unknown provider fields are written to `evidence_schema_drift` with their exact owner/evidence/revision/canonical-shift scope and digest. They are visible only through the authenticated member's extracted-facts review and never become authority observations, bundles, household state, Hercules facts, or command inputs. Name-only rows remain unmapped; exact provider subject plus an explicit Hearth job/role mapping is required before automation eligibility.

## Ownership and encryption

Every authenticated route derives the Supabase/Google subject from the bearer JWT and resolves an active `continuity_memberships` row for the exact Development household/member. Clients cannot assert `auth_user_id`. Raw bytes use a random 256-bit data key and AES-GCM. The additional authenticated data binds environment, authenticated subject, household, member, evidence id, plaintext SHA-256, and cipher version. The data key is separately wrapped under versioned `EVIDENCE_KEK_V1`. Raw reads reauthorize, stream with `no-store`, and never return a public/presigned R2 URL. Delete nulls the wrapped key before deleting R2.

Queue messages contain only `{ evidenceId, revision }`. Raw filenames, private calendar URLs, mail sender/recipient/subject/body, provider keys, tokens, names, notes, object keys, and hashes are never household/model facts. Raw evidence defaults to no expiry until the member exports/deletes it or a later approved retention policy changes.

## Capture channels

- PWA: one selected JSON/CSV/ICS/PDF/image at a time. Selected ICS and an on-demand private 7shifts link can refresh only the member's Personal schedule outlook. The private URL is cleared and never stored; scope, URL, navigation, and unmount abort the request.
- Chromium companion: Manifest V3; exact `app.7shifts.com` and one Evidence upload endpoint only; `activeTab`, scripting, and session storage only. Capture requires a popup gesture, top frame, and session enablement. Passwords, cookies, headers, tokens, other origins, and background broad scraping are excluded. One five-minute member capability authorizes one upload and is burned first.
- iPhone companion: SwiftUI/Share Extension/App Intent scaffold accepts one selected file/image/text/URL, uses security-scoped access, Keychain cleanup, account-bound capability validation, nonce replay protection, and bounded URLSession upload. It has no Photos/Contacts/Mail/notification entitlement. Xcode/device/TestFlight proof requires macOS and a separate gate.
- Email: an authenticated member may rotate a high-entropy alias only when the independent email flag/domain are configured. Cloudflare's trusted email event stores the complete bounded RFC822 encrypted and quarantined. From/To/headers/body/attachments are evidence, never identity. No remote URL is fetched.
- OCR/vision: the existing local layout/OCR and disclosed provider paths remain independent. The selected artifact is retained only through the Evidence vault; the document client no longer sends its local filename. A screen cannot become eligible unless local and cloud extraction agree at high confidence on every material time/money field.
- Official API: D-155 remains an optional administrator/company adapter. Its connector is not a prerequisite for employee-selected channels and stays separately disabled/Development-only.

## Evidence and authority

`SevenShiftsEvidenceBundle` is versioned and binds every reference to one environment, household, member, mapped Hearth job, provider subject, canonical shift, and exact time window. Canonical sorting and a material hash cover all envelopes, observations, authority choices, conflicts, and revisions. Command identity, financial audit facts, and PGlite integrity facts include the whole bundle.

An eligible bundle is never trusted from client JSON. The Worker resolves every evidence id against the authenticated owner's immutable D1 item, digest, capture kind, capture time, canonical-shift derivative, parser/schema version, and exact complete observation set. The same proof is rerun at stage, claim, and immediately before posting. Client-only facts may be retained only in quarantine; they cannot create an automation job.

Calendar, schedules, trades, open shifts, notifications, and email cannot establish worked money. Structured approved/final worked rows can be eligible immediately; provisional rows wait the configured stability window. Screens require matching independent extraction. Conflicts, unknown money meaning, missing role/job mapping, changed scope, and arithmetic mismatch quarantine. Missing sales/covers/staffing/tips remain absent; no zero or inference is introduced.

Hearth's effective-dated job rules remain wage/overtime/account/visibility/tip-out authority. Provider money is carried as attributed evidence; final wage/tip reclassification and closed-period variance require configured semantics and cannot silently overwrite an accrual or payroll settlement.

## Automation and correction

Automation is hard-off by default and enabled per exact member/job. An authenticated awake Hearth runner claims at most a bounded number of jobs. `s7:<member>:<canonical-shift>:<revision>:<action>:<material-hash>` becomes the command confirmation/idempotency id. The runner uses ordinary `postWorkShift` and `acceptHouseholdWrite`; PGlite/hash verification occurs before a member-scoped receipt is acknowledged. A crash after append retries the same id and acknowledges the existing receipt.

Evidence acknowledgement writes the receipt, posted bundle marker, and terminal job state in one D1 batch. If the authenticated command append succeeded but the Worker acknowledgement was lost, claim-time recovery reads the exact member-visible Supabase command event by deterministic id, verifies its identity/audit receipt, repairs D1 atomically, and reclassifies any newer revision as reconciliation. Until that hosted receipt is visible, a changed-evidence conflict remains pending instead of being quarantined.

Provider revisions create `reconcile_week` jobs. `reconcileWorkWeekFromEvidence` requires the complete active evidence-backed payroll week, refuses mixed scopes, closed periods, paid deferred tip-outs, missing shift revisions, and conflicts, creates exactly one component-faithful reversal per original, then posts replacements chronologically so weekly overtime is recomputed. It links original and replacement shifts and commits the composite once. `workShiftIsReversed` recognizes only exact one-for-one reversals including accounts, categories, splits, visibility, and amounts.

Only the newest eligible revision can be claimed. Older pending work is superseded, a revision arriving behind an in-flight post is reclassified at claim, the exact policy/membership/lease is revalidated immediately before the money command, and corrections beyond the configured horizon become variance review. Any wage or card-tip receivable settlement in the affected period also blocks automatic reversal.

Settled/closed periods do not reopen. The local packet deliberately routes them to visible variance review; activating automatic current-period variance entries requires a later approved account/mapping policy and synthetic accounting proof.

## Hercules and model boundary

Tool execution scopes internally for every call. Shift/tip tools can retain only the requesting member's legitimate legacy household-posted shifts; a `member` argument cannot reach partner Personal rows. All evidence bundles/digests are stripped before reduced confirmed shift facts reach tools or model prompts. Calendar projections additionally remove source-derived ids, provenance, notes flags, source timestamps, and capture metadata. Raw vault routes, identifiers, source paths, hashes, filenames, URLs, mail content, coworker names, and pending/quarantined rows have no Hercules contract.

## Activation gates

1. Review/merge local code with zero P0/P1 and documented P2.
2. **Completed inert:** provision Development D1/R2/Queue/DLQ plus `EVIDENCE_KEK_V1`; apply `migrations/evidence/0001_evidence_mesh.sql` and the fail-closed R2 ceiling in `0002_r2_budget_guard.sql` to the dedicated D1; deploy with every activation flag off.
3. Synthetic PWA capture and vault attack tests; then an explicitly approved real member capture with automation still off.
4. Separate approvals for extension distribution, email routing/domain, macOS build/device/TestFlight, and one-job Development automation.
5. Prove multi-runner retry, full-week overtime correction, settlement/closed-period variance semantics, deletion/export, logs/cache, and rollback.
6. Production remains hard-disabled until a new Release decision and Production-specific storage, secrets, retention, monitoring, incident response, and rollback proof.
