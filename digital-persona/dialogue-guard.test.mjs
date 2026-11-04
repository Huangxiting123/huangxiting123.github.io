import test from 'node:test';
import assert from 'node:assert/strict';
import {blockedTopic,topicList,dialogueRules,guardReply,guardedFallback,uncertainFallback} from './dialogue-guard.mjs';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import http from 'node:http';
const pass={score:90,factsSupported:true,styleMatches:true,relationshipMatches:true,tabooFree:true};
test('话题规则规范化、全局与联系人组合、格式校验',()=>{
 assert.ok(blockedTopic('SECRET， topic',['secret topic']));assert.ok(blockedTopic('遗\u200b 产',['遗产']));assert.equal(blockedTopic('普通问候',['遗产']),false);assert.deepEqual(topicList(['话题','话题']),['话题']);assert.throws(()=>topicList(['!!!']));assert.throws(()=>topicList(Array(31).fill('话题')));assert.deepEqual(dialogueRules({tabooTopics:['a']},{tabooTopics:['b']}).topics,['a','b']);
});
test('本地回复拦截不调用模型，未启用人设校验也不额外调用',async()=>{
 const chat=()=>{throw Error('不应调用');};let result=await guardReply({candidate:'不可聊的遗产',rules:{topics:['遗产'],validate:true},context:{},chat});assert.equal(result.text,guardedFallback);assert.equal(result.checks,0);result=await guardReply({candidate:'你好',rules:{topics:[],validate:false},context:{},chat});assert.equal(result.text,'你好');assert.equal(result.outcome,'local_checked');
});
test('校验通过正常输出；一次改写及再次校验后输出',async()=>{
 let calls=0;const result=await guardReply({candidate:'旧回复',rules:{topics:[],validate:true},context:{memories:[]},chat:async()=>{calls++;return calls===1?JSON.stringify({...pass,score:50,styleMatches:false}):calls===2?'改写回复':JSON.stringify(pass);}});assert.equal(result.text,'改写回复');assert.equal(calls,3);assert.equal(result.checks,2);assert.equal(result.rewrites,1);assert.equal(result.outcome,'rewritten');
});
test('校验失败、格式异常和服务故障保守回退，不无限重试',async()=>{
 let calls=0;const result=await guardReply({candidate:'原回复',rules:{topics:[],validate:true},context:{},chat:async()=>{calls++;return calls===2?'仍然不合适':JSON.stringify({...pass,score:40});}});assert.equal(result.text,uncertainFallback);assert.equal(calls,3);assert.equal(result.outcome,'validation_failed');for(const chat of [async()=>'bad JSON',async()=>{throw Error('service error');}])assert.equal((await guardReply({candidate:'原回复',rules:{topics:[],validate:true},context:{},chat})).outcome,'validation_unavailable');await assert.rejects(guardReply({candidate:'原回复',rules:{topics:[],validate:true},context:{},chat:async()=>{throw Object.assign(Error('changed'),{status:409});}}),e=>e.status===409);
});
test('受限输入不发送/归档；关系隔离、上下文过滤、拒绝受限输出及规则变更竞争',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'stillhere-rules-'));let child;const requests=[];let candidate='普通问候';let hold=false,release,started;const mock=http.createServer(async(req,res)=>{let raw='';for await(const part of req)raw+=part;const payload=JSON.parse(raw);requests.push(payload);res.setHeader('Content-Type','application/json');let answer=candidate;if(payload.messages[0].content.includes('回复校验器')){if(hold){started();await new Promise(r=>release=r);}answer=JSON.stringify(pass);}res.end(JSON.stringify({choices:[{message:{content:answer}}]}));});await new Promise(r=>mock.listen(0,'127.0.0.1',r));
 async function api(path,{method='GET',data,token='owner',status=200}={}){const r=await fetch('http://127.0.0.1:4333/api/'+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});assert.equal(r.status,status,await r.clone().text());return r.json();}
 try{child=spawn(process.execPath,['server.mjs'],{cwd:fileURLToPath(new URL('.',import.meta.url)),env:{...process.env,PORT:'4333',PERSONA_DATA:join(dir,'data.json'),PERSONA_OWNER_TOKEN:'owner',PERSONA_API_URL:`http://127.0.0.1:${mock.address().port}/chat`,PERSONA_API_KEY:'fake',PERSONA_MODEL:'mock',PERSONA_EMBED_URL:'',PERSONA_EMBED_KEY:'',PERSONA_EMBED_MODEL:''},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',()=>reject(Error('server exited')));});
 await api('profile',{method:'POST',data:{name:'本体',style:'温和',values:'诚实',tabooTopics:['GLOBALSECRET'],validatePersona:true}});
 const a=await api('contacts',{method:'POST',data:{name:'女儿',relation:'孩子',tabooTopics:['CONTACTSECRET']},status:201});const b=await api('contacts',{method:'POST',data:{name:'朋友',relation:'朋友'},status:201});
 await api('profile',{token:a.token,method:'POST',data:{name:'越权',tabooTopics:[]},status:403});
 let reply=await api('chat',{token:a.token,method:'POST',data:{text:'CONTACTSECRET 这个具体句子不要留存'}});assert.equal(reply.assistant.guard.outcome,'input_blocked');assert.equal(requests.length,0);let state=await api('state');assert.equal(state.sources.length,0);assert.doesNotMatch(await readFile(join(dir,'data.json'),'utf8'),/这个具体句子不要留存/);assert.equal((await api('state',{token:a.token})).profile.tabooTopics,undefined);
 await api('chat',{token:b.token,method:'POST',data:{text:'GLOBALSECRET'}});assert.equal(requests.length,0);
 await api('memories',{method:'POST',data:{text:'CONTACTSECRET 这段保密回忆',source:'本人',visibility:'shared',contactIds:[a.id,b.id]},status:201});
 reply=await api('chat',{token:a.token,method:'POST',data:{text:'聊聊回忆'}});assert.equal(reply.assistant.guard.outcome,'validated');assert.doesNotMatch(JSON.stringify(requests),/这段保密回忆/);assert.match(JSON.stringify(requests),/诚实/);
 candidate='CONTACTSECRET 模型生成的受限句子';reply=await api('chat',{token:a.token,method:'POST',data:{text:'你好'}});assert.equal(reply.assistant.guard.outcome,'output_blocked');assert.doesNotMatch(await readFile(join(dir,'data.json'),'utf8'),/模型生成的受限句子/);
 candidate='普通问候';const before=requests.length;await api('chat',{token:b.token,method:'POST',data:{text:'聊聊回忆'}});assert.match(JSON.stringify(requests.slice(before)),/这段保密回忆/);
 hold=true;const signal=new Promise(r=>started=r);const pending=api('chat',{token:a.token,method:'POST',data:{text:'说说今天'},status:409});await signal;await api('contacts/'+a.id,{method:'PUT',data:{name:a.name,relation:a.relation,version:a.version||1,tabooTopics:['CONTACTSECRET','新规则']}});release();await pending;hold=false;assert.equal((await api('state')).messages.length,0);
 await api('profile',{method:'POST',data:{name:'改称呼'}});state=await api('state');assert.equal(state.profile.validatePersona,true);assert.deepEqual(state.profile.tabooTopics,['GLOBALSECRET']);
 }finally{if(child?.exitCode===null){const done=new Promise(r=>child.once('exit',r));child.kill();await done;}await new Promise(r=>mock.close(r));await rm(dir,{recursive:true,force:true});}
});
