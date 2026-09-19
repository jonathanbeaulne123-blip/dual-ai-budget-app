import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import type {Household} from '../core/types.ts';
import type {LedgerSyncClient} from '../ledgerSync/client.ts';
import {HearthsideVaultClient,IndexedDbVaultUploadQueue,type VaultClientScope} from './vaultClient.ts';

export type VaultConnection={client:HearthsideVaultClient;scope:VaultClientScope;identity:string;token:()=>Promise<string>};
const Context=createContext<{connection:VaultConnection|null;error:string}>({connection:null,error:'Connect to this household to open its private content.'});
export const useHearthsideVault=()=>useContext(Context);

/** Private clients have the same lifetime as the authenticated account/household generation. */
export function HearthsideVaultProvider(props:{household:Household;memberId:string;identity:string;connected:boolean;source:()=>LedgerSyncClient|null;children:ReactNode}){
  return <ScopedVault key={JSON.stringify([props.identity,props.household.environment,props.household.householdId,props.memberId])} {...props}/>;
}
function ScopedVault({household,memberId,identity,connected,source,children}:Parameters<typeof HearthsideVaultProvider>[0]){
  const latest=useRef(source);latest.current=source;
  const [value,setValue]=useState<{connection:VaultConnection|null;error:string}>({connection:null,error:''});
  useEffect(()=>{
    setValue({connection:null,error:''});
    const authority=latest.current();
    if(!authority||authority.options.scope.environment!==household.environment||authority.options.scope.householdId!==household.householdId||authority.options.scope.memberId!==memberId){setValue({connection:null,error:'Connect to this household to open its private content.'});return;}
    const {environment,householdId,subject}=authority.options.scope,scope={environment,householdId,memberId,subject};
    let queue:IndexedDbVaultUploadQueue;
    try{queue=new IndexedDbVaultUploadQueue();}catch{setValue({connection:null,error:'This device cannot open private storage. Saved content remains in the Vault.'});return;}
    const token=async()=>{
      const live=latest.current();
      if(!live||live.options.scope.subject!==subject||live.options.scope.environment!==environment||live.options.scope.householdId!==householdId||live.options.scope.memberId!==memberId)throw Error('SCOPE_CHANGED');
      return live.options.token();
    };
    const client=new HearthsideVaultClient(scope,token,queue);
    setValue({connection:{client,scope,identity,token},error:''});
    return()=>{client.dispose();queue.close();};
  },[connected]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
