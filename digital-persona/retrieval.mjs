import {recall} from './store.mjs';
export function cosine(a,b){if(a.length!==b.length)throw Error('向量维度不匹配');let dot=0,aa=0,bb=0;for(let i=0;i<a.length;i++){dot+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i];}return aa&&bb?dot/Math.sqrt(aa*bb):0;}
function vectors(result,count){
 if(!Array.isArray(result.data)||result.data.length!==count)throw Error('向量数量无效');const rows=[...result.data].sort((a,b)=>a.index-b.index);
 if(rows.some((r,i)=>r.index!==i||!Array.isArray(r.embedding)||!r.embedding.length||!r.embedding.every(Number.isFinite)||!r.embedding.some(n=>n!==0)))throw Error('向量返回格式无效');const dims=rows[0]?.embedding.length;if(rows.some(r=>r.embedding.length!==dims))throw Error('向量维度不匹配');return rows.map(r=>r.embedding);
}
export function createRetriever({url,key,model,fetcher=fetch}){
 const configured=Boolean(url&&key&&model);
 return async function retrieve(memories,query){
 const lexical=recall(memories,query);if(!configured||!memories.length)return {memories:lexical,mode:'keyword'};
 if(memories.length>200)return {memories:lexical,mode:'keyword_fallback',notice:'可访问记忆超过本地语义检索上限，已使用关键词检索'};
 try{
 // No persisted vector cache: deleted or revoked records are never reused in another request.
 const response=await fetcher(url,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},signal:AbortSignal.timeout(15000),body:JSON.stringify({model,input:[query,...memories.map(m=>m.text)]})});if(!response.ok)throw Error('向量服务失败');
 const all=vectors(await response.json(),memories.length+1);const scored=memories.map((m,i)=>({m,score:cosine(all[0],all[i+1])})).filter(x=>x.score>=.35).sort((a,b)=>b.score-a.score);
 const combined=[...scored.slice(0,6).map(x=>x.m),...lexical];const seen=new Set();return {memories:combined.filter(m=>!seen.has(m.id)&&seen.add(m.id)).slice(0,6),mode:'hybrid'};
 }catch{return {memories:lexical,mode:'keyword_fallback',notice:'语义服务暂不可用，已使用关键词检索'};}
 };
}
