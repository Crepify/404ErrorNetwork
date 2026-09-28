// Public project stories only. Shared file format also used by ArchiSpace.
export const STORY_FIELDS=['problemStatement','idealSolution','lessonsLearned'];
export const EVENT_FIELDS=['eventName','eventType','eventVenue','eventLocation','eventOutcome'];
export const PUBLIC_TEXT_FIELDS=['description',...STORY_FIELDS,'context',...EVENT_FIELDS,'tech','repository'];
export function projectDefaults(){return {id:crypto.randomUUID(),name:'',description:'',problemStatement:'',idealSolution:'',lessonsLearned:'',context:'',flagship:false,eventName:'',eventType:'',eventVenue:'',eventLocation:'',eventOutcome:'',tech:'',repository:'',url:'',linkLabel:'Visit project',visual:'signal'};}
export function safeProjectUrl(value){if(!value)return '';const u=new URL(value);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw Error('Project links must be public HTTP or HTTPS URLs without credentials.');return u.href;}
export function normalizeProject(raw,{allowBlank=false}={}){
 if(!raw||typeof raw!=='object')throw Error('Invalid project.');
 const string=(value,max=20000)=>{if(value===undefined||value===null)return '';if(typeof value!=='string'||value.length>max)throw Error('Project text is invalid or too long.');return value;};
 const id=string(raw.id,100);if(!/^[a-zA-Z0-9_-]+$/.test(id))throw Error('Project IDs must contain only letters, numbers, dashes and underscores.');
 const name=string(raw.name??raw.title,160).trim();if(!allowBlank&&!name)throw Error('Every project needs a name.');
 const p={id,name};
 for(const key of PUBLIC_TEXT_FIELDS)p[key]=string(key==='description'?(raw.description??raw.detail??raw.summary):raw[key]);
 if(raw.flagship!==undefined&&typeof raw.flagship!=='boolean')throw Error('Flagship must be true or false.');
 p.flagship=raw.flagship===true;
 p.url=allowBlank?string(raw.url,2000):safeProjectUrl(string(raw.url,2000));p.repository=allowBlank?p.repository:safeProjectUrl(p.repository);
 p.linkLabel=string(raw.linkLabel,100)||'Visit project';
 p.visual=['city','plant','signal'].includes(raw.visual)?raw.visual:'signal';
 return p;
}
export function normalizeProjects(items,options={}){
 if(!Array.isArray(items)||items.length>200)throw Error('Supply a project list with at most 200 entries.');
 const projects=items.map(p=>normalizeProject(p,options)),ids=new Set();
 for(const p of projects){if(ids.has(p.id))throw Error('Duplicate project ID: '+p.id);ids.add(p.id);}
 if(projects.filter(p=>p.flagship).length>1)throw Error('Choose at most one flagship project.');
 return projects;
}
export function readProjectFile(payload){
 if(!payload||(!['404-projects-v1','archispace-public-v1'].includes(payload.format)&&typeof payload.networkName!=='string'))throw Error('Import a projects.json export, a public-profile.json export, or the team site.json. Private workspace backups are not accepted.');
 return normalizeProjects(payload.projects);
}
export function portableProjects(projects){return {format:'404-projects-v1',projects:normalizeProjects(projects)};}
