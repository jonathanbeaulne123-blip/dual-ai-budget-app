import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { AuthInviteChrome, WelcomeJoin } from '../src/Pairing.tsx';
import { catalogHousehold } from '../src/core/index.ts';

vi.mock('../src/auth/supabaseSession.ts',async importOriginal=>({...await importOriginal<typeof import('../src/auth/supabaseSession.ts')>(),supabaseAuthEnabled:()=>true}));

const owner='00000000-0000-0000-0000-000000000001';
const partner='00000000-0000-0000-0000-000000000002';
const stranger='00000000-0000-0000-0000-000000000003';
const setup=`
CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE SCHEMA hearth_private;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
CREATE FUNCTION hearth_private.session_is_live() RETURNS boolean LANGUAGE sql AS $$ SELECT auth.uid() IS NOT NULL $$;
CREATE FUNCTION hearth_private.jwt_email() RETURNS text LANGUAGE sql AS $$ SELECT 'unused@example.test' $$;
CREATE TABLE auth.identities(user_id uuid,provider text,provider_id text,identity_data jsonb);
INSERT INTO auth.identities VALUES('${owner}','google','owner','{"email":"owner@example.test"}'),('${partner}','google','partner','{"email":"partner@example.test"}'),('${stranger}','google','stranger','{"email":"stranger@example.test"}');
CREATE TABLE continuity_memberships(environment text,household_id text,member_id text,google_subject text,google_email text,display_name text,active boolean,updated_at text,auth_user_id uuid,role text,revoked_at timestamptz,PRIMARY KEY(environment,household_id,member_id));
INSERT INTO continuity_memberships VALUES('development','HH-1','MEM-OWNER','owner','owner@example.test','Owner',true,'2026-09-07','${owner}','owner',null);
CREATE FUNCTION hearth_private.is_household_owner(h text,e text) RETURNS boolean LANGUAGE sql AS $$ SELECT EXISTS(SELECT 1 FROM public.continuity_memberships WHERE household_id=h AND environment=e AND auth_user_id=auth.uid() AND role='owner' AND active AND revoked_at IS NULL) $$;
CREATE FUNCTION hearth_private.own_member_id(h text,e text) RETURNS text LANGUAGE sql AS $$ SELECT member_id FROM public.continuity_memberships WHERE household_id=h AND environment=e AND auth_user_id=auth.uid() AND active $$;
CREATE FUNCTION hearth_private.identity_audit(text,text,text,text,text,text DEFAULT NULL) RETURNS void LANGUAGE sql AS $$ SELECT $$;
CREATE TABLE household_snapshots(environment text,household_id text,payload text);
INSERT INTO household_snapshots VALUES('development','HH-1','{"members":[{"id":"MEM-OWNER","name":"Owner","active":true}]}');
CREATE TABLE household_invitations(id uuid DEFAULT gen_random_uuid(),environment text,household_id text,target_member_id text,target_role text,kind text,invite_token_hash text,invited_email text,created_by_auth_user_id uuid,status text,expires_at timestamptz,revoked_at timestamptz,accepted_at timestamptz,accepted_by_auth_user_id uuid);
CREATE TABLE schema_migrations(id int PRIMARY KEY,applied_at text);
`;

it('reserves without a roster entry, then joins exactly once with recipient name; refuses third member', async()=>{
 const db=new PGlite();
 try {
  await db.exec(setup);
  await db.exec(readFileSync('supabase/migrations/021_invite_new_person.sql','utf8'));
  const as=async(id:string)=>db.query("SELECT set_config('test.uid',$1,false)",[id]);
  const issue=async()=> (await db.query<{v:any}>("SELECT hearth_issue_invite('development','HH-1',NULL,'qr',NULL,168,'owner') v")).rows[0]!.v;
  await as(stranger); expect(await issue()).toMatchObject({ok:false,reason:'not-owner'});
  await as(owner); const first=await issue();
  const second=(await db.query<{v:any}>("SELECT hearth_issue_invite('development','HH-1',NULL,'email','partner@example.test',168,'member') v")).rows[0]!.v;
  expect(first.ok).toBe(true); expect(second.ok).toBe(true);
  expect((await db.query<{n:number}>("SELECT count(*)::int n FROM continuity_memberships WHERE active")).rows[0]!.n).toBe(1);
  expect((await db.query<{payload:string}>('SELECT payload FROM household_snapshots')).rows[0]!.payload).not.toContain('Invited person');
  const redeem=async(token:string,name:string)=>(await db.query<{v:any}>('SELECT hearth_redeem_invite($1,$2) v',[token,name])).rows[0]!.v;
  await as(partner); expect(await redeem(first.invite_token,'Bianca')).toMatchObject({ok:false,reason:'not-pending'});
  expect(await redeem(second.invite_token,'')).toMatchObject({ok:false,reason:'display-name-required'});
  const joined=await redeem(second.invite_token,'Bianca'); expect(joined).toMatchObject({ok:true,role:'member'});
  expect(await redeem(second.invite_token,'Changed')).toMatchObject({ok:true,duplicate:true,member_id:joined.member_id});
  expect((await db.query<{display_name:string}>('SELECT display_name FROM continuity_memberships WHERE member_id=$1',[joined.member_id])).rows[0]!.display_name).toBe('Bianca');
  await as(stranger); expect(await redeem(second.invite_token,'Third')).toMatchObject({ok:false,reason:'house-full'});
  await as(owner); expect(await issue()).toMatchObject({ok:false,reason:'house-full'});
  await as(''); expect(await redeem(first.invite_token,'Anonymous')).toMatchObject({ok:false,reason:'session-not-live'});
 } finally {await db.close();}
},30000);

// Auth enablement is covered in the mounted component regression below when configured.
describe('recipient name step',()=>{
 it('asks the recipient for a name before accepting',()=>{
  const html=renderToStaticMarkup(createElement(WelcomeJoin,{error:'',busy:false,environment:'development',inviteInput:'a'.repeat(64),inviteFlowState:'awaiting-name',onInviteInput:()=>{},onError:()=>{},onBusy:()=>{},onJoined:async()=>{},onBack:()=>{}}));
  expect(html).toContain('Your name'); expect(html).toContain('What name would you like');
  expect(html).toMatch(/disabled=""[^>]*>Accept invitation/);
 });
});

it('offers a QR invite when the owner is the only roster member',()=>{
 const h=catalogHousehold();h.members=h.members.slice(0,1);
 const html=renderToStaticMarkup(createElement(AuthInviteChrome,{household:h,memberId:h.members[0]!.id,busy:false,syncState:'synced',onError:()=>{},onBusy:()=>{}}));
 expect(html).toContain('Someone new');expect(html).toContain('Issue QR / link invite');
 expect(html).not.toContain('Add another person to the household roster');
});
