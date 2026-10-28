(function(r,f){if(typeof module==='object'&&module.exports)module.exports=f(require('./content.js'),require('./packs.js'),require('./sap-core.js'));else r.SS2Opponents=f(r.SS2Content,r.SS2Packs,r.SS2SAPCore);})(typeof globalThis!=='undefined'?globalThis:this,function(C,P,SAP){'use strict';
// SAP skill evidence inspires these synergies; this is a local opponent algorithm.
const profiles=[
 ['vanguard','先阵联击',1,['after_attack_self','friend_attack','start_front_attack','buy_buff','end_front'],'前排承伤，后排借攻击成长；突破前排或狙击支援。'],
 ['succession','薪火接阵',1,['faint_soldier','faint_buff','summon_buff','friend_faint','income'],'前排阵亡让位，召唤与存活者联动；定点清理后排。'],
 ['provision','军需长养',1,['armor','food_health','end_front','buy_buff','sell_buff'],'经营成长保住前排，军需集中；早期施压。'],
 ['counter','受伤反哺',2,['hurt_friend','armor','friend_attack','after_attack_self','end_front'],'承伤者保护身后受益者；致死打击跳过受伤收益。'],
 ['ambush','后阵奇袭',2,['armor','after_attack_self','weak_shot','back_shot','start_front_attack'],'开战打击薄弱后排；分散生命与玉盾可缓冲。'],
 ['echo','幻术借势',2,['armor','start_copy','faint_soldier','summon_buff','faint_buff'],'相邻技能复制与召唤接力；狙击复制目标。'],
 ['oxen','木牛接力',3,['faint_soldier','faint_ox','friend_faint','summon_buff','end_front'],'连续召唤并强化新军；清后排或压满召唤位置。'],
 ['duelist','破阵追击',3,['after_attack_self','after_attack_splash','friend_attack','kill_shot','start_front_attack'],'存活攻击成长并压制第二阵位；高伤击杀前排。'],
 ['bastion','铁壁护阵',3,['hurt_shield','armor','hurt_friend','friend_attack','food_health'],'护盾和减伤延长承伤；多段攻击消耗防护。'],
 ['renewal','还魂转势',4,['faint_ox','friend_faint','swallow','summon_buff','start_copy'],'复活、阵亡与腾位协作；提前消灭受益后排。'],
 ['barrage','连弩齐发',5,['armor','after_attack_splash','start_second','weak_shot','triple_shot'],'多方向开战伤害接追击；高生命与防护反制。'],
 ['veterans','宿将同袍',5,['start_level_attack','hurt_shield','end_levels','level_support','friend_faint'],'等级与成长集中于前军；狙击发动者并抢节奏。']
].map(([id,name,minTier,abilities,hint])=>Object.freeze({id,name,minTier,abilities:Object.freeze(abilities),hint}));
Object.freeze(profiles);
const coreKeys={vanguard:['after_attack_self','friend_attack'],succession:['faint_soldier','faint_ox'],provision:['end_front','buy_buff','food_health'],counter:['hurt_friend','hurt_shield'],ambush:['weak_shot','back_shot','triple_shot','start_second'],echo:['start_copy','swallow'],oxen:['faint_ox'],duelist:['after_attack_self','after_attack_splash'],bastion:['armor','hurt_shield'],renewal:['faint_ox'],barrage:['triple_shot'],veterans:['start_level_attack']};
function generate(turn,seed,packId){P.getPlayablePack(packId);if(P.getPack(packId).ruleset==='sap-original')return {team:SAP.makeOpponent(turn,seed,packId),info:SAP.describeOpponent(turn,seed,packId)};if(!Number.isInteger(turn)||turn<1||turn>25||!Number.isSafeInteger(seed))throw Error('无效对手参数');
 let rng=seed>>>0;const rand=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;},pick=a=>a[Math.floor(rand()*a.length)],tier=Math.min(6,Math.floor((turn+1)/2)),pool=P.getUnits(packId).filter(d=>d.tier<=tier),matches=(d,key)=>!!key&&(d.ability===key||d.formAbility===key||d.aiAbilityTags?.includes(key)),has=key=>pool.some(d=>matches(d,key)),available=profiles.filter(p=>(p.id==='echo'&&packId!=='pack.q9'?4:p.id==='vanguard'&&packId!=='pack.q9'?3:p.minTier)<=tier&&coreKeys[p.id].some(has)).concat(P.getPack(packId).ruleset==='v8'?[{id:'v8-recruits',name:'军团试阵',abilities:[],hint:'招募与站位构成基础队形；条件技能会随军需、等级与阵型逐步启用。'}]:[]),picked=available[(seed>>>0)%available.length],profile=picked.id==='echo'&&packId!=='pack.q9'?{...picked,name:'吞噬借位',abilities:['faint_ox','swallow','friend_attack','end_front','summon_buff'],hint:'将前军藏入后位，阵亡后释放；优先清理携带者与召唤支援。'}:picked,used=new Set(),team=[];
 const modern=P.getPack(packId).ruleset==='v8',size=Math.min(5,modern?(turn>=4?5:turn+1):(turn>=4?5:turn+2),pool.length);
 for(let i=0;i<size;i++){
  const candidates=pool.filter(d=>!used.has(d.id)),wanted=profile.abilities[i],preferred=candidates.filter(d=>matches(d,wanted)),d=pick(preferred.length?preferred:candidates);used.add(d.id);
  const level=modern?(turn>=20&&i===0?3:turn>=11&&i===0?2:turn>=13&&i===1?2:turn>=17&&i===2?2:1):(turn>=17&&i===0?3:turn>=9&&i===0?2:turn>=11&&i===1?2:turn>=15&&i===2?2:1),xp=level===3?5:level===2?2:0;
  const growth=Math.max(0,Math.floor((turn-3)*(modern?.25:.45))),jitter=turn>=4?Math.floor(rand()*(modern?2:3)):0,front=i===0;
  const attack=Math.min(50,d.attack+growth+jitter+(level-1)*2+(front?0:1)),health=Math.min(50,d.health+growth+(level-1)*2+(front?Math.floor(turn/(modern?6:4)):0));
  let food=null;
  if(turn>=7&&(front||(turn>=11&&i===2))){
   const desired=profile.id==='renewal'&&tier>=6?'mushroom':profile.id==='succession'||profile.id==='oxen'?'honey':front&&tier>=5?'melon':front?'garlic':'meat';
   const f=C.FOOD_BY_ID[desired];if(f?.tier<=tier&&P.isFoodAllowed(packId,desired))food=desired;
  }
  team.push({uid:'enemy_'+i,id:d.id,assetId:d.assetId,attack,health,xp,level,food,tempAttack:0,tempHealth:0});
 }
 return {team,info:{id:profile.id,name:profile.name,hint:profile.hint,phase:turn<=4?'前期':turn<=10?'中期':'后期',packId,tier,algorithm:modern?'LOCAL_SAP_INSPIRED_V8':'LOCAL_SAP_INSPIRED_V7',seed:seed>>>0}};
}
function makeOpponent(turn,seed,packId=P.DEFAULT_PACK_ID){return generate(turn,seed,packId).team;}
function describeOpponent(turn,seed,packId=P.DEFAULT_PACK_ID){return generate(turn,seed,packId).info;}
return Object.freeze({makeOpponent,describeOpponent,profiles});
});
