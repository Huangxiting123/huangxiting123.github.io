import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {dirname} from 'node:path';
import {safeCandidates} from './memory-quality.mjs';
import {pruneIndex} from './index-utils.mjs';
export function createStore(file){
 let queue=Promise.resolve();
 async function readRaw(){let state;try{state=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;state={profile:{name:'',bio:'',style:''},memories:[],messages:[]};}state.profile={values:'',tabooTopics:[],validatePersona:false,...state.profile};state.contacts??=[];state.sources??=[];state.revision??=0;state.contextRevision??=0;state.schemaVersion=6;state.settings={autoArchive:true,autoExtract:false,queuePaused:false,...state.settings};state.memories=state.memories.map(m=>({relatedContactIds:[],factKey:'',type:'fact',source:'manual',status:'confirmed',visibility:'private',contactIds:[],version:1,...m}));return state;}
 function update(fn){const result=queue.then(async()=>{const state=await readRaw();const value=await fn(state);pruneIndex(state);state.revision++;await mkdir(dirname(file),{recursive:true});await writeFile(file+'.tmp',JSON.stringify(state,null,2),'utf8');await rename(file+'.tmp',file);return value;});queue=result.catch(()=>{});return result;}
 function read(){const result=queue.then(readRaw);queue=result.then(()=>undefined,()=>undefined);return result;}
 return {read,update};
}
export function visibleMemories(state,contactId){return safeCandidates(state.memories.filter(m=>m.status==='confirmed'&&(contactId===null||m.visibility==='shared'&&m.contactIds.includes(contactId))));}
export function recall(memories,query){const words=[...new Set(query.toLowerCase().match(/[a-z0-9]+|[\u4e00-\u9fff]/g)||[])];return memories.map(m=>({m,score:words.reduce((s,w)=>s+(m.text.toLowerCase().includes(w)?1:0),0)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,5).map(x=>x.m);}
