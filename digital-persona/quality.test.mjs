import test from 'node:test';
import assert from 'node:assert/strict';
import {reviews,relation,normalize,safeCandidates} from './memory-quality.mjs';
import {visibleMemories} from './store.mjs';
test('重复内容、同事项冲突、跨时间区分与不覆盖来源',()=>{
 const a={id:'a',text:'我住北京',type:'fact',status:'confirmed',factKey:'居住城市/2020'};
 const duplicate={...a,id:'b',text:'我住北京。'};const conflict={...a,id:'c',text:'我住上海'};
 assert.equal(relation(a,duplicate),'duplicate');assert.equal(relation(a,conflict),'conflict');assert.equal(relation(a,{...conflict,factKey:'居住城市/2021'}),null);assert.equal(reviews([a,duplicate,conflict]).length,3);
 assert.deepEqual(safeCandidates([a,conflict]),[]);assert.deepEqual(safeCandidates([a,{...conflict,status:'pending'}]),[a]);assert.equal(safeCandidates([a,duplicate]).length,1);assert.equal(a.text,'我住北京');
 assert.notEqual(normalize('体重12.5'),normalize('体重125'));assert.notEqual(normalize('温度-10'),normalize('温度10'));
});
test('私密冲突不向其他联系人透露；归档记录不召回',()=>{
 const a={id:'a',text:'住北京',factKey:'住址',status:'confirmed',visibility:'shared',contactIds:['a'],type:'fact'};const b={...a,id:'b',text:'住上海',visibility:'private'};
 assert.equal(visibleMemories({memories:[a,b]},'a').length,1);assert.equal(visibleMemories({memories:[a,b]},null).length,0);assert.equal(visibleMemories({memories:[{...a,status:'archived'}]},'a').length,0);
});
