/* Presentation only: no executor calls, RNG, timers or state writes. */
(function(r,f){if(typeof module==='object'&&module.exports)module.exports=f();else r.SS2BattleFeedback=f();})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const kinds={attack:['attack','交锋'],damage:['damage','伤害'],buff:['buff','强化'],debuff:['debuff','弱化'],heal:['heal','治疗'],faint:['faint','阵亡'],summon:['summon','召唤'],summon_failed:['summon','召唤未入场'],shield:['buff','护盾'],armor:['buff','护甲'],copy:['copy','借技'],transform:['transform','变身'],ability:['ability','技能发动'],start:['ability','开战'],end:['ability','战果']};
function describe(e,previous,getName){
 if(!e)return null;const now=e.teams||[[],[]],old=previous||[[],[]],lookup=uid=>{if(!uid)return null;for(const teams of [now,old])for(let side=0;side<teams.length;side++){const index=teams[side].findIndex(u=>u.uid===uid);if(index>=0)return {unit:teams[side][index],side,index};}return e.unit?.uid===uid?{unit:e.unit,side:e.side??null,index:null}:null;};
 let [kind,title]=kinds[e.type]||['ability','战斗事件'];if(e.effectKind==='revive'){kind='summon';title='复生';}if(e.effectKind==='debuff_attack'||e.type==='buff'&&String(e.amount).startsWith('-')){kind='debuff';title='弱化';}
 const targetTypes=new Set(['damage','buff','debuff','heal','shield','armor','summon','transform','copy','faint']);
 const targetUid=e.targetUid||(targetTypes.has(e.type)?e.uid:null),sourceUid=e.sourceUid||(['ability','transform'].includes(e.type)?e.uid:null);
 const source=lookup(sourceUid),target=lookup(targetUid),unitName=x=>x?(getName?getName(x.unit):x.unit.name)||null:null;
 const subject=unitName(target)||unitName(source),names=source&&target&&sourceUid!==targetUid?[unitName(source),unitName(target)].filter(Boolean).join(' → '):subject||'';
 const value=e.amount!==undefined&&e.amount!==null?String(e.amount):'',message=String(e.message||'');
 const summary=[names,title,value].filter(Boolean).join(' · ')+(message?'：'+message:'');
 const marks=[];if(source)marks.push({...source,uid:sourceUid,role:'source'});if(target&&targetUid!==sourceUid)marks.push({...target,uid:targetUid,role:'target'});if(e.type==='attack')for(const uid of e.attackers||[e.sourceUid,e.targetUid]){const p=lookup(uid);if(p&&!marks.some(m=>m.uid===uid))marks.push({...p,uid,role:'source'});}
 for(const mark of marks)mark.caption=mark.role==='source'?(kind==='copy'?'供技':kind==='attack'?'攻击':'发动'):title;
 return {kind,title,summary,value,sourceUid:source?.unit.uid||null,targetUid:target?.unit.uid||null,marks,icon:(globalThis.SS2_ASSET_URL?.['assets/ui-feedback/'+kind+'.svg']||'assets/ui-feedback/'+kind+'.svg')};
}
return Object.freeze({describe});
});
