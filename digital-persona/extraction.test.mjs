import test from 'node:test';
import assert from 'node:assert/strict';
import {parseExtraction} from './extraction.mjs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import http from 'node:http';
const row={text:'喜欢喝茶',quote:'我喜欢喝茶',type:'preference',confidence:.8};
test('抽取仅接受结构有效、引文真实的整批JSON；去除重复',()=>{
 assert.equal(parseExtraction(JSON.stringify({memories:[row,row]}),'我喜欢喝茶').length,1);
 for(const content of ['not JSON',JSON.stringify({memories:[{...row,quote:'凭空编造'}]}),JSON.stringify({memories:[row,{...row,confidence:2}]}),JSON.stringify({memories:Array(21).fill(row)})])assert.throws(()=>parseExtraction(content,'我喜欢喝茶'));
 assert.deepEqual(parseExtraction('{"memories":[]}','任何原文'),[]);
});
test('原文抽取待确认、审核、去重、异常不写入、级联删除与联系人更新轮换',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'persona-extract-'));let child;let output=JSON.stringify({memories:[row]});let payload;let outputs=[];let hold=false,release,entered;
 const mock=http.createServer(async(req,res)=>{let data='';for await(const p of req)data+=p;payload=JSON.parse(data);if(hold){entered();await new Promise(r=>release=r);}res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{content:outputs.length?outputs.shift():output}}]}));});await new Promise(r=>mock.listen(0,'127.0.0.1',r));
 async function api(path,{method='GET',data,token='owner',status=200}={}){const res=await fetch('http://127.0.0.1:4330/api/'+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});assert.equal(res.status,status,await res.clone().text());return res.json();}
 try{child=spawn(process.execPath,['server.mjs'],{cwd:fileURLToPath(new URL('.',import.meta.url)),env:{...process.env,PORT:'4330',PERSONA_DATA:join(dir,'data.json'),PERSONA_OWNER_TOKEN:'owner',PERSONA_API_KEY:'mock',PERSONA_MODEL:'mock',PERSONA_API_URL:`http://127.0.0.1:${mock.address().port}`},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',()=>reject(Error('server exited')));});
 let c=await api('contacts',{method:'POST',data:{name:'女儿',relation:'孩子'},status:201});const oldToken=c.token;
 c=await api('contacts/'+c.id,{method:'PUT',data:{name:'小雨',relation:'女儿',address:'宝贝',tone:'温柔',version:1}});assert.equal(c.address,'宝贝');assert.equal(c.id,(await api('state',{token:oldToken})).contact.id);
 await api('contacts/'+c.id,{method:'PUT',data:{name:'旧编辑',relation:'女儿',version:1},status:409});
 c=await api('contacts/'+c.id+'/rotate',{method:'POST',data:{}});await api('state',{token:oldToken,status:401});await api('state',{token:c.token});
 const source=await api('sources',{method:'POST',data:{title:'本人访谈',text:'我喜欢喝茶',speaker:'self'},status:201});
 await api('sources',{token:c.token,method:'POST',data:{title:'越权',text:'内容',speaker:'self'},status:403});
 let extracted=await api('sources/'+source.id+'/extract',{method:'POST',data:{},status:201});const m=extracted.memories[0];assert.equal(m.status,'pending');assert.equal(m.visibility,'private');assert.equal(m.evidenceQuote,row.quote);assert.equal(m.sourceId,source.id);assert.match(JSON.stringify(payload),/我喜欢喝茶/);
 assert.equal((await api('state',{token:c.token})).memories.length,0);assert.equal((await api('state',{token:c.token})).sources,undefined);
 await api('sources/'+source.id+'/extract',{method:'POST',data:{},status:409});
 await api('memories/'+m.id,{method:'PUT',data:{...m,status:'confirmed',visibility:'shared',contactIds:[c.id]}});assert.equal((await api('state',{token:c.token})).memories.length,1);
 const other=await api('sources',{method:'POST',data:{title:'他人访谈',text:'我喜欢喝茶',speaker:'other'},status:201});output='invalid';await api('sources/'+other.id+'/extract',{method:'POST',data:{},status:502});let state=await api('state');assert.equal(state.memories.length,1);assert.equal(state.sources.find(s=>s.id===other.id).status,'failed');
 output=JSON.stringify({memories:[row]});extracted=await api('sources/'+other.id+'/extract',{method:'POST',data:{},status:201});assert.equal(extracted.memories[0].speaker,'other');assert.equal(extracted.memories[0].status,'pending');
 await api('sources/'+source.id,{method:'DELETE'});state=await api('state');assert.equal(state.memories.some(x=>x.sourceId===source.id),false);assert.equal(state.sources.some(x=>x.id===source.id),false);assert.equal((await api('state',{token:c.token})).memories.length,0);
 const queued=await api('sources',{method:'POST',data:{title:'队列测试',text:'我喜欢喝茶',speaker:'self'},status:201});await api('sources/'+queued.id+'/queue',{method:'POST',data:{},status:202});let queueState;for(let i=0;i<100;i++){queueState=await api('state');if(queueState.sources.find(x=>x.id===queued.id).status==='extracted')break;await new Promise(r=>setTimeout(r,5));}assert.equal(queueState.sources.find(x=>x.id===queued.id).status,'extracted');await api('sources/'+queued.id+'/queue',{method:'POST',data:{},status:409});
 const long=await api('sources',{method:'POST',data:{title:'长访谈',text:'我喜欢喝茶'+'甲'.repeat(500)+'\n'+'我喜欢喝茶'+'乙'.repeat(600),speaker:'self'},status:201});outputs=[JSON.stringify({memories:[row]}),'invalid'];await api('sources/'+long.id+'/extract',{method:'POST',data:{},status:502});let partial=(await api('state')).sources.find(x=>x.id===long.id);assert.equal(partial.status,'failed');assert.equal(partial.segmentProgress.completed.length,1);extracted=await api('sources/'+long.id+'/extract',{method:'POST',data:{},status:201});assert.equal(extracted.memories.length,1);assert.equal(extracted.memories[0].evidenceStart,0);assert.equal((await api('state')).sources.find(x=>x.id===long.id).segmentProgress.completed.length,2);
 const racing=await api('sources',{method:'POST',data:{title:'竞争测试',text:'我喜欢喝茶',speaker:'self'},status:201});hold=true;const enteredSignal=new Promise(r=>entered=r);const inFlight=api('sources/'+racing.id+'/extract',{method:'POST',data:{},status:409});await enteredSignal;await api('sources/'+racing.id+'/extract',{method:'POST',data:{},status:409});await api('sources/'+racing.id+'/queue',{method:'POST',data:{},status:409});await api('sources/'+racing.id,{method:'DELETE'});release();await inFlight;hold=false;assert.equal((await api('state')).memories.some(m=>m.sourceId===racing.id),false);
 }finally{if(child?.exitCode===null){const done=new Promise(r=>child.once('exit',r));child.kill();await done;}await new Promise(r=>mock.close(r));await rm(dir,{recursive:true,force:true});}
});
