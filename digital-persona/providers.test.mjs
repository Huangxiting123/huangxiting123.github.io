import test from 'node:test';
import assert from 'node:assert/strict';
import {createProviders} from './providers.mjs';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import http from 'node:http';
const config={url:'https://example.test/chat',model:'test',key:'FAKE_SECRET_FOR_TEST'};
test('配置不返回密钥；留空仅允许同域名沿用；远程仅HTTPS',()=>{
 let auth;const p=createProviders({env:{},fetcher:async(_,req)=>{auth=req.headers.Authorization;return {ok:true,json:async()=>({choices:[{message:{content:'ok'}}]})};}});p.apply('text',config);assert.doesNotMatch(JSON.stringify(p.status()),/FAKE_SECRET/);p.apply('text',{...config,key:'',model:'changed'});assert.equal(p.status().text.model,'changed');assert.throws(()=>p.apply('text',{...config,key:'',url:'https://other.test/chat'}));
 for(const url of ['http://remote.test/chat','https://user:pass@example.test/chat','https://example.test/chat?key=secret','https://example.test/chat#secret'])assert.throws(()=>p.apply('text',{...config,url}));p.clear('text');assert.equal(p.configured(),false);
});
test('文本检测只发送固定内容并检查结构；HTTP错误不泄露响应内容',async()=>{
 let payload,redirect;let success=true;const p=createProviders({env:{},fetcher:async(_,req)=>{payload=JSON.parse(req.body);redirect=req.redirect;return success?{ok:true,json:async()=>({choices:[{message:{content:'连接正常'}}]})}:{ok:false,status:401,json:async()=>({error:'SENSITIVE_RESPONSE'})};}});p.apply('text',config);assert.equal((await p.check('text')).ok,true);assert.equal(redirect,'error');assert.equal(payload.messages.length,1);assert.match(payload.messages[0].content,/连接测试/);assert.equal(p.status().text.lastCheck.ok,true);success=false;await assert.rejects(p.check('text'),/认证失败/);assert.doesNotMatch(JSON.stringify(p.status()),/SENSITIVE_RESPONSE|FAKE_SECRET/);assert.equal(p.status().text.lastCheck.ok,false);
});
test('向量连接验证数量、索引、维度与有限值',async()=>{
 let good=true;const p=createProviders({env:{},fetcher:async()=>({ok:true,json:async()=>({data:good?[{index:1,embedding:[0,1]},{index:0,embedding:[1,0]}]:[{index:0,embedding:[0,0]}]})})});p.apply('embedding',config);assert.equal((await p.check('embedding')).ok,true);good=false;await assert.rejects(p.check('embedding'),/无效/);
});
test('修改配置时拒绝正在返回的旧服务响应',async()=>{
 let release;const p=createProviders({env:{},fetcher:()=>new Promise(r=>release=r)});p.apply('text',config);const request=p.chat([{role:'user',content:'hello'}]);p.apply('text',{...config,model:'new-model'});release({ok:true,json:async()=>({choices:[{message:{content:'old'}}]})});await assert.rejects(request,/配置已变化/);
});
test('未配置或返回非法内容时给出明确提示',async()=>{
 const p=createProviders({env:{},fetcher:async()=>({ok:true,json:async()=>({choices:[]})})});await assert.rejects(p.chat([]),/尚未配置/);p.apply('text',config);await assert.rejects(p.chat([]),/未返回有效内容/);
});
test('服务端动态配置、检查、清除、授权隔离与备份无密钥',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'stillhere-provider-'));let child;let fail=false;const requests=[];const mock=http.createServer(async(req,res)=>{let raw='';for await(const part of req)raw+=part;const payload=JSON.parse(raw);requests.push(payload);res.setHeader('Content-Type','application/json');if(fail){res.statusCode=429;return res.end('{"error":"quota"}');}res.end(JSON.stringify(payload.input?{data:payload.input.map((_,index)=>({index,embedding:[1,0]}))}:{choices:[{message:{content:'服务测试通过'}}]}));});await new Promise(r=>mock.listen(0,'127.0.0.1',r));
 async function api(path,{method='GET',token='owner',data,status=200}={}){const r=await fetch('http://127.0.0.1:4331/api/'+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});assert.equal(r.status,status,await r.clone().text());return r.json();}
 try{child=spawn(process.execPath,['server.mjs'],{cwd:fileURLToPath(new URL('.',import.meta.url)),env:{...process.env,PORT:'4331',PERSONA_DATA:join(dir,'data.json'),PERSONA_OWNER_TOKEN:'owner',PERSONA_API_URL:'',PERSONA_API_KEY:'',PERSONA_MODEL:'',PERSONA_EMBED_URL:'',PERSONA_EMBED_KEY:'',PERSONA_EMBED_MODEL:''},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',()=>reject(Error('server exited')));});
 assert.equal((await api('state')).mode,'demo');await api('providers/text/check',{method:'POST',data:{},status:503});
 await api('demo/load',{method:'POST',data:{}});assert.equal((await api('state')).profile.demo,true);await api('demo/load',{method:'POST',data:{},status:409});const contact=await api('contacts',{method:'POST',data:{name:'家人',relation:'家人'},status:201});await api('demo/clear',{token:contact.token,method:'POST',data:{},status:403});await api('demo/clear',{method:'POST',data:{}});assert.equal((await api('state')).contacts.length,1);const cfg={url:`http://127.0.0.1:${mock.address().port}/chat`,model:'mock',key:'FAKE_PRIVATE_KEY'};
 await api('providers/text',{token:contact.token,method:'PUT',data:cfg,status:403});await api('providers/text/check',{token:contact.token,method:'POST',data:{},status:403});
 await api('providers/text',{method:'PUT',data:{...cfg,key:'owner'},status:400});const saved=await api('providers/text',{method:'PUT',data:cfg});assert.equal(saved.text.configured,true);assert.doesNotMatch(JSON.stringify(saved),/FAKE_PRIVATE_KEY/);assert.equal((await api('state')).mode,'configured');await api('providers/text/check',{method:'POST',data:{}});assert.equal((await api('state')).providers.text.lastCheck.ok,true);assert.equal((await api('state',{token:contact.token})).providers,undefined);
 await api('providers/embedding',{method:'PUT',data:{...cfg,url:`http://127.0.0.1:${mock.address().port}/embed`}});await api('providers/embedding/check',{method:'POST',data:{}});await api('chat',{method:'POST',data:{text:'你好'}});assert.equal(requests.some(p=>p.messages?.some(m=>m.content==='你好')),true);
 fail=true;await api('providers/text/check',{method:'POST',data:{},status:502});assert.match((await api('state')).providers.text.lastCheck.message,/配额/);assert.doesNotMatch(JSON.stringify(await api('export')),/FAKE_PRIVATE_KEY/);assert.doesNotMatch(await readFile(join(dir,'data.json'),'utf8'),/FAKE_PRIVATE_KEY/);
 await api('providers/text',{method:'DELETE'});assert.equal((await api('state')).mode,'demo');assert.equal((await api('state')).messages.length,0);
 }finally{if(child?.exitCode===null){const done=new Promise(r=>child.once('exit',r));child.kill();await done;}await new Promise(r=>mock.close(r));await rm(dir,{recursive:true,force:true});}
});
