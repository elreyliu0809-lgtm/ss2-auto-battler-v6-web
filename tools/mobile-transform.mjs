export function mobileApp(code){
 const replace=(from,to)=>{if(!code.includes(from))throw Error('Frozen V6 mobile hook drift: '+from.slice(0,80));code=code.replace(from,to);};
 replace("const DEATH_SECONDS=.7;",`const DEATH_SECONDS=.7;
let assetBusy=false;
function busyControls(on){document.body.dataset.assetsBusy=String(on);for(const c of document.querySelectorAll('button,select')){if(on){c.dataset.assetDisabled=String(c.disabled);c.disabled=true;}else if(c.dataset.assetDisabled!==undefined){c.disabled=c.dataset.assetDisabled==='true';delete c.dataset.assetDisabled;}}}
async function readyState(candidate){await SS2Scene.scene(candidate,renderer);}
const portraitObserver=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){portraitObserver.unobserve(e.target);const c=e.target,id=c.dataset.portrait;SS2Scene.portrait(id,renderer).then(p=>{if(c.isConnected){c.getContext('2d').drawImage(p,0,0);c.dataset.portraitReady='true';}}).catch(err=>{if(c.isConnected){c.setAttribute('aria-label','角色资源未载入，联网后重新打开此界面可重试');setWarning(err.message);}});}},{rootMargin:'80px'});`);
 replace('function act(command){',"async function act(command){if(assetBusy)return;assetBusy=true;busyControls(true);");
 replace('state=Core.act(state,command);','const candidate=Core.act(state,command);await readyState(candidate);state=candidate;');
 replace('}catch(e){toast(e.message);}}\r\nfunction portrait',"}catch(e){toast('操作未完成，金币与本局状态已保留：'+e.message);}finally{assetBusy=false;busyControls(false);render();}}\r\nfunction portrait");
 const oldMount="function mountPortraits(){for(const img of document.querySelectorAll('.pack-emblem,.icon'))img.onerror=()=>{img.hidden=true;};for(const c of document.querySelectorAll('canvas[data-portrait]')){c.width=200;c.height=180;const p=portraits[c.dataset.portrait];if(p)c.getContext('2d').drawImage(p,0,0);else setWarning('缺少角色肖像：'+c.dataset.portrait);}}";
 replace(oldMount,"function mountPortraits(){for(const img of document.querySelectorAll('.pack-emblem,.icon'))img.onerror=()=>{img.hidden=true;};for(const c of document.querySelectorAll('canvas[data-portrait]'))if(!c.dataset.portraitObserved){c.dataset.portraitObserved='true';c.width=200;c.height=180;portraitObserver.observe(c);}}");
 const init=/imageBackground\.src='assets\/battlefield.jpg';renderer=await new SS2Renderer\(SS2_ACTORS\)\.load\(\);for\(const \[id,d\]of Object.entries\(SS2_ACTORS\)\)\{[\s\S]*?portraits\[id\]=canvas;\}\s*let loaded=Store.load\(\);state=loaded.state\|\|Core.createRun\(20261026\);/;
 if(!init.test(code))throw Error('Frozen V6 startup hook drift');code=code.replace(init,"imageBackground.src='assets/battlefield.jpg';renderer=new SS2Renderer(SS2_ACTORS);let loaded=Store.load();state=loaded.state||Core.createRun(20261026);await readyState(state);");
 replace("$('#start-new').onclick=()=>{","$('#start-new').onclick=async()=>{if(assetBusy)return;");
 replace("state=Core.createRun(seed,$('#new-pack').value);loadBlocked=false;", "assetBusy=true;busyControls(true);try{const candidate=Core.createRun(seed,$('#new-pack').value);await readyState(candidate);state=candidate;loadBlocked=false;");
 replace("$('#modal').close();};}","$('#modal').close();}catch(err){toast('新局未替换，原存档保留：'+err.message);}finally{assetBusy=false;busyControls(false);render();}};}");
 replace('candidate.webRunId??=crypto.randomUUID();state=candidate;', 'candidate.webRunId??=crypto.randomUUID();await readyState(candidate);state=candidate;');
 replace("$('#import-file').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{", "$('#import-file').onchange=async e=>{const f=e.target.files[0];if(!f||assetBusy)return;assetBusy=true;busyControls(true);try{");
 replace("}e.target.value='';};", "}finally{assetBusy=false;busyControls(false);render();}e.target.value='';};");
 for(const selector of ["$('#unit-actions').onclick=e=>{", "$('#team').ondrop=e=>{"]){const start=code.indexOf(selector);if(start<0)throw Error('Frozen V6 touch action hook drift');const end=code.indexOf('\r\n',start);const old=code.slice(start,end);code=code.slice(0,start)+old.replace('=e=>{','=async e=>{').replaceAll('act({','await act({')+code.slice(end);}
 replace('function loop(now){',"function loop(now){if(document.hidden||assetBusy){lastFrame=now;requestAnimationFrame(loop);return;}");
 replace('save();render();}catch(e){toast(\'操作未完成', 'save();}catch(e){toast(\'操作未完成');
 replace("save();render();$('#modal').close();", "save();$('#modal').close();");
 replace("resetPlayback();save();render();toast('存档已载入');", "resetPlayback();save();toast('存档已载入');");
 replace('const d=qualityRuntime(c,g),m=', 'const d=qualityRuntime(c,g),m=');
 code=code.replace("(actor?'已接入本机骨骼播放':'本次页面未取得播放资源登记')","(window.SS2_WEB_MANIFEST.actors[String(d.assetId)]?'真实资源按需载入':'本次页面未取得播放资源登记')");
 return code.replaceAll('state=candidate;','state=candidate;SS2Scene.retain(state,renderer);');
}
export function mobileRenderer(code){const old="async load(){const pages=new Set(Object.values(this.data).flatMap(d=>Object.values(d.atlas).map(x=>x.page)));await Promise.all([...pages].map(p=>new Promise((ok,no)=>{let im=new Image;im.onload=()=>{this.images[p]=im;ok();};im.onerror=()=>{this.errors.push(p);no(new Error('角色纹理缺失：'+p));};im.src=p;})));return this;}";
 if(!code.includes(old))throw Error('Frozen V6 renderer hook drift');return code.replace(old,"async load(ids=Object.keys(this.data)){this.loading??={};const pages=new Set(ids.flatMap(id=>Object.values(this.data[id].atlas).map(x=>x.page)));await Promise.all([...pages].map(async p=>{if(this.images[p])return;if(!this.loading[p])this.loading[p]=new Promise((ok,no)=>{const im=new Image;im.onload=()=>{this.images[p]=im;ok();};im.onerror=()=>no(Error('角色纹理未载入：'+p));im.src=p;}).finally(()=>delete this.loading[p]);await this.loading[p];}));return this;}");}
