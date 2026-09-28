import {cloudConfig} from './cloud-config.js';
import {normalizeProjects} from './project-schema.js';
export function publicationFromRow(row){
 if(!row||!Number.isSafeInteger(row.revision)||row.revision<0||typeof row.published_at!=='string')throw Error('Invalid cloud publication.');
 return {projects:normalizeProjects(row.projects),revision:row.revision,publishedAt:row.published_at};
}
export async function readPublication({config=cloudConfig,fetcher=fetch}={}){
 if(!config.enabled)return null;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{
  const headers={apikey:config.key};if(config.key.startsWith('eyJ'))headers.Authorization='Bearer '+config.key;
  const response=await fetcher(config.url+'/rest/v1/story_publications?id=eq.team&select=projects,revision,published_at&limit=1',{headers,signal:controller.signal,cache:'no-store',credentials:'omit'});
  if(!response.ok)throw Error('Online stories could not be loaded. Check the connection and Supabase setup.');
  const rows=await response.json();if(!Array.isArray(rows)||rows.length!==1)throw Error('Shared story storage has not been initialized. Run the setup SQL.');
  return publicationFromRow(rows[0]);
 }finally{clearTimeout(timer);}
}
// Public reads only, with no user session and no academic/workspace data.
// Visible pages refresh every 30 seconds and when the tab regains focus.
export function watchPublicStories({onPublication,onStatus=()=>{},config=cloudConfig}){
 let stopped=false,busy=false,lastRevision=-1;
 async function refresh(){if(stopped||busy||!config.enabled)return;busy=true;
  try{const publication=await readPublication({config});if(stopped)return;if(publication.revision!==lastRevision){lastRevision=publication.revision;onPublication(publication);}onStatus(publication.revision===0?'Cloud connected · awaiting first publication':'Online stories · revision '+publication.revision+' · '+new Date(publication.publishedAt).toLocaleString());}
  catch{if(!stopped)onStatus('Cloud unavailable · showing the last loaded or bundled stories');}
  finally{busy=false;}
 }
 if(!config.enabled){onStatus('');return {refresh,stop(){stopped=true;}};}
 refresh();const timer=setInterval(()=>{if(document.visibilityState==='visible')refresh();},30000);
 const focus=()=>{if(document.visibilityState==='visible')refresh();};window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus);
 return {refresh,stop(){stopped=true;clearInterval(timer);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus);}};
}
