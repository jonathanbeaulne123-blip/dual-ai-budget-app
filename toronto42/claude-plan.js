/* Claude expansion — September 19, 2026 (14:00–16:30 Toronto).
   Adds independently researched, live-verified prospects (C-series), reorders the weekly board by
   hireability rather than pay/prestige, tailors the pitch per role, and fixes transit facts from the
   September 2026 GO timetable. Loads after discoveries.js, audit-data.js and (where present) prep-data.js.
   Nothing here creates a submission, reply or offer. Saved drafts, visits and outcomes are untouched. */
window.CLAUDE_PLAN = {
  date: '2026-09-19',
  checkedAt: 'September 19, 2026 · 14:00–16:30',
  summary: 'Four parallel searches (downtown core, west GTA, hotels/clubs/events, transit) on September 19 found live openings the earlier plan did not track. Every C-series record below was opened and read on the day; “signal” means the page rendered only partially or conflicted between boards. Distance and awkward transit count against a prospect even when the venue is excellent.',
  rules: [
    'Hireability first: the order favours roles whose live requirements the résumé already meets without inventing anything.',
    'One employer group = one chance. Fairmont, Sheraton, O&B and Liberty each get a primary role plus alternatives, not separate counts.',
    'Transit penalty: bus-only or last-train-risk sites drop a tier regardless of pay.',
    'Walk-ins only where a quiet afternoon public window exists. Hotels, private clubs and banquet venues are online-first.',
    'No probability claims. Portal confirmations, “Immediate Start” badges and interviews are not offers.'
  ]
};

window.CLAUDE_DISCOVERIES = [
  {id:'C01',name:'Fairmont Royal York · MONOGRAM & REIGN',address:'100 Front St W, Toronto',cluster:'Union / Financial District',tier:'A-GAME',
   why:'Full-time luxury-hotel bartender role directly across from Union; the advert asks for exactly what seven years behind the bar and two Bar Lead roles provide. Union pay scale with a raise after six months.',
   transit:'Clarkson → Union 37 min; the hotel is a 2-minute walk (PATH in bad weather). Last westbound train 23:47 Mon–Thu, 00:47 Fri–Sat, 00:17 Sun.',
   hours:'Hotel outlets; not a walk-in recruitment stop. Apply online.',site:'https://www.fairmont.com/royal-york-toronto/',
   job:'SmartRecruiters posting read September 19: Bartender, MONOGRAM & Reign Restaurant (Full-Time), existing vacancy, posted September 11. Mandatory AssessFirst questionnaire follows the application. GPT tracked only Clockwork and Library Bar at this hotel.',
   roles:'Bartender · full-time',pay:'C$20.30/hour + tips; increase after six months (collective agreement)',
   url:'https://jobs.smartrecruiters.com/AccorHotel/744000149082128',status:'active',
   requirements:'Excellent cocktail and mixology knowledge; Smart Serve; prior restaurant/F&B experience; luxury-hotel bartending preferred; cash handling. Unionised (Local 75); two interviews are typical. Complete the AssessFirst step the same day or the candidature is incomplete.',
   extra:[['Banquet Bartender · casual (same AssessFirst covers both)','https://careers.accor.com/global/en/job/banquet-bartender-casual-in-fairmont-royal-york-toronto-canada-jid-71346'],['Bartender, MONOGRAM · part-time','https://jobs.smartrecruiters.com/AccorHotel/744000146467850'],['Banquet Server · part-time','https://jobs.smartrecruiters.com/AccorHotel/744000141268729']]},
  {id:'C02',name:'Sheraton Centre Toronto',address:'123 Queen St W, Toronto',cluster:'Union / Financial District',tier:'A-GAME',
   why:'Highest posted bartender rate downtown, at union scale even for part-time. Three live F&B vacancies share one Marriott application profile.',
   transit:'Union → 12-minute walk up Bay/York, or Line 1 to Osgoode. Well inside last-train margins.',
   hours:'Hotel outlets; apply online. No walk-in hiring.',site:'https://www.marriott.com/en-us/hotels/yyztc-sheraton-centre-toronto-hotel/',
   job:'Three Indeed-syndicated Marriott postings read September 19, each marked existing vacancy: Mixologist (PT, C$21.85–27.31), Club Lounge Attendant (PT, C$23.79–29.74, no experience required), Food & Beverage Server (FT, C$17.60–19.80 + tips).',
   roles:'Mixologist · PT; Club Lounge Attendant · PT; F&B Server · FT',pay:'Mixologist C$21.85–27.31/hour; Club Lounge C$23.79–29.74/hour; Server C$17.60–19.80/hour + tips',
   url:'https://ca.indeed.com/viewjob?jk=7e060f6442ce7da1',status:'active',
   requirements:'Smart Serve; 1+ year bar experience preferred (Mixologist); Food Handler for the server role. Apply through the Marriott portal via Indeed; HR screen then F&B manager interview is typical. Choose Mixologist as primary and list the other two as alternatives in one profile.',
   extra:[['Club Lounge Attendant · PT','https://ca.indeed.com/viewjob?jk=ab6faa5aac7705d7'],['Food & Beverage Server · FT','https://ca.indeed.com/viewjob?jk=4a500debe763258e']]},
  {id:'C03',name:'Oliver & Bonacini Events · Offsite Catering',address:'Events across Toronto (O&B Events, downtown base)',cluster:'Union / Financial District',tier:'A-GAME',
   why:'Premium caterer paying a flat C$25/hour for event bartending, with a C$26–28 Key Supervisor track that uses the Bar Lead, shift-supervisor and 2024 event-coordination history together.',
   transit:'Event sites vary; most are downtown or reachable from Union. Check each shift’s venue and finish time against the last train before accepting.',
   hours:'Event-driven. Online first; one group interview plus a trial shift is typical.',site:'https://www.oliverbonacini.com/events',
   job:'SmartRecruiters postings read September 19, both “current vacancy”: Bartender – Offsite Catering (PT and FT available, C$25) and Key Supervisor – Offsite Catering (FT, C$26–28, one year supervisory experience).',
   roles:'Bartender · offsite catering (PT/FT); Key Supervisor · offsite catering (FT)',pay:'Bartender C$25/hour flat; Key Supervisor C$26–28/hour',
   url:'https://jobs.smartrecruiters.com/OliverBonacini/744000141779049-bartender-offsite-catering',status:'active',
   requirements:'Smart Serve; event or hospitality bartending; food and wine knowledge; lift 30 lb; evenings/weekends/holidays. Key Supervisor asks for one year supervisory experience — Bar Lead (Gametime, Capra’s) plus Boston Pizza shift supervision meet it; do not overstate. O&B notes AI-assisted screening; one SmartRecruiters profile serves La Plume, Maison Selby, Ceci Bar and the Carlu too.',
   extra:[['Key Supervisor · offsite catering','https://jobs.smartrecruiters.com/OliverBonacini/744000141779809-key-supervisor-offsite-catering']]},
  {id:'C04',name:'O&B Corporate Hospitality · CIBC Square',address:'81 Bay St, Toronto',cluster:'Union / Financial District',tier:'A-GAME',
   why:'Full-time daytime serving at C$25/hour attached to Union by the PATH. Stackable with an evening bar job; zero last-mile risk.',
   transit:'Union → CIBC Square via PATH, under 5 minutes. Daytime hours never touch the last train.',
   hours:'Weekday daytime service. Online first.',site:'https://www.oliverbonacini.com/',
   job:'SmartRecruiters posting read September 19: Server, CHS (Corporate Hospitality Solutions) — “currently recruiting 2 servers”. Position 1 Mon–Thu 09:45–14:15; Position 2 three days/week 09:00–16:00.',
   roles:'Server · corporate hospitality (FT, daytime)',pay:'C$25/hour',
   url:'https://jobs.smartrecruiters.com/OliverBonacini/744000148571419-server-chs-corporate-hospitality-solutions-',status:'active',
   requirements:'Two years serving in hospitality/events; Smart Serve; food-safety knowledge; boardroom-level discretion. Daytime schedule pairs naturally with Salon, Liberty Grand or Habitat evenings.',extra:[]},
  {id:'C05',name:'Mizunara',address:'Adelaide St W at Duncan St, Toronto (M5H 3G6)',cluster:'King West / Downtown',tier:'A-GAME',
   why:'A real Head Bartender opening at a 60-seat Japanese-whisky cocktail bar. This is the only live bar-lead title in the set that a two-time Bar Lead can claim outright.',
   transit:'Union → Line 1 to St Andrew, then 5 minutes; or a 10-minute walk. Late nights: last train 23:47 Mon–Thu — confirm actual close before accepting.',
   hours:'Evenings. Apply by email; no walk-in recruitment.',site:'https://www.mizunara.ca/',
   job:'Indeed posting read September 19: Head Bartender, full-time, one position, C$19.60 + tips. Applications by email to orlando@mizunara.ca with availability, hours sought and three references. The advert states no AI is used in hiring. A companion Bartender posting (two vacancies) is also live.',
   roles:'Head Bartender · FT; Bartender alternative',pay:'Head Bartender C$19.60/hour + tips; Bartender C$17.60–18.60 + tips',
   url:'https://ca.indeed.com/viewjob?jk=88e0dbbe08787d23',status:'active',
   requirements:'Smart Serve; spirits and classic-cocktail knowledge; leadership; late nights and weekends; Japanese whisky knowledge preferred (study before applying). Have three references with permission ready — the email application asks for them up front.',
   extra:[['Bartender · two vacancies','https://ca.indeed.com/viewjob?jk=31997c170c839a7d']]},
  {id:'C06',name:'Chotto Matte Toronto',address:'161 Bay St (Brookfield Place), Toronto',cluster:'Union / Financial District',tier:'A-GAME',
   why:'International Nikkei cocktail-led destination three minutes from Union by PATH. Full-time bartender with benefits; the four-year premium-setting requirement is met by the résumé.',
   transit:'Union → Brookfield Place, 3 minutes indoors. Closes 23:00 Mon–Thu, midnight Fri–Sat — check release against 23:47/00:47 last trains.',
   hours:'Mon–Thu 11:30am–11pm; Fri 11:30am–midnight; Sat noon–midnight; Sun 4–10pm. Happy hour Mon–Fri 3–6pm — visit before 3pm.',site:'https://chotto-matte.com/toronto/',
   job:'Indeed posting read September 19: Bartender – PREMIUM UPSCALE, full-time, from C$17.60 + tips, dental/vision/health benefits. Shown 30+ days on Glassdoor but still accepting applications.',
   roles:'Bartender · FT',pay:'From C$17.60/hour + tips; extended health, dental, vision',
   url:'https://ca.indeed.com/viewjob?jk=6d1887afe79a7c55',status:'active',
   requirements:'Four years restaurant/bar experience in a premium upscale setting; Smart Serve; excellent written and spoken English. Apply online first; a quiet early-afternoon introduction is plausible between lunch and happy hour.',extra:[]},
  {id:'C07',name:'The York Club',address:'135 St George St, Toronto',cluster:'Annex / St George',tier:'A-GAME',
   why:'Private members’ club bartender at C$22–26/hour before gratuities; small team, usually one interview with the F&B manager. Lunch-and-dinner mix means earlier finishes than restaurant bars.',
   transit:'Union → Line 1 (University side) to St George, ~15 min, then 5 minutes. Unaffected by this weekend’s St Clair–College closure.',
   hours:'Members only; no walk-in recruitment. Apply online.',site:'https://www.yorkclub.ca/',
   job:'Indeed posting read September 19: Bartender (part-time), C$22–26 based on experience, “mixture of lunches and dinners through the week and weekends based on business levels”.',
   roles:'Bartender · PT',pay:'C$22–26/hour (gratuities not included in the figure)',
   url:'https://ca.indeed.com/viewjob?jk=650f8d986ec98f0e',status:'active',
   requirements:'One year bartending (required); wine, cocktail and spirits knowledge; etiquette and member discretion. Part-time only; pairs with a daytime or event role.',extra:[]},
  {id:'C08',name:'Liberty Grand Entertainment Complex',address:'25 British Columbia Rd, Exhibition Place, Toronto',cluster:'Exhibition / Liberty Village',tier:'STRONG',
   why:'Immediate-start banquet serving five minutes from Exhibition GO — on the Lakeshore West line with no Union transfer. Fastest realistic start in the set; Liberty Group states it does not use AI screening.',
   transit:'Clarkson → Exhibition GO 28 min (some PM-peak expresses skip Exhibition — check the specific train), then a 6-minute walk. Return from Exhibition; last trains as for Union minus ~8 minutes.',
   hours:'Event-driven; online first. Group interviews are typical.',site:'https://www.libertygrand.com/',
   job:'86network posting read September 19: Banquet Server, part-time, C$18–19/hour, minimum three days/week, Immediate Start, posted five days earlier. The group’s SmartRecruiters page shows nothing — 86network is the live channel.',
   roles:'Banquet Server · PT',pay:'C$18–19/hour (tips not stated)',
   url:'https://www.86network.com/jobs/toronto/on/liberty-grand/banquet-server-ijbjaa',status:'active',
   requirements:'Smart Serve; strong English; evenings/weekends/holidays; carry trays. Part-time — treat as immediate income alongside a full-time application, not the whole plan.',extra:[]},
  {id:'C09',name:'Splash Catering at Casa Loma',address:'1 Austin Terrace, Toronto',cluster:'Dupont / St Clair',tier:'STRONG',
   why:'Liberty Group’s Casa Loma caterer posted a banquet-server contract yesterday with Immediate Start; wedding and gala volume runs September–December.',
   transit:'Union → Line 1 (University side) to Dupont, then a 10-minute uphill walk; about 30 minutes from Union. Late gala finishes need the 23:47/00:47 trains checked.',
   hours:'Event-driven; online first.',site:'https://casaloma.ca/',
   job:'86network posting read September 19: Banquet Server, part-time contract, C$19–22/hour, four days/week, Immediate Start, posted one day earlier. Previous banquet experience required.',
   roles:'Banquet Server · PT contract',pay:'C$19–22/hour',
   url:'https://www.86network.com/jobs/toronto/on/splash-catering/banquet-server-vjkk4w',status:'active',
   requirements:'Previous banquet serving (Capra’s private events qualify); Smart Serve; daytime, evening, weekend and holiday flexibility. Seasonal contract — ask the end date.',extra:[]},
  {id:'C10',name:'Sodexo Live! · Cerise Fine Catering (Beanfield Centre)',address:'105 Princes’ Blvd, Exhibition Place, Toronto',cluster:'Exhibition / Liberty Village',tier:'A-GAME',
   why:'Banquet and Bar Supervisor at C$23–28/hour, a ten-minute walk from Exhibition GO. It is the one supervisor role whose requirements match the résumé’s actual supervision: bar leadership, shift supervision and event execution.',
   transit:'Clarkson → Exhibition GO 28 min, then 8–10 minutes on foot. No Union transfer.',
   hours:'Event-driven; online first.',site:'https://www.sodexolive.com/',
   job:'Indeed posting read September 19: Banquet and Bar Supervisor, C$23–28/hour, evenings/weekends as needed. A separate Event Services Supervisor posting at the same site asks for two years supervisory — apply to the Banquet & Bar one.',
   roles:'Banquet & Bar Supervisor',pay:'C$23–28/hour',
   url:'https://ca.indeed.com/viewjob?jk=dd34465e8fb0f333',status:'active',
   requirements:'Prior supervisory experience in banquet/catering/hotel/events; Smart Serve; bar operations a strong asset; union environment an asset; lift 50 lb. Lead with the two Bar Lead roles and the 2024 event coordination; be exact about the six months of shift supervision.',
   extra:[['Event Services Supervisor · same site (2 yrs supervisory)','https://ca.indeed.com/viewjob?jk=2d0f95ef83f9c64d']]},
  {id:'C11',name:'Simona · FAB Restaurants',address:'59 Merchants’ Wharf, Toronto',cluster:'Harbourfront / Bayside',tier:'STRONG',
   why:'Titled Food Service Supervisor but written as a bar lead: direct the beverage team, train bartenders, hold cocktail quality. Sicilian-inspired waterfront room.',
   transit:'Union → 20-minute walk east along Queens Quay, or 6 Bay bus. Return well inside last-train times.',
   hours:'Dinner service; online first.',site:'https://www.simonatoronto.com/',
   job:'86network posting read September 19: Food Service Supervisor, PT/FT, C$19 + tips, three days/week minimum, posted two days earlier. Available from October 5 — an offer can precede it, but not paid work by September 27.',
   roles:'Food Service Supervisor (bar lead) · PT/FT',pay:'C$19/hour + tips',
   url:'https://www.86network.com/jobs/toronto/on/simona/food-service-supervisor-0linrq',status:'active',
   requirements:'3+ years bartending; Smart Serve; supervisory background an asset. October 5 start.',extra:[]},
  {id:'C12',name:'Strella Strella by Modus',address:'145 King St W, Toronto',cluster:'Union / Financial District',tier:'STRONG',
   why:'Pre-opening Server/Bartender hire for the Modus relaunch — upscale Italian with a tableside cocktail cart. Opening-team upside and a wide pay band, five minutes from Union.',
   transit:'Union → 5-minute walk along Front/King.',
   hours:'Not yet open; online only.',site:'https://www.strellastrella.com/',
   job:'Indeed posting read September 19: Server/Bartender, full-time up to 44 hours, C$17.60–29.89. Opening date not stated on the advert — confirm before relying on it for income this month.',
   roles:'Server / Bartender · FT (pre-opening)',pay:'C$17.60–29.89/hour advertised',
   url:'https://ca.indeed.com/viewjob?jk=ae56562cd6a78d86',status:'active',
   requirements:'Restaurant experience preferred; bartending an advantage; Micros POS. Ask the opening date and training-pay arrangements in the first reply.',extra:[]},
  {id:'C13',name:'Ceci Bar · Oliver & Bonacini',address:'33 Yonge St #101, Toronto',cluster:'Union / Financial District',tier:'STRONG',
   why:'Full-time bartender at O&B’s modern-Mexican bar and restaurant three minutes from Union (Google lists it as Mexican, not Italian — the cocktail list leans tequila and mezcal); same SmartRecruiters profile as the other O&B roles.',
   transit:'Union → 3 minutes on foot. Two blocks from Harbour Sixty.',
   hours:'Mon closed; Tue 11:30am–2:30pm; Wed–Thu 11:30am–9pm; Fri–Sat 4–9pm; Sun closed (Google, Sept 19). Online first.',site:'https://www.oliverbonacini.com/',
   job:'SmartRecruiters posting read September 19: Bartender – Ceci Bar, full-time, current vacancy, C$17.60 + tips.',
   roles:'Bartender · FT',pay:'C$17.60/hour + tips',
   url:'https://jobs.smartrecruiters.com/OliverBonacini/744000148647209-bartender-ceci-bar',status:'active',
   requirements:'Two years bartending in a similar environment; wine, beer and classic cocktails; keg handling; evenings/weekends/holidays. One O&B application group with La Plume, Maison Selby, Carlu and Offsite — pick a primary.',extra:[]},
  {id:'C14',name:'MLSE · Hot Stove Club / ScotiaClub',address:'40 Bay St, Scotiabank Arena, Toronto',cluster:'Union / Financial District',tier:'STRONG',
   why:'Supervisor of the arena’s premium restaurants at C$26/hour, attached to Union. Event-driven hours suit a second job.',
   transit:'Union → Scotiabank Arena, attached (under 5 minutes).',
   hours:'Event nights; online first (Workday).',site:'https://www.mlse.com/careers',
   job:'Workday posting read September 19: Supervisor, Premium Restaurants (Hot Stove, ScotiaClub), C$26.00/hour, posted August 19 and still open. Page did not display an explicit open/closed flag — reopen before applying.',
   roles:'Supervisor · premium restaurants (PT, event-driven)',pay:'C$26/hour',
   url:'https://mlse.wd3.myworkdayjobs.com/MLSE/job/Toronto-Ontario/Supervisor--Premium-Restaurants--Hot-Stove--ScotiaClub-_JR0000687-1',status:'signal',
   requirements:'Supervisory experience in high-volume restaurants preferred; food and wine knowledge; POS; evenings/weekends/holidays. MLSE encourages applications without every qualification.',extra:[]},
  {id:'C15',name:'360 Restaurant · CN Tower',address:'290 Bremner Blvd, Toronto',cluster:'Union / Financial District',tier:'STRONG',
   why:'C$23.56/hour service-bar bartender with pension and benefits even part-time, ten minutes from Union.',
   transit:'Union → 10-minute walk via the SkyWalk.',
   hours:'Restaurant service; online only (ADP board).',site:'https://www.cntower.ca/careers',
   job:'Listing read September 19 on Glassdoor (posted about a day earlier); the CN Tower ADP application board is JavaScript-rendered and could not be opened here. Part-time replacement vacancy, one opening.',
   roles:'Bartender · PT (service bar)',pay:'C$23.56/hour (C$22.38 probation) + tips',
   url:'https://www.cntower.ca/careers',status:'signal',
   requirements:'1–3 years fine-dining bartending; Smart Serve; a wine and spirits certification is listed as a requirement — if not held, say so plainly rather than claim it. Unionised.',extra:[]},
  {id:'C16',name:'Shangri-La Toronto · Lobby Lounge',address:'188 University Ave, Toronto',cluster:'Union / Financial District',tier:'STRONG',
   why:'Luxury-hotel restaurant and lounge server posting refreshed September 17. Excellent room; slow multi-round hiring makes it a career application rather than a deadline one.',
   transit:'Union → 12-minute walk or Line 1 to St Andrew.',
   hours:'Hotel outlet; online first.',site:'https://www.shangri-la.com/toronto/shangrila/',
   job:'Hcareers posting read September 19: Service Associate – Server (Restaurant & Lobby Lounge), part-time, posted September 17. Pay not stated. Shangri-La typically runs two or three interviews including a service assessment.',
   roles:'Server · PT',pay:'Not stated',
   url:'https://www.hcareers.com/jobs/4362725-sa-server',status:'active',
   requirements:'Two years similar experience, preferably luxury hotel; Smart Serve; fine-dining service; POS; full English fluency; impeccable grooming.',extra:[]},
  {id:'C17',name:'IRENE Corus Quay · FAB Restaurants',address:'25 Dockside Dr, Toronto',cluster:'Harbourfront / Bayside',tier:'STRONG',
   why:'Full-time waterfront cocktail-bar bartender with Immediate Start, four days/week.',
   transit:'Union → 15-minute walk east on Queens Quay.',
   hours:'Lunch and dinner; online first.',site:'https://www.irenetoronto.com/',
   job:'86network posting read September 19: Bartender, full-time, four days/week, Immediate Start, C$17.60 + tips, posted 23 days earlier. The advert’s “bachelor’s degree” line reads like a form default — ask rather than self-exclude.',
   roles:'Bartender · FT',pay:'C$17.60/hour + tips',
   url:'https://www.86network.com/jobs/toronto/on/irene-corus-quay/bartender-zwc4hw',status:'active',
   requirements:'High-volume bartending; Smart Serve; evenings and weekends required.',extra:[]},
  {id:'C18',name:'The Carlu · Oliver & Bonacini',address:'444 Yonge St, 7th floor, Toronto',cluster:'Yonge corridor',tier:'STRONG',
   why:'Iconic gala venue; part-time event serving with O&B benefits. Low-friction fit for the private-event background.',
   transit:'Union → Line 1 to College, ~15 min. Note: College is inside this weekend’s St Clair–College closure; weekdays are unaffected.',
   hours:'Event-driven; online first.',site:'https://www.thecarlu.com/',
   job:'SmartRecruiters posting read September 19: Server, Events – Carlu, part-time, minimum three weekday/evening shifts per week, C$17.60 + gratuities, posted September 9.',
   roles:'Server · events (PT)',pay:'C$17.60/hour + gratuities',
   url:'https://jobs.smartrecruiters.com/OliverBonacini/744000148576597-server-events-carlu',status:'active',
   requirements:'One year serving; Smart Serve; long periods standing. Alternative within the O&B application group.',extra:[]},
  {id:'C19',name:'Credit Valley Golf & Country Club',address:'2500 Old Carriage Rd, Mississauga',cluster:'Mississauga / bus only',tier:'STRONG',
   why:'Private club bartender posted September 17, peak fall banquet season, 20–32 hours/week. Top-tier venue and an easy requirement match — held back only by a bus-only commute.',
   transit:'No rail option. MiWay 110 University Express from Clarkson GO up Mississauga Rd (~25–30 min) plus a 10–15 minute walk; roughly 45 minutes each way, and evening bus frequency drops after 22:00. Uber home would eat most of the C$30 cap.',
   hours:'Members only; online first. HR contact is published on the club’s employment page.',site:'https://www.creditvalleygolf.com/golf-1-3',
   job:'Indeed and Job Bank postings read September 19: Bartender (part-time), C$17.60 + gratuities, 20–32 hours/week, start “as soon as possible”/TBD, posted September 17.',
   roles:'Bartender · PT',pay:'C$17.60/hour + gratuities',
   url:'https://ca.indeed.com/viewjob?jk=12e6308452f94e91',status:'active',
   requirements:'Smart Serve; minimum two years bartending; lift 20 lb; evenings/weekends/holidays. Transit penalty applied: apply, but do not spend a scout trip here.',
   extra:[['Job Bank listing (posted Sept 17)','https://www.jobbank.gc.ca/jobsearch/jobposting/50310000']]},
  {id:'C20',name:'The Pearle Hotel & Spa · Burlington',address:'3 Elizabeth St, Burlington',cluster:'Burlington waterfront',tier:'STRONG',
   why:'Luxury hotel with three live F&B openings: Event Bartender from C$21, Restaurant Supervisor from C$25 full-time, Event Server from C$20. The best base rates in the west GTA, discounted for a 50–60 minute commute and late event finishes.',
   transit:'Clarkson → Burlington GO 25 min, then 2.3 km (Burlington Transit ~10–15 min, free under One Fare, or a 25–30 minute walk). Weekend event teardowns after midnight collide with the last eastbound train (00:47 Sat, 00:17 Sun) — a real constraint, not a footnote.',
   hours:'Hotel and events; online first.',site:'https://www.pearlehotel.ca/',
   job:'Indeed/SimplyHired postings read September 19: Event Bartender (PT, nights Fri–Sun, from C$21, existing vacancy); Restaurant Supervisor (FT, from C$25, 2+ years upscale, First Aid/WHMIS); Event Server (PT, from C$20).',
   roles:'Event Bartender · PT; Restaurant Supervisor · FT; Event Server · PT',pay:'Event Bartender from C$21/hour; Restaurant Supervisor from C$25/hour; Event Server from C$20/hour',
   url:'https://ca.indeed.com/viewjob?jk=13bbde5e55d21e2a',status:'active',
   requirements:'Smart Serve; one year bartending preferred for events; supervisor asks 2+ years upscale, First Aid/CPR and WHMIS. Apply to Event Bartender and Restaurant Supervisor together; ask about shift-end times before any interview.',
   extra:[['Restaurant Supervisor · FT','https://www.simplyhired.ca/job/UboOJ5m3J-KvefEowghjPvHtS_EjV_rYKT-KZ_U93ldUU6mxlOAT-A'],['Event Server · PT','https://ca.indeed.com/viewjob?jk=d1072f0e31cdfb74']]},
  {id:'C21',name:'bar Su · Kerr Village',address:'343 Kerr St, Oakville',cluster:'Downtown Oakville',tier:'STRONG',
   why:'Vintage-modern Italian restaurant and lounge, house-made pasta and craft cocktails — the closest live match to the Sotto Sotto years, one GO stop from Clarkson.',
   transit:'Clarkson → Oakville GO 7 min, then a 20-minute walk or Oakville Transit (free under One Fare). Mild penalty only.',
   hours:'Dinner-led; hours not verified. Online first.',site:'https://www.barsu.ca/',
   job:'Indeed posting read September 19: Server, part-time, C$17.90–20.00/hour; proven upscale-restaurant experience; Toast POS. Posting date not shown (surfaced in the last-14-days filter).',
   roles:'Server · PT',pay:'C$17.90–20.00/hour',
   url:'https://ca.indeed.com/viewjob?jk=071cd56b2d9d53cc',status:'active',
   requirements:'Upscale restaurant experience; Toast familiarity; some kitchen experience preferred. Small independent — a good place to be upsold to the bar once in.',extra:[]},
  {id:'C22',name:'Edge Hospitality · Paletta Mansion',address:'4250 Lakeshore Rd, Burlington',cluster:'Burlington waterfront',tier:'OPPORTUNISTIC',
   why:'Premium lakefront wedding venue paying from C$22/hour for banquet staff; the estate is a bus-or-walk last mile from Appleby GO and weddings end late.',
   transit:'Clarkson → Appleby GO ~15 min, then 2.5 km (Burlington Transit ~10 min or a 30-minute walk). Late finishes carry the same last-train risk as Pearle.',
   hours:'Event-driven; online first.',site:'https://www.palettamansion.com/',
   job:'Indeed posting read September 19: Banqueting Staff, part-time 20–40 hours/week, from C$22/hour; hotel/banquet experience desirable but optional. Edge also runs the Oakville Conference Centre and Harbour Banquet Centre — rotation not stated.',
   roles:'Banqueting Staff · PT',pay:'From C$22/hour',
   url:'https://ca.indeed.com/viewjob?jk=cd8bc2fcad73d885',status:'active',
   requirements:'Food-service experience preferred; food safety. Transit penalty applied.',extra:[]},
  {id:'C23',name:'The Toronto Golf Club',address:'1305 Dixie Rd, Mississauga',cluster:'Lakeview / Long Branch',tier:'STRONG',
   why:'One of the country’s oldest private clubs states it is hiring for the 2026 fall season including Clubhouse and Food & Beverage. Member dining and banquets finish earlier than restaurant bars. No formal posting — a direct approach.',
   transit:'Clarkson → Long Branch GO ~10 min, then a 20–25 minute walk west on Lakeshore to Dixie; or MiWay 23 Lakeshore straight from Clarkson GO (~35 min, free after a GO tap).',
   hours:'Members only; use the online employment form.',site:'https://www.torontogolfclub.com/about-the-club/forms/employment-opportunities',
   job:'Employment page read September 19: “We are currently hiring for the 2026 Fall season” with Clubhouse and Food & Beverage listed. No titles or pay published; apply through the page’s form (PDF résumé) addressed to the Clubhouse Manager.',
   roles:'Clubhouse / F&B — fall season (titles unpublished)',pay:'Not published',
   url:'https://www.torontogolfclub.com/about-the-club/forms/employment-opportunities',status:'standing',
   requirements:'Day, evening, weekend and holiday flexibility. Send a bar-and-events résumé variant; ask which F&B roles are open this season.',extra:[]},
  {id:'C24',name:'Hilton Toronto · Frenchy Bar et Brasserie',address:'145 Richmond St W, Toronto',cluster:'Union / Financial District',tier:'STRONG',
   why:'Lobby brasserie server at the Hilton, separate from the Ruth’s Chris flex role in the same building. Ten minutes from Union.',
   transit:'Union → 12-minute walk or Line 1 to Osgoode.',
   hours:'Hotel outlet; online first.',site:'https://www.hilton.com/en/hotels/torhihh-hilton-toronto/',
   job:'Indeed posting read September 19: Server (part-time), C$17.80 + tips, weekends/holidays; minimum three years elevated-restaurant serving.',
   roles:'Server · PT',pay:'C$17.80/hour + tips',
   url:'https://ca.indeed.com/viewjob?jk=9a1d2553940608b7',status:'active',
   requirements:'Three years elevated-restaurant service; Smart Serve; POS; wine knowledge an asset.',extra:[]},
  {id:'C25',name:'Westin Harbour Castle',address:'1 Harbour Square, Toronto',cluster:'Union / Financial District',tier:'STRONG',
   why:'Hotel bartender ten minutes from Union. The Marriott page loaded in full, but the posting did not appear in date-sorted boards — possibly evergreen, so apply without counting on speed.',
   transit:'Union → 10-minute walk south via Bay St.',
   hours:'Hotel outlet; online first.',site:'https://www.marriott.com/en-us/hotels/yyzwi-the-westin-harbour-castle-toronto/',
   job:'careers.marriott.com posting read September 19: Bartender, existing vacancy; FT/PT and pay not stated.',
   roles:'Bartender',pay:'Not stated',
   url:'https://careers.marriott.com/bartender/job/9B690A7391E4FAC4F087A97353F9D27B',status:'signal',
   requirements:'One year related experience; drink recipes; wine service; cash handling; lift 50 lb. Unionised.',extra:[]},
  {id:'C26',name:'Compass Group Canada · TD Centre corporate catering',address:'79 Wellington St W, Toronto',cluster:'Union / Financial District',tier:'STRONG',
   why:'Full-time permanent daytime catering server at C$22/hour five minutes from Union — stable base income that leaves evenings free.',
   transit:'Union → 5-minute walk via the PATH.',
   hours:'Weekday daytime; online first.',site:'https://www.compass-canada.com/',
   job:'Indeed posting read September 19: Catering Server, full-time permanent, C$22/hour, existing vacancy. The advert says a driver’s licence “may be required” and that AI tools may be used in screening.',
   roles:'Catering Server · FT (daytime)',pay:'C$22/hour',
   url:'https://ca.indeed.com/viewjob?jk=73162732d861de8c',status:'active',
   requirements:'Food Handler; Smart Serve; one year catering. No car — clarify the licence line at the screen rather than assume.',extra:[]},
  {id:'C27',name:'The Drake Hotel',address:'1150 Queen St W, Toronto',cluster:'Queen West / Ossington',tier:'STRONG',
   why:'Full-time server at a boutique hotel with a strong events and bar programme for internal moves.',
   transit:'Union → 501 Queen streetcar ~30 min, or Exhibition GO then a 25-minute walk / 29 Dufferin bus. Longer last mile late at night.',
   hours:'All-day; online first.',site:'https://www.thedrake.ca/',
   job:'Indeed posting read September 19: Server (full-time), C$17.85 + tips, mornings/evenings/late-night flexibility; 2–3 years high-volume casual fine dining; WSET preferred. A part-time barback posting is also live.',
   roles:'Server · FT',pay:'C$17.85/hour + tips',
   url:'https://ca.indeed.com/viewjob?jk=c0669100f20f9b33',status:'active',
   requirements:'2–3 years high-volume casual fine dining; food, wine and cocktail knowledge; WSET preferred (not held — say so).',extra:[]},
  {id:'C28',name:'Contrada',address:'537 College St, Toronto',cluster:'College / Bloor West',tier:'STRONG',
   why:'Chef-driven Roman-style Italian with a serious bar; part-time bartender with mandatory closing shifts Saturday–Monday.',
   transit:'Union → 510 Spadina streetcar to College, then 10 minutes; closing shifts push against the 00:17 Sunday last train.',
   hours:'Dinner; online first.',site:'https://www.contradato.com/',
   job:'Indeed posting read September 19: Bartender, part-time, from C$17.60; closing shifts Sat/Sun/Mon required; 3+ years full-service bartending.',
   roles:'Bartender · PT (closing)',pay:'From C$17.60/hour + tips',
   url:'https://ca.indeed.com/viewjob?jk=2086e1d5b0bd01cc',status:'active',
   requirements:'3+ years full-service bartending; Smart Serve; classic cocktails, spirits and wine. Sunday closes need a bus-18 backup plan.',extra:[]},
  {id:'C29',name:'Gia',address:'1214 Dundas St W, Toronto',cluster:'Queen West / Ossington',tier:'STRONG',
   why:'Michelin-recommended plant-forward Italian; combined server/bartender role, Immediate Start, and the advert promises no early mornings or late nights.',
   transit:'Union → 501 Queen to Ossington then 10 minutes, or Line 1 + 505 Dundas. Edge of the target geography.',
   hours:'Afternoons and evenings; online first.',site:'https://www.giarestaurant.ca/',
   job:'86network posting read September 19: Server/Bartender, part-time, three days/week, afternoons/evenings, Immediate Start, C$17.60 + tips, posted three days earlier.',
   roles:'Server / Bartender · PT',pay:'C$17.60/hour + tips',
   url:'https://www.86network.com/jobs/downtown-toronto/on/gia-restaurant/server-nifxrq',status:'active',
   requirements:'Smart Serve; fine-dining or casual-fine server and bartender experience.',extra:[]},
  {id:'C30',name:'W Toronto · In-Room Dining and Server',address:'90 Bloor St E, Toronto',cluster:'Yorkville',tier:'OPPORTUNISTIC',
   why:'The bartender posting is closed, but full-time In-Room Dining Server and Server vacancies at the W are live. Room-service serving is below the résumé level, but it is full-time hotel work with bar cross-training possible later.',
   transit:'Union → Line 1 to Bloor-Yonge ~12 min, then 5 minutes. Bloor-Yonge is inside this weekend’s St Clair–College closure (shuttle buses Sept 19–20 only); weekdays are unaffected.',
   hours:'Hotel outlet; online first.',site:'https://www.marriott.com/en-us/hotels/yyzwh-w-toronto/',
   job:'Indeed-syndicated Marriott postings read September 19: In-Room Dining Server (full-time, C$17.80–20.98 + tips) and a part-time twin; Server (full-time, C$17.80–19.60). Bartender remains closed.',
   roles:'In-Room Dining Server · FT; Server · FT',pay:'IRD C$17.80–20.98/hour + tips; Server C$17.80–19.60/hour',
   url:'https://ca.indeed.com/viewjob?jk=73e13bdf272b3ef7',status:'active',
   requirements:'Smart Serve; one year food service preferred; MICROS; lift 25 lb.',
   extra:[['Server · FT','https://ca.indeed.com/viewjob?jk=2a35429f524b2e22'],['In-Room Dining Server · PT','https://ca.indeed.com/viewjob?jk=7fa35a6c665665a1']]},
  {id:'C31',name:'Granite Club',address:'2350 Bayview Ave, Toronto',cluster:'North / Midtown',tier:'OPPORTUNISTIC',
   why:'Top private club with a full-time bartender vacancy and C$24.28/hour casual banquet serving. Commute is about an hour each way from Union with a bus last mile — the transit penalty outweighs the pay for this week.',
   transit:'Union → Line 1 to York Mills, then 11 Bayview bus; ~60 minutes. Line 1 north of St Clair is closed next weekend too.',
   hours:'Members only; online first.',site:'https://www.graniteclub.com/',
   job:'Indeed postings read September 19: Bartender (full-time; Grade 12, two years bartending) and Banquet Server (casual, C$24.28). Both require a criminal background and vulnerable-sector check, adding about a week.',
   roles:'Bartender · FT; Banquet Server · casual',pay:'Banquet Server C$24.28/hour; Bartender not listed',
   url:'https://ca.indeed.com/viewjob?jk=5a201002f3c4decb',status:'active',
   requirements:'Grade 12; two years bartending; Smart Serve; background check. Career application, not a deadline one.',
   extra:[['Banquet Server · casual','https://ca.indeed.com/viewjob?jk=261ecb0135a84ff0']]},
  {id:'C32',name:'Toronto Cricket, Skating & Curling Club',address:'141 Wilson Ave, Toronto',cluster:'North / Midtown',tier:'OPPORTUNISTIC',
   why:'Full-time permanent F&B Supervisor at C$24–29/hour with benefits; the role fits, the 55-minute bus-and-subway commute does not.',
   transit:'Union → Line 1 to Wilson, then bus; ~55 minutes.',
   hours:'Members only; online first.',site:'https://www.torontocricketclub.com/',
   job:'Indeed posting read September 19: Food & Beverage Supervisor, full-time permanent, C$24–29/hour; supervises dining venues, events and staffing.',
   roles:'F&B Supervisor · FT',pay:'C$24–29/hour',
   url:'https://ca.indeed.com/viewjob?jk=c21774d7e2a68c25',status:'active',
   requirements:'Smart Serve; two years hospitality; POS; AGCO knowledge an asset.',extra:[]},
  {id:'C33',name:'Snug Harbour Seafood Bar & Grill',address:'14 Stavebank Rd S, Port Credit',cluster:'Port Credit',tier:'OPPORTUNISTIC',
   why:'Waterfront seafood room eight minutes from Port Credit GO with an evergreen “we’re hiring” page for servers and oyster-bar staff. Best transit in the set; not a dated vacancy.',
   transit:'Clarkson → Port Credit GO 6 min, then an 8-minute walk.',
   hours:'Lunch and dinner daily.',site:'https://snugharbour.above-the-cloud.com/careers.php',
   job:'Careers page read September 19 lists Servers, Oyster Bar Staff, Hosts, Runners and Bussers with no dates, pay or apply link; Indeed shows no open jobs. Walk in with a résumé during the Tuesday Port Credit visit if time allows.',
   roles:'Server / Oyster Bar (unposted)',pay:'Not published',
   url:'https://snugharbour.above-the-cloud.com/careers.php',status:'standing',
   requirements:'Confirm whether any FOH vacancy actually exists before counting it.',extra:[]},
  {id:'C34',name:'Steam Whistle · The Roundhouse events',address:'255 Bremner Blvd, Toronto',cluster:'Union / Financial District',tier:'OPPORTUNISTIC',
   why:'C$23/hour event staff (bartend and serve) ten minutes from Union — but the company’s own applicant board says the position is closed while Indeed still shows Apply.',
   transit:'Union → 10-minute walk.',
   hours:'Event-driven.',site:'https://steamwhistle.ca/',
   job:'Conflicting on September 19: Indeed live, employer ATS (theapplicantmanager.com SW567) closed. Treat as closed unless the events team confirms otherwise by email.',
   roles:'Event Staff · PT',pay:'C$23/hour',
   url:'https://ca.indeed.com/viewjob?jk=a20f002e13f96452',status:'signal',
   requirements:'1–3 years server/bartender; Smart Serve; heavy lifting.',extra:[['Employer ATS shows closed','https://theapplicantmanager.com/jobs?pos=SW567']]}
];

(function(root){
  'use strict';
  const data=root.FLOW_DATA;if(!data)return;
  const statuses={active:'CONFIRMED ACTIVE',standing:'GENERAL HIRING / ACCEPTING APPLICATIONS',signal:'POSSIBLE / UNCONFIRMED',closed:'STALE / HISTORICAL ONLY',scout:'NO CURRENT HIRING FOUND'};
  const labels={active:'Listed opening · Claude check Sept 19',standing:'Accepting interest · vacancy unconfirmed',signal:'Unconfirmed / partially rendered · reopen first',closed:'Checked posting closed · historical only',scout:'Scout · no opening verified'};
  root.RESTAURANT_INTEL=root.RESTAURANT_INTEL||{};
  root.ADDITIONAL_PROSPECTS=root.ADDITIONAL_PROSPECTS||[];
  root.PASSPORT_DISCOVERIES=root.PASSPORT_DISCOVERIES||[];
  const existing=new Set(data.restaurants.map(r=>String(r.id)));
  root.CLAUDE_DISCOVERIES.forEach(r=>{
    if(existing.has(r.id))return;
    r.statusLabel=labels[r.status];r.source='claude';
    const sources=[['Restaurant / employer',r.site],...(r.url?[['Job / careers evidence',r.url]]:[]),...r.extra];
    const actionable=r.status!=='closed'&&r.url;
    const hiring={status:statuses[r.status],roles:r.roles?[r.roles]:[],role:r.roles,applicationUrl:actionable||'',careersUrl:r.status==='standing'?r.url:'',requirements:r.requirements,checkedAt:'2026-09-19',caveat:r.job+' Reopen the exact posting before applying.',sources};
    const flow={id:r.id,name:r.name,address:r.address,website:r.site,approvedFit:true,brief:true,tier:r.tier,cluster:r.cluster,reason:r.why,transit:r.transit,hiring,price:{status:'FIT APPROVED',estimate:'Approved for setting / career fit',basis:'Venue tier reflects workplace and career appeal, not offer probability. Pay is employer-advertised.'},hours:{official:r.hours},access:{best:'Online first. Hotels, clubs and banquet venues do not take walk-in applications; restaurants only in a quiet public window.',likelihood:'UNKNOWN',risk:'SERVICE DEPENDENT',avoid:'Busy dinner service'},scores:{fit:16,career:r.tier==='A-GAME'?18:12,access:1,confidence:r.status==='active'?5:2},windows:[],onSiteMinutes:10,askFor:'Who handles front-of-house hiring',prep:r.why+' '+r.requirements,materials:'Résumé variant matched to the role (bar, service or events), accurate availability, one real example.',failureRisk:'Confirm the shift-end time against the last Lakeshore West train before accepting.',sources:sources.map(([label,url])=>({label,url})),fit:r.why};
    data.restaurants.push(flow);
    root.PASSPORT_DISCOVERIES.push(r);
    root.ADDITIONAL_PROSPECTS.push({n:r.id,r:r.name,a:r.address,p:'Setting / career fit',d:r.why,b:r.cluster,s:r.transit,discovery:true});
    const note='Seven years behind the bar including two Bar Lead roles, upscale Italian service at Sotto Sotto, and private-event coordination and service at Capra’s. '+r.why;
    root.RESTAURANT_INTEL[r.id]={brief:true,discovery:r,name:r.name,status:'CLAUDE CHECK · SEPT 19',lastVerified:'2026-09-19',summary:r.why,mustKnow:[r.job,r.transit,r.requirements],hiringAngle:note,manager:{name:''},walkIn:{askFor:'The person handling front-of-house hiring',opening:'Hi, I’m Jonathan. I’ve led bars for two restaurants and worked upscale Italian service and private events. Is there a good person or time to ask about front-of-house openings?'},sources,application:{general:'',events:'',phone:'',url:actionable||'',urlLabel:r.status==='active'?'View listed role':r.status==='standing'?'Careers / future interest':'Reopen partially verified lead',urlCaveat:r.job,note},nextSteps:{applyUrl:actionable||'',contactEmail:'',contactName:''}};
  });
  data.clusters=[...new Set([...(data.clusters||[]),...root.CLAUDE_DISCOVERIES.map(r=>r.cluster)])];
  data.checkedAt='September 19, 2026 · Claude expansion';

  /* Corrections to records the earlier plan already tracks. */
  const A=root.PASSPORT_AUDIT;
  const updates={
    N16:{url:'https://ca.indeed.com/viewjob?jk=73e13bdf272b3ef7',roles:'In-Room Dining Server · FT (bartender closed)',pay:'IRD C$17.80–20.98/hour + tips; Server C$17.80–19.60/hour',job:'Bartender confirmed closed on the Oracle ATS September 19. In-Room Dining Server (full-time) and Server (full-time) postings were opened the same afternoon and are live. See C30 for the working record.',requirements:'Smart Serve; one year food service preferred; MICROS.',status:'active',extra:[['Server · FT','https://ca.indeed.com/viewjob?jk=2a35429f524b2e22'],['Closed bartender ATS evidence','https://ejwl.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX/job/26112459']]},
    N11:{url:'https://ca.indeed.com/viewjob?jk=59a2edf80d880667',roles:'Bartender / Server (PT/FT) · Event Coordinator alternative',pay:'Server C$17.60/hour; Bartender pay not stated; Coordinator C$75,000–85,000/year',job:'Two new Aidan Hospitality postings at 134 Lakeshore Rd E were opened September 19: Server (PT/FT, C$17.60, “USDA Prime steaks, seafood, bespoke cocktails”) and Bartender (PT/FT, Workopolis). These fit the résumé far better than the salaried On-Site Event Coordinator, which asks for management experience the résumé does not document. Keep the coordinator as a stretch, not the lead.',requirements:'High-volume service; Smart Serve; legal age. For the coordinator: previous management or leadership experience and an events background.',status:'active',extra:[['Bartender · PT/FT (Workopolis)','https://www.workopolis.com/jobsearch/viewjob/2JFvd_A7ZfXLCJK9fKX2RBOoAVjG5iyftVKaGy-vEf-IHNxWnnUmcH_2MMpRNmwg'],['On-Site Event Coordinator · stretch','https://app.higherme.com/jobs/648498fbd2628?domain=careerbeacon.com']]},
    N15:{url:'https://www.86network.com/jobs/toronto/on/the-national-club/banquet-server-y2di-a',roles:'Banquet & Event Server (primary) · Event Coordinator alternative',pay:'Banquet C$20–24/hour, no tips stated; Coordinator C$26–28/hour',job:'Reordered September 19: the Banquet Server advert (9 days old, four days/week, Immediate Start) matches the résumé exactly; the Coordinator advert (17 days old, also titled Catering Coordinator) is an office role — proposals, contracts, billing reconciliation, Outlook/Word/Excel — that a private club will hire slowly and that the résumé supports only partly.',requirements:'Banquet: Smart Serve, Food Handler an asset, four days/week including evenings/weekends/holidays, carry 30 lb. Coordinator: administrative and billing experience that must be described accurately.',status:'active',extra:[['Event Coordinator · alternative','https://www.86network.com/jobs/toronto/on/the-national-club/event-coordinator-gobwtw']]},
    N02:{url:'https://ca.indeed.com/viewjob?jk=c9a0efea8c959705',roles:'FOH Service Manager · reserve',pay:'From C$55,000/year advertised',job:'Reopened September 19. The advert requires financial acumen with cost control and sales analysis, recruitment, onboarding, scheduling and performance management — the exact areas the plan says must not be invented. Apply online as a reserve; do not spend a scout trip on it.',requirements:'1–2 years restaurant management/supervision; Smart Serve; cost control and sales analysis; team training and performance management; Toast an asset.',status:'active'}
  };
  if(A){
    const lbl={active:'Listed opening · Claude check Sept 19',signal:'Unconfirmed · see role-specific correction',closed:'Checked posting closed · historical only'};
    const st={active:'CONFIRMED ACTIVE',signal:'POSSIBLE / UNCONFIRMED',closed:'STALE / HISTORICAL ONLY'};
    for(const [id,u] of Object.entries(updates)){
      const r=data.restaurants.find(x=>String(x.id)===id),d=root.PASSPORT_DISCOVERIES.find(x=>x.id===id),i=root.RESTAURANT_INTEL?.[id];
      if(!r)continue;
      if(d)Object.assign(d,u,{statusLabel:lbl[u.status]});
      Object.assign(r.hiring,{applicationUrl:u.url,careersUrl:'',roles:[u.roles],role:u.roles,requirements:u.requirements,caveat:u.job+' '+u.pay,status:st[u.status],checkedAt:'2026-09-19'});
      const sources=[...(d?.site?[['Restaurant / employer',d.site]]:[]),...(u.url?[['Current role',u.url]]:[]),...(u.extra||[])];
      r.hiring.sources=sources;r.sources=[...sources.map(([label,url])=>({label,url})),...(r.sources||[]).filter(x=>!/(job|careers|application|hiring|role)/i.test(x.label||''))];
      if(i){i.status='CLAUDE RECHECK · SEPT 19';i.lastVerified='2026-09-19';i.application=i.application||{};Object.assign(i.application,{url:u.url,urlLabel:'Current role / application',urlCaveat:u.job+' '+u.pay});i.nextSteps=i.nextSteps||{};i.nextSteps.applyUrl=u.url;if(d)i.sources=sources;i.auditNote=u.job+' '+u.pay+' '+u.requirements;}
    }
    A.updates=Object.assign(A.updates||{},updates);

    /* Interview on record (stated by Jonathan, Sept 19 17:29): Arianna at Harbour Sixty, Tuesday Sept 22, 12:30. */
    A.knownEvents=[{id:'A02',kind:'interview',at:'2026-09-22T12:30',arriveBy:'12:15',where:'Arianna at Harbour Sixty · 60 Harbour St, 4th floor (ask at the Harbour Sixty host stand)',note:'Interview recorded September 19. Bring two printed résumés, Smart Serve on your phone, and the questions below.'}];
    try{
      const KEY='toronto42-prep-visits-v1',SEED='2026-09-22T12:30';
      if(typeof localStorage!=='undefined'){
        const st=JSON.parse(localStorage.getItem(KEY)||'null')||{};st.apps=st.apps||{};st.batch=Array.isArray(st.batch)?st.batch:[];
        const a=st.apps.A02||(st.apps.A02={checks:{}});
        if(a.seededInterview!==SEED){
          a.seededInterview=SEED;
          if(!a.interviewAt&&!['interview','offer','rejected','withdrawn'].includes(a.stage)){a.stage='interview';a.interviewAt=SEED;a.submitted=true;if(!a.submittedDate)a.submittedDate='2026-09-19';a.outcomeNotes=(a.outcomeNotes?a.outcomeNotes+'\n':'')+'Interview: Tuesday September 22, 12:30 at Arianna, Harbour Sixty (recorded Sept 19).';}
          if(!st.batch.includes('A02'))st.batch.unshift('A02');
          localStorage.setItem(KEY,JSON.stringify(st));
        }
      }
    }catch(_){}

    /* Reordered board: hireability, not pay or prestige. */
    A.rows=[
      {id:'A02',wave:'Interview · Tue 22',name:'Arianna at Harbour Sixty',role:'Interview 12:30 · Server / Bartender / FOH',why:'A real interview at an A-game room: contemporary Italian on the 4th floor of Harbour Sixty, dinner-only 5pm–midnight, advertised start September 28. Prepare it like the offer depends on it — it does.',gate:'Arrive 12:15 at 60 Harbour St. Ask their decision date and the actual clock-out time; last train home is 23:47 Mon–Thu, 00:47 Fri–Sat, 00:17 Sun. A trial shift or “we’ll be in touch” is not an offer.',group:'Harbour Sixty',urgency:'immediate'},
      {id:'N12',wave:'First wave',name:'Mercatto Centrale',role:'Bartender (FT) · Server alternative',why:'Existing full-time vacancy, seven minutes from Clarkson, and the advert now says “experience isn’t everything… strong training program”. The likeliest offer by September 27.',gate:'Push Operations form may bounce to a login page on first load — reload the public URL, never log in. Pick bartender as primary.',group:'Mercatto / Alter Ego',urgency:'live'},
      {id:'C01',wave:'First wave',name:'Fairmont Royal York · MONOGRAM & REIGN',role:'Bartender · FT',why:'Full-time luxury-hotel bar across from Union, posted September 11, union pay with a raise at six months. The advert asks for exactly the cocktail background on the résumé.',gate:'Complete the AssessFirst questionnaire the same day; one assessment also covers the casual Banquet Bartender alternative.',group:'Fairmont / Accor',urgency:'immediate'},
      {id:'C03',wave:'First wave',name:'O&B Events · Offsite Catering',role:'Bartender (C$25) · Key Supervisor alternative',why:'Flat C$25/hour event bartending plus a C$26–28 supervisor track that uses Bar Lead, shift supervision and event coordination together. One SmartRecruiters profile also serves La Plume, Ceci Bar and the Carlu.',gate:'Choose Bartender as primary and mention Key Supervisor interest; describe the six months of shift supervision exactly.',group:'Oliver & Bonacini',urgency:'live'},
      {id:'41',wave:'First wave',name:'Buca Yorkville',role:'Server',why:'Posted three days ago, Immediate Start, no years requirement stated; Sotto Sotto experience maps directly.',gate:'Three days/week minimum. Confirm actual release time despite the No Late Nights badge.',group:'Buca / King Street Co',urgency:'immediate'},
      {id:'N57',wave:'First wave',name:'Salon Private Dining',role:'Seasonal Event Bartender',why:'Bar plus events overlap, Immediate Start, Alo Food Group standards.',gate:'Seasonal Fall–Winter; worksite is 162 Cumberland. Three days/week.',group:'Alo Food Group',urgency:'immediate'},
      {id:'C02',wave:'First wave',name:'Sheraton Centre Toronto',role:'Mixologist (PT) · Club Lounge / F&B Server alternatives',why:'Highest posted bartender rate downtown at union scale; three vacancies through one Marriott profile.',gate:'Marriott portal via Indeed; HR screen then manager interview. List all three roles once.',group:'Marriott · Sheraton Centre',urgency:'live'},
      {id:'C08',wave:'First wave',name:'Liberty Grand',role:'Banquet Server · PT',why:'Immediate Start, posted five days ago, five minutes from Exhibition GO on your own line. Fastest realistic paid start.',gate:'Part-time C$18–19; treat as immediate income beside a full-time application.',group:'Liberty Entertainment Group',urgency:'immediate'},
      {id:'N15',wave:'First wave',name:'The National Club',role:'Banquet & Event Server (primary) · Event Coordinator alternative',why:'Banquet advert is nine days old, four days/week, Immediate Start and an exact résumé match; the coordinator is an office role the club will hire slowly.',gate:'Apply to Banquet Server first; add the coordinator only if you can evidence billing and Office work honestly. No tips stated.',group:'The National Club',urgency:'immediate'},
      {id:'C05',wave:'Second wave',name:'Mizunara',role:'Head Bartender · FT',why:'The only live bar-lead title a two-time Bar Lead can claim outright; no AI screening; one position.',gate:'Email application with availability and three references — line up references with permission before sending.',group:'Mizunara',urgency:'live'},
      {id:'C17',wave:'Second wave',name:'IRENE Corus Quay',role:'Bartender · FT',why:'Tuesday cluster: a 12-minute walk east of Harbour Sixty along the water. Full-time bar, four days/week, Immediate Start — apply before Tuesday so a quick hello after the interview lands on an application already in.',gate:'23-day-old advert; the degree line looks like a form default — ask.',group:'FAB Restaurants',urgency:'live'},
      {id:'C13',wave:'Second wave',name:'Ceci Bar · O&B',role:'Bartender · FT',why:'Tuesday cluster: two blocks north of Harbour Sixty, open Tuesday lunch 11:30–2:30. Full-time O&B bar (modern Mexican per Google).',gate:'O&B group alternative; two years bartending.',group:'Oliver & Bonacini',urgency:'live'},
      {id:'C25',wave:'Second wave',name:'Westin Harbour Castle',role:'Bartender',why:'Tuesday cluster: the hotel is next door to Harbour Sixty (1 Harbour Square). Apply online before Tuesday; no walk-in.',gate:'Marriott page loaded in full but the posting may be evergreen; unionised; one year related experience.',group:'Marriott · Westin',urgency:'live'},
      {id:'C14',wave:'Second wave',name:'MLSE · Hot Stove Club',role:'Supervisor · premium restaurants',why:'Tuesday cluster: Scotiabank Arena is across the street from Harbour Sixty. C$26/hour supervisor, attached to Union.',gate:'Workday page did not confirm open/closed — reopen first.',group:'MLSE',urgency:'live'},
      {id:'C15',wave:'Second wave',name:'360 Restaurant · CN Tower',role:'Bartender · PT service bar',why:'Tuesday cluster: the CN Tower is a 10-minute walk west of Harbour Sixty. C$23.56 with pension even part-time.',gate:'Wine/spirits certification listed as required; application board not verified here.',group:'CN Tower',urgency:'live'},
      {id:'C04',wave:'Second wave',name:'O&B Corporate Hospitality · CIBC Square',role:'Server · FT daytime',why:'C$25/hour full-time daytime serving attached to Union; stacks with any evening bar role.',gate:'Two years serving required; pick Position 1 (Mon–Thu) or 2 (three days) in the application.',group:'Oliver & Bonacini',urgency:'live'},
      {id:'23',wave:'Second wave',name:'Henry’s',role:'Bartender · PT',why:'Asks for two years running a full bar single-handed with wine knowledge — a direct fit that needs nothing invented.',gate:'Part-time; confirm weekly hours and shift end.',group:'Henry’s',urgency:'live'},
      {id:'N30',wave:'Second wave',name:'La Plume',role:'Server · FT',why:'Full-time vacancy asking two years serving and Smart Serve — met without stretching.',gate:'Same O&B group as C03/C04/C13: one profile, alternatives not independent chances.',group:'Oliver & Bonacini',urgency:'live'},
      {id:'C06',wave:'Second wave',name:'Chotto Matte Toronto',role:'Bartender · FT',why:'Cocktail-led destination in Brookfield Place, three minutes from Union, benefits included; four-year premium requirement is met.',gate:'Advert is 30+ days old — apply, then a quiet 2pm introduction on the Monday core walk.',group:'Chotto Matte',urgency:'live'},
      {id:'C10',wave:'Second wave',name:'Sodexo Live! · Beanfield Centre',role:'Banquet & Bar Supervisor',why:'C$23–28 supervisor role at Exhibition Place whose requirements match real supervision on the résumé.',gate:'Lead with Bar Lead and 2024 event coordination; state shift supervision as six months.',group:'Sodexo Live!',urgency:'live'},
      {id:'C07',wave:'Second wave',name:'The York Club',role:'Bartender · PT',why:'C$22–26 before gratuities at a private club with earlier finishes; one interview is typical.',gate:'Part-time; pairs with C04 daytime or Liberty Grand.',group:'The York Club',urgency:'live'},
      {id:'C09',wave:'Second wave',name:'Splash Catering at Casa Loma',role:'Banquet Server · PT contract',why:'Posted yesterday, Immediate Start, C$19–22, four days/week.',gate:'Seasonal contract; ask the end date. Line 1 to Dupont plus an uphill walk.',group:'Liberty Entertainment Group',urgency:'immediate'},
      {id:'C11',wave:'Next wave',name:'Simona',role:'Food Service Supervisor (bar lead)',why:'Tuesday cluster: Bayside, a 15-minute walk east of Harbour Sixty. Direct bar-lead match; October 5 start.',gate:'Start October 5.',group:'FAB Restaurants',urgency:'later'},
      {id:'N01',wave:'Next wave',name:'Habitat Social',role:'Bartender · PT',why:'Replacement advert live at C$19 + tips, Immediate Start, seven minutes from Port Credit GO.',gate:'Two evening days/week — supplemental unless expanded.',group:'Habitat Social',urgency:'immediate'},
      {id:'N10',wave:'Next wave',name:'Ruth’s Chris Downtown',role:'Bartender / Team Leader (Flex)',why:'Bar-lead fit is real, but income is minimum wage plus tips with only 4–8 lead hours a week.',gate:'Treat as a part-time bar job beside Henry’s, not above it.',group:'Ruth’s Chris',urgency:'live'},
      {id:'N31',wave:'Next wave',name:'Maison Selby',role:'Bartender · PT key position',why:'Asks only 6–12 months bartending; three shifts with doubles.',gate:'O&B group — alternative to the other O&B roles.',group:'Oliver & Bonacini',urgency:'live'},
      {id:'N11',wave:'Next wave',name:'Ce Soir · Aidan Hospitality',role:'Bartender / Server (PT/FT) · Coordinator stretch',why:'New Bartender and Server postings at the Oakville address fit the résumé; the C$75–85k coordinator remains a stretch.',gate:'Apply to bartender/server first; mention coordinator interest in one line. Oakville GO plus a 30-minute walk or free local bus.',group:'Aidan Hospitality',urgency:'live'},
      {id:'C21',wave:'Next wave',name:'bar Su · Kerr Village',role:'Server · PT',why:'Closest live match to the Sotto Sotto years, one GO stop away.',gate:'Part-time; hours unverified; small independent.',group:'bar Su',urgency:'live'},
      {id:'N41',wave:'Next wave',name:'Bar Filo',role:'Server (or Bartender if the diploma line is met)',why:'Immediate Start, three days/week; server route is the clean one.',gate:'Bartender advert requires a College Diploma and 5–7 years — confirm before choosing it.',group:'Bar Filo',urgency:'live'},
      {id:'C12',wave:'Reserve',name:'Strella Strella by Modus',role:'Server / Bartender · FT (pre-opening)',why:'Opening-team upside five minutes from Union with a wide pay band.',gate:'Opening date not stated — not guaranteed income this month.',group:'Modus',urgency:'live'},
      {id:'C19',wave:'Reserve',name:'Credit Valley Golf & Country Club',role:'Bartender · PT',why:'Private club, posted September 17, easy requirement match.',gate:'Bus-only commute (~45 min) with thin evening service — apply, no scout trip.',group:'Credit Valley',urgency:'live'},
      {id:'C20',wave:'Reserve',name:'The Pearle Hotel & Spa',role:'Event Bartender (C$21) · Restaurant Supervisor (C$25 FT)',why:'Best west-GTA base rates; luxury hotel.',gate:'Burlington GO plus 2.3 km; weekend event teardowns collide with the last eastbound train.',group:'Pearle Hospitality',urgency:'live'},
      {id:'C18',wave:'Reserve',name:'The Carlu · O&B',role:'Server · events PT',why:'Gala venue, low friction.',gate:'O&B group alternative.',group:'Oliver & Bonacini',urgency:'live'},
      {id:'C16',wave:'Reserve',name:'Shangri-La Toronto',role:'Server · PT',why:'Luxury lounge posting refreshed September 17.',gate:'Two to three interviews — a career application, not a deadline one.',group:'Shangri-La',urgency:'live'},
      {id:'N02',wave:'Reserve',name:'Tabule Oakville',role:'FOH Service Manager',why:'Salaried step up.',gate:'Requires cost control, scheduling and performance management the résumé does not document — apply honestly, no scout trip.',group:'Tabule',urgency:'live'},
      {id:'N03',wave:'Reserve',name:'Cactus Club First Canadian Place',role:'Bartender · PT',why:'Existing vacancy, 23 days old.',gate:'Afternoon happy hour makes walk-ins awkward.',group:'Cactus Club',urgency:'live'},
      {id:'C24',wave:'Reserve',name:'Hilton Toronto · Frenchy',role:'Server · PT',why:'Lobby brasserie, ten minutes from Union.',gate:'Three years elevated-restaurant serving required.',group:'Hilton Toronto',urgency:'live'},
      {id:'C26',wave:'Reserve',name:'Compass Group · TD Centre',role:'Catering Server · FT daytime',why:'C$22 full-time daytime at Union.',gate:'Clarify the possible driver’s-licence line.',group:'Compass Group',urgency:'live'},
      {id:'C23',wave:'Reserve',name:'The Toronto Golf Club',role:'F&B · fall season (direct approach)',why:'Top private club hiring for fall; MiWay 23 from Clarkson.',gate:'No formal posting — send the events/bar résumé via the form and ask which roles are open.',group:'Toronto Golf Club',urgency:'live'},
      {id:'N21',wave:'Later',name:'Library Bar',role:'Server · PT',why:'Luxury-hotel service opening.',gate:'Hotel HR, union, mandatory AssessFirst — least likely to close by September 27.',group:'Fairmont / Accor',urgency:'live'},
      {id:'N58',wave:'Later',name:'Michael’s Back Door',role:'Bartender · one day/week',why:'Walkable from Clarkson.',gate:'October 1 start, one day/week.',group:'Michael’s Back Door',urgency:'later'},
      {id:'C30',wave:'Later',name:'W Toronto · In-Room Dining',role:'IRD Server · FT',why:'Full-time hotel work; bar closed.',gate:'Below résumé level; cross-training only after hire.',group:'Marriott · W',urgency:'live'},
      {id:'C31',wave:'Later',name:'Granite Club',role:'Bartender · FT; Banquet Server casual',why:'Top club, C$24.28 banquet rate.',gate:'~60-minute commute with a bus last mile; background check adds a week.',group:'Granite Club',urgency:'live'}
    ];
    A.firstWaveCount=9;
    A.weekPlan=[
      ['Sat 19 · tonight','Eight applications, three résumé variants','Bar variant → Mercatto, Fairmont MONOGRAM, Sheraton Mixologist. Events variant → O&B Offsite, Liberty Grand, National Club banquet, Salon. Service variant → Buca Yorkville. Fairmont’s AssessFirst is done the same evening. Line up two references with permission — Mizunara’s email asks for three.'],
      ['Sun 20','Second wave, one profile per group','Mizunara by email, CIBC Square, Henry’s, La Plume, Chotto Matte, Sodexo Live, York Club, Splash. O&B roles share one SmartRecruiters profile: primary Offsite Bartender, alternatives noted. Target 16–18 complete applications across 12 employer groups by Sunday night.'],
      ['Mon 21 · Union core walk','Applications first, one quiet loop','Clarkson 13:08 → Union 13:45. Chotto Matte 14:00 (before 3pm happy hour), Bar Filo 14:30, then west to La Plume by 15:30 on the 504 or a 25-minute walk. Fairmont, National Club and Sheraton are online-only — do not walk in. Check inbox and voicemail at 12:00 and 17:00.'],
      ['Tue 22 · INTERVIEW 12:30','Arianna at Harbour Sixty','Clarkson 10:38 → Union 11:15; host stand at 60 Harbour by 12:15. Two printed résumés, references with permission, three one-minute stories, questions on shifts, tips, training, decision date and clock-out. Afterwards: IRENE and Simona on the waterfront (both applied to Sunday), then a thank-you email that evening.'],
      ['Wed 23 · Port Credit','Noon checkpoint, then the closest cluster','Habitat 14:00 (open Wed 11–3), Mercatto by 14:45 (MiWay 23 from Clarkson GO stops at Brightwater — free after a GO tap). Noon checkpoint first: beyond Arianna, no interviews → review résumé clarity, missing portal steps and role choice; activate Reserve.'],
      ['Thu 24 · Oakville (optional)','Only if Aidan replies or time allows','Ce Soir’s new bartender/server roles first (12:30), then bar Su in Kerr Village over its Thursday lunch (20 minutes west of Oakville GO). Tabule is online-only now.'],
      ['Thu 24 · Fri 25','Interviews over scouting','One follow-up per employer after 2–3 business days unless told otherwise. Ask every employer for their decision date and the actual clock-out time; check it against 23:47 (Mon–Thu) / 00:47 (Fri–Sat) / 00:17 (Sun) last trains.'],
      ['Sat 26 · Sun 27','Written offers only','Compare pay, guaranteed hours, start date and commute. A trial shift, a portal confirmation or an “Immediate Start” badge is not an offer. If nothing suitable is in writing, reset next week from real feedback.']
    ];
    A.claudeNote='Interview on record: Arianna at Harbour Sixty, Tuesday September 22 at 12:30 — Tuesday is built around it and the waterfront roles near 60 Harbour moved up. Board reordered by Claude on September 19 after live rechecks of 48 postings. First wave = eight applications tonight across eight employer groups. Salaried management roles (Ce Soir coordinator, Tabule) moved to stretch/reserve because their live requirements exceed what the résumé documents.';
  }

  /* Transit facts — September 2026 Lakeshore West timetable, One Fare, MiWay. */
  root.PASSPORT_TRAVEL=Object.assign(root.PASSPORT_TRAVEL||{},{
    title:'From Clarkson GO · verified September 19',
    summary:'Lakeshore West: Clarkson → Union 37 min off-peak (26–30 min AM express), every 30 min all day and evening, weekends too. Port Credit 6 min, Oakville 7 min, Exhibition 28 min, Burlington 25 min. Adult PRESTO one-way roughly C$7.45 Clarkson–Union and C$3.70 to Port Credit or Oakville (third-party fare table — confirm in the GO trip planner). GO→TTC, MiWay, Oakville Transit and Burlington Transit transfers are free under One Fare when the same PRESTO card or bank card taps the whole trip.',
    closure:'Sept 19–20 only: Line 1 closed St Clair↔College (Yonge side); Union–King–Queen–Dundas and the University side to St George/Dupont are open. Sept 21–24: Line 1 St Clair–College closes nightly at 23:59. Sept 26–27: another Line 1 closure north of St Clair West is expected — does not touch downtown. No Lakeshore West disruption found for either weekend.',
    returnNote:'Last train Union → Clarkson: 23:47 Mon–Thu (arr 00:23), 00:47 Fri and Sat (arr 01:23), 00:17 Sun (arr 00:54). After that only GO bus 18 (00:20 / 01:10 / 02:30 Mon–Thu; 01:20 / 02:30 Fri; 01:20 / 02:20 Sat; 01:05 / 02:30 Sun) — check each departure stops at Clarkson. First weekend train from Clarkson is 08:08; weekday 05:24. MiWay 23 Lakeshore runs from Clarkson GO to Port Credit and Long Branch until about 23:49; route 13 runs past 01:00. Late Uber Clarkson↔Port Credit is roughly C$14–30 — an estimate, not a quote.',
    sources:[['Lakeshore West timetable PDF · effective Sept 5/8 2026','https://assets.metrolinx.com/image/upload/v1787946222/Documents/GO/full-schedules/FS05092025/Table01.pdf'],['GO full schedules','https://www.gotransit.com/en/trip-planning/seeschedules/full-schedules'],['One Fare · GO and local transit partners','https://www.gotransit.com/en/your-commute-to-go/go-transit-local-transit-partners'],['GO fare information','https://www.gotransit.com/en/ways-to-pay/fare-information'],['MiWay fares · free with GO under One Fare','https://www.mississauga.ca/miway-transit/fares/fare-prices/'],['TTC Line 1 closure Sept 19–20','https://www.ttc.ca/service-advisories/subway-service/Line-1-St-Clair-to-College-Full-weekend-closure-Sept-19-and-20-2026'],['TTC service advisories','https://www.ttc.ca/service-advisories']]
  });

  /* Tailored approaches and visit routes (Prep & Visits page only). */
  const P=root.PASSPORT_PREP;
  if(P){
    P.defaults=['N12','C01','C03','41','N57','C02','C08','N15'];
    P.checked='2026-09-19 · Claude expansion';
    Object.assign(P.angles,{
      A02:{label:'Interview · Tuesday 12:30',role:'Server / Bartender / FOH at Arianna',pitch:'Arianna is Harbour Sixty’s contemporary Italian room — “avant-garde Italian, meticulously prepared” — on the 4th floor at 60 Harbour, dinner 5pm–midnight, private dining for up to 150, valet, a full craft-cocktail bar. Lead with Sotto Sotto (upscale Italian service and bar), then the two Bar Lead roles, then private events at Capra’s. They advertise 3+ years upscale dining preferred, evenings, three days a week minimum, start September 28. Say plainly you can start earlier and work any evening.',proof:'Three stories, one minute each: (1) a full Italian service at Sotto Sotto — pacing courses, a wine pairing you suggested, a recovery; (2) a night you led the bar — specs, tickets, a colleague you steadied; (3) an event at Capra’s that changed on the day and how you closed it out cleanly.',study:'Menu: crab cappellacci, house meatballs, Arianna lasagna for two, PEI flat iron, bone-in ribeye, pistachio gelato. Executive Chef Scott Mackenzie. Harbour Sixty itself: steakhouse institution in the old Harbour Commission building, lunch weekdays from 11:30, events downstairs. Late-night energy is part of the pitch — say you like a room that fills late.',question:'It’s 10:45pm, the room is full, a table of eight wants the lasagna for two twice and the kitchen is 25 minutes behind. What do you do in the next five minutes?',portal:'Interview logistics: Clarkson 10:38 → Union 11:15; walk 6 minutes south on Bay to 60 Harbour; be at the host stand by 12:15. Bring two printed résumés and references with permission. Ask: which role and shifts they are actually filling, training and start date, how tips are pooled, and when they decide. Afterwards, a short thank-you email the same evening (draft in the Cover letter box).'},
      N12:{label:'First wave · likeliest offer',role:'Bartender (FT)',pitch:'Lead with seven years of restaurant bartending, Italian-dining familiarity from Sotto Sotto and two Bar Lead roles. The advert says experience isn’t everything and they train — so show attitude and consistency, not just years. Mention Clarkson: you can cover any shift without a car problem.',proof:'One busy Port Credit-style service: ticket priorities, drink consistency, a clean station and how you kept servers moving. Real numbers only if you have them.',study:'Mercatto Centrale’s current menu and drinks, the Brightwater room, Silverware POS (say you learn POS fast if you have not used it), Alter Ego Group’s other rooms.',question:'How would you balance a full bar with service tickets while keeping drinks and guest care consistent?',portal:'Use the exact Port Credit bartender form. If the page shows a Push Operations login, reload the public link — do not log in. Server form is the alternative.'},
      C01:{label:'First wave · luxury bar',role:'Bartender · FT (MONOGRAM & REIGN)',pitch:'This advert wants cocktail and mixology depth first. Open with the two Bar Lead roles (spec-writing, training, batching if you did it), then upscale service at Sotto Sotto, then private events. Say plainly that you have not worked a luxury hotel bar and why you want this one.',proof:'A cocktail-programme example you actually ran: how you built or maintained specs, trained a colleague, or handled a high-volume service without quality slipping.',study:'MONOGRAM (lobby bar) and REIGN (restaurant) concepts, the Royal York’s recent renovation, Fairmont service language, Local 75 basics.',question:'A guest asks for a classic you know but the house spec differs — what do you do, and how do you keep the bar moving while you do it?',portal:'Apply on SmartRecruiters, then complete the AssessFirst questionnaire the same evening — the candidature is incomplete without it. The same assessment covers the casual Banquet Bartender alternative.'},
      C03:{label:'First wave · events at C$25',role:'Bartender · Offsite Catering (Key Supervisor interest)',pitch:'Events are where the résumé is strongest: Capra’s event coordination and private-event serving plus bar leadership. Say you want Offsite Bartender and are interested in the Key Supervisor track, and state your supervision honestly — Bar Lead at two restaurants, six months shift supervisor.',proof:'An event where guests arrived together: how you prepped, batched, staged the bar and recovered a problem. Include set-up and tear-down responsibilities.',study:'O&B Events venues (Arcadian Court, Malaparte, the Carlu, Luma), typical corporate and gala formats, O&B’s 50% dining perk, AI-assisted screening (write plainly, no keyword stuffing).',question:'You arrive at an offsite venue and the bar setup is short two bottles of the featured cocktail’s base spirit. What do you do in the next ten minutes?',portal:'SmartRecruiters: apply to Bartender – Offsite Catering; note Key Supervisor in the cover note. One profile also serves La Plume, Ceci Bar, CIBC Square and the Carlu — pick a primary and do not spam.'},
      '41':{label:'First wave · upscale Italian',role:'Server',pitch:'Foreground Sotto Sotto upscale Italian service, wine and spirits knowledge, and current event/table service at Capra’s. Yorkville location only.',proof:'Guiding a table through an unfamiliar menu, pacing courses, one wine recommendation and one recovery — all from real services.',study:'Buca Yorkville’s coastal Italian menu, its wine list, King Street Company standards.',question:'How do you guide a table through an unfamiliar Italian menu and coordinate the pace of the meal?',portal:'Use the exact Buca Yorkville server vacancy on 86network. Immediate Start is an advert signal, not a decision date.'},
      N57:{label:'First wave · bar + events',role:'Seasonal Event Bartender',pitch:'Connect the two Bar Lead roles with private-event service and say you want to learn Alo Food Group standards at Salon. Confirm the worksite is 162 Cumberland.',proof:'Preparation, batching or station organisation, timing and service recovery at a real event.',study:'Salon’s private-event format, current event menus, refined beverage service, the Alo group.',question:'How would you prepare and run the bar for an event when most guests arrive together?',portal:'86network intake; the header says Alo but the role is Salon seasonal event bartending. Ask season length, shifts and release time.'},
      C02:{label:'First wave · union hotel bar',role:'Mixologist (PT) · Club Lounge / F&B Server alternatives',pitch:'Lead with cocktail range and speed from the bar-lead years; the hotel wants a mixologist who can hold a busy lobby bar. Apply once and name all three roles in order of preference: Mixologist, Club Lounge Attendant, F&B Server.',proof:'A high-volume bar service with a mixed cocktail list — how you sequenced, batched and kept quality.',study:'Sheraton Centre outlets (lobby bar, Club Lounge on the upper floors), Marriott service basics, Local 75.',question:'Describe how you set up a bar for a 300-cover conference reception versus a quiet lobby evening.',portal:'Indeed → Marriott careers portal (account required). Expect an HR screen and an F&B manager interview.'},
      C08:{label:'First wave · fastest start',role:'Banquet Server · PT',pitch:'Short and practical: Smart Serve current, private-event serving at Capra’s, available immediately, Exhibition GO is on your line so any event time works.',proof:'One banquet-style service: tray work, course timing, a last-minute change.',study:'Liberty Grand’s ballrooms and event calendar; Liberty Entertainment Group (Casa Loma, BlueBlood).',question:'A plated dinner for 400 is running 20 minutes late — what does the floor team do?',portal:'86network Apply. Liberty says no AI screening; group interviews are typical.'},
      N15:{label:'First wave · private club',role:'Banquet & Event Server (Coordinator alternative)',pitch:'Lead with Capra’s private events and Sotto Sotto service; four days/week is easy from Clarkson. Mention the Event Coordinator advert only if you can describe billing, proposals and Office work you actually did.',proof:'An event from inquiry to bill where you personally owned a piece: brief, setup, service, close.',study:'Private-club discretion, member dining norms, the National Club’s event spaces at 303 Bay.',question:'Walk me through a member event from arrival to the last guest leaving. What do you own?',portal:'86network Banquet Server intake first; Coordinator via its own 86network page as a stated alternative. No walk-ins at a private club.'},
      C05:{label:'Second wave · bar lead',role:'Head Bartender · FT',pitch:'This is the title you have earned twice. Email a short note: two Bar Lead roles, what you owned (specs, training, ordering, quality), classic-cocktail depth, interest in Japanese whisky — and that you are ready to study the category. Include availability, hours sought and three references as the advert asks.',proof:'How you raised consistency or trained a new bartender; a spirits-forward menu you ran.',study:'Mizunara’s cocktail omakase format, Japanese whisky basics (Suntory/Nikka houses, highball culture), Adelaide & Duncan neighbours.',question:'A regular asks you to build a drink around a whisky you have not tasted. How do you approach it?',portal:'Email orlando@mizunara.ca (from the advert) with résumé, availability, hours sought and three references with permission. No AI screening.'},
      C04:{label:'Second wave · daytime FT',role:'Server · CHS (FT daytime)',pitch:'Discreet, polished weekday service for corporate boardrooms at C$25. Lead with Sotto Sotto service and event serving; say which position (Mon–Thu 09:45–14:15 or three days 09:00–16:00) you want and that evenings are free for another role.',proof:'Serving senior guests who want efficient, unobtrusive service; a dietary request handled quietly.',study:'O&B Corporate Hospitality Solutions, CIBC Square, boardroom service etiquette.',question:'A client’s executive lunch is running while a second meeting needs the room in 20 minutes. How do you close service gracefully?',portal:'SmartRecruiters (shared O&B profile). State Position 1 or 2.'},
      '23':{label:'Second wave · direct fit',role:'Bartender · PT',pitch:'Henry’s wants one bartender to run the whole bar with wine knowledge — exactly the Bar Lead years. Keep it about single-handed service, timing multi-course orders and wine confidence.',proof:'A night you ran the bar alone: sequencing, timing courses, wine service.',study:'Henry’s wine-bar menu and list; Queen West room.',question:'How do you time a bar-top tasting menu while serving walk-ins?',portal:'Indeed application; no submission has been made yet. Confirm hours and shift end.'},
      N30:{label:'Second wave · FT service',role:'Server · FT',pitch:'Foreground serving and event service with bar knowledge as an advantage; two years serving and Smart Serve are met outright.',proof:'Pacing several tables or coordinating drinks and food without losing the guest connection.',study:'La Plume’s French brasserie menu, wine by the glass, The Well.',question:'How do you suggest wine and additional courses without making a guest feel pressured?',portal:'SmartRecruiters (shared O&B profile). Alternative to C03/C04/C13, not an extra chance.'},
      C06:{label:'Second wave · cocktail destination',role:'Bartender · FT',pitch:'Nikkei cocktails and a high-design room: lead with cocktail craft, speed and upscale service manners. Four years in a premium setting is met — say where.',proof:'A themed or ingredient-led cocktail programme you executed; guest education at the bar.',study:'Chotto Matte’s Nikkei (Japanese-Peruvian) concept, pisco and shochu basics, Brookfield Place clientele, 3–6pm happy hour.',question:'A guest wants a pisco sour but is allergic to egg — what do you offer and how do you explain it?',portal:'Indeed application first; a 2pm introduction on Monday before happy hour is reasonable if the room is quiet.'},
      C10:{label:'Second wave · supervisor fit',role:'Banquet & Bar Supervisor',pitch:'Lead with bar leadership (two venues), event execution (Capra’s), and six months of shift supervision — exact, not inflated. Exhibition GO makes any event time workable.',proof:'Running a bar team during an event: assignments, stock, a problem solved mid-service.',study:'Sodexo Live! and Cerise Fine Catering at the Beanfield Centre; union environment basics.',question:'Two bars, one short-staffed, a VIP reception starting early — how do you redeploy?',portal:'Indeed application. Apply to Banquet & Bar Supervisor, not the two-year Event Services one.'},
      C07:{label:'Second wave · private club bar',role:'Bartender · PT',pitch:'Polish and discretion: classic cocktails, wine confidence, member names remembered. One year bartending required — seven offered.',proof:'A regular-guest relationship you built; handling a difficult member politely.',study:'The York Club’s history and etiquette; St George Street; classic-cocktail canon.',question:'A long-standing member’s usual isn’t on the list any more. What do you do?',portal:'Indeed application. Part-time; lunches and dinners mixed.'},
      C09:{label:'Second wave · immediate contract',role:'Banquet Server · PT contract',pitch:'Banquet experience required — cite Capra’s private events. Immediate availability, four days/week.',proof:'A wedding or gala service: timing, plated course flow, a change handled.',study:'Casa Loma event spaces; Splash Catering; Dupont station walk.',question:'How do you keep a plated service moving when the kitchen falls behind?',portal:'86network Apply. Ask the contract end date.'},
      N11:{label:'Next wave · Oakville reframed',role:'Bartender / Server (Coordinator stretch)',pitch:'Apply to the new Bartender and Server postings first — steaks, seafood and bespoke cocktails suit the bar-lead and upscale-service history. Mention the coordinator role in one honest line: event coordination and execution in 2024, no management title.',proof:'A bar service and one event you coordinated end to end.',study:'Ce Soir’s French brasserie concept and the new steak-and-seafood description; Aidan Hospitality’s other rooms.',question:'What did you personally own in the events you coordinated, and what did someone else own?',portal:'Indeed server posting and Workopolis bartender posting; HigherMe coordinator as the stretch.'},
      N02:{label:'Reserve · honest stretch',role:'FOH Service Manager',pitch:'Only if applying: lead with coaching bartenders and servers, shift supervision, guest recovery; state clearly that budgeting, scheduling and formal performance management were not yours.',proof:'Coaching a colleague to a standard; a cost or waste issue you actually influenced.',study:'Tabule’s menu and Oakville room; Toast POS.',question:'Which parts of restaurant management have you done, and which would be new to you?',portal:'Indeed application. No scout trip.'}
    });
    P.sprees=[
      {id:'union-core',name:'Union core walk',date:'2026-09-21',start:'14:00',days:[1,2,3,4,5],preferred:'Monday · after the weekend applications',station:'Union Station, Toronto',
       entry:'Clarkson 13:08 → Union 13:45 (37 min). Chotto Matte is 3 minutes away inside Brookfield Place; Bar Filo 8 minutes north; then the 504 King streetcar or a 25-minute walk west to La Plume, which opens at 4pm on Mondays. Fairmont, Sheraton, National Club and CIBC Square are online-only — pass them, do not walk in. Return from Union on the :17/:47 trains.',
       why:'Three rooms with live roles on one walking line from Union: two before the 3pm happy hours, then La Plume at its 4pm Monday opening. Applications go in first; the loop is to be seen once, briefly, where a quiet window exists.',
       stops:[
         {id:'C06',walk:0,window:['14:00','14:50'],hours:'Mon 11:30am–10pm; Tue–Thu 11:30am–11pm; Fri 11:30am–midnight (Google, Sept 19). Happy hour Mon–Fri 3–6pm.',url:'https://chotto-matte.com/toronto/contact/',note:'Apply online first. Ask for the bar manager only if the room is quiet after lunch; leave before happy hour.'},
         {id:'N41',walk:8,window:['14:15','16:00'],hours:'Mon–Fri 11:30am–10pm.',url:'https://www.barfilo.ca/',note:'Server route unless the diploma line is met. Short introduction; do not imply you applied to a role you did not.'},
         {id:'N30',walk:25,window:['16:00','16:45'],hours:'Mon 4–11pm (opens at 4); Tue–Wed 11:30am–11pm; Thu 11:30am–1am (Google, Sept 19).',url:'https://www.laplumebrasserie.com/contact/',note:'Exact server application first. On Monday the room opens at 4pm — arrive at opening, keep it to five minutes. Tue–Wed the bar is open through the afternoon.'},
         {id:'N03',walk:10,window:['14:00','14:30'],hours:'Mon–Wed 11:30am–midnight; Thu–Sat to 1am (Google, Sept 19). Happy hour 2–5pm daily.',url:'https://www.cactusclubcafe.com/location/first-canadian-place/',note:'Optional and off by default: the 2–5pm happy hour makes afternoon introductions awkward.'}
       ],omitted:['N03'],later:'Ceci Bar (Front & Yonge) and Strella Strella (King W) are online-first; add only if a contact suggests a time.'},
      {id:'harbour-tuesday',name:'Interview day · Harbour Sixty',date:'2026-09-22',start:'13:45',days:[1,2,3,4,5],preferred:'Tuesday · fixed by the interview',station:'Union Station, Toronto',
       anchor:{id:'A02',time:'12:30',arriveBy:'12:15',label:'Interview at Arianna',address:'Harbour Sixty, 60 Harbour St, Toronto',note:'4th floor of Harbour Sixty. Ask at the host stand for whoever you were told to meet. Allow 60–75 minutes.'},
       entry:'Clarkson 10:38 → Union 11:15 (or 11:08 → 11:45 at the latest). Walk south on Bay under the Gardiner, 6 minutes to 60 Harbour. After the interview, the waterfront loop east: IRENE (12 min), Simona (3 min further), then back west along Queens Quay to Union. Westin and Scotiabank Arena are next door but online-only.',
       why:'The interview fixes the day; everything else is arranged around it. Two live bar roles on the waterfront within 15 minutes of Harbour Sixty, both applied to beforehand, so the visit is a face to a name — not a first contact.',
       stops:[
         {id:'C17',walk:12,window:['13:45','16:00'],hours:'Mon–Wed 11am–9pm; Thu–Sat 11am–10pm; Sun 11am–9pm (Google, Sept 19).',url:'https://www.irenetoronto.com/',note:'Full-time bartender, Immediate Start. Apply Sunday; on Tuesday ask for the bar manager between lunch and dinner.'},
         {id:'C11',walk:3,window:['14:00','16:30'],hours:'Mon–Thu 11:30am–10pm; Fri 11:30am–11pm (Google, Sept 19).',url:'https://www.simonatoronto.com/',note:'Food Service Supervisor = bar lead; October 5 start. Same FAB group as IRENE — one conversation can cover both.'},
         {id:'C13',walk:25,window:['13:45','14:20'],hours:'Tue 11:30am–2:30pm only (Google, Sept 19).',url:'https://www.oliverbonacini.com/',note:'Only reachable if the interview ends by 13:30; otherwise online (O&B profile). Off by default.'},
         {id:'C06',walk:5,window:['14:00','14:50'],hours:'Tue 11:30am–11pm; happy hour 3–6pm.',url:'https://chotto-matte.com/toronto/contact/',note:'Only if not visited Monday. Off by default.'}
       ],omitted:['C13','C06'],later:'360 at the CN Tower and Westin Harbour Castle are within ten minutes but hire online only.'},
      {id:'port-credit',name:'Port Credit',date:'2026-09-23',start:'14:00',days:[2,3,4],preferred:'Wednesday',station:'Port Credit GO, Mississauga',
       entry:'Clarkson → Port Credit GO 6 minutes, then 7–8 minutes to Habitat. For Mercatto at Brightwater, MiWay 23 Lakeshore from Port Credit (or straight from Clarkson GO) stops on Lakeshore Rd W — free after a GO tap under One Fare — or allow a 25-minute walk. Return from Port Credit GO or MiWay 23 back to Clarkson.',
       why:'The likeliest full-time offer (Mercatto) and the nearest supplemental bar (Habitat) in one short trip. Visit after applying, or when the employer suggests a time.',
       stops:[
         {id:'N01',walk:0,window:['14:00','14:40'],hours:'Mon closed. Tue 11am–3pm; Wed–Sat 11am–3pm and 5–9/10pm; Sun 10:30am–3pm (Google, Sept 19).',url:'https://www.habitatsocial.ca/',note:'Bartender application first. A late-lunch visit may meet a different team from the evening bar.'},
         {id:'N12',walk:25,window:['14:00','16:00'],hours:'Mon–Thu 11:30am–11pm; Fri 11:30am–midnight (Google, Sept 19).',url:'https://mercatto.ca/menu/dinner?location_id=3658',note:'Existing full-time bar/server vacancies. Ask for the hiring contact only if service allows.'},
         {id:'C33',walk:20,window:['14:30','16:30'],hours:'Daily 11:30am–9:30pm, Fri–Sat to 10pm (Google, Sept 19).',url:'https://snugharbour.above-the-cloud.com/careers.php',note:'Optional walk-in with a résumé; no dated vacancy.'}
       ],omitted:['C33'],later:'POSTA and La Vita remain optional scouts; neither displaces the live roles.'},
      {id:'oakville',name:'Downtown Oakville · optional',date:'2026-09-24',start:'12:30',days:[1,2,3,4,5,6],omitted:['N02','N26'],preferred:'Thursday · only if Aidan replies or time allows',station:'Oakville GO, Oakville',
       entry:'Clarkson → Oakville GO 7 minutes, then Oakville Transit (free after a GO tap) ~10 minutes to downtown or a 30-minute walk; bar Su in Kerr Village is a 20-minute walk west of the station. Plan the return last mile too.',
       why:'Ce Soir now has bartender and server postings, which are a real reason to be seen; bar Su serves lunch Thursday–Saturday, so a Thursday 12:30 start reaches both. Tabule is a reserve application, not a visit. Secondary to any interview.',
       stops:[
         {id:'N11',walk:0,window:['12:30','16:00'],hours:'Daily 11am–11pm, Fri–Sat to 1am (Google, Sept 19); kitchen until 10pm.',url:'https://cesoirbrasserie.com/',note:'Bartender/server applications first. Ask for the FOH manager; presence during service is unconfirmed.'},
         {id:'C21',walk:35,days:[4,5,6],window:['12:00','13:45'],hours:'Mon closed; Tue–Wed 5–10:30pm; Thu–Sat lunch 11:30am–2pm and dinner from 5pm (Google, Sept 19).',url:'https://www.barsu.ca/',note:'Kerr Village. Only reachable in the afternoon on a Thursday–Saturday lunch; otherwise apply online.'},
         {id:'N02',walk:7,window:['14:00','16:00'],hours:'Daily 11:30am–10pm, Fri–Sat to 10:30pm (Google, Sept 19).',url:'https://tabule.ca/location/tabule-oakville/',note:'Reserve application only; off by default.'},
         {id:'N26',walk:6,days:[4],window:['14:00','16:00'],hours:'Thu noon–10pm; Tue–Wed 4–10pm.',url:'https://www.veracepizza.ca/reserve-now',note:'Scout only; Thursday.'}
       ],later:'7 Enoteca and Centro are nearby once hours and hiring interest are confirmed.'},
      {id:'exhibition',name:'Exhibition Place · online-first',date:'2026-09-25',start:'14:00',days:[1,2,3,4,5],omitted:['C08','C10'],preferred:'Only if an employer invites you',station:'Exhibition GO, Toronto',
       entry:'Clarkson → Exhibition GO 28 minutes (check the train stops there). Liberty Grand is a 6-minute walk, the Beanfield Centre 8–10 minutes. Banquet venues do not take walk-ins; this block exists so an invited interview here has its travel ready.',
       why:'Two live event employers on your own train line. Both are apply-online; keep the stops unchecked unless invited.',
       stops:[
         {id:'C08',walk:0,window:['13:00','17:00'],hours:'Event-driven; office hours weekdays.',url:'https://www.libertygrand.com/',note:'Invited interview only.'},
         {id:'C10',walk:10,window:['13:00','17:00'],hours:'Event-driven; office hours weekdays.',url:'https://www.sodexolive.com/',note:'Invited interview only.'}
       ],later:'Hotel X and the Boulevard Club are nearby but had no matching openings on September 19.'}
    ];
    P.sprees.sort((a,b)=>a.date.localeCompare(b.date));
  }
})(window);
