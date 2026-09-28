// Public configuration only. This is also validated before the production build.
export function resolveCloudConfig(env={}){
 const first=names=>names.map(name=>String(env[name]||'').trim()).find(Boolean)||'';
 const url=first(['VITE_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_URL','SUPABASE_URL']);
 const key=first(['VITE_SUPABASE_PUBLISHABLE_KEY','VITE_SUPABASE_ANON_KEY','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_PUBLISHABLE_KEY','SUPABASE_ANON_KEY']);
 // Only these explicitly public fields can reach the bundle. Secret/service keys are never fallbacks.
 if(!url&&!key)return {enabled:false,url:'',key:''};
 if(!url||!key)throw Error('Set both VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, or leave both empty.');
 const u=new URL(url);
 if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.pathname!=='/')throw Error('Use the HTTPS Supabase project URL without credentials or paths.');
 let allowed=/^sb_publishable_[A-Za-z0-9_-]+$/.test(key);
 if(!allowed&&key.split('.').length===3){try{const payload=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));allowed=payload.role==='anon';}catch{}}
 if(!allowed)throw Error('Browser configuration requires a publishable key (or legacy anon key). NEVER use a secret or service_role key.');
 return {enabled:true,url:u.origin,key};
}
export const cloudConfig=typeof __STORY_CLOUD_CONFIG__!=='undefined'?__STORY_CLOUD_CONFIG__:{enabled:false,url:'',key:''};
