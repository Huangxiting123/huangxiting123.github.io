import {createHash} from 'node:crypto';
export const textHash=text=>createHash('sha256').update(text).digest('hex');
export const modelFingerprint=options=>options.url&&options.model?textHash(options.url+'\0'+options.model):null;
export function pruneIndex(state){
 if(!state.semanticIndex)return;const index=state.semanticIndex;if(!Array.isArray(index.rows)){state.semanticIndex={fingerprint:null,rows:[]};return;}
 const current=new Map(state.memories.filter(m=>m.status==='confirmed').map(m=>[m.id,m]));index.rows=index.rows.filter(row=>{const m=current.get(row.id);return m&&row.version===m.version&&row.textHash===textHash(m.text);});
}
