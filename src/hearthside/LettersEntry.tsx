import type {Household} from '../core/types.ts';
import type {LedgerSyncClient} from '../ledgerSync/client.ts';
import {Letters,publishLettersReview} from './Letters.tsx';
import {HEARTHSIDE_FLAGS} from './flags.ts';
import {useHearthsideVault} from './VaultProvider.tsx';
type Props={household:Household;memberId:string;identity:string;connected:boolean;source:()=>LedgerSyncClient|null;theme:'classic'|'taylor'|'newfoundland';onClose:()=>void};
export default function LettersEntry({household,memberId,identity,connected,theme,onClose}:Props){
  const {connection,error}=useHearthsideVault();
  if(!connection||connection.identity!==identity||connection.scope.environment!==household.environment||connection.scope.householdId!==household.householdId||connection.scope.memberId!==memberId)return <section aria-label="Private writing desk"><h2>Your letters and voice notes</h2><p role="status">{error||'Opening your private writing desk…'}</p><button onClick={onClose}>Back to the room</button></section>;
  return <Letters client={connection.client} scope={connection.scope} theme={theme} roster={household.members.map(member=>({memberId:member.id,name:member.name,active:member.active}))} onClose={onClose} publicationEnabled={HEARTHSIDE_FLAGS.vaultPublication&&connected} publishReviewed={review=>publishLettersReview(connection.client,review)}/>;
}
