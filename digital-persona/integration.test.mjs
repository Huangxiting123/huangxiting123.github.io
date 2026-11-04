import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import http from 'node:http';
test('授权隔离、编辑删除、迁移、重启及真实适配器的受控上游验证',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'persona-v2-'));let child;let lastPayload;const embeddingInputs=[];let hold,release,arrived;
 const mock=http.createServer(async(req,res)=>{let raw='';for await(const chunk of req)raw+=chunk;lastPayload=JSON.parse(raw);if(lastPayload.input){embeddingInputs.push(lastPayload.input);res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:lastPayload.input.map((_,index)=>({index,embedding:[1,0]}))}));return;}if(hold){arrived();await new Promise(r=>release=r);}res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{content:'测试模型回复'}}]}));});
 await new Promise(r=>mock.listen(0,'127.0.0.1',r));
 async function boot(){child=spawn(process.execPath,['server.mjs'],{cwd:fileURLToPath(new URL('.',import.meta.url)),env:{...process.env,PORT:'4329',PERSONA_DATA:join(dir,'state.json'),PERSONA_OWNER_TOKEN:'test-owner',PERSONA_API_KEY:'test-key',PERSONA_MODEL:'mock',PERSONA_EMBED_KEY:'test-embed',PERSONA_EMBED_MODEL:'mock',PERSONA_EMBED_URL:`http://127.0.0.1:${mock.address().port}/embed`,PERSONA_API_URL:`http://127.0.0.1:${mock.address().port}/chat`},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',()=>reject(Error('server exited')));});}
 async function stop(){const done=new Promise(r=>child.once('exit',r));child.kill();await done;}
 async function api(path,{token='test-owner',method='GET',data,status=200,headers={}}={}){const r=await fetch('http://127.0.0.1:4329/api/'+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...headers},...(data?{body:JSON.stringify(data)}:{})});assert.equal(r.status,status,await r.clone().text());return r.json();}
 try{
 await writeFile(join(dir,'state.json'),JSON.stringify({profile:{name:'本体',bio:'PRIVATE_BIO',style:'温和'},memories:[{id:'legacy',text:'LEGACY_SECRET',createdAt:'2000-01-01'}],messages:[]}));
 await boot();await api('state',{token:'',status:401});await api('state',{headers:{Origin:'https://example.com'},status:403});
 const a=await api('contacts',{method:'POST',data:{name:'女儿',relation:'孩子',address:'宝贝',tone:'温柔'},status:201});const b=await api('contacts',{method:'POST',data:{name:'朋友',relation:'朋友'},status:201});
 let owner=await api('state');assert.equal(owner.memories[0].visibility,'private');
 const original={text:'爸爸带我去杭州西湖',source:'本人回忆原文',visibility:'shared',contactIds:[a.id],status:'confirmed',type:'fact',date:'2000-06-01'};
 let m=await api('memories',{method:'POST',data:original,status:201});
 await api('memories',{method:'POST',data:{...original,text:'PENDING_SECRET',status:'pending'},status:201});
 await api('memories',{method:'POST',data:{...original,date:'2000-02-31'},status:400});
 let sa=await api('state',{token:a.token});assert.equal(sa.memories.length,1);assert.equal(sa.profile.bio,undefined);assert.equal(sa.contacts,undefined);assert.equal((await api('state',{token:b.token})).memories.length,0);
 await api('export',{token:a.token,status:403});await api('memories',{token:a.token,method:'POST',data:{text:'尝试越权'},status:403});
 await api('chat',{token:a.token,method:'POST',data:{text:'爸爸杭州'}});const captured=JSON.stringify(lastPayload);assert.match(captured,/西湖/);assert.doesNotMatch(captured,/PRIVATE_BIO|LEGACY_SECRET|PENDING_SECRET/);assert.match(captured,/宝贝/);assert.ok(embeddingInputs.length);assert.doesNotMatch(JSON.stringify(embeddingInputs),/PRIVATE_BIO|LEGACY_SECRET|PENDING_SECRET/);assert.equal((await api('state',{token:b.token})).messages.length,0);
 m=await api('memories/'+m.id,{method:'PUT',data:{...original,text:'爸爸带我去苏州',version:m.version}});assert.equal((await api('state',{token:a.token})).messages.length,0);
 await api('memories/'+m.id,{method:'PUT',data:{...original,version:1},status:409});
 await api('chat',{token:a.token,method:'POST',data:{text:'爸爸苏州'}});assert.doesNotMatch(JSON.stringify(lastPayload),/西湖/);
 await stop();await boot();assert.equal((await api('state',{token:a.token})).memories[0].text,'爸爸带我去苏州');
 const signal=new Promise(r=>arrived=r);hold=true;const inFlight=api('chat',{token:a.token,method:'POST',data:{text:'爸爸'},status:409});await signal;
 await api('memories/'+m.id,{method:'DELETE'});release();await inFlight;hold=false;
 assert.equal((await api('state',{token:a.token})).messages.length,0);
 await api('chat',{token:a.token,method:'POST',data:{text:'爸爸'}});assert.doesNotMatch(JSON.stringify(lastPayload),/苏州|西湖/);
 let archived=await api('state');assert.ok(archived.sources.every(s=>s.origin==='chat'&&s.speaker==='other'));assert.ok(archived.sources.some(s=>s.text==='爸爸杭州'));const sourceCount=archived.sources.length;await api('settings',{method:'PUT',data:{autoArchive:false,autoExtract:false,queuePaused:false}});await api('settings',{token:a.token,method:'PUT',data:{autoArchive:true,autoExtract:true,queuePaused:false},status:403});await api('chat',{token:a.token,method:'POST',data:{text:'关闭归档后'}});assert.equal((await api('state')).sources.length,sourceCount);const oldFact=await api('memories',{method:'POST',data:{text:'住北京',factKey:'居住城市/2020'},status:201});const newFact=await api('memories',{method:'POST',data:{text:'住上海',factKey:'居住城市/2020',status:'pending'},status:201});await api('reviews',{token:a.token,status:403});let review=await api('reviews');assert.ok(review.reviews.some(r=>r.kind==='conflict'));await api('reviews/resolve',{method:'POST',data:{candidateId:newFact.id,referenceId:oldFact.id,candidateVersion:99,referenceVersion:oldFact.version,action:'replace'},status:409});await api('reviews/resolve',{method:'POST',data:{candidateId:newFact.id,referenceId:oldFact.id,candidateVersion:newFact.version,referenceVersion:oldFact.version,action:'replace'}});let corrected=await api('state');assert.equal(corrected.memories.find(m=>m.id===oldFact.id).status,'archived');assert.equal(corrected.memories.find(m=>m.id===newFact.id).status,'confirmed');assert.equal(corrected.memories.find(m=>m.id===newFact.id).visibility,'private');assert.equal((await api('state',{token:a.token})).memories.some(m=>m.id===newFact.id),false);assert.equal(corrected.messages.length,0);await api('index',{token:a.token,status:403});await api('index/clear',{token:a.token,method:'POST',data:{},status:403});assert.equal((await api('state',{token:a.token})).index,undefined);const built=await api('index/rebuild',{method:'POST',data:{}});assert.ok(built.stored>0);assert.equal((await api('state')).semanticIndex,undefined);const backup=await api('export');assert.equal(backup.semanticIndex,undefined);await api('index/clear',{method:'POST',data:{}});assert.equal((await api('index')).stored,0);assert.ok(backup.contacts.every(c=>!c.token));
 await api('contacts/'+a.id,{method:'DELETE'});await api('state',{token:a.token,status:401});
 assert.equal((await api('state')).messages.length,0);
 }finally{if(child?.exitCode===null)await stop();await new Promise(r=>mock.close(r));await rm(dir,{recursive:true,force:true});}
});
