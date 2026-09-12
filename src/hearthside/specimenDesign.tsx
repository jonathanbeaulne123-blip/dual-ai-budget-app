import {useEffect,useRef,useState,type ReactNode} from 'react';
import type {Household} from '../core/types.ts';
import {HearthsideDesignClient} from './designClient.ts';
import {HearthsideDesignClientProvider} from './DesignProvider.tsx';
import {acceptKittyDesignOperation,createKittyDesignDocument,migrateLegacyKittyStudio,decodeKittyDesignDocument} from './design.ts';
import {KittyDesignError,type KittyDesignDocument} from './designContracts.ts';
import {applyAcceptedDesignReference} from './designProjection.ts';

/** Fictional in-browser authority for the labelled storyboard, never an authenticated proof. */
export function SpecimenDesign({household,memberId,onHousehold,children}:{household:Household;memberId:string;onHousehold:(h:Household)=>void;children:ReactNode}){
  if(!import.meta.env.DEV)throw Error('SYNTHETIC_DEVELOPMENT_ONLY');
  const live=useRef({household,onHousehold});live.current={household,onHousehold};
  const documents=useRef(new Map<string,{document:KittyDesignDocument;bankId:string|null}>());
  const [client,setClient]=useState<HearthsideDesignClient|null>(null);
  useEffect(()=>{
    const next=new HearthsideDesignClient({environment:household.environment,householdId:household.householdId,memberId,identity:'fictional-storyboard',token:async()=> 'fictional-storyboard',fetch:async(_url,init)=>{
      const request=JSON.parse(String(init?.body)),current=live.current.household;
      if(current.householdId!==household.householdId)throw Error('SCOPE_CHANGED');
      try{
        let row=documents.current.get(request.designId??request.operation?.designId),receipt=null;
        if(request.kind==='create'){
          row??=request.bankId?[...documents.current.values()].find(row=>row.bankId===request.bankId):undefined;
          if(!row){const bank=current.goals.find(g=>g.id===request.bankId),scope={environment:current.environment,householdId:current.householdId,ownerMemberId:bank&&!bank.shared?memberId:null};row={document:bank?migrateLegacyKittyStudio(request.designId,scope,bank.envelope?.studio,'synthetic-migration'):createKittyDesignDocument(request.designId,scope),bankId:request.bankId};}
        }
        if(!row)return Response.json({error:'DESIGN_NOT_FOUND'},{status:409});
        if(request.kind==='operate'){const accepted=acceptKittyDesignOperation(row.document,request.operation,{environment:current.environment,householdId:current.householdId,actorId:memberId,order:row.document.revision+1,acceptedAt:new Date().toISOString()});row={...row,document:accepted.document};receipt=accepted.receipt;}
        // Exercise the same strict wire reader after each synthetic transport round trip.
        row={...row,document:decodeKittyDesignDocument(JSON.parse(JSON.stringify(row.document)))};documents.current.set(row.document.id,row);
        live.current.onHousehold(applyAcceptedDesignReference(current,row.document,row.bankId));
        return Response.json({version:1,document:row.document,receipt,sequence:row.document.revision});
      }catch(error){if(error instanceof KittyDesignError)return Response.json({error:error.code},{status:409});throw error;}
    }});setClient(next);return ()=>next.close();
  },[household.environment,household.householdId,memberId]);
  return <HearthsideDesignClientProvider client={client}>{children}</HearthsideDesignClientProvider>;
}
