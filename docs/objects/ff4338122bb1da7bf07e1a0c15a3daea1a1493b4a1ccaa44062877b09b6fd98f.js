/* Bounded theme interpreter. Only the owning core mutates snapshots, resources or events. */
(function(r,f){if(typeof module==='object'&&module.exports)module.exports=f();else r.SS2ProductEffects=f();})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const SHOP=new Set(['buy_self','buy_friend','sell_self','level_self','level_friend','food','roll','round_start','end_shop']);
const FUTURE=new Set(['hurt','attack','kill','faint','friend_hurt','friend_attack','friend_faint','summon','summon_failed']);
const alive=u=>u&&u.health>0;
function key(C,u){return u.copiedAbility||(u.transformed?C.BY_ID[u.id]?.formAbility:C.BY_ID[u.id]?.ability);}
function resolve(C,u){const k=key(C,u);return C.ALL_UNITS.find(d=>d.ability===k)?.mechanic||null;}
function condition(m,c){const u=c.source,t=c.team.filter(alive),i=t.findIndex(x=>x.uid===u.uid),pos=i<0?(c.sourceIndex??-1):i;switch(m.condition||'always'){
case 'always':return true;case 'unarmed':return !u.food;case 'armed':return !!u.food;case 'front':return pos===0;case 'rear':return pos===(i<0?(c.sourceSize??t.length):t.length)-1;
case 'full_team':return t.length===5;case 'short_team':return t.length<5;case 'level2':return u.level>=2;case 'low_health':return u.health<=(u.maxHealth??u.health)/2;
case 'gold_ge3':return c.state?.gold>=3;case 'gold_le1':return c.state&&c.state.gold<=1;case 'non_equipment':return c.food&&c.food.kind!=='equipment';
case 'recipient':return c.recipients?.some(x=>x.uid===u.uid);case 'tier1_purchase':return c.C.BY_ID[c.subject?.id]?.tier===1;case 'blocked':return c.blocked>0;case 'ally_level2':return t.some(x=>x.uid!==u.uid&&x.level>=2);default:throw Error('未知主题条件 '+m.condition);}}
function canCopy(C,t){const m=resolve(C,t),k=key(C,t);return m?FUTURE.has(m.trigger)&&m.effect!=='copy_ability':new Set(['faint_buff','faint_soldier','summon_buff','friend_attack','hurt_friend','faint_ox','kill_shot','hurt_shield','after_attack_self','friend_faint','after_attack_splash']).has(k);}
function targets(m,c){const u=c.source,team=c.team.filter(alive),i=team.findIndex(x=>x.uid===u.uid),other=team.filter(t=>t.uid!==u.uid),enemy=c.enemies.filter(alive),single=x=>x?[x]:[],eligible=a=>m.effect==='copy_ability'?a.filter(t=>canCopy(c.C,t)):m.effect==='xp'?a.filter(t=>t.xp<5&&!(c.event==='level_friend'&&t.uid===c.subject?.uid)):a;
 const min=(a,k)=>a.reduce((x,y)=>!x||y[k]<x[k]?y:x,null),max=(a,k)=>a.reduce((x,y)=>!x||y[k]>x[k]?y:x,null),friends=eligible(other);
 switch(m.target){case 'self':return eligible([u]);case 'subject':return eligible(single(alive(c.subject)?c.subject:null));case 'actual_food_recipients':return eligible((c.recipients||[]).filter(alive));
case 'ahead':return eligible(single(i>0?team[i-1]:i<0&&c.sourceIndex>0?team[c.sourceIndex-1]:null));case 'behind':return eligible(single(i>=0?team[i+1]:team[c.sourceIndex]));
case 'front_friend':return single(friends[0]);case 'back_friend':return single(friends.at(-1));case 'low_health_friend':return single(min(friends,'health'));case 'high_attack_friend':return single(max(friends,'attack'));case 'low_level_friend':return single(min(friends,'level'));case 'random_friend':return single(c.api.pick(friends));case 'all_other_friends':return friends;case 'unarmed_friend':return single(friends.find(t=>!t.food));
case 'enemy_front':return single(enemy[0]);case 'enemy_back':return single(enemy.at(-1));case 'enemy_second':return single(enemy[1]||enemy[0]);case 'enemy_low_health':return single(min(enemy,'health'));case 'random_enemy':return single(c.api.pick(enemy));default:throw Error('未知主题目标 '+m.target);}}
function run(event,c,budget){c.event=event;const u=c.source,m=resolve(c.C,u),shop=!!c.state;
 if(!m||m.trigger!==event||!condition(m,c)||(!shop&&event!=='faint'&&!alive(u)))return false;
 const origin=m.originKey,ledger=shop?(u.themeTurnUses||={}):c.api.ledger(u),used=ledger[origin]||0;if(used>=m.limit)return false;
 let list=['supply','gold','defer_gold','summon_soldier','summon_bus'].includes(m.effect)?[u]:targets(m,c);if(!list.length)return false;
 const scale=m.scale==='none'?1:u.level,a=m.attack*scale,h=m.health*scale,n=m.amount*scale,cost=m.cost*(m.costScale==='level'?u.level:1),stat=m.costStat;
 if(stat==='gold'&&cost&&c.state?.gold<cost||stat==='health'&&cost&&u.health<=cost||stat==='attack'&&cost&&u.attack<cost)return false;
 const useful=t=>{switch(m.effect){case 'buff':return a>0&&t.attack<50||h>0&&t.health<50;case 'heal':return t.health<(t.maxHealth??t.health);case 'damage':return t.health>0&&n>0;case 'armor':return (shop?(t.prepArmor||0):(t.armor||0))<n;case 'shield':return !(shop?t.prepShield:t.shield);case 'xp':return t.xp<5;case 'debuff_attack':return t.attack>0;case 'equip_pass':return !!u.food&&!u.equipmentSpent&&!u.perkSpent&&!t.food&&t!==u;case 'grant_equipment':return !t.food;case 'swap_stats':return t.attack>0&&t.attack!==t.health;case 'copy_ability':return canCopy(c.C,t);case 'attack_to_health':return u.attack>0&&t.health<50;case 'health_to_attack':return u.health>1&&t.attack<50;default:return true;}};
 list=list.filter(useful);if(!list.length)return false;
 if(budget.remaining<=0||budget.depth>=12)throw Error('主题事件预算耗尽，操作未提交');budget.remaining--;budget.depth++;
 ledger[origin]=used+1;if(cost){if(stat==='gold')c.state.gold-=cost;else u[stat]-=cost;}
 let applied=0;
 try{for(const t of list){switch(m.effect){
 case 'buff':applied+=c.api.buff(t,a,h,u)?1:0;break;
 case 'heal':{const gain=Math.min(n,(t.maxHealth??t.health)-t.health);if(gain>0){t.health+=gain;c.api.report?.(u,m,{targetUid:t.uid,healed:gain});applied++;}break;}
 case 'damage':applied+=c.api.damage(t,n,u)>0?1:0;break;
 case 'debuff_attack':{const d=Math.min(n,t.attack);t.attack-=d;applied+=d>0?1:0;break;}
 case 'armor':if(shop)t.prepArmor=n;else t.armor=n;applied++;break;
 case 'shield':if(shop)t.prepShield=true;else t.shield=true;applied++;break;
 case 'gold':{const room=1000-c.state.gold,gain=Math.max(0,Math.min(n,room,m.refundCap?c.refund.remaining:1000));c.state.gold+=gain;if(m.refundCap)c.refund.remaining-=gain;applied+=gain>0?1:0;break;}
 case 'defer_gold':{const gain=Math.min(n,1000-(c.state.deferredGold||0));c.state.deferredGold=(c.state.deferredGold||0)+gain;applied+=gain>0?1:0;break;}
 case 'xp':applied+=c.api.xp(t,n,origin)?1:0;break;
 case 'summon_soldier':case 'summon_bus':applied+=c.api.summon(m.effect==='summon_bus'?'token_bus':'token_soldier',Math.max(1,n),Math.max(1,n),u)?1:0;break;
 case 'supply':{const f=m.foodByLevel?.[u.level];if(f)applied+=c.api.supply(f,u)?1:0;break;}
 case 'grant_equipment':t.food=m.foodKey;t.perkSpent=false;t.equipmentSpent=false;applied++;break;
 case 'equip_pass':if(!t.food&&u.food&&!u.equipmentSpent&&!u.perkSpent){t.food=u.food;t.perkSpent=false;t.equipmentSpent=false;u.food=null;applied++;}break;
 case 'swap_stats':{[t.attack,t.health]=[t.health,t.attack];if(!shop)t.maxHealth=Math.max(t.health,Math.min(50,t.maxHealth??t.health));applied++;break;}
 case 'attack_to_health':{const paid=Math.min(n,u.attack,50-t.health);if(paid>0){u.attack-=paid;c.api.buff(t,0,paid,u);applied++;}break;}
 case 'health_to_attack':{const paid=Math.min(n,u.health-1,50-t.attack);if(paid>0){u.health-=paid;c.api.buff(t,paid,0,u);applied++;}break;}
 case 'copy_ability':if(c.api.copy(t,u))applied++;break;
 default:throw Error('未知主题效果 '+m.effect);
 }}
 if(applied)c.api.report?.(u,m);else{ledger[origin]=used;if(cost){if(stat==='gold')c.state.gold+=cost;else u[stat]+=cost;}}
 return applied>0;
 }finally{budget.depth--;}
}
return Object.freeze({SHOP,FUTURE,key,resolve,canCopy,condition,targets,run});
});
