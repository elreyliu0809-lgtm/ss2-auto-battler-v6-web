'use strict';
const status=document.getElementById('web-status'), update=document.getElementById('web-update'), rollback=document.getElementById('web-rollback');
let controller,cacheState;
function request(type,onProgress){return new Promise((resolve,reject)=>{const channel=new MessageChannel(),timer=setTimeout(()=>reject(Error('资源准备超时，请重开后继续下载')),180000);channel.port1.onmessage=e=>{if(e.data.progress){onProgress?.(e.data);return;}clearTimeout(timer);channel.port1.close();e.data.ok?resolve(e.data.state):reject(Error(e.data.error));};controller.postMessage({type},[channel.port2]);});}
const SAVE_KEY='ss2.v6-web:'+new URL('./',location.href).pathname+'save';
function saved(){try{const e=JSON.parse(localStorage.getItem(SAVE_KEY));return e?JSON.parse(e.payload):null;}catch{return null;}}
function safe(){const s=saved();return !s||s.phase==='over'||(s.phase==='shop'&&s.turn===1&&!s.team.length&&!s.history.length);}
async function switchVersion(type){if(!safe()){status.textContent='更新已备妥，请结束当前整局后再切换；当前局继续使用原版本。';return;}try{await request(type);const s=saved();if(s){delete s.webRelease;const text=SS2Storage.exportSave(s);localStorage.setItem(SS2Storage.KEY,text);}location.reload();}catch(e){status.textContent=e.message;}}
update.onclick=()=>switchVersion('ACTIVATE');rollback.onclick=()=>switchVersion('ROLLBACK');
async function load(m){window.SS2_WEB_RELEASE=m.id;window.SS2_WEB_RULES=m.rules;window.SS2_ACTORS={};const css=document.createElement('link');css.rel='stylesheet';css.href=m.css;document.head.append(css);for(const src of m.scripts)await new Promise((ok,no)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>no(Error('载入失败：'+src));document.body.append(s);});document.body.dataset.webRelease=m.id;}
function showReady(s){cacheState=s;update.hidden=!s.pending;rollback.hidden=!s.previous;status.textContent='V6 · '+window.SS2_WEB_RELEASE+' · 离线资源已就绪'+(s.pending?' · 新版已下载，整局结束后可切换':'');}
(async()=>{try{if(!('serviceWorker'in navigator)||!window.isSecureContext)throw Error('请使用HTTPS或本机localhost打开');await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(ok=>navigator.serviceWorker.addEventListener('controllerchange',ok,{once:true}));controller=navigator.serviceWorker.controller;
 cacheState=await request('STATUS');if(!cacheState.active){status.textContent='首次准备离线资源…';cacheState=await request('PREPARE',p=>{status.textContent='首次下载 '+(p.done/1048576).toFixed(1)+' / '+(p.total/1048576).toFixed(1)+' MB · '+Math.floor(p.done/p.total*100)+'%';});}
 const s=saved(),pinned=s&&s.phase!=='over'?s.webRelease:null,m=cacheState.releases[pinned||cacheState.active];if(!m)throw Error('当前局对应版本不在本机，请导出存档后恢复对应发行包');await load(m);showReady(cacheState);
 if(navigator.storage?.persist){const persistent=await navigator.storage.persist();status.title=persistent?'浏览器已允许持久存储':'浏览器可能回收缓存；可通过导出保留存档。';}
 try{showReady(await request('PREPARE'));}catch(e){status.textContent='继续使用本机 '+m.id+' · 版本检查/下载未完成：'+e.message;}
 }catch(e){status.textContent='载入未完成：'+e.message+'。联网后重开可继续下载。';document.getElementById('warning').hidden=false;document.getElementById('warning').textContent=status.textContent;console.error(e.message);}})();
