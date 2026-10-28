'use strict';
const BASE=new URL('./',self.location.href), NS='ss2-v6-web:'+BASE.pathname+':', OBJECTS=NS+'objects', META=NS+'meta', SHELL=NS+'shell-v1';
const url=p=>new URL(p,BASE).href;
const key=url('__release_state__');
const hex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
async function read(){const r=await (await caches.open(META)).match(key);return r?r.json():{active:null,previous:null,pending:null,releases:{}};}
async function write(s){await(await caches.open(META)).put(key,new Response(JSON.stringify(s),{headers:{'Content-Type':'application/json'}}));}
self.addEventListener('install',e=>e.waitUntil((async()=>{const prepared=[];for(const p of ['','index.html','bootstrap.js']){const r=await fetch(url(p),{cache:'reload'});if(!r.ok)throw Error('启动页下载失败');prepared.push([url(p),r]);}const c=await caches.open(SHELL);for(const [p,r]of prepared)await c.put(p,r);})()));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(u.origin!==BASE.origin||!u.href.startsWith(BASE.href)||e.request.method!=='GET')return;
 if(u.pathname.includes('/objects/'))e.respondWith((async()=>{const c=await caches.open(OBJECTS),r=await c.match(e.request);return r||fetch(e.request);})());
 else if(e.request.mode==='navigate'||u.pathname.endsWith('/bootstrap.js'))e.respondWith((async()=>{const c=await caches.open(SHELL);const r=await c.match(e.request,{ignoreSearch:true});return r||fetch(e.request);})());
});
let preparing=null;
async function prepare(port){const response=await fetch(url('release.json'),{cache:'no-store'});if(!response.ok)throw Error('版本检查失败：'+response.status);const m=await response.json();
 if(m.schema!==1||!/^v6-web-[a-zA-Z0-9.-]+$/.test(m.id)||!Array.isArray(m.files)||m.files.length>300||!Array.isArray(m.scripts)||!m.files.some(f=>f.path===m.css)||m.scripts.some(p=>!m.files.some(f=>f.path===p)))throw Error('版本清单不合法');
 let total=0;const paths=new Set();for(const f of m.files){if(!/^objects\/[a-f0-9]{64}\.(js|css|svg|png|jpg)$/.test(f.path)||!f.path.includes(f.sha256)||!Number.isSafeInteger(f.size)||f.size<0||f.size>20000000||paths.has(f.path))throw Error('资源清单不合法');paths.add(f.path);total+=f.size;}if(total>100000000)throw Error('资源包超限');
 const c=await caches.open(OBJECTS);let done=0,downloaded=0,reused=0;
 for(const f of m.files){let r=await c.match(url(f.path));if(r){reused+=f.size;}else{r=await fetch(url(f.path),{cache:'no-store'});if(!r.ok)throw Error('资源下载中断：'+r.status);const b=await r.arrayBuffer();if(b.byteLength!==f.size||hex(await crypto.subtle.digest('SHA-256',b))!==f.sha256)throw Error('资源校验失败：'+f.path);await c.put(url(f.path),new Response(b,{headers:{'Content-Type':r.headers.get('Content-Type')||'application/octet-stream'}}));downloaded+=b.byteLength;}
 done+=f.size;port.postMessage({progress:true,done,total,downloaded,reused});}
 const s=await read();if(s.releases[m.id]&&JSON.stringify(s.releases[m.id])!==JSON.stringify(m))throw Error('相同发行编号禁止改写');s.releases[m.id]=m;if(!s.active)s.active=m.id;else if(s.active!==m.id)s.pending=m.id;await write(s);return {...s,downloaded,reused};
}
self.addEventListener('message',e=>{const port=e.ports[0];if(!port)return;e.waitUntil((async()=>{try{const t=e.data?.type;if(t==='STATUS')port.postMessage({ok:true,state:await read()});else if(t==='PREPARE'){if(!preparing)preparing=prepare(port).finally(()=>{preparing=null;});port.postMessage({ok:true,state:await preparing});}else if(t==='ACTIVATE'||t==='ROLLBACK'){const s=await read(),target=t==='ACTIVATE'?s.pending:s.previous;if(!target||!s.releases[target])throw Error('没有完整可切换版本');for(const f of s.releases[target].files)if(!await(await caches.open(OBJECTS)).match(url(f.path)))throw Error('目标版本缓存不完整');const old=s.active;s.active=target;s.previous=old;s.pending=null;await write(s);port.postMessage({ok:true,state:s});}else throw Error('未知缓存操作');}catch(error){port.postMessage({ok:false,error:error.message});}})());});
