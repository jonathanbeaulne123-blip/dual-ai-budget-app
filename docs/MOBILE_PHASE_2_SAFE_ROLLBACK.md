# Mobile Phase 2 compatibility rollback

This branch is a dormant Development rollback candidate. It restores the pre-Phase-2 shell and instruments from 6fb15c7a98f3336862bb743b836aa96a358a35b9 while retaining Phase 2 core and ledgerSync authority/privacy fixes. Count, exact frozen confirmation recovery and its App/Shift-room wiring are retained as a safety exception. It is not an exact historical code rewind.

Do not deploy the historical Worker 47e8de95-a516-4a71-869d-f7a81fc1c51f after new mobile use: it lacks reviewed-command resource enforcement and Personal goal partition checks. Do not reset books, rewind hosted snapshots, clear IndexedDB, clear sessionStorage, or drop outboxes. The compatible Worker/client must be deployed together.

Activation: use the configured Cloudflare Workers workflow with ref codex/mobile-phase2-safe-rollback, after confirming its exact tested SHA and no newer compatibility changes on main. This builds with configured public Google/Supabase environment settings and deploys hearth-books with Production continuity disabled. Alternatively deploy the recorded Cloudflare version for this exact branch at 100 percent. Keep the forward release version so it can be restored. Reload clients after activation; old tabs may continue running their loaded UI, with the retained authority validating submitted commands. This is a code rollback only and preserves accepted money history.

The fallback is kept off main and is not activated by the Phase 2 release. Test/build/version evidence is indexed in the external Phase 2 release receipt.
