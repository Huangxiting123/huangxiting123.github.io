import {randomUUID} from 'node:crypto';
function fail(message){throw Object.assign(Error(message),{status:409});}
export function seedDemo(state){
 if(['name','bio','style','values'].some(key=>state.profile[key])||state.profile.tabooTopics?.length||state.memories.length||state.sources.length||state.contacts.length||state.messages.length)fail('已有资料，不能直接载入示例。请保留现有数据或在独立数据目录体验。');
 state.profile={name:'示例人物·林远',bio:'虚构示例人物，用于展示人生记忆与关系管理。不是实际用户资料。',style:'温和、简短，喜欢从具体往事说起',values:'重视守信与家人之间的理解',tabooTopics:[],validatePersona:false,demo:true};
 const now=new Date().toISOString();const examples=[['fact','童年时，父亲教我骑自行车。摔倒后，他扶我起来，让我再试一次。','童年的自行车'],['preference','我喜欢清晨喝一杯清茶，安静地读一会儿书。','清晨的习惯'],['relationship','我和女儿每年春天会一起去公园看花。我们常带上一本植物图鉴。','春天的约定']];
 for(const [type,text,title] of examples){const id=randomUUID();state.sources.push({id,title:'示例·'+title,text,speaker:'self',origin:'demo',status:'extracted',extractedCount:1,createdAt:now,demo:true});state.memories.push({id:randomUUID(),text,type,factKey:'',date:'',sourceId:id,source:'虚构示例原文',speaker:'self',evidenceQuote:text,evidenceStart:0,evidenceEnd:text.length,status:'confirmed',visibility:'private',contactIds:[],relatedContactIds:[],version:1,createdAt:now,demo:true});}
 state.messages=[];state.contextRevision++;return {ok:true};
}
export function clearDemo(state){
 if(!state.profile.demo&&!state.memories.some(m=>m.demo)&&!state.sources.some(s=>s.demo))return {ok:true};
 state.memories=state.memories.filter(m=>!m.demo);const retainedSources=new Set(state.memories.map(m=>m.sourceId));state.sources=state.sources.filter(s=>!s.demo||retainedSources.has(s.id));if(state.profile.demo)state.profile={name:'',bio:'',style:'',values:'',tabooTopics:[],validatePersona:false};state.messages=[];state.contextRevision++;return {ok:true};
}
