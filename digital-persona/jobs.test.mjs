import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {archiveConversation,createWorker} from './jobs.mjs';
import {createStore} from './store.mjs';
const extracted=JSON.stringify({memories:[{text:'喜欢喝茶',quote:'我喜欢喝茶',type:'preference',confidence:.9}]});
async function until(check){const end=Date.now()+3000;while(Date.now()<end){const value=await check();if(value)return value;await new Promise(r=>setTimeout(r,5));}throw Error('等待状态超时');}
async function fixture(run){const dir=await mkdtemp(join(tmpdir(),'persona-jobs-'));const db=createStore(join(dir,'state.json'));const workers=[];try{await run(db,args=>{const w=createWorker({db,...args});workers.push(w);return w;});}finally{workers.forEach(w=>w.close());await new Promise(r=>setTimeout(r,20));await rm(dir,{recursive:true,force:true});}}
test('自动归档只包含用户原话，按身份区分陈述者，可关闭',async()=>fixture(async db=>{
 await db.update(s=>{const user={id:'msg1',text:'我喜欢喝茶',contactId:null,createdAt:new Date().toISOString()};const source=archiveConversation(s,user);assert.equal(source.text,user.text);assert.equal(source.speaker,'self');assert.equal(source.status,'new');s.settings.autoExtract=true;assert.equal(archiveConversation(s,{...user,id:'msg2',contactId:'contact'}).speaker,'other');s.settings.autoArchive=false;assert.equal(archiveConversation(s,user),null);});assert.equal((await db.read()).sources.length,2);
}));
test('队列暂停、失败后显式重试和防重复处理',async()=>fixture(async(db,worker)=>{
 let calls=0;let valid=false;await db.update(s=>{s.settings.autoExtract=true;s.settings.queuePaused=true;archiveConversation(s,{id:'x',text:'我喜欢喝茶',contactId:null,createdAt:new Date().toISOString()});});
 const w=worker({configured:true,request:async()=>{calls++;if(!valid)throw Error('测试模型暂不可用');return extracted;}});await w.recover();assert.equal((await db.read()).sources[0].status,'queued');assert.equal(calls,0);
 await db.update(s=>s.settings.queuePaused=false);w.kick();await until(async()=>(await db.read()).sources[0].status==='failed');assert.equal((await db.read()).memories.length,0);assert.equal(calls,1);
 valid=true;await db.update(s=>s.sources[0].status='queued');w.kick();w.kick();await until(async()=>(await db.read()).sources[0].status==='extracted');const state=await db.read();assert.equal(state.sources[0].attempts,2);assert.equal(state.memories.length,1);assert.equal(state.memories[0].status,'pending');assert.equal(state.memories[0].visibility,'private');assert.equal(calls,2);
}));
test('重启恢复中断任务；未配置模型时保持原文并等待',async()=>fixture(async(db,worker)=>{
 await db.update(s=>s.sources.push({id:'recover',text:'我喜欢喝茶',title:'中断访谈',speaker:'self',status:'running'}));let calls=0;const w=worker({configured:false,request:async()=>{calls++;return extracted;}});await w.recover();await until(async()=>(await db.read()).sources[0].status==='waiting_model');assert.equal(calls,0);assert.equal((await db.read()).sources[0].text,'我喜欢喝茶');
}));
test('原文在抽取请求期间被删除，不会复活派生记忆',async()=>fixture(async(db,worker)=>{
 await db.update(s=>s.sources.push({id:'gone',text:'我喜欢喝茶',title:'待删除',speaker:'self',status:'queued'}));let release;const started=new Promise(resolve=>{const w=worker({configured:true,request:()=>new Promise(r=>{release=r;resolve();})});w.kick();});await started;
 await db.update(s=>{s.sources=[];});release(extracted);await new Promise(r=>setTimeout(r,30));assert.equal((await db.read()).memories.length,0);assert.equal((await db.read()).sources.length,0);
}));
