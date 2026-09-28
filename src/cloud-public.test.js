import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveCloudConfig} from './cloud-config.js';
import {readPublication,publicationFromRow} from './cloud-public.js';
import {refreshUntouchedAgriPulse} from './project-updates.js';
const config={enabled:true,url:'https://example.supabase.co',key:'sb_publishable_TEST_ONLY'};
test('missing cloud configuration is safely disabled; partial or secret-key config is rejected',()=>{
 assert.equal(resolveCloudConfig({}).enabled,false);
 assert.throws(()=>resolveCloudConfig({VITE_SUPABASE_URL:config.url}),/both/);
 for(const key of ['sb_secret_DO_NOT_EXPOSE','eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.test'])assert.throws(()=>resolveCloudConfig({VITE_SUPABASE_URL:config.url,VITE_SUPABASE_PUBLISHABLE_KEY:key}),/NEVER/);
 assert.equal(resolveCloudConfig({VITE_SUPABASE_URL:config.url,VITE_SUPABASE_PUBLISHABLE_KEY:config.key}).enabled,true);
});
test('public reader sends only a public key, never browser cookies or private workspace data',async()=>{
 let options,endpoint;const result=await readPublication({config,fetcher:async(url,init)=>{endpoint=url;options=init;return {ok:true,json:async()=>[{projects:[{id:'test',name:'Public',description:'Story',flagship:false}],revision:3,published_at:'2026-09-28T00:00:00Z'}]};}});
 assert.equal(result.revision,3);assert.equal(options.credentials,'omit');assert.equal(options.body,undefined);assert.equal(options.headers.Authorization,undefined);assert.deepEqual(options.headers,{apikey:config.key});assert(endpoint.includes('/story_publications?'));assert(!endpoint.includes('history'));
});
test('unconfigured readers never request the network; corrupt/unavailable publications fail closed',async()=>{
 assert.equal(await readPublication({config:{enabled:false},fetcher:()=>{throw Error('Must not call');}}),null);
 assert.throws(()=>publicationFromRow({projects:[],revision:-1,published_at:''}));
 await assert.rejects(readPublication({config,fetcher:async()=>({ok:false})}),/could not be loaded/);
 await assert.rejects(readPublication({config,fetcher:async()=>({ok:true,json:async()=>[]})}),/initialized/);
});
test('AgriPulse migrates the untouched placeholder, while custom writing and private workflow survive',()=>{
 const previous='AgriPulse was our project for the NexHack hackathon at IITM Delhi. We were shortlisted and travelled to Delhi, but narrowly missed making the elimination round.';
 const p={id:'agripulse',description:previous,problemStatement:'',idealSolution:'',lessonsLearned:'',nextStep:'Private task'};refreshUntouchedAgriPulse(p);assert.match(p.description,/leaf scanning/);assert.match(p.lessonsLearned,/mentors/);assert.equal(p.nextStep,'Private task');
 const custom={id:'agripulse',description:previous,lessonsLearned:'My wording'};refreshUntouchedAgriPulse(custom);assert.equal(custom.description,previous);assert.equal(custom.lessonsLearned,'My wording');
});
