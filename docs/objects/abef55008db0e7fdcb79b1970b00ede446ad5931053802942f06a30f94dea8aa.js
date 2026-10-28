(function(r,f){if(typeof module==='object'&&module.exports)module.exports=f;else r.SS2SAPCoreV3=f(r.SS2SAPData);})(typeof globalThis!=='undefined'?globalThis:this,function(inputData,hooks){'use strict';hooks=hooks||{};
const D=Object.freeze({...inputData,VERSION:'sap-turtle-26131463-v3'});
// V3 isolates M01/M02/M03 corrections; v1/v2 bytes are retained. Static-source corrections only. Native coordinator drain order and RNG parity remain UNKNOWN.
// Source-led rules are isolated from the historical/local experimental rulesets.
const clone=x=>JSON.parse(JSON.stringify(x)),cap=n=>Math.max(0,Math.min(50,Math.floor(n))),lvl=x=>x>=5?3:x>=2?2:1;
const BY=Object.fromEntries([...D.UNITS,...D.TOKENS].map(x=>[x.id,x])),FB=Object.fromEntries(D.FOODS.map(x=>[x.id,x])),PB=Object.fromEntries(D.PACKS.map(x=>[x.id,x]));
const check=(v,m)=>{if(!v)throw Error(m);},int=(n,a,b)=>Number.isInteger(n)&&n>=a&&n<=b;
function rand(s){s.rng=(s.rng+0x6d2b79f5)>>>0;let t=s.rng;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;}
const pick=(s,a)=>a.length?a[Math.floor(rand(s)*a.length)]:null,nextSeed=s=>Math.floor(rand(s)*4294967296)>>>0;
function sample(s,a,n){const p=[...a],out=[];while(p.length&&out.length<n){const i=Math.floor(rand(s)*p.length);out.push(p.splice(i,1)[0]);}return out;}
function pack(id){const p=PB[id];check(p,'未知原作配置包');return p;}
const units=id=>pack(id).unitIds.map(x=>BY[x]),foods=()=>D.FOODS,role=u=>u.copiedSAPRole||BY[u.id]?.sapRole,perk=u=>u.food?FB[u.food]?.perkEnum:null,tier=t=>Math.min(6,Math.floor((t+1)/2));
function unit(id,uid){const d=BY[id];check(d,'未知原作武将');return {id,uid,assetId:d.assetId,...(d.name?{name:d.name}:{}),attack:d.attack,health:d.health,xp:0,level:1,food:null,tempAttack:0,tempHealth:0,turnUses:{},extraSellValue:0};}
function totalA(u){return cap(u.attack+(u.tempAttack||0));}function totalH(u){return cap(u.health+(u.tempHealth||0));}
function give(u,a,h,temp=false){if(temp){u.tempAttack=cap((u.tempAttack||0)+a);u.tempHealth=cap((u.tempHealth||0)+h);return;}u.attack=cap(u.attack+a);u.health=cap(u.health+h);if(u.maxHealth!==undefined)u.maxHealth=cap(u.maxHealth+h);}
function givePerk(u,p){const f=D.FOODS.find(x=>x.perkEnum===p);check(f,'缺少原作装备登记 '+p);u.food=f.id;u.perkSpent=false;}
function used(u,key,max,battle=false){const ledger=battle?(u.battleUses||=(Object.create(null))):(u.turnUses||=(Object.create(null)));if((ledger[key]||0)>=max)return false;ledger[key]=(ledger[key]||0)+1;return true;}
// Each resumed selection draws new tie tokens for the remaining candidates.
function rankCandidates(list,random,sourceUid=null){return list.map((u,sequence)=>({u,sequence,tie:random()})).sort((a,b)=>(Number(b.u.uid===sourceUid)-Number(a.u.uid===sourceUid))||b.u.attack-a.u.attack||a.tie-b.tie||a.sequence-b.sequence).map(x=>x.u);}
function selectNext(list,random,sourceUid=null){return rankCandidates(list,random,sourceUid)[0];}
function dispatchCandidates(list,random,options){const remaining=[...list];let ranked=null,sorts=0,attempts=0;while(remaining.length){if(!ranked){ranked=rankCandidates(remaining.filter(options.eligible),random,options.sourceUid);sorts++;options.onSort?.({candidates:ranked.map(u=>u.uid)});}const u=ranked.shift();if(!u)break;remaining.splice(remaining.indexOf(u),1);if(!options.eligible(u))continue;const before=options.eventCount();options.activate(u);options.after?.(u);attempts++;if(options.eventCount()!==before)ranked=null;}return {sorts,attempts};}
function rebuildAfterMushroom(source,uid){const out=unit(source.id,uid);out.level=source.level;out.xp=out.level===3?5:out.level===2?2:0;out.attack=out.health=out.maxHealth=1;out.battleUses={};
 const key=BY[out.id]?.sapRole,scopes={Ox:'turnUses',Gorilla:'turnUses',Hippo:'battleUses',Fly:'turnUses',Cat:'turnUses',Dragon:'turnUses',Rabbit:'turnUses',Snake:'battleUses'},scope=scopes[key];
 if(scope&&Object.hasOwn(source[scope]||{},key))out[scope][key]=source[scope][key];return out;}
function capacity(t){const k=tier(t);return {units:3+(k>=3?1:0)+(k>=5?1:0),food:1+(k>=3?1:0)};}
function restock(s){const c=capacity(s.turn),pool=units(s.packId).filter(d=>d.tier<=tier(s.turn)),fp=D.FOODS.filter(d=>d.rollable&&d.tier<=tier(s.turn));
 for(let i=0;i<Math.max(c.units,s.shop.units.length);i++){const old=s.shop.units[i];if(old?.frozen)continue;s.shop.units[i]=i<c.units?{id:pick(s,pool).id,frozen:false,shopAttack:s.shopBuff.attack,shopHealth:s.shopBuff.health}:null;}
 for(let i=0;i<Math.max(c.food,s.shop.food.length);i++){const old=s.shop.food[i];if(old?.frozen)continue;s.shop.food[i]=i<c.food?{id:pick(s,fp).id,frozen:false}:null;}
 while(s.shop.units.length>c.units&&!s.shop.units.at(-1))s.shop.units.pop();while(s.shop.food.length>c.food&&!s.shop.food.at(-1))s.shop.food.pop();
}
function foodPrice(s,offer){const f=FB[offer.id];return Math.max(0,(offer.price??f.price)-(offer.noDiscount?0:s.foodDiscount||0));}
function addFood(s,id,amount,price,replace=false){check(FB['sap_food_'+id],'原作供给食品未登记 '+id);const rows=Array.from({length:amount},()=>({id:'sap_food_'+id,frozen:false,price}));if(replace)s.shop.food=rows;else s.shop.food.push(...rows);check(s.shop.food.length<=40,'原作供给槽超出安全上限，未静默丢弃食品');}
function sourceOrder(s,list){return list.map(x=>({x,t:rand(s)})).sort((a,b)=>totalA(b.x)-totalA(a.x)||a.t-b.t).map(x=>x.x);}
function notifySummon(s,subject){for(const u of sourceOrder(s,[...s.team])){if(u.uid===subject.uid)continue;const L=u.level;switch(role(u)){case 'Horse':give(subject,L,0,true);break;case 'Dog':give(u,2*L,L,true);break;case 'Turkey':give(subject,3*L,L);break;}}if(role(subject)==='Scorpion')givePerk(subject,2);}
function cowFood(s,u,chocolate=false){addFood(s,(chocolate?[130,131,132]:[49,102,103])[u.level-1],2,0,true);}
function onBought(s,u){const L=u.level;if(role(u)==='Otter')for(const f of sample(s,s.team.filter(x=>x.uid!==u.uid),L))give(f,0,1);if(role(u)==='Cow')cowFood(s,u);if(BY[u.id].tier===1)for(const d of sourceOrder(s,[...s.team]))if(role(d)==='Dragon'&&used(d,'Dragon',4))for(const f of s.team)give(f,d.level,d.level);}
function consumeUnitOffer(s,index,o){for(let i=0;i<s.shop.units.length;i++)if(i===index||(o.rewardGroup&&s.shop.units[i]?.rewardGroup===o.rewardGroup))s.shop.units[i]=null;}
function gainXP(s,u,n,suppressReward=false){for(let i=0;i<n;i++){give(u,1,1);const previous=u.level;u.xp=Math.min(5,u.xp+1);u.level=lvl(u.xp);if(u.level!==previous){
  if(role(u)==='Fish')for(const f of sample(s,s.team.filter(x=>x.uid!==u.uid),2)){const v=Math.max(u.level-1,1);give(f,v,v);}
  if(!suppressReward){const targetTier=Math.min(6,tier(s.turn)+1),rewards=sample(s,units(s.packId).filter(x=>x.tier===targetTier),2),rewardGroup='reward_'+(s.rewardSerial=(s.rewardSerial||0)+1);for(const reward of rewards)s.shop.units.push({id:reward.id,frozen:false,upgrade:true,rewardGroup,price:3,shopAttack:s.shopBuff.attack,shopHealth:s.shopBuff.health});}
 }}check(s.shop.units.length<=40,'升级供给超出安全槽上限');}
function merge(s,target,donor){check(target.id===donor.id&&target.uid!==donor.uid,'只能合成两个相同原作槽位');check(target.level<3&&donor.level<3,'满级武将不能合成');const delta=Math.min(target.xp,donor.xp)+1,suppressReward=target.level>=2&&donor.level>=2;
 target.attack=Math.max(target.attack,donor.attack);target.health=Math.max(target.health,donor.health);target.tempAttack=Math.max(target.tempAttack||0,donor.tempAttack||0);target.tempHealth=Math.max(target.tempHealth||0,donor.tempHealth||0);target.xp=Math.max(target.xp,donor.xp);target.level=lvl(target.xp);if(!target.food)target.food=donor.food;target.extraSellValue=Math.max(target.extraSellValue||0,donor.extraSellValue||0);for(const [k,v]of Object.entries(donor.turnUses||{}))target.turnUses[k]=Math.max(target.turnUses[k]||0,v);gainXP(s,target,delta,suppressReward);}
function startTurn(s){
 // StartTurn runs after NEXT_ROUND increments turn, matching native BuildExtensions.StartTurn.
 if(s.turn===3&&s.lastLifeRegainTurn!==3){s.lastLifeRegainTurn=3;if(s.phase!=='over'&&s.lives>0&&s.lossPoints>0){s.lossPoints=Math.max(0,s.lossPoints-1);s.lives=5-s.lossPoints;s.lifeRecoveryCount++;}}
 s.foodDiscount=0;for(const u of s.team){u.tempAttack=u.tempHealth=0;u.turnUses={};delete u.copiedSAPRole;}restock(s);
 for(const u of sourceOrder(s,[...s.team])){const L=u.level,i=s.team.indexOf(u);switch(role(u)){case 'Swan':s.gold=Math.min(300,s.gold+L);break;case 'Worm':addFood(s,[0,134,135][L-1],1,2);break;case 'Giraffe':for(const f of s.team.slice(Math.max(0,i-L),i))give(f,1,1);break;case 'Squirrel':s.foodDiscount+=L;break;case 'Penguin':for(const f of sample(s,s.team.filter(x=>x.uid!==u.uid&&x.level>=2),2))give(f,L,L);break;}}
}
function endTurn(s){for(const u of sourceOrder(s,[...s.team])){const L=u.level,i=s.team.indexOf(u);switch(role(u)){case 'Snail':if(s.history.at(-1)?.winner==='opponent')for(const f of s.team.slice(Math.max(0,i-3),i))give(f,L,0);break;case 'Bison':if(s.team.some(x=>x.level===3))give(u,2*L,2*L);break;case 'Monkey':if(s.team[0])give(s.team[0],2*L,2*L);break;case 'Parrot':if(i>0&&role(s.team[i-1])!=='Parrot'&&role(s.team[i-1])!=='Tiger')u.copiedSAPRole=role(s.team[i-1]);break;}if(perk(u)===41)give(u,0,7,true);if(perk(u)===44)u.extraSellValue=(u.extraSellValue||0)+1;}}
function createRun(seed=20261028,packId=D.DEFAULT_PACK_ID){check(int(seed,0,4294967295),'随机种子必须是32位无符号整数');pack(packId);const s={version:D.VERSION,packId,packVersion:D.VERSION,seed,rng:seed,nextUid:1,turn:1,gold:10,lives:5,lossPoints:0,lifeRecoveryCount:0,lastLifeRegainTurn:0,wins:0,phase:'shop',team:[],shop:{units:[],food:[]},shopBuff:{attack:0,health:0},foodDiscount:0,history:[]};restock(s);return s;}
function validateUnit(u,packId,battle=false){const d=BY[u?.id];check(d&&(pack(packId).unitIds.includes(u.id)||D.TOKENS.some(x=>x.id===u.id)),'武将不属于原作本局');check(typeof u.uid==='string'&&u.uid.length>0&&u.uid.length<=100,'武将标识损坏');check(u.assetId===d.assetId,'原作皮肤映射损坏');check(int(u.attack,0,50)&&int(u.health,battle?-10000:1,50),'原作属性越界');check(int(u.xp,0,5)&&u.level===lvl(u.xp),'原作经验不匹配');check(u.food===null||FB[u.food]?.kind==='equipment','原作装备非法');check(int(u.tempAttack||0,0,50)&&int(u.tempHealth||0,0,50),'原作临时属性非法');if(u.copiedSAPRole)check(role(d)==='Parrot'||d.sapRole==='Parrot','非法原作复制身份');check(u.turnUses&&typeof u.turnUses==='object'&&!Array.isArray(u.turnUses)&&Object.keys(u.turnUses).length<=12,'原作次数账本非法');for(const v of Object.values(u.turnUses))check(int(v,0,100),'原作次数越界');}
function validateState(s){check(s&&s.version===D.VERSION,'原作存档版本不匹配');pack(s.packId);check(s.packVersion===D.VERSION,'原作包版本不匹配');check(int(s.seed,0,4294967295)&&int(s.rng,0,4294967295)&&int(s.nextUid,1,1000000),'原作随机状态损坏');check(int(s.turn,1,1000)&&int(s.gold,0,300)&&int(s.lives,0,5)&&int(s.wins,0,10),'原作局进度损坏');check(int(s.lossPoints,0,5)&&s.lossPoints===5-s.lives,'原作损失生命状态损坏');check(int(s.lifeRecoveryCount,0,1)&&[0,3].includes(s.lastLifeRegainTurn)&&(!s.lifeRecoveryCount||s.lastLifeRegainTurn===3),'原作回血记录损坏');check(['shop','battle','result','over'].includes(s.phase),'原作阶段损坏');check(Array.isArray(s.team)&&s.team.length<=5,'原作编队损坏');const ids=new Set();for(const u of s.team){validateUnit(u,s.packId);check(!ids.has(u.uid),'武将标识重复');ids.add(u.uid);}check(s.shop&&Array.isArray(s.shop.units)&&s.shop.units.length<=40&&Array.isArray(s.shop.food)&&s.shop.food.length<=40,'原作商店损坏');for(const o of s.shop.units)if(o)check(pack(s.packId).unitIds.includes(o.id)&&typeof o.frozen==='boolean'&&int(o.shopAttack||0,0,50)&&int(o.shopHealth||0,0,50),'原作招募商品非法');for(const o of s.shop.food)if(o)check(FB[o.id]&&typeof o.frozen==='boolean'&&(o.price===undefined||int(o.price,0,300)),'原作食物商品非法');check(Array.isArray(s.history)&&s.history.length<=1000,'原作历史损坏');check(s.shopBuff&&int(s.shopBuff.attack,0,50)&&int(s.shopBuff.health,0,50),'原作商店成长损坏');if(['battle','result'].includes(s.phase)||s.battle){check(s.battle&&['player','opponent','draw'].includes(s.battle.winner)&&Array.isArray(s.battle.events)&&s.battle.events.length<=4097,'原作战报损坏');check(Array.isArray(s.battle.opponent)&&s.battle.opponent.length<=5,'原作敌阵损坏');for(const u of s.battle.opponent)validateUnit(u,s.packId);for(const e of s.battle.events){check(typeof e.type==='string'&&Array.isArray(e.teams)&&e.teams.length===2,'原作战斗事件损坏');for(const team of e.teams){check(Array.isArray(team)&&team.length<=5,'原作事件编队损坏');for(const u of team)validateUnit(u,s.packId,true);}}}return true;}

// Battle executor is shared by real combat and build-phase Pill effects. It never
// writes a battle clone back into the permanent player board.
function runCombat(teamA,teamB,seed,packId,build=false,buildState=null){
 const s={rng:seed>>>0},teams=build?[teamA,teamB]:clone([teamA,teamB]),events=[];let serial=1,exchanges=0,processingFaints=false,steps=0,depth=0;let activeAbility=null;
 const allocated=new Set();
 function allocateUid(prefix){let uid;do{if(build){check(buildState&&int(buildState.nextUid,1,999999),'召唤标识计数已达安全上限');uid=prefix+buildState.nextUid++;}else uid=prefix+serial++;}while(allocated.has(uid)||teams.some(team=>team.some(u=>u.uid===uid)));allocated.add(uid);return uid;}
 const snapshot=()=>clone(teams),loc=u=>{for(let side=0;side<2;side++){const index=teams[side].findIndex(x=>x.uid===u.uid);if(index>=0)return {side,index,u:teams[side][index]};}return null;},alive=u=>{const p=loc(u);return p&&u.health>0?p:null;};
 function emit(type,detail={}){check(++steps<=4096,'原作事件超过本机安全上限，未伪装成平局');events.push({type,...(activeAbility?{skillRole:activeAbility.role,trigger:activeAbility.trigger}:{}),...detail,teams:snapshot()});}
 function ordered(list){return list.map((u,sequence)=>({u,sequence,tie:rand(s)})).sort((a,b)=>b.u.attack-a.u.attack||a.tie-b.tie||a.sequence-b.sequence).map(x=>x.u);}
 function dispatch(list,event,extra={},after=()=>{}){return dispatchCandidates(list.filter(u=>triggerFor(u,event)===event),()=>rand(s),{eligible:u=>['before_faint','faint'].includes(event)?!!(loc(u)||extra.position):!!alive(u),sourceUid:extra.sourceUid??null,eventCount:()=>events.length,activate:u=>fire(event,u,extra),after,onSort:hooks.onTriggerSort?entry=>hooks.onTriggerSort({event,sourceUid:extra.sourceUid??null,...entry}):undefined});}
 for(let side=0;side<2;side++)for(const u of teams[side]){if(!build){u.uid=side+':'+u.uid;u.attack=totalA(u);u.health=totalH(u);u.tempAttack=u.tempHealth=0;}u.maxHealth=u.health;u.battleUses={};u.perkSpent=false;}
 function buff(u,a,h,source,temp=false){if(!alive(u))return;give(u,a,h,build&&temp);emit('buff',{side:loc(u).side,uid:u.uid,targetUid:u.uid,sourceUid:source.uid,effectKind:'buff',duration:build?(temp?'turn':'permanent'):'battle',attackDelta:a,healthDelta:h,amount:'+'+a+'/+'+h,message:(BY[source.id]?.name||source.name)+'：'+(BY[u.id]?.name||u.name)+' +'+a+'/+'+h});}
 function setPerk(u,p,source){if(!alive(u))return;givePerk(u,p);emit('ability',{side:loc(u).side,uid:u.uid,targetUid:u.uid,sourceUid:source.uid,effectKind:'equipment',perkEnum:p,message:(u.name||BY[u.id].name)+'获得'+FB[u.food].name});}
 function token(id,L,a,h){const u=unit('sap_token_'+id,allocateUid('summon_'));u.level=L;u.xp=L===3?5:L===2?2:0;u.attack=cap(a??u.attack);u.health=cap(h??u.health);u.maxHealth=u.health;u.battleUses={};if(id===85)givePerk(u,5);return u;}
 function summon(side,u,index,source=activeAbility?.source,effectKind='summon'){if(teams[side].length>=5){emit('summon_failed',{side,uid:u.uid,targetUid:u.uid,...(source?{sourceUid:source.uid}:{}),effectKind:'summon_failed',message:'队伍已满，召唤失败'});return false;}teams[side].splice(Math.max(0,Math.min(index,teams[side].length)),0,u);if(role(u)==='Scorpion')givePerk(u,2);emit('summon',{side,uid:u.uid,targetUid:u.uid,...(source?{sourceUid:source.uid}:{}),effectKind,unit:clone(u),message:'召唤'+(u.name||BY[u.id]?.name)});dispatch(teams[side].filter(x=>x.uid!==u.uid&&x.health>0),'friend_summon',{subject:u,sourceUid:u.uid});return true;}
 function damage(u,n,source,attack=false){if(!alive(u)||n<=0)return 0;let amount=Math.max(0,Math.floor(n)),blocked=0,p=perk(u);if(!u.perkSpent&&p===0){blocked=amount;amount=0;u.perkSpent=true;u.food=null;}else if(!u.perkSpent&&p===13){blocked=Math.min(20,amount);amount-=blocked;u.perkSpent=true;u.food=null;}else if(p===9)amount=Math.max(Math.min(amount,2),amount-2);
  if(attack&&perk(source)===2&&amount>0)amount=Math.max(amount,u.health);u.health-=amount;if(u.health<=0)u.killedBy=source.uid;emit('damage',{side:loc(u).side,uid:u.uid,targetUid:u.uid,sourceUid:source.uid,effectKind:attack?'attack_damage':'skill_damage',amount,blocked,message:(u.name||BY[u.id]?.name)+'受到'+amount+'伤害'});return amount;}
 function hurt(u){if(!alive(u))return;fire('hurt',u);const p=alive(u);if(p)dispatch(teams[p.side].filter(x=>x.uid!==u.uid&&x.health>0),'friend_hurt',{subject:u,sourceUid:u.uid});}
 function hit(u,n,source,attack=false){const amount=damage(u,n,source,attack);if(amount>0&&u.health>0)hurt(u);faints();}
 function triggerFor(u,event){return {Ant:'before_faint',Cricket:'faint',Horse:'friend_summon',Rat:'faint',Hedgehog:'before_faint',Peacock:'hurt',Flamingo:'before_faint',Kangaroo:'friend_ahead_attack',Spider:'faint',Dodo:'start',Badger:'before_faint',Dolphin:'start',Elephant:'after_attack',Camel:'hurt',Ox:'friend_ahead_faint',Dog:'friend_summon',Sheep:'faint',Skunk:'start',Hippo:'kill',Blowfish:'hurt',Turtle:'before_faint',Deer:'faint',Whale:event==='faint'?'faint':'start',Crocodile:'start',Rhino:'kill',Armadillo:'start',Rooster:'faint',Shark:'friend_faint',Turkey:'friend_summon',Leopard:'start',Boar:'before_attack',Wolverine:'friend_hurt',Gorilla:'hurt',Mammoth:'before_faint',Snake:'friend_ahead_attack',Fly:'friend_faint',Mosquito:'start',Crab:'start'}[role(u)];}
 function fire(event,u,extra={},fromAura=false,overrideLevel=null){if(!u)return;const p=loc(u)||extra.position;if(!p)return;const R=role(u),L=overrideLevel??u.level;let match=false,quota=null,perBattle=false;
  const trigger=triggerFor(u,event);
  if(trigger!==event)return;if(!['before_faint','faint'].includes(event)&&!alive(u))return;
  if(R==='Ox'||R==='Gorilla')quota=L;if(R==='Hippo'){quota=3;perBattle=true;}if(R==='Snake'){quota=5;perBattle=true;}if(R==='Fly'){if(BY[extra.subject?.id]?.sourcePetId===31)return;quota=3;if(teams[p.side].length>=5)return;}if(R==='Whale'&&event==='faint'&&!u.captive)return;if(R==='Wolverine'&&!fromAura){u.charges=(u.charges||0)+1;if(u.charges<4)return;u.charges=0;}
  if(quota!==null&&!fromAura&&!used(u,R,quota,perBattle))return;
  const capturedTiger=!fromAura&&!build&&!(R==='Whale'&&event==='faint')?(Object.hasOwn(extra,'repeatAura')?extra.repeatAura:teams[p.side][p.index+1]):null,repeatLevel=capturedTiger&&role(capturedTiger)==='Tiger'&&capturedTiger.health>0?capturedTiger.level:null;
  check(++depth<48,'原作技能递归超过安全上限');const own=teams[p.side],enemy=teams[1-p.side],ahead=own[p.index-1],behind=own[p.index+1],others=()=>own.filter(x=>x.uid!==u.uid&&x.health>0),enemies=()=>enemy.filter(x=>x.health>0),targets=n=>sample(s,enemies(),n),strike=(t,n)=>{if(t)hit(t,n,u);};
  const previousAbility=activeAbility;activeAbility={source:u,role:R,trigger:event};
  try{switch(R){
   case 'Ant':{const f=pick(s,others());if(f)buff(f,L,L,u);break;}
   case 'Cricket':summon(p.side,token(86,L,L,L),extra.index??p.index);break;
   case 'Horse':if(extra.subject)buff(extra.subject,L,0,u,true);break;
   case 'Mosquito':for(const f of targets(L))strike(f,1);break;
   case 'Crab':{const hp=Math.max(0,...others().map(x=>x.health));buff(u,0,Math.ceil(hp*.25*L),u);break;}
   case 'Rat':for(let i=0;i<L;i++)summon(1-p.side,token(58,1),0);break;
   case 'Hedgehog':{const all=ordered(teams.flat().filter(x=>x.health>0));const hitUnits=[];for(const f of all)if(damage(f,2*L,u)>0&&f.health>0)hitUnits.push(f);for(const f of hitUnits)hurt(f);break;}
   case 'Peacock':buff(u,3*L,0,u);break;
   case 'Flamingo':for(const f of own.slice(p.index+1,p.index+3))buff(f,L,L,u);break;
   case 'Kangaroo':buff(u,L,L,u);break;
   case 'Spider':{const d=pick(s,units(packId).filter(x=>x.tier===3)),child=unit(d.id,allocateUid('summon_'));child.level=L;child.xp=L===3?5:L===2?2:0;child.attack=2*L;child.health=2*L;child.maxHealth=2*L;child.battleUses={};summon(p.side,child,extra.index??p.index);break;}
   case 'Dodo':if(ahead)buff(ahead,Math.floor(u.attack*.5*L),0,u);break;
   case 'Badger':{const adjacent=[own[p.index-1],own[p.index+1],...(p.index===0?[enemy[0]]:[])].filter(x=>x&&x.health>0);for(const f of adjacent)strike(f,Math.floor(u.attack*.5*L));break;}
   case 'Dolphin':for(let n=0;n<L;n++){const e=enemies();if(!e.length)break;const hp=Math.min(...e.map(x=>x.health));strike(pick(s,e.filter(x=>x.health===hp)),4);}break;
   case 'Elephant':for(let n=0;n<L;n++){const current=loc(u);if(current)strike(teams[current.side][current.index+1],1);}break;
   case 'Camel':if(behind)buff(behind,L,2*L,u);break;
   case 'Ox':setPerk(u,13,u);buff(u,1,0,u);break;
   case 'Dog':buff(u,2*L,L,u,true);break;
   case 'Sheep':for(let i=0;i<2;i++)summon(p.side,token(62,L,2*L,2*L),(extra.index??p.index)+i);break;
   case 'Skunk':{const es=enemies();if(es.length){const hp=Math.max(...es.map(x=>x.health)),e=pick(s,es.filter(x=>x.health===hp)),healthBefore=e.health;e.health=Math.max(1,Math.floor(e.health*[.667,.334,0][L-1]));emit('ability',{side:1-p.side,uid:e.uid,targetUid:e.uid,sourceUid:u.uid,effectKind:'health_reduction',amount:healthBefore-e.health,healthBefore,healthAfter:e.health,message:'臭鼬降低敌军生命至'+e.health});}break;}
   case 'Hippo':buff(u,3*L,3*L,u);break;
   case 'Blowfish':strike(pick(s,enemies()),3*L);break;
   case 'Turtle':for(const f of own.slice(p.index+1,p.index+1+L))setPerk(f,13,u);break;
   case 'Deer':summon(p.side,token(85,L,5*L,3*L),extra.index??p.index);break;
   case 'Whale':if(event==='start'&&ahead){(u.captive||=[]).push({id:ahead.id,attack:ahead.attack,health:ahead.health,level:L});own.splice(p.index-1,1);emit('ability',{side:p.side,uid:u.uid,sourceUid:u.uid,targetUid:ahead.uid,effectKind:'swallow',message:'鲸鱼吞下前方友军，不触发阵亡'});}else if(event==='faint'&&u.captive){let offset=0;for(const memory of u.captive){const child=unit(memory.id,allocateUid('released_'));child.attack=memory.attack;child.health=memory.health;child.maxHealth=child.health;child.level=memory.level;child.xp=child.level===3?5:child.level===2?2:0;child.battleUses={};summon(p.side,child,(extra.index??p.index)+offset++);}u.captive=null;}break;
   case 'Crocodile':for(let i=0;i<L;i++)strike(enemies().at(-1),8);break;
   case 'Rhino':{const e=enemies()[0];if(e)strike(e,(BY[e.id]?.tier<=1?8:4)*L);break;}
   case 'Armadillo':for(const f of teams.flat().filter(x=>x.health>0))buff(f,0,8*L,u);break;
   case 'Rooster':for(let i=0;i<L;i++)summon(p.side,token(13,L,Math.floor((build?totalA(u):u.attack)*.5),1),(extra.index??p.index)+i);break;
   case 'Shark':buff(u,2*L,2*L,u);break;
   case 'Turkey':if(extra.subject)buff(extra.subject,3*L,L,u);break;
   case 'Leopard':for(const e of targets(L))strike(e,Math.floor(u.attack*.5));break;
   case 'Boar':buff(u,4*L,2*L,u);break;
   case 'Wolverine':for(const e of enemies()){const healthBefore=e.health;e.health=Math.max(1,e.health-3*L);emit('ability',{side:1-p.side,uid:e.uid,targetUid:e.uid,sourceUid:u.uid,effectKind:'health_reduction',amount:healthBefore-e.health,healthBefore,healthAfter:e.health,message:'狼獾移除'+(3*L)+'生命，最低1'});}break;
   case 'Gorilla':setPerk(u,0,u);break;
   case 'Mammoth':for(const f of others())buff(f,2*L,2*L,u);break;
   case 'Snake':strike(pick(s,enemies()),5*L);break;
   case 'Fly':summon(p.side,token(31,L,4*L,4*L),extra.index??p.index);break;
  }}finally{activeAbility=previousAbility;depth--;}
  if(repeatLevel!==null)fire(event,u,extra,true,repeatLevel);
 }
 function faints(){if(processingFaints)return;processingFaints=true;try{let rounds=0;while(true){check(++rounds<=128,'原作阵亡连锁超过安全上限');const dead=ordered(teams.flat().filter(x=>x.health<=0));if(!dead.length)break;const records=dead.map(u=>({u,...loc(u)}));dispatch(records.map(r=>r.u),'before_faint');
  for(const r of records){const now=loc(r.u);if(!now)continue;const source=r.u,side=now.side,index=now.index,behind=teams[side][index+1];teams[side].splice(index,1);emit('faint',{side,uid:source.uid,targetUid:source.uid,...(source.killedBy?{sourceUid:source.killedBy}:{}),effectKind:'faint',unit:clone(source),message:(source.name||BY[source.id]?.name)+'阵亡'});fire('faint',source,{position:{side,index},index,repeatAura:behind});
   if(perk(source)===8)summon(side,token(4,1,1,1),index,source);if(perk(source)===1&&!source.perkSpent){const revived=rebuildAfterMushroom(source,allocateUid('revived_'));summon(side,revived,index,source,'revive');}
   if(behind&&alive(behind))fire('friend_ahead_faint',behind,{subject:source,index});dispatch(teams[side].filter(x=>x.health>0),'friend_faint',{subject:source,index,sourceUid:source.uid});
   if(source.killedBy){const killer=teams.flat().find(x=>x.uid===source.killedBy&&x.health>0);if(killer)fire('kill',killer,{subject:source});}
  }
 }}finally{processingFaints=false;}}
 if(build)return {teams,events,rng:s.rng,kill(u){u.health=0;faints();return {teams,events,rng:s.rng};}};
 emit('start',{message:'两军交锋 · 原作海龟包规则'});dispatch(teams.flat(),'start',{},()=>faints());
 while(teams[0].length&&teams[1].length&&exchanges<300){exchanges++;let a=teams[0][0],b=teams[1][0];dispatch([a,b],'before_attack');faints();if(!alive(a)||!alive(b))continue;
  emit('attack',{side:0,uid:a.uid,sourceUid:a.uid,targetUid:b.uid,attackers:[a.uid,b.uid],message:'双方前排同时攻击'});const da=a.attack+(perk(a)===6?3:perk(a)===12&&!a.perkSpent?20:0),db=b.attack+(perk(b)===6?3:perk(b)===12&&!b.perkSpent?20:0),splashA=perk(a)===5?teams[1][1]:null,splashB=perk(b)===5?teams[0][1]:null;
  if(perk(a)===12&&!a.perkSpent){a.perkSpent=true;a.food=null;}if(perk(b)===12&&!b.perkSpent){b.perkSpent=true;b.food=null;}
  const hurtUnits=[];for(const [u,n,src]of [[b,da,a],[a,db,b],...(splashA?[[splashA,5,a]]:[]),...(splashB?[[splashB,5,b]]:[])]){const amount=damage(u,n,src,true);if(amount>0&&u.health>0)hurtUnits.push(u);}for(const u of ordered(hurtUnits))hurt(u);
  for(const [side,attacker]of [[0,a],[1,b]]){const f=teams[side][1];if(f&&f.health>0)fire('friend_ahead_attack',f,{subject:attacker});}faints();dispatch([a,b],'after_attack');faints();
 }
 check(exchanges<300||!teams[0].length||!teams[1].length,'原作战斗超出本机交换安全上限');const winner=teams[0].length&&!teams[1].length?'player':teams[1].length&&!teams[0].length?'opponent':'draw';emit('end',{winner,reason:'combat',message:winner==='player'?'我方获胜':winner==='opponent'?'敌方获胜':'双方平局'});return {winner,events,seed,rng:s.rng,exchanges,reason:'combat'};
}
function simulateBattle(a,b,seed,packId){const first=a.find(x=>BY[x.id])||b.find(x=>BY[x.id]);packId=packId||D.PACKS.find(p=>p.unitIds.includes(first?.id))?.id||D.DEFAULT_PACK_ID;pack(packId);check(int(seed,0,4294967295),'原作战斗种子非法');return runCombat(a,b,seed,packId);}

function applyFood(s,offer,target){const f=FB[offer.id],id=f.sourceFoodId,mult=1+s.team.filter(u=>role(u)==='Cat'&&(u.turnUses.Cat||0)<2).reduce((n,u)=>n+u.level,0);let recipients=[];
 if(f.kind==='equipment'){givePerk(target,f.perkEnum);recipients=[target];}
 else if(id===92){const b=runCombat(s.team,[],s.rng,s.packId,true,s),result=b.kill(target);s.rng=result.rng;recipients=[target];}
 else if(id===16){s.shopBuff.attack=cap(s.shopBuff.attack+mult);s.shopBuff.health=cap(s.shopBuff.health+mult);for(const o of s.shop.units)if(o){o.shopAttack=cap((o.shopAttack||0)+mult);o.shopHealth=cap((o.shopHealth||0)+mult);}}
 else if(f.kind==='experience'){check(target.level<3,'目标已满级');gainXP(s,target,1);recipients=[target];}
 else{recipients=[73,82,63].includes(id)?sample(s,s.team,{73:2,82:3,63:2}[id]):[target];const e=f.effects.find(x=>x.kind==='GiveBuff');check(e&&int(e.attack,0,50)&&int(e.health,0,50),'未实现的原作食物效果 '+id);for(const u of recipients)give(u,e.attack*mult,e.health*mult,e.durationEnum===1);}
 if(f.effects.some(e=>['GiveBuff','GiveShopPermanentBuff'].includes(e.kind)))for(const cat of s.team.filter(u=>role(u)==='Cat'))used(cat,'Cat',2);
 for(const u of sourceOrder(s,[...s.team])){if(role(u)==='Rabbit')for(const r of recipients)if(s.team.includes(r)&&used(u,'Rabbit',3))give(r,0,u.level);if(role(u)==='Seal'&&recipients.includes(u))for(const r of sample(s,s.team.filter(x=>x.uid!==u.uid),3))give(r,u.level,0);if(role(u)==='Cow'&&recipients.includes(u)&&![130,131,132].includes(id))cowFood(s,u,true);}
}
function act(input,c){validateState(input);const s=clone(input);check(c&&typeof c.type==='string','无效原作操作');const type=c.type;
 if(type==='FINISH_BATTLE'){check(s.phase==='battle','当前不在战斗');const win=s.battle.winner;if(win==='player')s.wins++;if(win==='opponent'){s.lives=Math.max(0,s.lives-1);s.lossPoints=5-s.lives;}s.history.push({turn:s.turn,winner:win});s.phase=s.wins>=10||s.lives<=0?'over':'result';return s;}
 if(type==='NEXT_ROUND'){check(s.phase==='result','请先结算战斗');s.turn++;s.gold=10;s.phase='shop';delete s.battle;startTurn(s);validateState(s);return s;}
 check(s.phase==='shop','请先结算当前战斗');const requireSlot=i=>{check(int(i,0,s.team.length-1),'请选择有效友军');return s.team[i];},offer=(kind,i)=>{check(int(i,0,s.shop[kind].length-1)&&s.shop[kind][i],'商品已售出或不存在');return s.shop[kind][i];};
 if(type==='ROLL'){check(s.gold>=1,'金币不足');s.gold--;restock(s);}
 else if(type==='FREEZE'){check(['units','food'].includes(c.kind),'商品类别错误');const o=offer(c.kind,c.index);o.frozen=!o.frozen;}
 else if(type==='BUY'){check(s.gold>=3,'招募需要3金币');const o=offer('units',c.index),bought=unit(o.id,'unit_'+s.nextUid++);give(bought,o.shopAttack||0,o.shopHealth||0);const target=c.slot===undefined?null:s.team[c.slot];
  if(target?.id===bought.id){merge(s,target,bought);s.gold-=3;consumeUnitOffer(s,c.index,o);onBought(s,target);}else{check(s.team.length<5,'队伍已满');check(c.slot===undefined||int(c.slot,0,s.team.length),'无效招募位置');s.team.splice(c.slot??s.team.length,0,bought);s.gold-=3;consumeUnitOffer(s,c.index,o);notifySummon(s,bought);onBought(s,bought);}}
 else if(type==='SELL'){const u=requireSlot(c.slot),L=u.level;if(role(u)==='Pig')u.extraSellValue+=L;s.gold=Math.min(300,s.gold+u.level+(u.extraSellValue||0));s.team.splice(c.slot,1);switch(role(u)){case 'Duck':for(const o of s.shop.units)if(o)o.shopHealth=cap((o.shopHealth||0)+L);break;case 'Beaver':for(const f of sample(s,s.team,2))give(f,L,0);break;case 'Pigeon':addFood(s,139,L,0);break;}}
 else if(type==='MOVE'){requireSlot(c.from);requireSlot(c.to);[s.team[c.from],s.team[c.to]]=[s.team[c.to],s.team[c.from]];}
 else if(type==='MERGE'){const from=requireSlot(c.from),to=requireSlot(c.to);s.team.splice(c.from,1);merge(s,to,from);}
 else if(type==='FOOD'){const o=offer('food',c.index),f=FB[o.id],price=foodPrice(s,o);check(s.gold>=price,'金币不足');check(s.team.length>0||f.sourceFoodId===16,'先招募一名武将');const target=s.team.length?requireSlot(c.target??0):null;if(f.kind==='experience')check(target.level<3,'目标已满级，请选择其他友军');s.gold-=price;s.shop.food[c.index]=null;applyFood(s,o,target);}
 else if(type==='BATTLE'){check(s.team.length>0,'先招募一名武将');endTurn(s);const opponentSeed=nextSeed(s),battleSeed=nextSeed(s),opponent=makeOpponent(s.turn,opponentSeed,s.packId),battle=simulateBattle(s.team,opponent,battleSeed,s.packId);s.rng=battle.rng;s.battle={...battle,opponent,opponentSeed,opponentInfo:opponentInfo(s.turn,opponentSeed,s.packId)};s.phase='battle';}
 else throw Error('未知原作操作 '+type);validateState(s);return s;
}

// Offline arena opponents spend the same 10-gold economy. There are no free
// turn-based stat or level grants. This is a local legal-economy policy, not
// the original asynchronous server's player snapshot distribution.
const opponentCache=new Map();
function makeOpponent(turn,seed,packId=D.DEFAULT_PACK_ID){check(int(turn,1,1000),'无效敌阵轮次');const key=[turn,seed,packId].join(':');if(opponentCache.has(key))return clone(opponentCache.get(key));let s=createRun(seed,packId);const style=(seed>>>0)%6;
 const focus=[['Ant','Cricket','Horse','Spider','Sheep','Deer','Turkey','Fly'],['Camel','Peacock','Elephant','Blowfish','Gorilla','Wolverine'],['Fish','Swan','Giraffe','Penguin','Bison','Monkey','Dragon'],['Dodo','Dolphin','Skunk','Crocodile','Leopard','Tiger'],['Cow','Rabbit','Worm','Seal','Cat'],['Kangaroo','Hippo','Whale','Rhino','Boar','Snake']][style];
 for(let t=1;t<=turn;t++){
  if(t>1){s.turn=t;s.gold=10;startTurn(s);}let actions=0;
  while(s.gold>0&&actions++<60){
   const scored=s.shop.units.map((o,i)=>{if(!o)return null;const d=BY[o.id],same=s.team.findIndex(u=>u.id===o.id&&u.level<3),score=(same>=0?100:0)+(focus.includes(d.sapRole)?12:0)+d.tier*2+d.attack+d.health;return {i,d,same,score};}).filter(Boolean).sort((a,b)=>b.score-a.score);
   const buy=scored.find(x=>x.same>=0||s.team.length<5);if(s.gold>=3&&buy){s=act(s,{type:'BUY',index:buy.i,...(buy.same>=0?{slot:buy.same}:{})});continue;}
   if(s.team.length===5&&s.gold>=3){const worst=[...s.team].map((u,i)=>({u,i,score:u.attack+u.health+u.xp*4+(focus.includes(role(u))?10:0)})).sort((a,b)=>a.score-b.score)[0],best=scored[0];if(best&&best.score>worst.score+8){s=act(s,{type:'SELL',slot:worst.i});continue;}}
   const available=s.shop.food.map((o,i)=>o&&({o,i,d:FB[o.id],price:foodPrice(s,o)})).filter(x=>x&&x.price<=s.gold&&x.d.sourceFoodId!==92&&s.team.length&&(!['experience'].includes(x.d.kind)||s.team.some(u=>u.level<3)));
   available.sort((a,b)=>(b.d.kind==='experience'?100:b.d.tier)-(a.d.kind==='experience'?100:a.d.tier));if(available.length){const food=available[0],target=food.d.kind==='experience'?s.team.findIndex(u=>u.level<3):[...s.team].map((u,i)=>({u,i})).sort((a,b)=>b.u.attack+b.u.health-a.u.attack-a.u.health)[0].i;s=act(s,{type:'FOOD',index:food.i,target});continue;}
   if(s.gold>=1){s=act(s,{type:'ROLL'});continue;}break;
  }
  const frontline=['Boar','Hippo','Peacock','Elephant','Cricket','Ant','Sheep','Deer','Rhino','Gorilla'];s.team.sort((a,b)=>(frontline.includes(role(b))?20:0)+b.attack+b.health-(frontline.includes(role(a))?20:0)-a.attack-a.health);endTurn(s);s.history.push({turn:t,winner:((seed+t)%3===0?'opponent':'draw')});
 }
 const out=clone(s.team);if(opponentCache.size>=200)opponentCache.delete(opponentCache.keys().next().value);opponentCache.set(key,out);return clone(out);
}
function opponentInfo(turn,seed,packId){return {id:'legal-economy-'+((seed>>>0)%6),name:['召唤接力','承伤反击','经营成长','开战狙击','食物养成','前后联击'][(seed>>>0)%6],hint:'本地离线策略：同包、同轮次、真实买卖与食物成长；未使用原作服务器对手数据。',phase:turn<=4?'前期':turn<=10?'中期':'后期',packId,tier:tier(turn),algorithm:'LOCAL_LEGAL_ECONOMY_SAP_SOURCE',seed:seed>>>0};}
function previewOpponent(s){validateState(s);const copy=clone(s);endTurn(copy);const seed=nextSeed(copy);return {team:makeOpponent(s.turn,seed,s.packId),info:opponentInfo(s.turn,seed,s.packId)};}
return Object.freeze({ruleTools:Object.freeze({selectNext,dispatchCandidates}),createRun,act,validateState,simulateBattle,previewOpponent,makeOpponent,describeOpponent:opponentInfo,foodPrice,capacity,units,foods,BY,FB,sourceRules:D.PETS});
});
