/* Presentation resource planning and bounded image work; no Core/Store/RNG. */
(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.SS2SceneResources=value;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
function actorIds(state,lookup){const ids=new Set();for(const u of [...(state.team||[]),...(state.phase==='shop'?(state.shop?.units||[]):[])]){if(!u)continue;const def=lookup(u.id)||{},id=u.assetId||def.assetId;if(!id)throw Error('当前人物没有资源登记：'+u.id);ids.add(String(id));}return [...ids].sort();}
function key(state,lookup){return state.packId+':'+actorIds(state,lookup).join(',');}
function createQueue(limit){if(!Number.isInteger(limit)||limit<1)throw Error('Invalid resource concurrency');const waiting=[];let active=0;function pump(){while(active<limit&&waiting.length){const job=waiting.shift();active++;Promise.resolve().then(job.work).then(job.resolve,job.reject).finally(()=>{active--;pump();});}}return work=>new Promise((resolve,reject)=>{waiting.push({work,resolve,reject});pump();});}
const imageQueue=createQueue(3);
async function loadRenderer(renderer,{reuse={},valid=()=>true,progress=()=>{},imageFactory=()=>new Image(),timeoutMs=20000,urlFor=p=>p}={}){
 const pages=[...new Set(Object.values(renderer.data).flatMap(d=>Object.values(d.atlas).map(a=>a.page)))];let done=0,failure=null;const current=()=>!failure&&valid();
 const finished=(p,im)=>{if(!current())throw Error('画面准备已取消');renderer.images[p]=im;progress({phase:'textures',done:++done,total:pages.length});};
 await Promise.all(pages.map(p=>imageQueue(async()=>{if(!current())throw failure||Error('画面准备已取消');const cached=reuse?.[p];if(cached?.complete&&cached.naturalWidth>0){finished(p,cached);return;}try{const im=await new Promise((resolve,reject)=>{const image=imageFactory();let ended=false;const timer=setTimeout(()=>complete(Error('角色纹理载入超时：'+p)),timeoutMs);function complete(error){if(ended)return;ended=true;clearTimeout(timer);image.onload=image.onerror=null;if(error){image.removeAttribute?.('src');reject(error);}else resolve(image);}image.onload=()=>complete(image.naturalWidth>0?null:Error('角色纹理无有效尺寸：'+p));image.onerror=()=>complete(Error('角色纹理缺失：'+p));image.src=urlFor(p);});finished(p,im);}catch(e){failure??=e;if(/^角色纹理/.test(e.message)&&!renderer.errors.includes(p))renderer.errors.push(p);throw e;}})));
 if(failure)throw failure;if(!valid())throw Error('画面准备已取消');return renderer;
}
return Object.freeze({actorIds,key,createQueue,loadRenderer,imageConcurrency:3});
});

