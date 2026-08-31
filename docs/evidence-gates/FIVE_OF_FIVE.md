# Hearth 5/5 feature gate

P0-03 makes `5/5` a derived release claim, never an opinion or a passing-test count. A feature earns one equal point for each of these dimensions:

1. truth;
2. task completion;
3. recovery;
4. responsive and accessibility evidence;
5. Production evidence.

The evaluator exposes the literal label `5/5` only when all five dimensions link to fresh artifacts from the same clean 40-character Git SHA and exact environment identity, all artifacts pass SHA-256 verification, every browser channel was captured, and a human reviewed every evidence item after capture. A missing link, dirty worktree, mismatch, stale artifact, console error, failed/HTTP-error request, timeout, incomplete 320/390/430/720/1100 journey, or absent human acceptance blocks the label.

## Output contract

Copy [`evidence-record.template.json`](evidence-record.template.json) into this ignored path after the feature commit exists:

`artifacts/five-of-five/<America-Toronto-YYYY-MM-DD>/<feature-id>/<40-char-sha>-<environment>.json`

Keep screenshots, test reports, console/network capture, deployment receipts, live-smoke output, redaction report, and human attestation beside the JSON. Every artifact path is relative to the JSON directory and includes its SHA-256. Screenshots are distinct, structurally valid PNG or JPEG files whose parsed pixel dimensions match the recorded DOM content viewport and device-pixel ratio; the requested outer viewport remains one of the five manifest widths, with only bounded scrollbar/browser insets allowed. The structured human attestation binds the named reviewer, time, reviewed artifact ids, SHA/environment, and canonical claim digest; changing the claim after review invalidates it. Real screenshots and logs are local or CI artifacts and are never committed. Use fictional Development data or redacted Production chrome; never retain tokens, authorization headers, email addresses, account identifiers, household/member ids, amounts, transaction descriptions, or partner-personal content.

Run the evaluator from the exact clean checkout:

`pnpm quality:5of5 -- --evidence <path> --environment-kind production --origin <https-origin> --deployment-id <provider-id> --build-id <workflow-id> --privacy-scope <scope-fingerprint>`

The environment identity is deliberately concrete. `production` alone is insufficient; a live origin, provider deployment id, build/workflow id, and privacy-scope fingerprint are mandatory. Household features use `environment+household+member+view:sha256:<64 hex>`; a surface with no household data may use `environment+household+member+view:public-no-household`, and synthetic fixtures use the explicit `synthetic-redacted` sentinel. Local Vite, jsdom, unit tests, previews, and synthetic fixtures cannot satisfy Production evidence.

The structured named-human attestation prevents the claim from changing after review, but P0-03 does not provide cryptographic human identity. Jonathan or the named feature decision owner must create that attestation as a separate acceptance step; an AI-authored name is not acceptance. A future signing service may strengthen identity without changing the five dimensions.

## Browser operator contract

Use [`browser-journeys.json`](browser-journeys.json) as the versioned journey manifest. Run both the task and recovery journey at 320, 390, 430, 720, and 1100 CSS px. Each run records:

- viewport width and height, completed steps, passed assertions, deadline outcome, and screenshot;
- complete console, network, and timeout capture, including explicit capture-complete booleans when the arrays are empty;
- hands-on overflow, keyboard path, visible focus, accessible name/order, 200% zoom/text, and reduced-motion results.

If the current browser tooling cannot capture one of those channels, mark it incomplete. Do not infer success from silence.

## Synthetic harness proof

The unit suite evaluates one all-green feature fixture and one deliberately red feature fixture with a stale SHA, missing 430 px run, console error, network 503, timeout, and missing human acceptance. A green fixture can report `fixturePassed`; it is permanently `claimable: false` and can never emit `5/5`.

No financial authority changes here. CAD integer cents, Toronto civil dates, balanced double entry, reversal/repost history, Final Confirm through `acceptHouseholdWrite`, privacy scope, delayed-work generation, and Development/Production separation remain immutable truth claims. AI, OCR, bank, Google, calendar, weather, and work inputs remain evidence or proposals until the ordinary visible Confirm boundary accepts money.
