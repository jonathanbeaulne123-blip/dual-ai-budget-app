# Mobile C3 — destructive reveal, named Confirm

Status LOCALLY VERIFIED; branch codex/mobile-c3-danger-reveal. Exact base/pre-implementation HEAD52f93983e7da7a003e53dba7618073409d930d09 (C2, PR393). Sole writer root. Medium-High UI review-lifetime risk; Budget(5)+1; Engagement(3)+1.

Claude's tweak proposes slide-to-confirm; packet15.3 requires motion to remain a reading/draft with separate named Confirm. Retain the slide as disclosure, then the existing named destructive action. Phone danger sheets only; ordinary/desk Confirm remains recognizable. Bottom44pxCancel receives initial focus, scrollable explanation and fixed visible footer, original5pxcard/3pxcontrol tokens. Native horizontal reveal and named Show alternative; release/cancel/source change never invokes a writer.

All seven App danger calls receive an explicit opening token plus current scope/auth/target/source identity. Latch changes until Cancel and reopen, including A→B→A, rather than silently re-arm against stale summary/shift data. Recheck identity at the named button event. Options reset disclosure; busy/viewport changes are not new review openings. This is a UI review-lifetime fence, not certification of every legacy writer after its own async Google/queue awaits. Existing handlers remain.


## Final implementation and review

Seven App danger calls plus Ledger duplicate exclusion carry an explicit opening and current source reader. App captures at the opening event and checks the displayed reversal/shift target before first render; Ledger retains its stronger accepted command basis and opening generation. Rejection notice is separate from reviewed copy, so unchanged-source retries remain possible. Initial busy focus goes to Working. No gesture calls a writer.

The first zoom assertion only checked Cancel and missed clipped explanation. Corrected card max-height to its actual container, added whole-card scrolling fallback and a 96px minimum explanation. Strengthened proof visits heading, text, long named action and Cancel after disclosure at 200% body zoom. Native user zoom permission is still an integration item.

## Evidence

- Four mounted disclosure/cancel/lost-capture/Escape/second-pointer/source-ABA/busy/focus cases plus eight B8 accepted-review cases pass. The busy ABA test first failed and was fixed with a monotonic disclosure generation. Three mounted App cases cover current source, Shared/Personal roundtrip, and stale displayed target before opening; mocked transport, no physical claim.
- Seven all-main-CSS browser cases at320/390/720/1100 and long200%, busy, ordinary states pass; native touch reveal/cancel writes nothing, explanation scroll0→206px, Escape closes. B8 thirteen browser cases pass with separate Show and named Confirm. Driver's early immediate-React-render assertion and ambiguous Show/Confirm locator were corrected; no source defect hidden by those fixes. Evidence `/tmp/hearth-mobile-c3-evidence`, `/tmp/c3-browser4.log`, `/tmp/c3-gesture2.log`, `/tmp/c3-b8-browser3.log`.
- Independent money, UX and verifier reviews found the missing Ledger review, opening gap, zoom fallback and transient retry-copy issues; all repaired. UI lifetime proof does not certify legacy handler continuation after its own async Google/queue waits.

Final Medium-High quick gate: `110.312`seconds; fingerprint`4bd9c78ec6bc64819e1e4095a43dd5ebde6f5c6cabef74726e528e528e809091`; five-minute breach=False. TypeScript/AI/diff and102/102selected tests passed. Exact command is first line of `/tmp/c3-gate3.log` (base52f93983, focuses Confirm, Prise, App startup and month-rehearsal-mainline). Gate1 passed112tests161.429s and gate2 passed113tests148.626s before final rejection-notice refinement; neither breached five minutes.

## Delivery

Fictional local proof only. Implementation HEAD is the commit carrying this file. No merge/deployment/schema/secrets/Production or exhaustive gate. Separate stacked draft PR; next Codex C4 Due inline occurrence review.
