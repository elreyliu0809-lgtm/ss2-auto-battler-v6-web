/* Bounded local effects. The core owns event ordering, damage, XP, summon and persistence. */
(function(r,f){if(typeof module==='object'&&module.exports)module.exports=f();else r.SS2EffectsV8=f();})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const SHOP=new Set(['buy_self','buy_friend','sell_self','food','roll','round_start','end_shop','level_self','level_friend']);
const alive=u=>u&&u.health>0,cap=n=>Math.min(50,n);
function resolve(C,u){if(u.copiedAbility){return C.ALL_UNITS.find(d=>d.ability===u.copiedAbility)?.mechanic||null;}return C.BY_ID[u.id]?.mechanic||null;}
function condition(m,c){const u=c.source,team=c.team.filter(alive),index=team.findIndex(x=>x.uid===u.uid),pos=index<0?(c.sourceIndex??-1):index;
 switch(m.condition||'always'){
 case 'always':return true;case 'short_team':return team.length<5;case 'full_team':return team.length===5;
 case 'front':return pos===0;case 'rear':return pos===(c.sourceSize??team.length)-1;
 case 'gold_ge3':return !!c.state&&c.state.gold>=3;case 'gold_le1':return !!c.state&&c.state.gold<=1;
 case 'unarmed':return !u.food;case 'armed':return !!u.food;case 'level2':return u.level>=2;
 case 'low_health':return u.health<=(u.maxHealth??u.health)/2;
 case 'non_equipment':return !!c.food&&c.food.kind!=='equipment';case 'recipient':return !!c.recipients?.some(t=>t.uid===u.uid);
 case 'tier1_purchase':return c.subject&&c.C.BY_ID[c.subject.id]?.tier===1;
 case 'blocked':return c.blocked>0;case 'ally_level2':return team.some(t=>t.uid!==u.uid&&t.level>=2);
 default:throw Error('未知V8条件 '+m.condition);
 }}
function targets(m,c){const u=c.source,team=c.team.filter(alive),other=team.filter(t=>t.uid!==u.uid),enemy=(c.enemies||[]).filter(alive),i=team.findIndex(t=>t.uid===u.uid),single=x=>x?[x]:[],min=(a,k)=>a.length?a.reduce((x,y)=>y[k]<x[k]?y:x):null;
 switch(m.target){
 case 'self':return single(u);case 'ahead':return single(i>0?team[i-1]:null);case 'behind':return single(i>=0?team[i+1]:null);
 case 'front_friend':return single(other[0]);case 'back_friend':return single(other.at(-1));
 case 'low_health_friend':return single(min(other,'health'));case 'high_attack_friend':return single(other.length?other.reduce((a,b)=>b.attack>a.attack?b:a):null);
 case 'low_level_friend':return single(min(other,'level'));case 'random_friend':return single(c.api.pick(other));
 case 'all_other_friends':return other;case 'unarmed_friend':return single(other.find(t=>!t.food));case 'subject':return single(alive(c.subject)?c.subject:null);
 case 'enemy_front':return single(enemy[0]);case 'enemy_back':return single(enemy.at(-1));case 'enemy_second':return single(enemy[1]||enemy[0]);case 'enemy_low_health':return single(min(enemy,'health'));case 'random_enemy':return single(c.api.pick(enemy));
 default:throw Error('未知V8目标 '+m.target);
 }}
function run(event,c,budget){const u=c.source,m=resolve(c.C,u);if(!m||m.trigger!==event||!condition(m,c))return false;if(!SHOP.has(event)&&event!=='faint'&&!alive(u))return false;
 const shop=SHOP.has(event),key=u.copiedAbility||c.C.BY_ID[u.id].ability,ledger=shop?null:(u.v8BattleLedger||{}),used=shop?(u.v8TurnUses||0):(ledger[key]||0);if(used>=m.limit)return false;
 let list=targets(m,c);if(['summon_soldier','summon_bus','gold'].includes(m.effect))list=[u];if(!list.length)return false;
 const scale=m.scale==='none'?1:u.level,a=(m.attack||0)*scale,h=(m.health||0)*scale,n=(m.amount||0)*scale,cost=(m.cost||0)*scale,stat=m.costStat;
 if(stat==='health'&&u.health<=cost)return false;if(stat==='attack'&&u.attack<cost)return false;if(stat==='gold'&&(!c.state||c.state.gold<cost))return false;
 if(m.effect==='buff'&&!list.some(t=>t.attack<50&&a>0||t.health<50&&h>0))return false;
 if(m.effect==='heal'&&!list.some(t=>t.health<(t.maxHealth??t.health)))return false;
 if(m.effect==='armor'&&!list.some(t=>(t.armor||0)<n))return false;if(m.effect==='shield'&&!list.some(t=>!t.shield))return false;
 if(m.effect==='debuff_attack'&&!list.some(t=>t.attack>0))return false;
 if(m.effect==='xp'&&!list.some(t=>t.xp<5))return false;
 if(m.effect==='gold'&&(!c.state||c.state.gold>=1000))return false;
 if(m.effect==='equip_pass'){const item=c.oldFood||u.food;if(!item||u.equipmentSpent||!list.some(t=>!t.food&&t!==u))return false;}
 if(m.effect==='copy_ability'&&!list.some(t=>c.api.canCopy(t)))return false;
 if(m.effect==='attack_to_health'&&(!u.attack||!list.some(t=>t.health<50)))return false;
 if(m.effect==='health_to_attack'&&(u.health<=1||!list.some(t=>t.attack<50)))return false;
 if(!budget)budget={remaining:80,depth:0};if(budget.remaining<=0||budget.depth>=12)throw Error('V8事件预算耗尽');budget.remaining--;budget.depth++;
 if(shop)u.v8TurnUses=used+1;else{u.v8BattleLedger=ledger;ledger[key]=used+1;}
 if(stat==='gold')c.state.gold-=cost;else if(stat)u[stat]-=cost;
 let applied=0;
 try{for(const t of list){
  switch(m.effect){
  case 'buff':{const da=cap(t.attack+a)-t.attack,dh=cap(t.health+h)-t.health;if(da||dh){c.api.buff(t,da,dh,u);applied++;}break;}
  case 'heal':{const gain=Math.min(n,(t.maxHealth??t.health)-t.health);if(gain>0){t.health+=gain;applied++;}break;}
  case 'damage':c.api.damage(t,n,u);applied++;break;
  case 'armor':if((t.armor||0)<n){t.armor=n;applied++;}break;
  case 'shield':if(!t.shield){t.shield=true;applied++;}break;
  case 'debuff_attack':{const loss=Math.min(t.attack,n);t.attack-=loss;if(loss)applied++;break;}
  case 'gold':{const gain=Math.min(n,1000-c.state.gold);c.state.gold+=gain;if(gain)applied++;break;}
  case 'xp':if(c.api.xp(t,n))applied++;break;
  case 'summon_soldier':c.api.summon('token_soldier',Math.max(1,n),Math.max(1,n),u);applied++;break;
  case 'summon_bus':c.api.summon('token_bus',Math.max(1,n),Math.max(1,n),u);applied++;break;
  case 'copy_ability':if(c.api.canCopy(t)){c.api.copy(t,u);applied++;}break;
  case 'equip_pass':if(!t.food&&t!==u){t.food=c.oldFood||u.food;for(const flag of ['melonUsed','equipmentSpent'])t[flag]=u[flag]||false;if(!c.oldFood)u.food=null;applied++;}break;
  case 'attack_to_health':{const paid=Math.min(n,u.attack,50-t.health);if(paid>0){u.attack-=paid;c.api.buff(t,0,paid,u);applied++;}break;}
  case 'health_to_attack':{const paid=Math.min(n,u.health-1,50-t.attack);if(paid>0){u.health-=paid;c.api.buff(t,paid,0,u);applied++;}break;}
  default:throw Error('未知V8效果 '+m.effect);
  }
 }
 if(applied)c.api.report?.(u,m,event);
 else{if(shop)u.v8TurnUses=used;else ledger[key]=used;if(stat==='gold')c.state.gold+=cost;else if(stat)u[stat]+=cost;}
 return applied>0;
 }finally{budget.depth--;}
}
return Object.freeze({run,resolve,targets,condition,SHOP});
});
