import {randomUUID} from 'node:crypto';
import {segmentSource} from './segments.mjs';
import {extractionPrompt,parseExtraction} from './extraction.mjs';
import {textHash} from './index-utils.mjs';
export async function extractSegments({db,source,runId,request,shouldContinue=()=>true}){
 const spans=segmentSource(source.text);const sourceHash=textHash(source.text);const fingerprint=textHash('segments-v1-800\0'+source.text);let written=0;
 for(const segment of spans){
 const latest=await db.read();const current=latest.sources.find(s=>s.id===source.id);if(!current||current.runId!==runId||current.status!=='running')return {cancelled:true,written};
 if(textHash(current.text)!==sourceHash)throw Error('原文已变化，请重新入队');
 if(current.segmentProgress?.fingerprint===fingerprint&&current.segmentProgress.completed.includes(segment.index))continue;
 if(!shouldContinue()){await db.update(s=>{const item=s.sources.find(x=>x.id===source.id);if(item?.runId===runId){item.status='queued';delete item.runId;}});return {cancelled:true,written};}
 const content=await request([{role:'system',content:extractionPrompt},{role:'user',content:JSON.stringify({speaker:source.speaker,text:segment.text})}]);const candidates=parseExtraction(content,segment.text);
 await db.update(s=>{const item=s.sources.find(x=>x.id===source.id);if(!item||item.runId!==runId||item.status!=='running')return;if(textHash(item.text)!==sourceHash)throw Error('原文已变化');
 if(!item.segmentProgress||item.segmentProgress.fingerprint!==fingerprint)item.segmentProgress={fingerprint,total:spans.length,completed:[]};if(item.segmentProgress.completed.includes(segment.index))return;
 const existing=new Set(s.memories.filter(m=>m.sourceId===source.id).map(m=>m.type+'\0'+m.text+'\0'+(m.factKey||'')));const now=new Date().toISOString();
 for(const m of candidates){const key=m.type+'\0'+m.text+'\0'+(m.factKey||'');if(existing.has(key))continue;existing.add(key);const evidenceStart=segment.start+segment.text.indexOf(m.quote);s.memories.push({id:randomUUID(),text:m.text,type:m.type,factKey:m.factKey,confidence:m.confidence,evidenceQuote:m.quote,evidenceStart,evidenceEnd:evidenceStart+m.quote.length,segmentIndex:segment.index,sourceId:source.id,source:source.title+'（'+(source.speaker==='self'?'本人陈述':'他人转述')+'）',speaker:source.speaker,date:'',createdAt:now,status:'pending',visibility:'private',contactIds:[],relatedContactIds:[],version:1});written++;}
 item.segmentProgress.completed.push(segment.index);item.extractedCount=s.memories.filter(m=>m.sourceId===source.id).length;
 });
 }
 await db.update(s=>{const item=s.sources.find(x=>x.id===source.id);if(item?.runId===runId&&item.status==='running'){item.status='extracted';item.extractedAt=new Date().toISOString();item.extractedCount=s.memories.filter(m=>m.sourceId===source.id).length;delete item.runId;}});return {written};
}
