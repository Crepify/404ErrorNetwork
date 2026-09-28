import {createClient} from '@supabase/supabase-js';
import {cloudConfig} from './cloud-config.js';
import {normalizeProjects} from './project-schema.js';
import {publicationFromRow} from './cloud-public.js';
export function createCloudEditor({onChange=()=>{}}={}){
 const state={configured:cloudConfig.enabled,ready:!cloudConfig.enabled,user:null,approved:false,error:''};
 if(!cloudConfig.enabled)return {state};
 const client=createClient(cloudConfig.url,cloudConfig.key,{auth:{flowType:'pkce',detectSessionInUrl:true,persistSession:true,autoRefreshToken:true},global:{fetch:(url,options)=>fetch(url,{...options,signal:options?.signal||AbortSignal.timeout(15000)})}});
 let generation=0;
 async function updateSession(session){const current=++generation;state.user=session?.user||null;state.approved=false;state.ready=false;state.error='';onChange();
  try{if(state.user){const {data,error}=await client.rpc('can_publish_stories');if(error)throw error;if(current!==generation)return;state.approved=data===true;}}
  catch{if(current===generation)state.error='Could not verify publishing permission. Check the connection and database setup.';}
  finally{if(current===generation){state.ready=true;onChange();}}
 }
 client.auth.onAuthStateChange((_event,session)=>{setTimeout(()=>updateSession(session),0);});
 client.auth.getSession().then(({data,error})=>{if(error){state.error='Sign-in could not be restored. Please sign in again.';state.ready=true;onChange();}else updateSession(data.session);});
 return {state,
  async requestSignIn(email){const redirect=new URL(location.href);redirect.search='';redirect.hash='studio';const {error}=await client.auth.signInWithOtp({email:email.trim().toLowerCase(),options:{shouldCreateUser:false,emailRedirectTo:redirect.href}});if(error)throw Error('Sign-in email could not be sent. Only invited, allowlisted team emails can sign in. Check the address and email delivery setup.');},
  async verifyCode(email,token){const {error}=await client.auth.verifyOtp({email:email.trim().toLowerCase(),token:token.trim(),type:'email'});if(error)throw Error('That code could not be verified. Check the email and request a new code if it expired.');},
  async signOut(){const {error}=await client.auth.signOut({scope:'local'});if(error)throw Error('Could not sign out. Try again.');await updateSession(null);},
  async publish(projects,expectedRevision){
   if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)throw Error('Load the current online revision before publishing.');
   const clean=normalizeProjects(projects);
   if(new Blob([JSON.stringify(clean)]).size>2500000)throw Error('Project stories exceed the 2.5 MB limit.');
   const {data,error}=await client.rpc('publish_story_collection',{p_projects:clean,p_expected_revision:expectedRevision});
   if(error){if(error.code==='40001')throw Error('Someone published a newer revision. Your draft is safe here. Export it, load the latest online stories, merge your changes and publish again.');if(error.code==='42501'){state.approved=false;onChange();throw Error('Publishing denied. Only currently approved editors can publish.');}throw Error('Publish was not confirmed. Keep this draft, then check the online revision before retrying.');}
   return publicationFromRow(data);
  }
 };
}
