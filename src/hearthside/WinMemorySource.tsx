import {decodeWinProvenance,winPublicCaption,type LegacyWinProvenance} from './winMemoryProvenance.ts';
export function WinMemorySource({source,history=true}:{source:LegacyWinProvenance|undefined;history?:boolean}){
 if(!source)return null;const exact=decodeWinProvenance(source),caption=winPublicCaption(exact);
 return <aside aria-label="Earlier Win record" className="hearthside-win-source"><p className="kicker">From an earlier Win</p>{caption&&<><h4>{caption.label}</h4><p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{caption.text}</p></>}{history&&<p className="muted">{exact.historicalKeptMemberIds.length?'This moment was kept in the earlier records. ':''}Those records remain history. We each choose whether to keep this exact composition now.</p>}</aside>;
}
