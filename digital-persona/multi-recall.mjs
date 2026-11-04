function tokens(text){return [...new Set(text.toLowerCase().match(/[a-z0-9]+|[\u4e00-\u9fff]/g)||[])];}
export function rankMemories(memories,query,{semantic=new Map(),contactId=null,now=Date.now()}={}){
 const words=tokens(query);const recentQuestion=/最近|近期|这几天|近况|recent|lately/i.test(query);
 const scored=memories.map(m=>{
 const lexical=words.length?words.filter(w=>m.text.toLowerCase().includes(w)).length/words.length:0;
 const similarity=semantic.get(m.id)||0;const age=now-Date.parse(m.updatedAt||m.createdAt||'');const recent=Number.isFinite(age)&&age>=0&&age<=30*86400000?1-age/(30*86400000):0;
 const related=Boolean(contactId&&m.relatedContactIds?.includes(contactId));
 const relevant=lexical>0||similarity>=.35||recentQuestion&&recent>0&&['preference','habit'].includes(m.type);
 const routes=[];if(lexical>0)routes.push('keyword');if(similarity>=.35)routes.push('semantic');if(related&&relevant)routes.push('relationship');if(recent>0&&relevant)routes.push('recent');
 return {m,routes,relevant,score:.5*(similarity>=.35?similarity:0)+.32*lexical+.12*(related?1:0)+.06*recent};
 }).filter(x=>x.relevant).sort((a,b)=>b.score-a.score||a.m.id.localeCompare(b.m.id)).slice(0,6);
 return {memories:scored.map(x=>x.m),trace:scored.map(x=>({memoryId:x.m.id,routes:x.routes}))};
}
