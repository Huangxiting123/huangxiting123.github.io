export function normalize(text){return text.normalize('NFKC').toLowerCase().replace(/[\p{Z}\s]/gu,'').replace(/[。！？!?]+$/u,'');}
const active=m=>['pending','confirmed'].includes(m.status);
export function relation(a,b){
 if(a.id===b.id||!active(a)||!active(b))return null;
 if(a.type===b.type&&normalize(a.text)===normalize(b.text))return 'duplicate';
 if(a.factKey&&b.factKey&&normalize(a.factKey)===normalize(b.factKey)&&normalize(a.text)!==normalize(b.text))return 'conflict';
 return null;
}
export function reviews(memories){const result=[];for(let i=0;i<memories.length;i++)for(let j=i+1;j<memories.length;j++){const kind=relation(memories[i],memories[j]);if(kind)result.push({kind,reference:memories[i],candidate:memories[j]});}return result;}
export function safeCandidates(memories){
 const confirmed=memories.filter(m=>m.status==='confirmed');const conflicts=new Set();for(const pair of reviews(confirmed))if(pair.kind==='conflict'){conflicts.add(pair.reference.id);conflicts.add(pair.candidate.id);}
 const seen=new Set();return confirmed.filter(m=>{if(conflicts.has(m.id))return false;const key=m.type+'\0'+normalize(m.text);if(seen.has(key))return false;seen.add(key);return true;});
}
