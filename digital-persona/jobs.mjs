import {randomUUID} from 'node:crypto';
import {extractSegments} from './segmented-extraction.mjs';
export function archiveConversation(state,user){
 if(!state.settings.autoArchive)return null;
 const source={id:randomUUID(),title:'对话 '+user.createdAt,text:user.text,speaker:user.contactId===null?'self':'other',origin:'chat',originContactId:user.contactId,sourceMessageId:user.id,createdAt:user.createdAt,status:state.settings.autoExtract?'queued':'new',attempts:0};
 state.sources.push(source);return source;
}
export function createWorker({db,configured,request}){
 let active=false,closed=false,fault=null;
 async function recover(){await db.update(s=>{for(const source of s.sources){if(source.status==='running'){source.status='queued';source.lastError='上次处理被中断，已恢复队列';}}});kick();}
 function kick(){if(!active&&!closed){active=true;fault=null;setImmediate(()=>drain().catch(e=>{fault=e.code||'storage_error';}).finally(async()=>{active=false;if(closed||fault)return;try{const state=await db.read();if(!state.settings.queuePaused&&state.sources.some(s=>s.status==='queued'))kick();}catch(e){fault=e.code||'storage_error';}}));}}
 async function drain(){
 while(!closed){
 const state=await db.read();if(state.settings.queuePaused)return;const next=state.sources.find(s=>s.status==='queued');if(!next)return;
 const runId=randomUUID();let claimed=false;
 await db.update(s=>{const source=s.sources.find(x=>x.id===next.id);if(!source||source.status!=='queued'||s.settings.queuePaused)return;if(!(typeof configured==='function'?configured():configured)){source.status='waiting_model';source.lastError='尚未配置真实模型，原文已保存';return;}source.status='running';source.runId=runId;source.attempts=(source.attempts||0)+1;source.lastError='';claimed=true;});
 if(!claimed)continue;
 try{
 await extractSegments({db,source:next,runId,request,shouldContinue:()=>!closed});
 }catch(e){await db.update(s=>{const source=s.sources.find(x=>x.id===next.id);if(!source||source.runId!==runId)return;source.status='failed';source.lastError=e.name==='TimeoutError'?'抽取超时，可重试':e.message;delete source.runId;});}
 }
 }
 return {kick,recover,status(){return {active,fault};},close(){closed=true;}};
}
