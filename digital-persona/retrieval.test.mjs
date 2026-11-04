import test from 'node:test';
import assert from 'node:assert/strict';
import {createRetriever,cosine} from './retrieval.mjs';
import {visibleMemories} from './store.mjs';
test('语义召回同义表达；仅发送授权、已确认记录；删除后无缓存复活',async()=>{
 const memories=[{id:'allowed',text:'喜欢喝茶',status:'confirmed',visibility:'shared',contactIds:['a'],type:'preference'},{id:'private',text:'PRIVATE_SECRET',status:'confirmed',visibility:'private',contactIds:[],type:'fact'},{id:'pending',text:'PENDING_SECRET',status:'pending',visibility:'shared',contactIds:['a'],type:'fact'}];let inputs=[];
 const retrieve=createRetriever({url:'http://mock',key:'test',model:'test',fetcher:async(_,req)=>{inputs=JSON.parse(req.body).input;return {ok:true,json:async()=>({data:inputs.map((_,index)=>({index,embedding:[1,0]})).reverse()})};}});
 let result=await retrieve(visibleMemories({memories},'a'),'有什么饮品偏好');assert.equal(result.mode,'hybrid');assert.equal(result.memories[0].id,'allowed');assert.deepEqual(inputs,['有什么饮品偏好','喜欢喝茶']);
 memories.splice(0,1);result=await retrieve(visibleMemories({memories},'a'),'有什么饮品偏好');assert.equal(result.memories.length,0);
 assert.equal(cosine([1,0],[1,0]),1);assert.throws(()=>cosine([1],[1,2]));
});
test('未配置、上游失败和畸形向量可回退；相似度过低不注入无关记忆',async()=>{
 const m=[{id:'a',text:'喜欢喝茶'}];assert.equal((await createRetriever({})(m,'茶')).mode,'keyword');
 for(const fetcher of [async()=>{throw Error('network');},async()=>({ok:false}),async()=>({ok:true,json:async()=>({data:[{index:0,embedding:[1]}]})})]){const r=await createRetriever({url:'mock',key:'x',model:'x',fetcher})(m,'茶');assert.equal(r.mode,'keyword_fallback');assert.equal(r.memories[0].id,'a');}
 const r=await createRetriever({url:'mock',key:'x',model:'x',fetcher:async()=>({ok:true,json:async()=>({data:[{index:0,embedding:[1,0]},{index:1,embedding:[0,1]}]})})})(m,'足球');assert.equal(r.memories.length,0);
});
