# Three worlds — component coverage and proof

This matrix distinguishes source review from rendered evidence. A themed selector or inherited token is not proof that every state renders correctly. `Pending` is an open acceptance requirement, not a removed feature. All rows apply to Classic, all twelve Taylor eras and all twelve Newfoundland scenes where the route is reachable.

| Surface family | Actual source components | Source treatment | Fixture / rendering | Contrast | Interaction |
|---|---|---|---|---|---|
| Entry and recovery | App, HouseholdEntryCard, LedgerPurposeBanner, KitchenErrorBoundary | Direct welcome, shell, purpose and recovery treatments | Local entry rendered; complete variants pending | Pending | Local demo opens through existing non-worker fallback; recovery variants pending |
| QR and pairing | AuthJoinQr, WelcomeQrScanner, Pairing | QR/video wrappers, shared controls, device/recovery tokens | Pending | Pending | Pending; QR content unchanged |
| Charter | CharterFounding, Charter | Direct page, quote, signature and question surfaces; fixed positioning preserved | Pending | Pending | Pending |
| Guided onboarding | OnboardingChat, OnboardingWitness, GuidedSetupPreview | Direct shell/rail/cards plus inherited tokens | Pending | Pending | Pending |
| Onboarding categories and estimates | OnboardingCategories, OnboardingEstimates | Shared cards, choices, fields, notices | Pending | Pending | Pending |
| Opening and readiness | OnboardingPlan, OnboardingReady, OpeningTruthCard | Ready/error/review and shared form treatment | Pending | Pending | Pending |
| Month rehearsal | MonthRehearsalAccess, MonthRehearsalPanel | Explicit surfaces, state pairs, week tabs, approvals and disclosures | Pending | Pending | Mainline command and isolated full-App income regression passed |
| Plan and categories | SitDownGuide, KittyBanks, AddCategoryForm, App | Paper, goals, bank/jar accents and labelled form controls | Both scopes × three themes × five widths | Zero automated A/AA violations at 390px | Editing/validation variants pending |
| Books, accounts and audit | Books, Ledger, Accounts, AddAccountTiles | Tables, wallets, tabs, statement surfaces and shared controls | 42 audit surfaces (seven panes × two scopes × three themes) at 390px; expanded activity/import variants pending | Zero automated A/AA violations on all 42 validated fixture surfaces | Read-only audit navigation verified; edits/Confirm variants pending |
| Household Fund | HouseholdFundPanel, FundDrawer, Register | All stage containers, drawers, custody disclosure and register tokens | Pending | Pending | Pending |
| Fund instruments | Level, NextOutStage, WeekStage, WaitingStage, SettleStage, ShapeStage, StreamsStage, AccountsStage, DeskPlates | Stage figures, controls, axes and status treatment | Pending: filled, empty, unavailable, unread | Pending | Pending |
| Ledger stories | SharedLedgerStory, PersonalLedgerFolio, MonthSpread | Folio/sheets and coherent series/legend/marker tokens; projected hatches retained | Pending | Pending | Pending |
| Financial readings | Ask, ClerkReading, WeeklyDocument | Diagram/readings, amounts, citations and status tokens | Pending | Pending | Pending |
| Till and swipe | Till, Swipe | Entries, sheets, accepted/Undo, offline and empty treatment | Shared Till × three themes × five widths | Zero automated A/AA violations at 390px | Accepted/Undo and swipe variants pending |
| Calendar and appointments | Calendar, RepeatingForm, Appointments, DuePreviewSheet | Grid/day/kind/heat, appointment and review treatment | Both calendar scopes × three themes × five widths; appointment details pending | Zero automated A/AA violations on calendar at 390px | Member/job colours retained; appointment interaction pending |
| Add and settlement | AddSlideshow, CadPad, WorkShiftFlow, WorkShiftWithSevenShifts, WorkSettlementSheet | Keypad, drafts, summary/review and shared control treatment | Pending: expense, income, transfer, payment and shift | Pending | Startup/Confirm guards tested; themed interaction matrix pending |
| Confirm and root guards | Confirm, DuePreviewSheet, App | Scrim, sheet, summary, focus, busy/disabled/destructive controls | Synthetic preview exists; actual variants pending | Pending | Synthetic dialog and root draft preservation tested; full variants pending |
| Imports and camera | BatchImport, FlinksConnectPanel, imports/DocumentCamera, ShiftReportScan | Confidence, duplicate review, reconciliation, frame/stage and controls | Pending | Pending | Camera overlay corrected by source audit; actual preview pending |
| Work and reports | WorkShiftPage, WorkJobs, WorkReport, WorkShiftHistory, ShiftElapsedHint | Shift/report/history, status, destination and evidence surfaces | Pending | Pending | Pending |
| Work/Google integrations | SevenShiftsConnectPanel, SevenShiftsEvidenceCenter, GoogleBridge | Panel, evidence, permission and shared control treatment | Pending | Pending | Pending |
| Desk renderers | Office, OfficePhone, OfficeWide, theme/PaperTheme | Three existing layouts, frames, drawers, paper primitives and retained Classic desk finish | Paper primitives rendered in all scene specimens; three full layouts pending | Specimen checked; full layouts pending | Draft/focus preservation tested; full desk interaction pending |
| Desk furniture | widgets/Instrument, DeskItem, Cabinets, OfficeWindow, WindowBand, SillOverview, AnalogClock, WeatherRibbon | Instruments, window/weather/sill/clock tokens | Pending | Pending | Pending |
| Financial desk tools | CalculatorPad, Blotter, WalletTray, AccountsDesk, ClaimsTray, Mail, Jars, Lamp, CookOffKettle, PresetChip | Instrument surfaces, figures, controls and semantic statuses | Pending | Pending | Pending |
| Planning/work desk tools | Timesheet, CalendarDesk, AppointmentsDesk, Postcard | Instrument and shared calendar/work controls | Pending | Pending | Pending |
| Chalk and notes | widgets/ChalkboardDesk, DailyHearth | Paired slate/ink tokens; repaint preserves stroke state | Pending | Pending | Source audit only; real drawing proof pending |
| Games and wardrobe | widgets/GamesDesk, WardrobeDesk, DailyHearth | Instrument/game/wardrobe surfaces and controls | Pending | Pending | Pending |
| Hercules | Hercules, HerculesFigure, HerculesDress, HerculesFly, HerculesPro | Companion chrome, chat, focus, permissions; preserved fur/rig and optional accessories | Figure/accessories rendered in specimens; chat/focus/permission variants pending | Figure chrome specimen only | Wardrobe precedence source-reviewed; behavioral proof pending |
| Supporting states | SyncFreshnessStatus, SoftPresenceStatus, CommandProgressStatus, commandSurface, KitchenNotice, deferredSurfaces, FabSpeedDial | Direct state, progress, notice, loading and navigation treatment | Pending: offline, stale, pending, error, empty, recovery | Pending | Pending |
| Appearance | ThemeProvider, AppearancePicker, SceneArtwork, Memorabilia, ThemeStudio | Provider, scene map, art, picker, pause and prepared-asset hooks | 36 specimens × five widths, plus 36 actual destination compositions × five widths | All 36 at 390px: zero automated A/AA violations | 25 appearance tests passed, including Use theme focus and explicit wardrobe None |
| Print and visual output | Existing print surfaces, worlds.css print rules | Monochrome foreground/surface tokens, scenery and navigation removed, chart hatches retained | Six synthetic statement PDFs; white paper/dark ink/hidden scenery assertions | Six white-paper/dark-ink/hidden-scenery checks passed; rendered balance-sheet page inspected | Machine-readable export formats unchanged |

## Scene evidence

`scenes.ts` assigns all twelve natural Shared/Personal destinations without adding navigation. `capture-theme-references.mjs` renders the 36 theme/scope/route combinations at 320, 390, 720, 1100 and 1440px. These use actual React paper controls with synthetic facts, not full financial pages. Local evidence is under `.artifacts/three-worlds/` and is intentionally excluded from Git.

Required scene and memorabilia manifests: `docs/theme-assets.json` and `src/theme/memorabilia.ts`. Actual bracelets, dress, concert ticket and selected photo remain missing. Development drawings and empty asset hooks do not satisfy that requirement.

## Boundaries and pending integration

- Provider-owned Google, bank, receipt/video pixels and QR payloads retain their content. Hearth-owned wrappers are themed.
- The separately hosted Hercules Pro/ChatGPT widget now receives allowlisted cosmetic account preferences on summon, resolves its Shared/Personal Home palette, and applies themed controls without recolouring its model or opaque page framing. Hosted ChatGPT rendering remains unverified.
- Incoming mobile PhoneFold, PhoneSpread, FundLedge, FundBoard, FundStage, ApronCard, SplitCut, ShiftCount and recoverable Count are absent from this baseline. CSS preparation is future compatibility only. Rebase/integration and actual markup verification remain required once that work is published.
- The installed-Chrome actual-App tour uses the existing local PGlite fallback in an isolated browser, with synthetic demo data. It is not normal worker-path, Safari, authenticated cross-device or physical-phone proof. The demo routes Shared Books to its readiness gate; that gate is not audit-office evidence. A separate completed-onboarding fixture checks nested Books surfaces.
- Release remains **no-go** until outstanding required assets, integration and proof are complete. No scope row is waived by this inventory.

## Latest measured evidence

- Focused repository quick gate: 88 tests passed (54 fast, 34 serial), with AI-surface and TypeScript checks. Elapsed 584.333 seconds exceeded the five-minute soft budget; TypeScript consumed 402.472 seconds and the serial lane 99.549 seconds.
- Subsequent appearance-only verification: 23 tests passed after contrast and keyboard-focus corrections.
- Installed Chrome destination tour: 36 compositions at 320, 390, 720, 1100 and 1440px (180 screenshots), zero page overflow and JavaScript errors; all 36 automated A/AA scans at 390px passed. The three Shared Books compositions include the readiness gate described above.
- Original reference screenshots, candidate screenshots, comparison reports and print samples remain local under `.artifacts/three-worlds/`. These artifacts contain synthetic fixtures only.

- Live atmosphere specimen checks passed for Classic Home, Showgirl Home and Cape Spear: 1, 2 and 8 active decorative animations respectively, then zero while paused, entering text, offscreen or using reduced motion. Control transitions were excluded because the atmosphere switch intentionally governs scenery.
- Hercules Pro: 20 focused tests passed (OAuth/read/write-boundary regression, asset/CORS contract and three cosmetic account tests). The account's namespace is read on summon, unrelated metadata is never returned, and unavailable/mismatched cosmetic reads safely use Classic. Hosted ChatGPT appearance remains a separate proof requirement.

- Final validated-fixture audit run: all 42 surfaces passed automated A/AA at 390px with zero horizontal overflow or JavaScript errors. Six statement PDFs passed print-token/scenery checks; a rendered balance-sheet page was visually inspected. This is local read-only audit coverage, not reconciliation/close mutation certification.

- Final combined follow-up: 45/45 tests passed in 58.92s (25 appearance, 20 companion). Explicit Wardrobe None suppresses only the corresponding automatic accessory; a separate account field preserves the other slot during initial preference loading.
- Native Safari was attempted through the installed-app control surface, which returned timeoutReached. This provides no Safari visual evidence.
