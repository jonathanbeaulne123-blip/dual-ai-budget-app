import {useEffect,useState} from 'react';
import {occasionDate,decodeOccasion,textValue,type PersonalOccasion,type HearthsideState} from './contracts.ts';
import type {HearthsideOperation} from './commands.ts';
import './occasions.css';

type Props={state:HearthsideState;memberId:string;identity:string;canSave:boolean;submit:(op:HearthsideOperation)=>Promise<boolean>;onOpen:(kind:'experience'|'memory',id:string)=>void;selectedId?:string};
export function Occasions(props:Props){return <OccasionDesk key={props.identity} {...props}/>;}
function OccasionDesk({state,memberId,identity,canSave,submit,onOpen,selectedId}:Props){
  const currentYear=new Date().getFullYear(),key=`hearthside-occasion-draft:${identity}`;
  const [draft,setDraft]=useState<PersonalOccasion|null>(()=>{try{const raw=sessionStorage.getItem(key);if(raw&&raw.length<20000){const parsed=JSON.parse(raw);const title=textValue(parsed.title,240,true),monthDay=textValue(parsed.monthDay,5,true);return {...decodeOccasion({...parsed,title:title||'Unfinished date',monthDay:monthDay||'01-01'}),title,monthDay};}}catch{}return null;});
  const [year,setYear]=useState(currentYear),[message,setMessage]=useState('');
  useEffect(()=>{try{if(draft)sessionStorage.setItem(key,JSON.stringify(draft));else sessionStorage.removeItem(key);}catch{setMessage('Keep this page open to retain your unfinished date.');}},[draft,key]);
  const rows=selectedId?state.occasions.filter(o=>o.id===selectedId):state.occasions;
  async function save(){if(!draft||!canSave)return;try{if(await submit({kind:'occasion.save',expectedRevision:draft.revision-1,value:draft})){setDraft(null);setMessage('This date has a place in our home.');}}catch(error){setMessage(error instanceof Error?error.message:'Review this date before saving.');}}
  async function prepare(occasion:PersonalOccasion){
    const existing=occasion.occurrences.find(o=>o.year===year);if(existing?.experienceId){onOpen('experience',existing.experienceId);return;}
    const id=`EXP-occasion:${occasion.id}:${year}`;
    const accepted=await submit({kind:'occasion.prepare',id:occasion.id,expectedRevision:occasion.revision,year,experience:{version:1,id,revision:1,title:`${occasion.title} · ${year}`,intention:'',state:'dreaming',horizon:'season',createdBy:memberId,references:[{kind:'occasion',id:occasion.id}]}});
    if(accepted)onOpen('experience',id);
  }
  return <section className="hearthside-occasions" aria-label="Dates that mean something">
    <header><p className="kicker">A place in our year</p><h2>Dates that mean something</h2><p>Every return is a fresh invitation. Earlier years keep their own story.</p></header>
    <div className="occasion-years"><label>Year to prepare<input type="number" min="1900" max="9999" value={year} onChange={e=>setYear(Number(e.target.value))}/></label><button onClick={()=>setDraft({version:1,id:`OCC-${crypto.randomUUID()}`,revision:1,title:'',monthDay:'',leapDay:'february-28',occurrences:[]})}>Add a meaningful date</button></div>
    {!rows.length&&<p>An anniversary, a birthday, or a day only the two of you understand.</p>}
    <div className="occasion-calendar">{rows.map(occasion=><article key={occasion.id}><div className="occasion-date" aria-hidden="true"><span>{occasion.monthDay.slice(0,2)}</span><strong>{occasion.monthDay.slice(3)}</strong></div><div><h3>{occasion.title}</h3><p>{Number.isInteger(year)&&year>=1900&&year<=9999?occasionDate(occasion,year):'Choose a year'}{occasion.monthDay==='02-29'?` · In other years, ${occasion.leapDay==='march-1'?'March 1':'February 28'}`:''}</p><button disabled={!canSave||!Number.isInteger(year)||year<1900||year>9999} onClick={()=>void prepare(occasion)}>{occasion.occurrences.some(o=>o.year===year&&o.experienceId)?`Open our ${year} intention`:`Prepare ${year} together`}</button><button onClick={()=>setDraft({...occasion,revision:occasion.revision+1})}>Edit this date</button><details><summary>Earlier and upcoming chapters of this date</summary>{occasion.occurrences.length?occasion.occurrences.map(occurrence=><div key={occurrence.id}><strong>{occurrence.date}</strong> {occurrence.experienceId&&<button onClick={()=>onOpen('experience',occurrence.experienceId!)}>Open its intention</button>}{occurrence.memoryIds.map(id=><button key={id} onClick={()=>onOpen('memory',id)}>{state.memories.find(m=>m.id===id)?.title??'Open the memory'}</button>)}</div>):<p>No preparation has been started yet.</p>}</details></div></article>)}</div>
    {draft&&<form className="occasion-draft" aria-label="Meaningful date draft" onSubmit={e=>{e.preventDefault();void save();}}><h3>{draft.revision===1?'A day of our own':'Edit this meaningful date'}</h3><label>What this day means<input autoFocus required maxLength={240} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label><label>Month and day<input required inputMode="numeric" pattern="(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])" placeholder="MM-DD" value={draft.monthDay} onChange={e=>setDraft({...draft,monthDay:e.target.value})}/></label>{draft.monthDay==='02-29'&&<label>In years without February 29<select value={draft.leapDay} onChange={e=>setDraft({...draft,leapDay:e.target.value as PersonalOccasion['leapDay']})}><option value="february-28">February 28</option><option value="march-1">March 1</option></select></label>}<p>This date is shared in your household. Preparing a year creates an intention when you choose; plans, tasks and banks stay optional.</p><button disabled={!canSave}>Keep this date</button><button type="button" onClick={()=>setDraft(null)}>Cancel</button></form>}
    {message&&<p role="status">{message}</p>}
  </section>;
}
