import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {normalizeProjects} from './project-schema.js';
const sql=readFileSync(new URL('../supabase/story-publishing.sql',import.meta.url),'utf8');
const site=JSON.parse(readFileSync(new URL('../content/site.json',import.meta.url),'utf8'));
const editor='11111111-1111-4111-8111-111111111111',outsider='22222222-2222-4222-8222-222222222222';
test('actual PostgreSQL RLS, permissions, validation, audit and stale-revision protection',async t=>{
 const db=new PGlite();
 await db.exec(`create role anon nologin; create role authenticated nologin; create role supabase_auth_admin nologin; create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,banned_until timestamptz);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema public,auth to anon,authenticated,supabase_auth_admin;
 insert into auth.users(id,email,email_confirmed_at) values ('${editor}','editor1@example.test',now()),('${outsider}','outsider@example.test',now());`);
 await db.exec(sql);await db.exec(sql); // Idempotent and doesn't reset the publication.
 await db.exec("insert into public.story_editor_emails(email) values ('editor1@example.test'),('editor2@example.test'),('editor3@example.test'),('editor4@example.test'),('editor5@example.test');");
 const login=async(id,role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+role);};
 const publish=(p,rev)=>db.query('select public.publish_story_collection($1::jsonb,$2::bigint) as result',[JSON.stringify(p),rev]);
 const projects=normalizeProjects(site.projects);
 await t.test('anonymous visitors can read only the public collection, not editors/history or publishing',async()=>{
  await login('','anon');assert.equal((await db.query('select revision from public.story_publications')).rows[0].revision,0);
  await assert.rejects(db.query('select * from public.story_editor_emails'),/permission denied/);
  await assert.rejects(db.query('select * from public.story_history'),/permission denied/);
  await assert.rejects(publish(projects,0),/permission denied/);
  await assert.rejects(db.exec("update public.story_publications set revision=99"),/permission denied/);
 });
 await t.test('signed-in but unapproved users cannot self-approve or publish',async()=>{
  await login(outsider);assert.equal((await db.query('select public.can_publish_stories() as approved')).rows[0].approved,false);
  assert.equal((await db.query('select * from public.story_history')).rows.length,0);
  await assert.rejects(db.query('insert into public.story_editor_emails(email) values ($1)',['outsider@example.test']),/permission denied/);
  await assert.rejects(publish(projects,0),/Only approved/);
 });
 await t.test('approved editors publish an atomic, validated snapshot with protected audit history',async()=>{
  await login(editor);const result=(await publish(projects,0)).rows[0].result;assert.equal(result.revision,1);assert.equal(result.projects[1].name,'AgriPulse');
  const history=(await db.query('select * from public.story_history')).rows;assert.equal(history.length,1);assert.equal(history[0].published_by,editor);
  await assert.rejects(db.exec('delete from public.story_history'),/permission denied/);
  await assert.rejects(db.exec('delete from public.story_publications'),/permission denied/);
 });
 await t.test('a stale draft cannot overwrite a teammate, and no failed publication enters history',async()=>{
  await assert.rejects(publish(projects,0),e=>e.code==='40001');
  await assert.rejects(publish(projects,null),e=>e.code==='40001');
  assert.equal((await db.query('select * from public.story_history')).rows.length,1);
  assert.equal((await db.query('select revision from public.story_publications')).rows[0].revision,1);
 });
 await t.test('the database independently rejects private fields, bad URLs, duplicate IDs and multiple flagships',async()=>{
  const cases=[{...projects[0],nextStep:'PRIVATE'},{...projects[0],url:'javascript:alert(1)'},{...projects[0],url:'https://user:password@example.com'},{...projects[0],name:''},{...projects[0],flagship:'true'},{...projects[0],description:null},{...projects[0],problemStatement:'x'.repeat(20001)}];
  for(const p of cases)await assert.rejects(publish([p],1),e=>e.code==='22023');
  await assert.rejects(publish([projects[0],projects[0]],1),/Duplicate/);
  await assert.rejects(publish([projects[0],{...projects[1],flagship:true}],1),/one flagship/);
  await assert.rejects(db.query('select public.publish_story_collection($1::jsonb,1)',[JSON.stringify({projects})]),/array/);
 });
 await t.test('revoking approval blocks a previously signed-in editor immediately',async()=>{
  await db.exec('reset role');await db.query('update public.story_editor_emails set enabled=false where email=$1',['editor1@example.test']);await login(editor);
  await assert.rejects(publish(projects,1),/Only approved/);assert.equal((await db.query('select * from public.story_history')).rows.length,0);
 });
 await t.test('Auth hooks admit only allowlisted addresses and deny unverified, revoked and spoofed identities',async()=>{
  await db.exec('reset role');await db.exec("update public.story_editor_emails set enabled=true where email='editor1@example.test'");
  await db.exec('set role supabase_auth_admin');
  const signup=async(email)=>(await db.query('select public.story_before_user_created_hook($1::jsonb) as result',[JSON.stringify({user:{email}})])).rows[0].result;
  const token=async(id,claims={email:'editor1@example.test'})=>(await db.query('select public.story_access_token_hook($1::jsonb) as result',[JSON.stringify({user_id:id,claims})])).rows[0].result;
  for(let i=1;i<=5;i++)assert.deepEqual(await signup('editor'+i+'@example.test'),{});
  assert.deepEqual(await signup(' EDITOR1@EXAMPLE.TEST '),{});
  for(const email of ['outsider@example.test','editor1+alias@example.test','editor1@example.test.evil',''])assert.equal((await signup(email)).error.http_code,403);
  assert.deepEqual((await token(editor)).claims,{email:'editor1@example.test'});
  assert.equal((await token(outsider,{email:'editor1@example.test',user_metadata:{email:'editor1@example.test',approved:true}})).error.http_code,403);
  await db.exec('reset role');await db.exec("update public.story_editor_emails set enabled=false where email='editor1@example.test'");await db.exec('set role supabase_auth_admin');assert.equal((await token(editor)).error.http_code,403);await db.exec('reset role');await db.exec("update public.story_editor_emails set enabled=true where email='editor1@example.test'");
  await db.exec('reset role');await db.query('update auth.users set email_confirmed_at=null where id=$1',[editor]);await db.exec('set role supabase_auth_admin');
  assert.equal((await token(editor)).error.http_code,403);
  await login(editor);assert.equal((await db.query('select public.can_publish_stories() as allowed')).rows[0].allowed,false);await assert.rejects(publish(projects,1),/Only approved/);
  await db.exec('reset role');await db.query("update auth.users set email_confirmed_at=now(),banned_until=now()+interval '1 day' where id=$1",[editor]);await db.exec('set role supabase_auth_admin');
  assert.equal((await token(editor)).error.http_code,403);
  await db.exec('reset role');await db.query('update auth.users set banned_until=null,email=$1 where id=$2',['changed@example.test',editor]);await db.exec('set role supabase_auth_admin');
  assert.equal((await token(editor)).error.http_code,403);
 });
 await t.test('API clients cannot read the private email list or call Auth hooks directly',async()=>{
  await login(outsider);await assert.rejects(db.query('select * from public.story_editor_emails'),/permission denied/);
  await assert.rejects(db.query("select public.story_access_token_hook('{}'::jsonb)"),/permission denied/);
  await assert.rejects(db.query("select public.story_before_user_created_hook('{}'::jsonb)"),/permission denied/);
 });
 await db.close();
});
