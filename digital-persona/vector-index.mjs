import {textHash,modelFingerprint} from './index-utils.mjs';
import {cosine} from './retrieval.mjs';
import {rankMemories} from './multi-recall.mjs';
function validVector(vector){return Array.isArray(vector)&&vector.length>0&&vector.every(Number.isFinite)&&vector.some(n=>n!==0);}
function readVectors(result,count){if(!Array.isArray(result.data)||result.data.length!==count)throw Error('向量数量错误');const rows=[...result.data].sort((a,b)=>a.index-b.index);if(rows.some((r,i)=>r.index!==i||!validVector(r.embedding))||rows.some(r=>r.embedding.length!==rows[0].embedding.length))throw Error('向量格式错误');return rows.map(r=>r.embedding);}
export function createIndexedRetriever({db,getOptions,fetcher=fetch}){
 let queue=Promise.resolve();
 async function request(options,input){const response=await fetcher(options.url,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',Authorization:'Bearer '+options.key},signal:AbortSignal.timeout(15000),body:JSON.stringify({model:options.model,input})});if(!response.ok)throw Error('语义服务失败');return readVectors(await response.json(),input.length);}
 async function run(memories,query,{contactId=null,contextRevision,now}={}){
 const before=await db.read();const expected=contextRevision??before.contextRevision;const conflict=()=>Object.assign(new Error('资料或权限已更新，请重新请求'),{status:409});if(before.contextRevision!==expected)throw conflict();
 const rank=semantic=>rankMemories(memories,query,{semantic,contactId,now});const options=getOptions();const fingerprint=modelFingerprint(options);
 if(!options.key||!fingerprint||!memories.length)return {...rank(new Map()),mode:'multi_route',indexHits:0,indexBuilt:0};
 if(memories.length>1000)return {...rank(new Map()),mode:'keyword_fallback',notice:'当前本地索引扫描上限为1000条，已回退多路关键词检索',indexHits:0,indexBuilt:0};
 try{
 const state=await db.read();if(state.contextRevision!==expected)throw conflict();
 const rows=state.semanticIndex?.fingerprint===fingerprint?state.semanticIndex.rows:[];const byId=new Map((rows||[]).map(r=>[r.id,r]));const hits=new Map(),missing=[];
 for(const m of memories){const r=byId.get(m.id);if(r&&r.version===m.version&&r.textHash===textHash(m.text)&&validVector(r.vector))hits.set(m.id,r.vector);else missing.push(m);}
 const first=await request(options,[query,...missing.slice(0,31).map(m=>m.text)]);const queryVector=first[0];const newRows=[];const add=(m,vector)=>{if(vector.length!==queryVector.length)throw Error('向量维度变化，请清空索引后重建');hits.set(m.id,vector);newRows.push({id:m.id,version:m.version,textHash:textHash(m.text),vector});};
 missing.slice(0,31).forEach((m,i)=>add(m,first[i+1]));for(let offset=31;offset<missing.length;offset+=32){const batch=missing.slice(offset,offset+32);const values=await request(options,batch.map(m=>m.text));batch.forEach((m,i)=>add(m,values[i]));}
 const semantic=new Map();for(const m of memories){const vector=hits.get(m.id);if(vector.length!==queryVector.length)throw Error('索引维度变化');semantic.set(m.id,cosine(queryVector,vector));}
 if(newRows.length)await db.update(current=>{if(current.contextRevision!==expected||modelFingerprint(getOptions())!==fingerprint)throw Error('资料或服务配置已更新');if(!current.semanticIndex||current.semanticIndex.fingerprint!==fingerprint)current.semanticIndex={fingerprint,rows:[]};const ids=new Set(newRows.map(r=>r.id));current.semanticIndex.rows=current.semanticIndex.rows.filter(r=>!ids.has(r.id));current.semanticIndex.rows.push(...newRows);current.semanticIndex.updatedAt=new Date().toISOString();});
 else if((await db.read()).contextRevision!==expected||modelFingerprint(getOptions())!==fingerprint)throw Error('资料或服务配置已更新');
 return {...rank(semantic),mode:'indexed_hybrid',indexHits:memories.length-missing.length,indexBuilt:missing.length};
 }catch{if((await db.read()).contextRevision!==expected)throw conflict();return {...rank(new Map()),mode:'keyword_fallback',notice:'语义索引暂不可用，已回退多路关键词检索',indexHits:0,indexBuilt:0};}
 }
 function retrieve(...args){const result=queue.then(()=>run(...args));queue=result.catch(()=>{});return result;}
 return retrieve;
}
