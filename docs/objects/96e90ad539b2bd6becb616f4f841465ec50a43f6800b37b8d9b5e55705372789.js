/* Read-only presentation for the preserved executors; no state or rule changes. */
(function(r,f){if(typeof module==='object'&&module.exports)module.exports=f(require('./content.js'),require('./effects-v8.js'),require('./legacy-player-copy.js'));else r.SS2LegacyPlayerView=f(r.SS2Content,r.SS2EffectsV8,r.SS2LegacyPlayerCopy);})(typeof globalThis!=='undefined'?globalThis:this,function(C,E,Copy){'use strict';
const own=u=>Copy.units[u.id],key=u=>u.copiedAbility||(u.transformed?C.BY_ID[u.id]?.formAbility:null)||C.BY_ID[u.id]?.ability;
const role=u=>u.copiedSAPRole||C.BY_ID[u.id]?.sapRole;
const plainByAbility=k=>C.ALL_UNITS.find(d=>own(d)&&!d.transformAssetId&&d.ability===k);
function sourceVersion(state){return /^sap-turtle-26131463-v[12]$/.test(state?.version||'')?state.version:'sap-turtle-26131463-v2';}
function effective(u){const d=C.BY_ID[u.id];if(!own(u))return null;if(d.sapRole&&u.copiedSAPRole)return C.ALL_UNITS.find(t=>t.sapRole===u.copiedSAPRole&&t.id.split('_').slice(0,3).join('_')===u.id.split('_').slice(0,3).join('_'))||C.ALL_UNITS.find(t=>t.sapRole===u.copiedSAPRole);if(u.copiedAbility||u.transformed)return plainByAbility(key(u))||d;return d;}
function layers(u,state){const d=effective(u),r=d&&own(d);if(!r)return null;const levels=r.versionVariants?.[sourceVersion(state)]||r.levels,l=levels[(u.level||1)-1];if(!l)return null;const notes=[...l.notes];let badges=[...l.badges];
 if(u.copiedSAPRole)notes.unshift('当前使用借来的技能，效果按自身等级计算；下回合开始清除。');
 if(u.copiedAbility)notes.unshift('当前使用借来的技能，按自身等级与自己的已用次数结算；不同时发动原技能。');
 if(u.transformed){notes.unshift(u.copiedAbility?'当前已变身，仍使用借来的技能；复生后保留当前形态、借技和已用次数。':'当前已变身，使用变身后的技能；复生后保留当前形态和已用次数。');badges.push('本场已变身，不能再次变身');}
 const current=u.transformed&&!u.copiedAbility&&d.transformAssetId?{trigger:'当前变身技能',effect:l.effect.split('\n').find(s=>s.startsWith('变身后：'))?.replace(/^变身后：/,'')||l.effect}:{};
 return {...l,...current,notes,badges,glossary:(l.glossaryRefs||[]).map(k=>Copy.glossary[k]).filter(Boolean)};
}
function quota(u,state){if(!own(u))return null;const d=effective(u),shopping=state?.phase==='shop',m=E.resolve(C,u);let used=0,limit=null,domain='本场',next=false;
 if(C.BY_ID[u.id]?.sapRole){const R=role(u),v2=sourceVersion(state).endsWith('v2'),turnLimits={Cat:2,Dragon:4,Rabbit:3,Ox:u.level||1,Gorilla:u.level||1,Fly:3},battleLimits={Hippo:3,...(v2?{Snake:5}:{})};if(turnLimits[R]){limit=turnLimits[R];used=u.turnUses?.[R]||0;domain='本回合';}else if(battleLimits[R]){limit=battleLimits[R];used=shopping?0:u.battleUses?.[R]||0;next=shopping;}}
 else if(m){const shop=E.SHOP.has(m.trigger);limit=m.limit;domain=shop?'本回合':'本场';next=!shop&&shopping;used=shop?(u.v8TurnUses||0):(shopping?0:u.v8BattleLedger?.[key(u)]||0);}
 else{const k=key(u),fixed={after_attack_self:[3,'afterAttackUses'],after_attack_splash:[2,'afterAttackUses'],hurt_shield:[u.level||1,'shieldUses'],friend_faint:[3,'friendFaintUses'],roll_growth:[2,'rollTriggers'],food_rebate:[1,'foodPurchases'],tier1_buy:[3,'buyTriggers']},entry=fixed[k];if(entry){const turn=['roll_growth','food_rebate','tier1_buy'].includes(k);[limit]=entry;domain=turn?'本回合':'本场';next=!turn&&shopping;used=next?0:u[entry[1]]||0;}}
 if(limit===null)return {remaining:null,quotaText:''};const remaining=Math.max(0,limit-used);return {remaining,quotaText:(next?'下场战斗可用':domain+'剩余')+remaining+'/'+limit+'次'};
}
function preview(state,u,team,describe){if(!own(u))return undefined;const d=C.BY_ID[u.id],k=key(u),m=E.resolve(C,u),base=k==='start_copy';
 if(d.sapRole){if(role(u)!=='Parrot')return null;const i=team.findIndex(t=>t.uid===u.uid),donor=i>0?team[i-1]:null;if(!donor||['Parrot','Tiger'].includes(role(donor)))return {ok:false,reason:'身前相邻没有可借的友军；不能借取借技或重复发动技能'};return {ok:true,donorUid:donor.uid,donorName:donor.name||C.BY_ID[donor.id].name,description:describe({...donor,level:u.level},state),remaining:null,note:'结束购买时才借用；借来技能可在随后开战发动。攻血、装备和对方次数不复制。'};}
 if(!base&&m?.effect!=='copy_ability')return null;let donor;
 if(base){const alive=team.filter(t=>t.health>0),i=alive.findIndex(t=>t.uid===u.uid);donor=i>=0?alive[i+1]:null;}
 else{const c={C,state,source:u,team,enemies:[],api:{pick:()=>null}};if(!E.condition(m,c))return {ok:false,reason:'尚未满足借技条件'};if(m.target==='random_friend')return {ok:false,reason:'随机对象在实际触发时确定'};donor=E.targets(m,c)[0];}
 if(!donor||key(donor)==='start_copy'||!base&&E.resolve(C,donor)?.effect==='copy_ability')return {ok:false,reason:'指定对象不存在或其技能不能借取；不会另找对象'};
 // Old copy does not inherit the donor ledger; inspect only the borrower's records.
 const hypothetical={...u,copiedAbility:key(donor),transformed:false},q=quota(hypothetical,{...state,phase:'battle'});
 return {ok:true,donorUid:donor.uid,donorName:donor.name||C.BY_ID[donor.id].name,description:describe(hypothetical,state),remaining:q.remaining,note:base?'先借用，再继续本次开战尚未处理的步骤；不重演已结束步骤。':'先选指定对象，再判断能否借；不复制对方已用次数，也不清空自己的次数。已处理的开战效果不补发。'};
}
return Object.freeze({owns:u=>!!own(u),layers,quota,preview,effective,key,sourceVersion});
});
