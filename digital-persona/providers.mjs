const kinds=['text','embedding'];
export {endpoint as validateEndpoint};
function fail(status,message){throw Object.assign(new Error(message),{status});}
function endpoint(value){if(typeof value!=='string'||value.length>2048)fail(400,'接口URL格式或长度无效');let url;try{url=new URL(value);}catch{fail(400,'请输入完整接口URL');}if(url.username||url.password||url.search||url.hash)fail(400,'接口URL不能携带账号、密钥查询参数或片段');if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))fail(400,'远程服务必须使用HTTPS；本机测试可使用HTTP');return url.href;}
function validate(kind){if(!kinds.includes(kind))fail(404,'未知服务类型');}
function errorMessage(status){if(status===401||status===403)return '服务认证失败，请检查密钥与权限';if(status===404)return '服务地址或模型不存在';if(status===429)return '服务限流或配额不足，请稍后重试';return '模型服务请求失败（HTTP '+status+'）';}
export function createProviders({env=process.env,fetcher=fetch}={}){
 const configs={text:null,embedding:null};const checks={text:null,embedding:null};let revision=0;
 function apply(kind,input){validate(kind);if(!input||typeof input!=='object')fail(400,'服务配置无效');const url=endpoint(input.url);if(typeof input.model!=='string'||!input.model.trim()||input.model.length>200)fail(400,'模型名称无效');if(typeof input.key!=='string'||input.key.length>8192||/[\r\n]/.test(input.key))fail(400,'密钥格式无效');let key=input.key.trim();if(!key){const old=configs[kind];if(!old||new URL(old.url).origin!==new URL(url).origin)fail(400,'请为此服务填写密钥；更换服务域名时不能沿用原密钥');key=old.key;}configs[kind]={url,model:input.model.trim(),key};checks[kind]=null;revision++;return status();}
 for(const [kind,prefix] of [['text','PERSONA_API'],['embedding','PERSONA_EMBED']]){const model=kind==='text'?env.PERSONA_MODEL:env.PERSONA_EMBED_MODEL;if(env[prefix+'_URL']&&env[prefix+'_KEY']&&model)apply(kind,{url:env[prefix+'_URL'],key:env[prefix+'_KEY'],model});}
 function configured(kind='text'){validate(kind);return Boolean(configs[kind]);}
 function status(){return Object.fromEntries(kinds.map(kind=>[kind,{configured:configured(kind),url:configs[kind]?.url||'',model:configs[kind]?.model||'',lastCheck:checks[kind]}]));}
 function clear(kind){validate(kind);configs[kind]=null;checks[kind]=null;revision++;}
 async function request(kind,input,timeout=45000){validate(kind);const config=configs[kind];if(!config)fail(503,'尚未配置'+(kind==='text'?'文本模型':'向量模型'));const startedRevision=revision;let response;
 try{response=await fetcher(config.url,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',Authorization:'Bearer '+config.key},signal:AbortSignal.timeout(timeout),body:JSON.stringify({model:config.model,...input})});}catch(e){fail(502,e.name==='TimeoutError'?'模型响应超时，请重试':'无法连接模型服务，请检查地址与网络');}
 if(!response.ok)fail(502,errorMessage(response.status));let result;try{result=await response.json();}catch{fail(502,'服务未返回有效JSON');}if(revision!==startedRevision)fail(409,'服务配置已变化，请重新请求');return result;
 }
 async function chat(messages){const result=await request('text',{messages});const content=result.choices?.[0]?.message?.content;if(typeof content!=='string'||!content.trim())fail(502,'文本模型未返回有效内容');return content;}
 async function check(kind){validate(kind);const before=revision;const started=Date.now();try{if(kind==='text')await chat([{role:'user',content:'连接测试：请简短回复连接正常。'}]);else{const result=await request(kind,{input:['连接测试A','连接测试B']},15000);const data=result.data;if(!Array.isArray(data)||data.length!==2)fail(502,'向量服务返回数量无效');const sorted=[...data].sort((a,b)=>a.index-b.index);if(sorted.some((row,i)=>row.index!==i||!Array.isArray(row.embedding)||!row.embedding.length||!row.embedding.every(Number.isFinite)||!row.embedding.some(v=>v!==0))||sorted[0].embedding.length!==sorted[1].embedding.length)fail(502,'向量服务返回格式无效');}const outcome={ok:true,latencyMs:Date.now()-started,checkedAt:new Date().toISOString(),message:'固定测试内容连接成功，未使用个人记忆'};if(before===revision)checks[kind]=outcome;return outcome;}catch(e){if(before===revision)checks[kind]={ok:false,checkedAt:new Date().toISOString(),message:e.message};throw e;}}
 function embeddingOptions(){const c=configs.embedding;return c?{url:c.url,key:c.key,model:c.model}:{ };}
 return {apply,clear,status,configured,chat,check,embeddingOptions};
}
