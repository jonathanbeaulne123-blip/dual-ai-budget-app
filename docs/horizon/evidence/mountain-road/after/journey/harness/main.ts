// The real Journey board and fictional household. Journey's printed map has fixed daylight.
import {loadJourneyLand,buildJourneyLand} from '/src/journey/land/index.ts';
import {layoutRoute,createJourneyBoardScene} from '/src/journey/board/index.ts';
import {deriveJourneyBoard} from '/src/journey/model/index.ts';
import {journeyDemoHousehold,BIANCA,FIXTURE_TODAY} from '/test/fixtures/journey-board-households.ts';
const params=new URLSearchParams(location.search),theme=params.get('theme')??'classic',tier=params.get('tier')??'full';
const data=await loadJourneyLand(),board=deriveJourneyBoard(journeyDemoHousehold().household,BIANCA,FIXTURE_TODAY),land=buildJourneyLand(data,{theme,tier,homes:board.homes}),route=layoutRoute(board,data);
const scene=createJourneyBoardScene(document.getElementById('host')!,{land,board,route,theme,tier,reducedMotion:true,onAnchors:()=>{},onTier:()=>{},onPick:()=>{},onReady:()=>{},onLost:()=>{},shared:false,size:{width:innerWidth,height:innerHeight},devicePixelRatio:1});
(window as any).__cap={frame(target:any,zoom:any){scene.focus(target,zoom,false);scene.renderNow();scene.renderNow();return{view:scene.view(),stats:scene.stats(),land:land.stats(),theme,tier};}};
(window as any).__ready=true;
