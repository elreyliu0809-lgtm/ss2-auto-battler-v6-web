// Pinned app consumers only; source functions are presentation-only and original rules remain linked.
export function legacySceneTransform(code,{id,source}){const once=(a,b)=>{if(code.split(a).length!==2)throw Error('Legacy scene anchor '+id+' '+a.slice(0,100));code=code.replace(a,b);};
if(id==='v6-web-v8-r2-items-r2'){
 once("async function loadPackAssets(packId,candidate){if(assetsBusy)","async function loadPackAssets(packId,candidate){if(assetsBusy)");
 once('busyControls(true);try{renderer??=', 'busyControls(true);const resourceToken=SS2LegacyScene.begin();try{renderer??=');
 once('await SS2Scene.scene(candidate,renderer);return{packId,renderer};','await SS2Scene.scene(candidate,renderer);if(!SS2LegacyScene.valid(resourceToken))throw Error("画面准备已取消");SS2LegacyScene.done();return{packId,renderer};');
 once('return{packId,renderer};}finally{assetsBusy=false;', 'return{packId,renderer};}catch(e){SS2LegacyScene.fail(e,()=>location.reload());throw e;}finally{assetsBusy=false;');
 once("async function act(command){if(assetsBusy)return;", "async function act(command){if(assetsBusy)return;const operationBase=state;");
 once("save();render();}catch(e){toast(e.message);}}", "save();render();}catch(e){SS2LegacyScene.fail(e,()=>{if(state===operationBase)act(command);else SS2LegacyScene.done();});toast(e.message);}}");
 const anchor="activateAssets(await loadPackAssets(state.packId,state));";if(code.includes(anchor))once(anchor,"try{activateAssets(await loadPackAssets(state.packId,state));}catch(e){SS2LegacyScene.fail(e,()=>location.reload());throw e;}");
 return code;
}
const nativeLine=name=>{const match=source.match(new RegExp('^(?:async )?function '+name+'\\([^\\n]+$','m'));if(!match)throw Error('Source scene function absent '+name);return match[0];};
const start=code.indexOf('async function loadPackAssets('),end=code.indexOf('\nfunction activateAssets(',start);if(start<0||end<0)throw Error('Legacy scene function boundary '+id);code=code.slice(0,start)+['sceneIds','hasSceneAssets','loadPackAssets'].map(nativeLine).join('\n')+'\n'+code.slice(end);
const oldPrepare=code.match(/^async function prepareActorSet\([^\n]+$/m)?.[0];if(!oldPrepare)throw Error('Historical prepare absent');once(oldPrepare,nativeLine('prepareActorSet').split('/^assets\\/actor-data\\/\\d+\\.js$/').join('/^objects\\/[a-f0-9]{64}\\.js$/'));
once('return isMobile()?null:loadPackAssets(next.packId);','return isMobile()?null:loadPackAssets(next.packId,next,progress,valid);');
once("report:status=>{if(status.state==='settled')", "report:status=>{SS2LegacyScene.report(status);if(status.state==='settled')");
const gate=code.match(/^const battleGate=Mobile\.createGate\([^\n]+$/m)?.[0];if(!gate)throw Error('Historical gate absent');once(gate,gate+"\nSS2LegacyScene.bindGate(battleGate,()=>{resumePending=true;return battleGate.run({type:'RESUME_VISUAL'});});");
once('try{render();}catch(e)', 'try{render();refreshPCAssets();}catch(e)');
const refresh="function refreshPCAssets(){if(!isMobile()&&state.phase!=='battle'&&!battleGate.busy&&!hasSceneAssets(state)){resumePending=true;void battleGate.run({type:'RESUME_VISUAL'});}}\n";once('function portrait(id){',refresh+'function portrait(id){');
once("if(state.phase!=='battle'&&!isMobile())activateAssets(await loadPackAssets(state.packId));", "if(state.phase!=='battle'&&!isMobile()){resumePending=true;await battleGate.run({type:'RESUME_VISUAL'});}");
return code;}
