import { useEffect, useRef, useState } from 'react';
import type { ActionContext, ActionValues } from './core/herculesActions.ts';
import { guideQuestion, planGuideFields } from './core/planGuide.ts';

export function HerculesPlanGuide({context,values,busy,onAnswer,onBack,onPause,onSkip,inlineAnswers=false}:{context:ActionContext;values:ActionValues;busy:boolean;inlineAnswers?:boolean;onAnswer:(text:string)=>void;onBack:(key?:string)=>void;onPause:()=>void;onSkip:()=>void}) {
 const [answer,setAnswer]=useState('');
 const [datePicker,setDatePicker]=useState(false);
 const field=guideQuestion(context,values),answered=planGuideFields(context,values).filter(f=>!f.optional&&values[f.key]);
 const questionHeading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{setAnswer('');setDatePicker(false);if(document.activeElement?.tagName!=='TEXTAREA')questionHeading.current?.focus();},[field?.key]);
 const choices=field?.choices?.(context,values)??[];
 return <section className="hercules-plan-guide" aria-label="Plan conversation" tabIndex={-1}>
  <p className="kicker">{values.guideMode==='goal'?'One goal · part of your monthly Plan':'A little at a time · private preparation'}</p>
  {field ? <div key={field.key} className="hercules-plan-question">
   <h4 ref={questionHeading} tabIndex={-1}>{field.question}</h4><p>{field.why}</p>
   {field.evidence?.length ? <details><summary>What I found in your books</summary><ul>{field.evidence.map((text,i)=><li key={i}>{text}</li>)}</ul></details>:null}
   {choices.length<=5?<div className="hercules-plan-choices">{choices.map(o=><button disabled={busy} key={o.value} type="button" onClick={()=>onAnswer(o.value)}>{o.label}</button>)}</div>:<label>{field.label}<select disabled={busy} value="" onChange={e=>onAnswer(e.target.value)}><option value="">Choose, or reply below…</option>{choices.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>}
   {!!field.suggestions?.length&&<div className="hercules-plan-choices">{field.suggestions.map(o=><button disabled={busy} key={o.value} type="button" onClick={()=>onAnswer(o.value)}>{o.label}</button>)}</div>}
   {inlineAnswers&&!choices.length&&<form onSubmit={event=>{event.preventDefault();if(answer.trim())onAnswer(answer);}}><label>{field.label}<input disabled={busy} value={answer} onChange={event=>setAnswer(event.target.value)} type={field.kind==='date'?'date':'text'} inputMode={field.kind==='money'?'decimal':undefined}/></label><button type="submit" disabled={busy||!answer.trim()}>Continue</button></form>}
   {!inlineAnswers&&field.kind==='date'&&<><button type="button" onClick={()=>setDatePicker(!datePicker)} aria-expanded={datePicker}>Choose a date</button>{datePicker&&<label>Pick {field.label.toLowerCase()}<input type="date" disabled={busy} onChange={e=>{if(e.target.value){onAnswer(e.target.value);setDatePicker(false);}}}/></label>}</>}
   <small>{inlineAnswers?"Answer here, go back, or leave this part open.":"Reply in the conversation below. You can ask “why?”, go back, or leave this part open."}</small>
   {/^(income|protect|prepare|build|everyday)/.test(field.key)&&<button type="button" disabled={busy} onClick={onSkip}>Leave this part open for now</button>}
  </div>:<p>Here is the draft we have built. Review the whole picture before saving it privately.</p>}
  {answered.length>0&&<details className="hercules-plan-recap"><summary>Answers so far · {answered.length}</summary><p>Changing a source reopens its related details. Your other answers stay here.</p><dl>{answered.map(f=><div key={f.key}><dt>{f.label}</dt><dd>{f.choices?.(context,values).find(o=>o.value===values[f.key])?.label??values[f.key]} <button type="button" disabled={busy} onClick={()=>onBack(f.key)}>Edit {f.label.toLowerCase()}</button></dd></div>)}</dl></details>}
  <div className="hercules-plan-controls"><button type="button" disabled={busy||!answered.length} onClick={()=>onBack()}>Back one question</button><button type="button" disabled={busy} onClick={onPause}>Pause planning</button></div>
 </section>;
}
