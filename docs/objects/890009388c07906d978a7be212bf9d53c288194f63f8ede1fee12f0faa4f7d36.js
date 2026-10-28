(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./content.js'));else root.SS2Packs=factory(root.SS2Content);})(typeof globalThis!=='undefined'?globalThis:this,function(C){'use strict';
const LEGACY_PACK_ID='local-base-18',DEFAULT_PACK_ID='cangjin-30';
const base=Object.freeze({id:LEGACY_PACK_ID,version:C.VERSION,name:'苍金基础包',status:'playable',unitIds:Object.freeze(C.LEGACY_UNIT_IDS.slice()),foodIds:Object.freeze(C.FOODS.map(x=>x.id)),qualityCodes:Object.freeze([11]),blockers:Object.freeze([])});
const candidate=Object.freeze({...base,id:'pack.q9',version:'local-redgold-22-v1',name:'赤金变身二十二将',status:'playable',unitIds:Object.freeze(C.REDGOLD_UNITS.map(x=>x.id)),qualityCodes:Object.freeze([9]),blockers:Object.freeze([])});
const expanded=Object.freeze({...base,id:DEFAULT_PACK_ID,version:'local-cangjin-30-v1',name:'苍金三十将阶段版',unitIds:Object.freeze(C.UNITS.map(x=>x.id))});
const theme48=Object.freeze({id:'theme-48',version:null,name:'四十八将主题完整包',status:'planning',plannedUnitCount:48,plannedPerTier:8,unitIds:Object.freeze([]),foodIds:Object.freeze([]),qualityCodes:Object.freeze([]),blockers:Object.freeze(['规划48名、六阶各8名；当前苍金30名阶段版可玩','新增18名按流派跨品质补齐，机制与资源未验收，尚不可开局'])});
const complete=Object.freeze((C.EXTRA_PACKS||[]).map(p=>Object.freeze({...base,...p,unitIds:Object.freeze(p.unitIds.slice()),qualityCodes:Object.freeze(p.qualityCodes.slice()),foodIds:Object.freeze([...base.foodIds,...C.EXTRA_FOODS.map(x=>x.id)]),blockers:Object.freeze([])})));
const original=Object.freeze((C.SAP_PACKS||[]).map(p=>Object.freeze({...p,status:'playable',unitIds:Object.freeze(p.unitIds.slice()),foodIds:Object.freeze(C.SAP_FOODS.map(x=>x.id)),qualityCodes:Object.freeze(p.qualityCodes.slice()),blockers:Object.freeze([])})));
const packs=Object.freeze([...original,expanded,base,candidate,...complete.map(p=>Object.freeze({...p,name:'实验历史 · '+p.name,experimental:true}))]);
function listPacks(){return packs;}
function getPack(id){const p=packs.find(x=>x.id===id);if(!p)throw Error('未知配置包：'+id);return p;}
function getPlayablePack(id){const p=getPack(id);if(p.status!=='playable')throw Error('配置包尚不可开局：'+p.blockers.join('；'));return p;}
const unitPools=new Map(),foodPools=new Map();
function getUnits(id){const p=getPlayablePack(id);if(!unitPools.has(id))unitPools.set(id,Object.freeze(p.unitIds.map(x=>C.BY_ID[x])));return unitPools.get(id);}
function getFoods(id){const p=getPlayablePack(id);if(!foodPools.has(id))foodPools.set(id,Object.freeze(p.foodIds.map(x=>C.FOOD_BY_ID[x])));return foodPools.get(id);}
function isUnitAllowed(id,unitId){return getPlayablePack(id).unitIds.includes(unitId);}
function isFoodAllowed(id,foodId){return getPlayablePack(id).foodIds.includes(foodId);}
return Object.freeze({DEFAULT_PACK_ID,RECOMMENDED_PACK_ID:'sap-turtle-1',LEGACY_PACK_ID,listPacks,getPack,getPlayablePack,getUnits,getFoods,isUnitAllowed,isFoodAllowed});
});
