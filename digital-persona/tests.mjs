import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createStore,recall} from './store.mjs';
test('读操作等待已排队的修改完成，避免读写交叉',async()=>{const dir=await mkdtemp(join(tmpdir(),'persona-read-'));try{const db=createStore(join(dir,'state.json'));let release;const gate=new Promise(r=>release=r);const update=db.update(async s=>{await gate;s.profile.name='已修改';});const read=db.read();release();await update;assert.equal((await read).profile.name,'已修改');}finally{await rm(dir,{recursive:true,force:true});}});
test('并发保存不会丢失记忆，重建实例后仍可读取',async()=>{const dir=await mkdtemp(join(tmpdir(),'persona-'));try{const file=join(dir,'data.json');const db=createStore(file);await Promise.all(Array.from({length:30},(_,i)=>db.update(s=>s.memories.push({id:i,text:`记忆${i}`}))));assert.equal((await createStore(file).read()).memories.length,30);}finally{await rm(dir,{recursive:true,force:true});}});
test('检索关联记忆并排除无关内容',()=>{const memories=[{id:'a',text:'小时候和爸爸在杭州看西湖'},{id:'b',text:'喜欢喝咖啡'}];assert.deepEqual(recall(memories,'爸爸'),[memories[0]]);assert.deepEqual(recall(memories,'足球'),[]);});
