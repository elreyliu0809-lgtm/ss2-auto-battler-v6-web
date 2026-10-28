/* Stable facade: saved rules choose their own executor, never migrate implicitly. */
(function(r,f){if(typeof module==='object'&&module.exports)module.exports=f(require('./legacy-core-v8.js'),require('./sap-core.js'),require('./sap-core-v2.js')(require('./sap-source-data.js')),require('./packs.js'),require('./product-core.js'),require('./product-core-r1.js'),require('./sap-core-v3.js')(require('./sap-source-data.js')));else r.SS2Core=f(r.SS2LegacyCore,r.SS2SAPCore,r.SS2SAPCoreV2,r.SS2Packs,r.SS2ProductCore,r.SS2ProductCoreR1,r.SS2SAPCoreV3);})(typeof globalThis!=='undefined'?globalThis:this,function(L,S1,S2,P,T,T1,S3){'use strict';
const SOURCE_V1='sap-turtle-26131463-v1',SOURCE_V2='sap-turtle-26131463-v2',SOURCE_V3='sap-turtle-26131463-v3';
function executor(s){if(s?.version===SOURCE_V1)return S1;if(s?.version===SOURCE_V2)return S2;if(s?.version===SOURCE_V3)return S3;if(s?.version===T1.VERSION||s?.version===T.VERSION){if(P.getPack(s.packId).version!==s.version)throw Error('主题包与规则版本不匹配');return s.version===T1.VERSION?T1:T;}return L;}
function createRun(seed,packId=P.DEFAULT_PACK_ID,options){const p=P.getPlayablePack(packId);if(p.ruleset==='product-theme')return (p.version===T1.VERSION?T1:T).createRun(seed,packId);if(p.ruleset==='sap-original'){const selected=options?.appearancePackId||packId;if(P.getPlayablePack(selected).ruleset!=='sap-original')throw Error('该外观不属于海龟对照');return S3.createRun(seed,selected);}return L.createRun(seed,packId);}
function simulateBattle(a,b,seed,options){
 const source=[...a,...b].some(u=>String(u.id).startsWith('sap_')),theme=[...a,...b].some(u=>/^p[12]_/.test(String(u.id)));
 if(source||options?.version===SOURCE_V1||options?.version===SOURCE_V2||options?.version===SOURCE_V3){
  const engine=options?.version===SOURCE_V1?S1:options?.version===SOURCE_V2?S2:S3;
  const packId=options&&typeof options==='object'&&!Array.isArray(options)?options.packId:options;
  return engine.simulateBattle(a,b,seed,packId);
 }
 const oldTheme=options?.version===T1.VERSION||options?.packId&&P.getPack(options.packId).version===T1.VERSION;
 return (theme?(oldTheme?T1:T):L).simulateBattle(a,b,seed,options);
}
function foodPrice(s,offer){const e=executor(s);e.validateState(s);return e.foodPrice?e.foodPrice(s,offer):3;}
return Object.freeze({createRun,act:(s,c)=>executor(s).act(s,c),validateState:s=>executor(s).validateState(s),previewOpponent:s=>executor(s).previewOpponent(s),simulateBattle,foodPrice});
});
