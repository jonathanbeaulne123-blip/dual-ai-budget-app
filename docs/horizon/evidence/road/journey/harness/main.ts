// The Journey land + board, mounted alone (no app shell, no login) on the fictional demo household fixture. Served by
// capture.mjs (relative imports into this checkout).
import { loadJourneyLand, buildJourneyLand } from "../../../../../../src/journey/land/index.ts";
import { layoutRoute, createJourneyBoardScene } from "../../../../../../src/journey/board/index.ts";
import { deriveJourneyBoard } from "../../../../../../src/journey/model/index.ts";
import { journeyDemoHousehold, BIANCA, FIXTURE_TODAY } from "../../../../../../test/fixtures/journey-board-households.ts";
const params = new URLSearchParams(location.search);
const theme = (params.get("theme") ?? "classic") as "classic";
const data = await loadJourneyLand();
const board = deriveJourneyBoard(journeyDemoHousehold().household, BIANCA, FIXTURE_TODAY);
const land = buildJourneyLand(data, { theme, tier: "full", homes: board.homes });
const route = layoutRoute(board, data);
let anchors: unknown[] = [];
const scene = createJourneyBoardScene(document.getElementById("host")!, {
  land, board, route, theme, tier: "full", reducedMotion: true,
  onAnchors: (a) => { anchors = a; }, onTier: () => {}, onPick: () => {}, onReady: () => {}, onLost: () => {},
  shared: false, size: { width: 1280, height: 800 }, devicePixelRatio: 1,
});
(window as any).__cap = {
  scene, land, data, route, board,
  frame(target: any, tier: any) { scene.focus(target, tier, false); scene.renderNow(); scene.renderNow(); return { view: scene.view(), stats: scene.stats(), land: land.stats(), anchors: anchors.length }; },
};
(window as any).__ready = true;
