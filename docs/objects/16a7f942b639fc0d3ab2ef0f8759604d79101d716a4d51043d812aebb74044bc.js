(function(r,f){if(typeof module==='object'&&module.exports)module.exports=f(require('./content.js'),require('./packs.js'));else r.SS2ProductOpponents=f(r.SS2Content,r.SS2Packs);})(typeof globalThis!=='undefined'?globalThis:this,function(C,P){'use strict';
function describe(turn,seed,packId){const p=P.getPack(packId),i=(seed>>>0)%p.builds.length,b=p.builds[i];return {id:p.themeKey+'-'+i,name:b.name,hint:b.hint,phase:turn<=4?'前期':turn<=10?'中期':'后期',packId,tier:Math.min(6,Math.floor((turn+1)/2)),algorithm:'LOCAL_THEMED_LEGAL_ECONOMY_R1',seed:seed>>>0};}
const cache=new Map(),clone=x=>JSON.parse(JSON.stringify(x));
function generate(api,turn,seed,packId){if(!Number.isInteger(turn)||turn<1||turn>25)throw Error('无效对手回合');const cacheKey=packId+'|'+turn+'|'+seed;if(cache.has(cacheKey))return clone(cache.get(cacheKey));const pack=P.getPack(packId),build=pack.builds[(seed>>>0)%pack.builds.length],wanted=new Set(build.unitIds);let s=api.createRun(seed>>>0,packId),operations=0;
 const score=d=>{const m=d.mechanic;return (wanted.has(d.id)?8:0)+(m?.trigger==='end_shop'||m?.trigger==='round_start'?turn<7?5:1:0)+(m?.trigger==='start'?1:0);};
 for(let round=1;round<=turn;round++){
  let attempts=0;while(s.gold>=1&&attempts++<16){
   const offers=s.shop.units.map((o,i)=>o?{o,i,d:C.BY_ID[o.id]}:null).filter(Boolean).sort((a,b)=>score(b.d)-score(a.d)),same=offers.find(x=>s.team.some(u=>u.id===x.o.id&&u.level<3));
   let command=null;
   if(s.gold>=3&&same)command={type:'BUY',index:same.i,slot:s.team.findIndex(u=>u.id===same.o.id&&u.level<3)};
   else if(s.gold>=3&&s.team.length<5&&offers.length)command={type:'BUY',index:offers[0].i};
   else {const foods=s.shop.food.map((o,i)=>o?{o,i,d:C.FOOD_BY_ID[o.id],price:api.foodPrice(s,o)}:null).filter(x=>x&&x.price<=s.gold&&x.d.kind!=='faint_action');
    const food=foods.find(x=>x.d.targetScope==='shop'||s.team.some(u=>x.d.kind!=='experience'||u.level<3));
    if(food){let target=s.team.findIndex(u=>food.d.kind!=='experience'||u.level<3);if(target<0&&food.d.targetScope!=='shop')break;command={type:'FOOD',index:food.i,target:Math.max(0,target)};}
    else if(s.gold>=3&&offers[0]&&s.team.length===5){const weakest=s.team.reduce((a,u,i)=>score(C.BY_ID[u.id]||{})<score(C.BY_ID[s.team[a].id]||{})?i:a,0),old=s.team[weakest];if(score(offers[0].d)>score(C.BY_ID[old.id]||{})+2&&old.level===1){s=api.act(s,{type:'SELL',slot:weakest});operations++;command={type:'BUY',index:offers[0].i};}else command={type:'ROLL'};}
    else command={type:'ROLL'};
   }
   try{s=api.act(s,command);operations++;}catch(e){if(!/没有有效目标|已经满级|队伍已满|没有装备|次数|请选择/.test(e.message))throw e;if(s.gold>=1&&command.type!=='ROLL'){s=api.act(s,{type:'ROLL'});operations++;}else break;}
  }
  api.endShop(s);
  if(round<turn){s.phase='result';api.nextRound(s);}
 }
 // Deterministic ordering uses real positions, not fabricated stats or rewards.
 const fronts=s.team.filter(u=>C.BY_ID[u.id]?.mechanic?.condition==='front'),rears=s.team.filter(u=>C.BY_ID[u.id]?.mechanic?.condition==='rear'),middle=s.team.filter(u=>!fronts.includes(u)&&!rears.includes(u));s.team=[...fronts,...middle,...rears];
 const result={team:s.team,info:{...describe(turn,seed,packId),operations,turnsPlayed:turn,stats:'Only real purchases, merges, foods and round triggers; no growth injection'}};cache.set(cacheKey,clone(result));if(cache.size>64)cache.delete(cache.keys().next().value);return result;
}
return Object.freeze({generate,describe});
});
