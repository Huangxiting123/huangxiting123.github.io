import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createStore,visibleMemories} from './store.mjs';
import {createIndexedRetriever} from './vector-index.mjs';
import {rankMemories} from './multi-recall.mjs';
const options={url:'https://test.invalid/embed',model:'model-a',key:'FAKE_VECTOR_KEY'};
const memory=(id,text,extra={})=>({id,text,version:1,type:'fact',status:'confirmed',visibility:'private',contactIds:[],relatedContactIds:[],createdAt:'2000-01-01T00:00:00Z',...extra});
async function fixture(run){const dir=await mkdtemp(join(tmpdir(),'stillhere-index-'));try{const file=join(dir,'state.json');const db=createStore(file);await run(db,file);}finally{await rm(dir,{recursive:true,force:true});}}
function mock(requests){return async(_,req)=>{const input=JSON.parse(req.body).input;requests.push(input);return {ok:true,json:async()=>({data:input.map((_,index)=>({index,embedding:[1,0]}))})};};}
test('向量持久保存并在重启后复用；只计算新增或修改的记忆',async()=>fixture(async(db,file)=>{
 await db.update(s=>s.memories.push(memory('a','爸爸教我骑车')));const requests=[];let retrieve=createIndexedRetriever({db,getOptions:()=>options,fetcher:mock(requests)});let state=await db.read();let result=await retrieve(visibleMemories(state,null),'爸爸',{contextRevision:state.contextRevision});assert.equal(result.indexBuilt,1);assert.equal(result.mode,'indexed_hybrid');assert.equal(requests[0].length,2);
 const second=createStore(file);retrieve=createIndexedRetriever({db:second,getOptions:()=>options,fetcher:mock(requests)});state=await second.read();result=await retrieve(visibleMemories(state,null),'爸爸',{contextRevision:state.contextRevision});assert.equal(result.indexHits,1);assert.equal(requests[1].length,1);
 await second.update(s=>{s.memories[0].text='爸爸教我游泳';s.memories[0].version++;s.contextRevision++;});assert.equal((await second.read()).semanticIndex.rows.length,0);state=await second.read();result=await retrieve(visibleMemories(state,null),'爸爸',{contextRevision:state.contextRevision});assert.equal(result.indexBuilt,1);assert.equal(requests[2][1],'爸爸教我游泳');
 const stored=JSON.stringify((await second.read()).semanticIndex);assert.doesNotMatch(stored,/爸爸|FAKE_VECTOR_KEY/);await second.update(s=>{s.memories=[];s.contextRevision++;});assert.equal((await second.read()).semanticIndex.rows.length,0);
}));
test('已缓存私密向量不进入联系人召回，分享撤销后也不复用',async()=>fixture(async db=>{
 await db.update(s=>s.memories.push(memory('private','PRIVATE_MEMORY'),memory('shared','和家人看海',{visibility:'shared',contactIds:['c']})));const requests=[];const retrieve=createIndexedRetriever({db,getOptions:()=>options,fetcher:mock(requests)});let s=await db.read();await retrieve(visibleMemories(s,null),'回忆',{contextRevision:s.contextRevision});s=await db.read();const r=await retrieve(visibleMemories(s,'c'),'海',{contactId:'c',contextRevision:s.contextRevision});assert.equal(r.memories.length,1);assert.equal(r.memories[0].id,'shared');assert.deepEqual(requests.at(-1),['海']);await db.update(s=>{s.memories[1].contactIds=[];s.memories[1].version++;s.contextRevision++;});s=await db.read();assert.equal((await retrieve(visibleMemories(s,'c'),'海',{contactId:'c',contextRevision:s.contextRevision})).memories.length,0);assert.equal(s.semanticIndex.rows.some(r=>r.id==='shared'),false);
}));
test('模型切换隔离索引；语义服务失败时回退多路检索',async()=>fixture(async db=>{
 await db.update(s=>s.memories.push(memory('a','爸爸教我骑车')));let config={...options};const requests=[];const retrieve=createIndexedRetriever({db,getOptions:()=>config,fetcher:mock(requests)});let s=await db.read();await retrieve(visibleMemories(s,null),'爸爸',{contextRevision:s.contextRevision});const fp=(await db.read()).semanticIndex.fingerprint;config={...options,model:'model-b'};s=await db.read();const result=await retrieve(visibleMemories(s,null),'爸爸',{contextRevision:s.contextRevision});assert.equal(result.indexBuilt,1);assert.notEqual((await db.read()).semanticIndex.fingerprint,fp);
 const failed=createIndexedRetriever({db,getOptions:()=>config,fetcher:async()=>{throw Error('failure');}});s=await db.read();assert.equal((await failed(visibleMemories(s,null),'爸爸',{contextRevision:s.contextRevision})).mode,'keyword_fallback');
}));
test('索引构建途中删除记忆会拒绝旧请求，不写回旧向量或返回旧内容',async()=>fixture(async db=>{
 await db.update(s=>s.memories.push(memory('a','旧记忆')));let release;let started;const signal=new Promise(r=>started=r);const retrieve=createIndexedRetriever({db,getOptions:()=>options,fetcher:async()=>{started();return new Promise(r=>release=r);}});const s=await db.read();const pending=retrieve(visibleMemories(s,null),'旧',{contextRevision:s.contextRevision});await signal;await db.update(s=>{s.memories=[];s.contextRevision++;});release({ok:true,json:async()=>({data:[{index:0,embedding:[1,0]},{index:1,embedding:[1,0]}]})});await assert.rejects(pending,e=>e.status===409);assert.equal((await db.read()).semanticIndex?.rows?.length||0,0);
}));
test('分批构建索引时每次最多32项，不触发旧200条限制',async()=>fixture(async db=>{
 await db.update(s=>{for(let i=0;i<205;i++)s.memories.push(memory('m'+i,'测试记忆'+i));});const requests=[];const retrieve=createIndexedRetriever({db,getOptions:()=>options,fetcher:mock(requests)});const s=await db.read();const r=await retrieve(visibleMemories(s,null),'测试',{contextRevision:s.contextRevision});assert.equal(r.indexBuilt,205);assert.equal((await db.read()).semanticIndex.rows.length,205);assert.ok(requests.every(x=>x.length<=32));assert.equal(r.memories.length,6);
}));
test('关系和近期排序不扩大权限，也不会让无关近期经历替代重要往事',()=>{
 const now=Date.parse('2026-11-04T00:00:00Z');const old=memory('old','爸爸教我骑自行车');const linked=memory('linked','爸爸教我骑自行车',{relatedContactIds:['c']});const fresh=memory('new','今天吃了苹果',{createdAt:'2026-11-03T00:00:00Z'});let r=rankMemories([old,linked,fresh],'爸爸骑车',{contactId:'c',now});assert.equal(r.memories[0].id,'linked');assert.equal(r.memories.some(m=>m.id==='new'),false);assert.ok(r.trace[0].routes.includes('relationship'));r=rankMemories([memory('p','爱喝茶',{type:'preference',createdAt:'2026-11-03T00:00:00Z'})],'最近有什么偏好',{now});assert.equal(r.memories.length,1);assert.ok(r.trace[0].routes.includes('recent'));assert.equal(rankMemories([fresh],'足球',{now}).memories.length,0);
});
