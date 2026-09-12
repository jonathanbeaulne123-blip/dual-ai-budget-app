# Hercules free-tier routing and synthetic activation

- Owner: Jonathan; implementer: Codex, one writer with two read-only trust auditors.
- Base: `origin/main@b1590260bba0cc7bf5992dac2a9ae60df384c6de`; branch `codex/hercules-free-tier`.
- Risk: Release. Jonathan authorizes free Flash-Lite for ordinary conversation, free Flash for larger tasks, stopping before quota exhaustion, and the US$5/month Cloudflare upgrade. All current app data is explicitly synthetic and fictional for simulation.
- Budget (5): enforce shared project quotas, preserve exact financial readers and Final Confirm; no paid AI fallback.
- Engagement (3): enable continuous Hercules conversation and durable work with adaptive model effort and understandable quota pauses.

## Scope and acceptance

Pin `gemini-3.1-flash-lite` for ordinary work and `gemini-3.8-flash` for larger thinking. Preserve model thought signatures, schema validation, immutable receipts, scoped grants and private project ownership. One durable Google-project quota coordinator must reserve all generation calls across workspace and legacy routes, including simultaneous devices, retries and service restarts. Limits and free-tier status must be verified against the actual Google project; absent or expired evidence pauses paid-risk calls. No automatic provider/model switching on exhausted quota.

Synthetic Development activation includes the prepared grant migration, workspace UI/runtime gates, real provider smoke and existing stable Sandbox infrastructure. Production and Google writes remain disabled. Apply the user-approved Cloudflare upgrade only at the quoted US$5/month base plan; no paid AI plan or credit purchase is authorized.

## Evidence and open work

- The source checkout is isolated from the already released workspace and newer Hercules Play work.
- Cloudflare connector cannot read account subscriptions (authentication error); dashboard browser control has timed out. No billing change is claimed.
- Existing code has per-run budgets but lacks project-wide provider quotas. Legacy Gemini paths can currently fall back to other providers and must be closed for free-only mode.
- Actual Google project free-tier status and RPM/TPM/RPD limits remain to be verified before execution activation.
- Focused tests, live synthetic provider checks, authenticated continuity, container execution and release receipts will be recorded separately. No exhaustive suite is authorized.

## Current activation evidence

- Jonathan upgraded Cloudflare; the previously plan-blocked Containers API now returns HTTP 200 with no applications yet. No second upgrade or subscription purchase was made.
- AI Studio project `hearth-506304` (Hearth) is Free tier. Observed limits: Gemini 3.1 Flash-Lite 15 RPM / 250,000 input TPM / 500 RPD; Gemini 3.8 Flash 5 RPM / 250,000 input TPM / 20 RPD. Both showed zero use over the displayed 28-day period. Bianca uses separate projects. No key for Hearth was listed.
- Jonathan explicitly approved creating a dedicated Hearth API key and storing it only in the Hearth Cloudflare Worker. Browser interaction subsequently failed with clipboard timeouts, stale/unresponsive navigation and noWindowsAvailable; the in-app browser also timed out. Key creation is not yet claimed.
- No Supabase database URL/password or access token is available in this process or the checked project-local env locations. Migration 022 is locally tested but its hosted application is not yet claimed.
- Worker typecheck passed after adding the quota Durable Object to its explicit coverage. Focused initial tests: 18 passed, one reset-time precision failure; that failure was fixed and all eight quota/provider helper tests then passed.
- Real Miniflare SQLite quota proof: five checks passed, including concurrent admission, recoverable attempts, paired count/generation slots, duplicate dispatch refusal, persistence across restart, and project-wide upstream quota pause. Artifact `/tmp/hearth-gemini-quota-2lbcSw/results.json`.
- Real Agents/Workflows/R2 proof: 13 checks passed, including Lite-to-Flash promotion with saved evidence and no foreign signatures, pure LedgerRoom reads, artifact persistence, duplicate command recovery, private isolation, steering, reviewed-action invalidation, restart, cancellation and grant continuation. Artifact `/tmp/hearth-workspace-proof-fbfNx7/results.json`. Provider is synthetic in this proof; it is not live Google or physical-device evidence.
- Two independent read-only audits found and drove fixes for Shared Plan retry lockout, generation budget debit before quota admission, shift-camera hint loss and interrupted promotion recovery. Parallel count starvation was also corrected.

- High quick gate passed 106 tests across 17 files, App TypeScript and AI-surface checks. Elapsed 783.3s; five-minute SLA breached during TypeScript (752.6s). Later scoped coverage passed 31 tests across six provider/worker files; the existing document-scan suite initially lacked its Cloudflare runtime mock, so its harness was corrected. Document scan plus App startup/mainline then passed 97 tests across three files. No exhaustive lane ran.
- Supabase CLI 2.117.0 was checked as a fallback; `projects list` reports no access token. No login, hosted schema mutation, model call, secret creation or deployment is claimed from that attempt.
- Jonathan reopened Chrome and the authorized key setup resumed. Key creation remains pending verification of its completed form.
- Final Worker TypeScript passed. The real Workspace proof passed all 13 checks again, now explicitly recreating interruption after the promotion tool receipt but before the execution checkpoint; recovery called Flash and omitted Lite signatures. Artifact `/tmp/hearth-workspace-proof-EYIRtC/results.json`. An initial added fixture edited project metadata rather than the separately stored run and failed with 409; the fixture was corrected to update `workspace_items`, then passed.
- Final independent source review found no further concrete defects in paired quota admission, retry release or hidden-input provisioning. Google rejected the approved key creation with "The request is suspicious"; Jonathan was asked to create the same dedicated Hearth key manually. No key was created by that rejected attempt, and no Google billing change was made.
- Jonathan created the dedicated key and explicitly provided it for Worker storage. Ordinary secret bulk upload was rejected with Cloudflare 10215 because another main preview version was not deployed. The helper now supports `--versioned`; encrypted secrets were stored through stdin in version `6a5c87bd-1f5d-4a8d-a7a9-f1b33ccbcb62`, then that copy of current main was explicitly deployed at 100%. Workspace execution was still disabled during credential setup. No secret was added to a local file, environment file or repository.
- Both pinned Google model metadata endpoints returned HTTP 200 using the provided key. This confirms credential acceptance/model availability, not generation quality. Supabase migration 022 already exists; read-only checks observed Development-only and 24-hour grant constraints. An invalid anonymous lease returns `HERCULES_RUN_GRANT_DENIED`; anonymous grant issuance is permission-denied. No hosted schema was applied in this activation turn.
- Main advanced to `5cc8c12` (Home feedback #461). It was merged into this branch, retaining both decision entries; no executable-code conflicts occurred. Focused post-merge coverage passed 23 tests in five files, including free routing, workspace deployment/provider and the new Home flow. Earlier GitHub test and pages builds passed; the separate preview uploader returned expected 10211 because the new quota Durable Object migration requires full deployment.

## Container activation correction

- PR #462 merged at `429db8e`. Main workflow `34704070563` uploaded and activated Worker `b8872d57-0906-4fec-83bb-2915096376a7`, then failed to build the document container: the default Sandbox image has no Python/pip. Containers API still lists no applications. This is partial activation, not a successful complete deployment.
- Correction branch `codex/hercules-sandbox-python` starts at that verified main. Use matching stable `0.12.9-python`; Docker Hub confirms its amd64 image exists. Keep package versions, authority, credentials and activation flags unchanged.
- Build the exact document image before any Worker upload in PR and main CI. Run the Worker's actual Python export and import programs for DOCX, XLSX, PPTX and PDF with networking disabled, including preservation of formula-like spreadsheet content as text. Local Docker is unavailable; real container evidence must come from the GitHub runner.
