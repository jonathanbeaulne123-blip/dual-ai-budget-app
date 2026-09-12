import {DurableObject} from 'cloudflare:workers';
import type {DurableObjectState} from '@cloudflare/workers-types';
import type {Scope} from '../src/ledgerSync/protocol.ts';
import {guestAssert,guestOpaque,guestSubject,type GuestIdentity,type GuestStreetCard} from '../src/hearthside/guestContracts.ts';
import {checkedGuestIdentity} from './hearthsideGuestAuthority.ts';
import {GuestArchive} from './hearthsideGuestArchive.ts';
import type {GuestEnv,OwnedCallingCard} from './hearthsideGuestTypes.ts';
export class HearthsideGuestIndex extends DurableObject<GuestEnv>{
  private archive:GuestArchive;
  constructor(ctx:DurableObjectState,env:GuestEnv){super(ctx,env);this.archive=new GuestArchive(this.ctx.storage,env.HEARTHSIDE_GUEST_ARCHIVE);}
  private checkScope(scope:Scope){guestAssert(scope.environment==='development'&&scope.expires>Date.now()&&/^HH-[A-Za-z0-9_-]{1,96}$/.test(scope.householdId),'GUEST_UNAUTHENTICATED');guestSubject(scope.subject);}
  async addCallingCard(identity:GuestIdentity,card:OwnedCallingCard){checkedGuestIdentity(identity);const name=`street/${identity.subject}`;await this.archive.ready(name);this.archive.put(`card/${guestOpaque(card.id)}`,card);await this.archive.flush(name);checkedGuestIdentity(identity);}
  async ownCards(identity:GuestIdentity){checkedGuestIdentity(identity);await this.archive.ready(`street/${identity.subject}`);return this.archive.list<OwnedCallingCard>('card/');}
  async addGrant(subject:string,card:GuestStreetCard){guestSubject(subject);const name=`street/${subject}`;await this.archive.ready(name);const key=`grant/${guestOpaque(card.id)}`,old=this.archive.get<{card:GuestStreetCard;revoked:boolean}>(key);if(old){guestAssert(JSON.stringify(old.card)===JSON.stringify(card)&&!old.revoked,'GUEST_GRANT_REVOKED');}else{guestAssert(this.archive.list('grant/').length<80,'GUEST_STREET_FULL');this.archive.put(key,{card,revoked:false});}await this.archive.flush(name);}
  async revokeGrant(subject:string,id:string){guestSubject(subject);const name=`street/${subject}`;await this.archive.ready(name);const key=`grant/${guestOpaque(id)}`,row=this.archive.get<{card:GuestStreetCard;revoked:boolean}>(key);if(row)this.archive.put(key,{...row,revoked:true});await this.archive.flush(name);}
  async grantPointers(identity:GuestIdentity){checkedGuestIdentity(identity);await this.archive.ready(`street/${identity.subject}`);return this.archive.list<{card:GuestStreetCard;revoked:boolean}>('grant/').filter(row=>!row.revoked&&row.card.expiresAt>Date.now()).map(row=>row.card);}
  async addHostPublication(scope:Scope,id:string){this.checkScope(scope);const name=`host/${scope.householdId}`;await this.archive.ready(name);const key=`publication/${guestOpaque(id)}`;guestAssert(this.archive.get(key)||this.archive.list('publication/').length<200,'GUEST_HOST_INDEX_FULL');this.archive.put(key,{id});await this.archive.flush(name);this.checkScope(scope);}
  async hostPublicationIds(scope:Scope){this.checkScope(scope);await this.archive.ready(`host/${scope.householdId}`);return this.archive.list<{id:string}>('publication/').map(row=>row.id);}
  /** Trusted recovery only; no HTTP operation maps here. */
  async restoreGuestArchive(name:string,maxEntries=128){return this.archive.restore(name,maxEntries);}
}
