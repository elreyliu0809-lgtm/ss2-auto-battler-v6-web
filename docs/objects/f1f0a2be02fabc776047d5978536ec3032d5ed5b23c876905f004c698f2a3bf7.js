(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./content.js'));else root.SS2Packs=factory(root.SS2Content);})(typeof globalThis!=='undefined'?globalThis:this,function(C){'use strict';
const LEGACY_PACK_ID='local-base-18',DEFAULT_PACK_ID='cangjin-30';
const base=Object.freeze({id:LEGACY_PACK_ID,version:C.VERSION,name:'苍金基础包',status:'playable',unitIds:Object.freeze(C.LEGACY_UNIT_IDS.slice()),foodIds:Object.freeze(C.FOODS.map(x=>x.id)),qualityCodes:Object.freeze([11]),blockers:Object.freeze([])});
const candidate=Object.freeze({id:'pack.q9',version:null,name:'赤金变身主题包',status:'candidate',unitIds:Object.freeze([]),foodIds:Object.freeze([]),qualityCodes:Object.freeze([9]),blockers:Object.freeze(['变身继承、回退与事件顺序仍待核','双形态已完成限定浏览器绘制，玩法尚未接入'])});
const expanded=Object.freeze({...base,id:DEFAULT_PACK_ID,version:'local-cangjin-30-v1',name:'苍金三十将阶段版',unitIds:Object.freeze(C.UNITS.map(x=>x.id))});
const theme48=Object.freeze({id:'theme-48',version:null,name:'四十八将主题完整包',status:'planning',plannedUnitCount:48,plannedPerTier:8,unitIds:Object.freeze([]),foodIds:Object.freeze([]),qualityCodes:Object.freeze([]),blockers:Object.freeze(['规划48名、六阶各8名；当前苍金30名阶段版可玩','新增18名按流派跨品质补齐，机制与资源未验收，尚不可开局'])});
const packs=Object.freeze([expanded,base,candidate,theme48]);
function listPacks(){return packs;}
function getPack(id){const p=packs.find(x=>x.id===id);if(!p)throw Error('未知配置包：'+id);return p;}
function getPlayablePack(id){const p=getPack(id);if(p.status!=='playable')throw Error('配置包尚不可开局：'+p.blockers.join('；'));return p;}
const unitPools=new Map(),foodPools=new Map();
function getUnits(id){const p=getPlayablePack(id);if(!unitPools.has(id))unitPools.set(id,Object.freeze(p.unitIds.map(x=>C.BY_ID[x])));return unitPools.get(id);}
function getFoods(id){const p=getPlayablePack(id);if(!foodPools.has(id))foodPools.set(id,Object.freeze(p.foodIds.map(x=>C.FOOD_BY_ID[x])));return foodPools.get(id);}
function isUnitAllowed(id,unitId){return getPlayablePack(id).unitIds.includes(unitId);}
function isFoodAllowed(id,foodId){return getPlayablePack(id).foodIds.includes(foodId);}
return Object.freeze({DEFAULT_PACK_ID,LEGACY_PACK_ID,listPacks,getPack,getPlayablePack,getUnits,getFoods,isUnitAllowed,isFoodAllowed});
});
