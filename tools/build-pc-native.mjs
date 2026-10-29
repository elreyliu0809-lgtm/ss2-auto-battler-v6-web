import fs from'node:fs';import path from'node:path';import crypto from'node:crypto';import vm from'node:vm';import{createRequire}from'node:module';import{execFileSync}from'node:child_process';
const inputSpec=JSON.parse(fs.readFileSync(process.argv[2]||'F:/AI_TEMP/scratch/20261029-ss2-pc-web-consumption/current-input.json','utf8'));
const repo=path.resolve(import.meta.dirname,'..'),input=inputSpec.root,out=inputSpec.publisherOut||'F:/AI_TEMP/exports/SS2-AUTO-BATTLER/PC-WEB-CONSUMPTION-20261029/publisher',pub=repo+'/public',id=inputSpec.release||'v6-web-pc-consumption-r2';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),src=p=>fs.readFileSync(input+'/'+p,'utf8'),files=[],mapping={},actors={},equivalence=[],sourceTransforms=[];
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(pub+'/objects',{recursive:true});
const manifest=JSON.parse(src('manifest.json'));for(const f of manifest.files){const b=fs.readFileSync(input+'/'+f.path);if(b.length!==f.size||sha(b)!==f.sha256)throw Error('Frozen input drift '+f.path);}
function put(b,ext,label){b=Buffer.from(b);const h=sha(b),p='objects/'+h+'.'+ext;if(fs.existsSync(pub+'/'+p)&&sha(fs.readFileSync(pub+'/'+p))!==h)throw Error('Object collision');fs.writeFileSync(pub+'/'+p,b);if(!files.some(f=>f.path===p))files.push({path:p,size:b.length,sha256:h,label});return p;}
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
for(const p of walk(input+'/assets').filter(p=>(/\.(png|jpg|svg)$/.test(p)||p.replaceAll('\\','/').endsWith('/assets/ui-battle-stats/provenance.json')))){const rel=path.relative(input,p).replaceAll('\\','/');mapping[rel]=put(fs.readFileSync(p),path.extname(p).slice(1),rel);}
const cx={window:{}};vm.runInNewContext(src('assets/actors.js'),cx,{timeout:5000});
for(const[actorId,info]of Object.entries(cx.window.SS2_ACTORS)){const code=src(info.lazyDataPath).trim(),parsed=code.match(/^window\.SS2_ACTORS\[("\d+")\]=JSON\.parse\(("[\s\S]*")\);$/);if(!parsed||JSON.parse(parsed[1])!==actorId)throw Error('Actor data format '+actorId);const original=JSON.parse(JSON.parse(parsed[2])),a=structuredClone(original);for(const t of Object.values(a.atlas)){t.page=mapping['assets/actors/'+t.page];if(!t.page)throw Error('Missing texture');}const script=put('window.SS2_ACTORS['+JSON.stringify(actorId)+']='+JSON.stringify(a)+';\n','js','actor:'+actorId);actors[actorId]={script,textures:[...new Set(Object.values(a.atlas).map(t=>t.page))],format:info.format};const back=structuredClone(a);for(const[k,t]of Object.entries(back.atlas))t.page=original.atlas[k].page;if(JSON.stringify(back)!==JSON.stringify(original))throw Error('Actor semantic drift');equivalence.push({id:actorId,source:sha(JSON.stringify(original)),reconstructed:sha(JSON.stringify(back)),script});}
function assets(text,css=false){for(const[from,to]of Object.entries(mapping).sort((a,b)=>b[0].length-a[0].length))text=text.split(from).join(css?'./'+path.basename(to):to);return text;}
function appTransform(code){
 const once=(a,b)=>{if(!code.includes(a))throw Error('Product hook drift '+a.slice(0,70));code=code.replace(a,b);};
 once("const actorIndex=Object.fromEntries(Object.entries(SS2_ACTORS));", "const actorIndex=Object.fromEntries(Object.entries(SS2_ACTORS));\nfunction webState(s){s.webRelease??=SS2_WEB_RELEASE;s.webRules??=SS2_WEB_RULES;s.webRunId??=crypto.randomUUID();return s;}\n");
 code=code.split("/^assets\\/actor-data\\/\\d+\\.js$/").join("/^objects\\/[a-f0-9]{64}\\.js$/");
 if(code.includes('^assets\\/actor-data'))throw Error('Unadapted actor guard');
 code=code.replaceAll('Mobile.persist(next,Store)','Mobile.persist(webState(next),Store)').replaceAll('Mobile.persist(state,Store)','Mobile.persist(webState(state),Store)');
 once('state=loaded.state||Core.createRun(20261028,P.RECOMMENDED_PACK_ID||mainPacks()[0]?.id||P.DEFAULT_PACK_ID);','state=loaded.state||Core.createRun(20261028,P.RECOMMENDED_PACK_ID||mainPacks()[0]?.id||P.DEFAULT_PACK_ID);if(loaded.state&&!state.webRelease)Mobile.persist(webState(state),Store);');
 once("render();if(state.phase==='battle'){resumePending=true;", "render();window.SS2_WEB_UI_READY?.();if(state.phase==='battle'){resumePending=true;");
 if(code.includes('document.body.dataset.sceneAssets=loading?'))once("const loading=status.state==='loading',failed=status.state==='failed';", "const loading=status.state==='loading',failed=status.state==='failed';if(loading||failed)window.SS2_WEB_UI_READY?.();");
 once("setWarning('游戏载入失败：'", "window.SS2_WEB_UI_READY?.();setWarning('游戏载入失败：'");
 once('async function adoptRun(next){if(battleGate.busy)return false;',"async function adoptRun(next){if(battleGate.busy)return false;if(await window.SS2_RESUME_SAVE(Store.exportSave(next)))return false;");
 once("if(command.type==='FINISH_BATTLE'){ghosts=[];", "if(command.type==='FINISH_BATTLE'){SS2Lineups.finish(state);ghosts=[];");
 once("modelsReady=next.phase==='battle'&&!!bundle;", "if(command.type==='BATTLE')SS2Lineups.record(state);modelsReady=next.phase==='battle'&&!!bundle;");
 // Keep the source portrait mounting: native mobile uses real heads, PC now uses
 // the approved real head portraits. No UI fixture or replacement rendering is injected.
 return code;
}
const sourceIndex=src('index.html'),scriptSources=[...sourceIndex.matchAll(/<script src="([^"]+)"><\/script>/g)].map(x=>x[1]);
if(scriptSources.at(-1)!=='src/app.js'||!scriptSources.includes('src/sap-core-v2.js')||!scriptSources.includes('src/legacy-player-copy.js'))throw Error('Index script dependency drift');
const mini=Object.fromEntries(Object.entries(actors).map(([k,a])=>[k,{lazyDataPath:a.script,format:a.format}]));
const scripts=[];
for(const p of scriptSources){let code=p==='assets/actors.js'?'window.SS2_ACTORS='+JSON.stringify(mini)+';':src(p);const original=code;
 if(p==='src/storage.js'){if(!code.includes("KEY='ss2.local.v1.save'"))throw Error('Storage hook drift');code=code.replace("KEY='ss2.local.v1.save'","KEY='ss2.v6-web:'+new URL('./',location.href).pathname+'save'");}
 if(p==='src/actor.js'){const old="im.src=this.imageBase+p;";if(code.includes(old))code=code.replace(old,'im.src=p;');else if(!code.includes('return global.SS2SceneResources.loadRenderer(this,options);'))throw Error('Renderer load delegation drift');}
 if(p==='src/scene-resources.js'){const a='urlFor=p=>renderer.imageBase+p';if(code.split(a).length!==2)throw Error('Scene URL hook drift');code=code.replace(a,'urlFor=p=>p');}
 if(p==='src/app.js')code=appTransform(code);
 if(p==='src/battle-feedback.js'){const anchor="icon:'assets/ui-feedback/'+kind+'.svg'";if(!code.includes(anchor))throw Error('Feedback URL anchor drift');code=code.replace(anchor,"icon:(globalThis.SS2_ASSET_URL?.['assets/ui-feedback/'+kind+'.svg']||'assets/ui-feedback/'+kind+'.svg')");}
 code=assets(code);sourceTransforms.push({path:p,sourceSHA256:sha(src(p)),webSHA256:sha(code),kind:p==='src/app.js'?'Resource paths, startup visibility, web save metadata and historical resume/lineup hooks; native portrait/UI logic preserved':p==='src/storage.js'?'Web namespace only':p==='src/actor.js'?'Texture URL only':'Asset URLs or unchanged'});
 if(p==='src/app.js'){
  let l=fs.readFileSync(repo+'/web/lineups-v8.js','utf8');
  l=l.replace("if(!spec||r.content!==spec.content||r.packVersion!==spec.version)","if(!spec||!((r.content===spec.content&&r.packVersion===spec.version)||(r.packId.startsWith('sap-turtle-')&&['sap-turtle-26131463-v1','sap-turtle-26131463-v2','sap-turtle-26131463-v3'].includes(r.content)&&r.packVersion===r.content)))");
  l=l.replace('s.team=clone(r.team);s.turn=r.turn;', 's.version=r.content;s.packVersion=r.packVersion;s.team=clone(r.team);s.turn=r.turn;').replace('content:spec.content,packId:r.packId,packVersion:spec.version','content:r.content,packId:r.packId,packVersion:r.packVersion');
  l=l.replace('当前V8规则与旧V6公共后端不同。本版阵容仅保存在本机，未自动上传，也不会混入旧版公共敌阵。继续历史V6整局时，原主动同意上传能力仍保留。','本版出战记录只保存在当前设备，可导出保留；不会上传，也不会混入其他版本的对手。').replace("document.querySelector('.web-toolbar')?.append(bar);","document.querySelector('#web-settings-slot')?.append(bar);");
  const lossAnchor='s.lives=r.lives;root.SS2Core.validateState(s);';if(!l.includes(lossAnchor))throw Error('Lineup validation anchor drift');l=l.replace(lossAnchor,"s.lives=r.lives;if(typeof s.lossPoints==='number')s.lossPoints=5-r.lives;root.SS2Core.validateState(s);");
  scripts.push(put(l,'js','web/lineups-v8.js'));
 }
 scripts.push(put(code,'js',p));
}
const legacyGroupPins={};for(const n of fs.readdirSync(repo+'/releases')){const old=JSON.parse(fs.readFileSync(repo+'/releases/'+n));if(old.rules==='v8-06720db5aec4b9a50ce7edf8')legacyGroupPins[old.id]={rules:old.rules,scripts:old.scripts};}
const legacyGroupScript=put(fs.readFileSync(repo+'/web/legacy-upgrade-groups.js'),'js','web/legacy-upgrade-groups.js');
const css=put(assets(src('styles.css'),true)+'\n.web-toolbar{display:flex;gap:8px;flex-wrap:wrap;font-size:13px}.web-toolbar button{min-height:44px}.web-toolbar [hidden]{display:none!important}.catalog-head{width:80px;height:80px;object-fit:contain}.web-first-load{padding:16px;background:#fff8e8;color:#17383e}\n','css','styles.css');
const require=createRequire(import.meta.url),P=require(input+'/src/packs.js'),Core=require(input+'/src/core.js');
const compatibility={packs:Object.fromEntries(P.listPacks().filter(p=>p.status==='playable').map(p=>[p.id,{version:p.version,content:Core.createRun(0,p.id).version,units:p.unitIds.length,ruleSet:p.ruleset||'legacy-adaptation'}]))};
const logic=scriptSources.filter(p=>/core|content|effects|opponents|packs|source-data/.test(p)),rules='v8-rules-uiux-'+sha(logic.map(p=>src(p)).join('\n')).slice(0,24);
const previousBytes=fs.readFileSync(repo+'/docs/release.json'),previous=JSON.parse(previousBytes);fs.mkdirSync(repo+'/releases',{recursive:true});
const pp=repo+'/releases/'+previous.id+'.json';if(fs.existsSync(pp)&&!fs.readFileSync(pp).equals(previousBytes))throw Error('Historical release collision');fs.writeFileSync(pp,previousBytes);
const legacyReleases=[];fs.mkdirSync(pub+'/releases',{recursive:true});for(const n of fs.readdirSync(repo+'/releases')){const b=fs.readFileSync(repo+'/releases/'+n),m=JSON.parse(b);fs.writeFileSync(pub+'/releases/'+n,b);legacyReleases.push({id:m.id,path:'releases/'+n,sha256:sha(b)});}
const bootFiles=files.filter(f=>!f.label.startsWith('actor:')&&!f.label.startsWith('assets/actors/')&&!f.label.startsWith('assets/portraits/')&&!f.label.startsWith('assets/items-v8/')&&!f.label.includes('redgold-pack-emblem')).map(f=>f.path);
const release={schema:2,id,title:'少年演武 · 主题演武',mode:'scene-v1',rules,content:'MULTIVERSION_NATIVE_SOURCE_AND_THEMATIC_R2',sourceZipSha256:inputSpec.sha256,css,scripts,files,bootFiles,actors,assetUrls:mapping,compatibility,backend:{upload:'unsupported-rules-local-only'},legacyReleases,sourceRendererSha256:sha(src('src/actor.js')),sourceTimelineSha256:sha(src('src/timeline-actor.js'))};
if(files.length>1200||files.reduce((n,f)=>n+f.size,0)>600000000)throw Error('Loader budget exceeded');
const shells={[id]:sourceIndex};for(const[commit]of [['147ba57'],['34c3f64'],['2f6ba10'],['a631d41'],['5e43f0c'],['933396f'],['d497460'],['3eea024'],['c905de7'],['44f8ed2'],['18b39e8']]){const m=JSON.parse(execFileSync('git',['-C',repo,'show',commit+':docs/release.json'],{encoding:'utf8'}));shells[m.id]=execFileSync('git',['-C',repo,'show',commit+':docs/index.html'],{encoding:'utf8'});}
const appPath=files.find(f=>f.label==='src/app.js').path,presentationPins={};
for(const ref of legacyReleases){const old=JSON.parse(fs.readFileSync(pub+'/'+ref.path));if(old.rules!==rules)continue;
 const oldRows=old.scripts.map(p=>({path:p,label:old.files.find(f=>f.path===p)?.label})),newRows=scripts.map(p=>({path:p,label:files.find(f=>f.path===p)?.label}));
 const added=newRows.filter(r=>!oldRows.some(o=>o.label===r.label));if(added.some(r=>!['src/battle-presentation.js','src/scene-resources.js'].includes(r.label)))throw Error('Unexpected presentation dependency addition '+old.id);
 for(const row of oldRows){const n=newRows.find(n=>n.label===row.label);if(!n)throw Error('Missing historical script '+row.label);if(row.label==='src/app.js')continue;if(row.label==='src/actor.js'&&row.path===previous.files.find(f=>f.label==='src/actor.js')?.path)continue;if(row.label==='web/lineups-v8.js'&&row.path!==n.path){if(!row.path.includes('85ed0d61b2c98b233f10c20f91dcbf6004955b24361951895fa4d7cd4eec7c1b')||!n.path.includes('6fb67354e11a835c3b38d59265139a30d1ef138486514ca4d3dfba73c69ae4a2'))throw Error('Unapproved historical helper difference');continue;}if(row.path!==n.path)throw Error('Protected non-presentation script differs '+row.label);}
 presentationPins[old.id]={scripts:old.scripts,css:old.css,rules:old.rules};
}
fs.writeFileSync(out+'/presentation-proof.json',JSON.stringify({status:'SAME_MECHANICAL_SCRIPT_BYTES_VERIFIED',pins:presentationPins,app:appPath,css,newId:id,rules,sourceOldCoreUnmodified:true},null,2));
let bootstrap=fs.readFileSync(repo+'/web/mobile-bootstrap.js','utf8');
bootstrap='const SS2_RELEASE_SHELLS='+JSON.stringify(shells)+';\n'+bootstrap;
bootstrap=bootstrap.replace('function showReady(s){cacheState=s;','function showReady(s){cacheState=s;if(!selectedManifest){status.textContent="正在准备游戏…";return;}');
const loadHook='async function load(m){selectedManifest=m;';if(!bootstrap.includes(loadHook))throw Error('Bootstrap hook drift');
bootstrap=bootstrap.replace(loadHook,`async function load(m){const html=SS2_RELEASE_SHELLS[m.id];if(!html)throw Error('未找到此版本的界面，请保留存档');const toolbar=document.querySelector('.web-toolbar');const parsed=new DOMParser().parseFromString(html,'text/html');for(const e of parsed.querySelectorAll('script,.web-toolbar'))e.remove();for(const e of [...document.body.children])if(e!==toolbar)e.remove();for(const e of [...parsed.body.childNodes])document.body.append(document.importNode(e,true));window.SS2_WEB_UI_READY=()=>delete document.body.dataset.webBoot;if(m.id!==${JSON.stringify(id)})delete document.body.dataset.webBoot;const slot=document.getElementById('web-settings-slot');if(slot){const h=document.createElement('h3');h.textContent='版本与离线';slot.append(h,toolbar);const b=document.createElement('button');b.textContent='本机出战记录';b.onclick=()=>{document.getElementById('game-settings').close();window.SS2Lineups.show();};slot.append(b);}else document.body.prepend(toolbar);selectedManifest=m;`);
bootstrap=bootstrap.replace('window.SS2_WEB_UI_READY=()=>delete document.body.dataset.webBoot;',"const firstLoad=document.createElement('p');firstLoad.id='web-first-load';firstLoad.className='web-first-load';firstLoad.setAttribute('role','status');firstLoad.textContent='正在准备游戏，请稍候…';document.body.prepend(firstLoad);window.SS2_WEB_UI_READY=()=>{delete document.body.dataset.webBoot;firstLoad.remove();};");
bootstrap=bootstrap.replace(`if(m.id!==${JSON.stringify(id)})delete document.body.dataset.webBoot;`,`if(m.id!==${JSON.stringify(id)})window.SS2_WEB_UI_READY();`);
bootstrap=bootstrap.replace("'V8 · 本机存档 · 本规则阵容未上传'","'进度仅保存在当前设备'").replaceAll('当前V8规则','当前版本规则').replaceAll('当前V8规则导入','当前版本规则导入');
bootstrap=bootstrap.replace("status.textContent='载入未完成：'","delete document.body.dataset.webBoot;document.getElementById('web-first-load')?.remove();status.textContent='载入未完成：'");
// Native routes are authoritative. Modern tagged saves resume their exact web shell;
// untagged local states are validated by the source Core adapter after explicit import.
const Portraits=require(input+'/src/portraits.js');const heads=Object.fromEntries(Object.keys(actors).filter(k=>Portraits.get(k)).map(k=>[k,mapping[Portraits.get(k)]]));
bootstrap='const SS2_PC_HEAD_RELEASE='+JSON.stringify(id)+';const SS2_PC_HEADS='+JSON.stringify(heads)+';\n'+bootstrap;
const overlay=fs.readFileSync(repo+'/web/pc-head-overlay.js','utf8');bootstrap=bootstrap.replace('(async()=>{try{if(!(',overlay+'\n(async()=>{try{if(!(');
bootstrap=bootstrap.replace('await load(m);showReady(cacheState);','await load(m);showReady(cacheState);installPCHeadOverlay();');
bootstrap=bootstrap.replace("showReady(await request(cacheState.protocol===2?'CHECK':'PREPARE'));","showReady(await request(cacheState.protocol===2?'CHECK':'PREPARE'));window.SS2_PC_HEAD_OVERLAY?.refresh();");
bootstrap='const SS2_UI_PATCH='+JSON.stringify({id,rules,css,app:appPath,scripts,pins:presentationPins})+';\n'+bootstrap;
const patchHelpers=`function presentationFor(m){const p=SS2_UI_PATCH,pin=p.pins[m.id],ready=cacheState.releases[p.id];return pin&&ready&&ready.rules===m.rules&&m.rules===p.rules&&m.css===pin.css&&JSON.stringify(m.scripts)===JSON.stringify(pin.scripts)?p:null;}\n`;
bootstrap=bootstrap.replace('async function load(m){const html=SS2_RELEASE_SHELLS[m.id];',patchHelpers+'async function load(m){const ui=presentationFor(m);window.SS2_WEB_UI_RELEASE=ui?.id||m.id;window.SS2_WEB_UI_SCRIPTS=m.scripts.map(p=>ui&&m.files.find(f=>f.path===p)?.label===\'src/app.js\'?ui.app:p);const html=SS2_RELEASE_SHELLS[ui?.id||m.id];');
bootstrap=bootstrap.replace('css.href=m.css;','css.href=ui?.css||m.css;').replace('for(const src of m.scripts)','for(const src of SS2_WEB_UI_SCRIPTS)');
bootstrap=bootstrap.replace('showReady(cacheState);await load(m);',"if(SS2_UI_PATCH.pins[m.id]&&!cacheState.releases[SS2_UI_PATCH.id]){try{cacheState=await request('CHECK');}catch{}}showReady(cacheState);await load(m);");
bootstrap=bootstrap.replace('if(m.id!=='+JSON.stringify(id)+')window.SS2_WEB_UI_READY();','if(!ui&&m.id!=='+JSON.stringify(id)+')window.SS2_WEB_UI_READY();');
bootstrap=bootstrap.replace('return pin&&ready&&',"return localStorage.getItem(SAVE_KEY+'.ui-rollback')!==m.id&&pin&&ready&&");
bootstrap=bootstrap.replace("if(!(type==='ACTIVATE'&&!cacheState.pending&&selectedManifest.id!==cacheState.active))await request(type);","if(!(type==='ACTIVATE'&&!cacheState.pending&&selectedManifest.id!==cacheState.active)){const next=await request(type);if(type==='ROLLBACK')localStorage.setItem(SAVE_KEY+'.ui-rollback',next.active);else localStorage.removeItem(SAVE_KEY+'.ui-rollback');}");
bootstrap='window.SS2_LEGACY_GROUP_SPEC='+JSON.stringify({release:id,pins:legacyGroupPins})+';\n'+bootstrap;
bootstrap=bootstrap.replace('if(SS2_UI_PATCH.pins[m.id]&&!cacheState.releases[SS2_UI_PATCH.id])','if((SS2_UI_PATCH.pins[m.id]||SS2_LEGACY_GROUP_SPEC.pins[m.id])&&!cacheState.releases[SS2_UI_PATCH.id])');
bootstrap=bootstrap.replace('document.body.dataset.webRelease=m.id;',`if(SS2_LEGACY_GROUP_SPEC.pins[m.id]&&cacheState.releases[SS2_UI_PATCH.id]&&localStorage.getItem(SAVE_KEY+'.ui-rollback')!==m.id)await new Promise((ok,no)=>{const el=document.createElement('script');el.src=`+JSON.stringify(legacyGroupScript)+`;el.onload=ok;el.onerror=()=>no(Error('历史升级组显示未准备好'));document.body.append(el);});document.body.dataset.webRelease=m.id;`);
bootstrap=bootstrap.replace('window.SS2_WEB_UI_SCRIPTS=m.scripts.map(','window.SS2_WEB_UI_SCRIPTS=ui?ui.scripts:m.scripts.map(');
fs.writeFileSync(repo+'/web/product-bootstrap.js',bootstrap);
let html=sourceIndex.replace("connect-src 'none'","connect-src 'self' https://ss2-v6-lineups.elreyliu0809.workers.dev; worker-src 'self'").replace('<link rel="stylesheet" href="styles.css">','<style>body[data-web-boot="loading"]>.game-shell{display:none}</style>').replace(/<script src="assets\/actors.js"><\/script>[\s\S]*?<\/body>/,'<script src="bootstrap.js"></script></body>');
const toolbar='<section class="web-toolbar" aria-label="离线与版本"><span id="web-status" role="status">正在准备游戏…</span><button id="web-offline">下载完整离线包</button><button id="web-pause-download" hidden>暂停下载</button><button id="web-update" hidden>切换已准备新版</button><button id="web-rollback" hidden>回退上一发行版</button><button id="web-loader-update" hidden>启用新版加载器</button></section>';
html=html.replace('<body>','<body data-web-boot="loading">'+toolbar);
let sw=fs.readFileSync(repo+'/web/mobile-sw.js','utf8').replace("SHELL=NS+'shell-v1'","SHELL=NS+'shell-"+id+"'").replace('m.schema!==1||','(m.schema!==1&&m.schema!==2)||').replace('for(const[p,r]of rows)await c.put(p,r);','for(const[p,r]of rows)await c.put(p,r);await self.skipWaiting();');
// Schema2 is intentionally rejected by the old loader: it cannot activate a new
// DOM/script contract before the complete shell-v2 loader has installed.
// This DOM revision uses an isolated shell cache; activate only after complete
// shell installation, preserving the prior shell if download fails.
sw=sw.replace('js|css|svg|png|jpg','js|css|svg|png|jpg|json');
sw='const SS2_PRESENTATION_REVISION='+JSON.stringify(id)+';\n'+sw;
fs.writeFileSync(repo+'/web/product-sw.js',sw);
fs.writeFileSync(pub+'/index.html',html);fs.writeFileSync(pub+'/bootstrap.js',bootstrap);fs.writeFileSync(pub+'/sw.js',sw);fs.writeFileSync(pub+'/release.json',JSON.stringify(release,null,2));fs.writeFileSync(pub+'/.nojekyll','');
fs.writeFileSync(out+'/build.json',JSON.stringify({id,rules,objects:files.length,bytes:files.reduce((n,f)=>n+f.size,0),bootBytes:files.filter(f=>bootFiles.includes(f.path)).reduce((n,f)=>n+f.size,0),scriptSources,sourceTransforms,actors:equivalence,legacyShells:Object.keys(shells),compatibility,limits:['Physical iPhone Safari, comprehension and balance NOT_RUN','No new public lineup backend']},null,2));
console.log(JSON.stringify({id,rules,objects:files.length,actors:Object.keys(actors).length,bootBytes:files.filter(f=>bootFiles.includes(f.path)).reduce((n,f)=>n+f.size,0),scripts:scripts.length}));
