// Presentation only for immutable historical web shells. No state/RNG writes.
function installPCHeadOverlay(){
 if(selectedManifest.id===SS2_PC_HEAD_RELEASE||window.SS2_PC_HEAD_OVERLAY)return;
 const team=document.getElementById('team');if(!team)return;
 const media=matchMedia('(min-width:901px)'),attempted=new WeakMap();let queued=false,busy=false,again=false;
 const style=document.createElement('style');style.textContent='@media(min-width:901px){#team .pc-team-portrait{display:inline-grid;place-items:center;flex:0 0 80px;width:80px;height:80px;margin-right:8px;pointer-events:none}#team .pc-team-portrait>img{width:80px;height:80px;max-width:100%;object-fit:contain}}@media(min-width:901px) and (max-width:1000px){#team .pc-team-portrait{margin:0 auto 5px}}';document.head.append(style);
 const retry=document.createElement('button');retry.id='web-heads-retry';retry.textContent='重试队伍头像';retry.hidden=true;document.querySelector('.web-toolbar').append(retry);
 function schedule(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;refresh();});}
 async function refresh(){
  if(!media.matches||!cacheState.releases[SS2_PC_HEAD_RELEASE])return;
  if(busy){again=true;return;}busy=true;
  try{
   const nodes=[...team.querySelectorAll('.team-slot canvas[data-portrait]')].slice(0,5),todo=nodes.filter(c=>attempted.get(c)!=='done'&&attempted.get(c)!=='failed');
   for(const h of team.querySelectorAll('.team-slot>.mobile-head-holder'))h.classList.add('pc-team-portrait');
   const rows=todo.map(c=>({c,path:SS2_PC_HEADS[c.dataset.portrait]})).filter(x=>x.path);
   if(!rows.length)return;
   rows.forEach(({c})=>attempted.set(c,'done'));
   try{
    await request('ENSURE',{release:SS2_PC_HEAD_RELEASE,paths:[...new Set(rows.map(x=>x.path))]});
    await Promise.all(rows.map(async({c,path})=>{const image=new Image();image.alt=c.getAttribute('aria-label')||'武将头像';image.decoding='async';image.src=path;await image.decode();if(!c.isConnected||!media.matches)return;const holder=document.createElement('span');holder.className='pc-team-portrait';holder.append(image);c.replaceWith(holder);}));
    retry.hidden=true;team.dataset.headsState='ready';
   }catch{rows.forEach(({c})=>attempted.set(c,'failed'));retry.hidden=false;team.dataset.headsState='retry';retry.title='头像未准备好，原角色图仍可使用。联网后重试。';}
  }finally{busy=false;if(again){again=false;schedule();}}
 }
 function retryHeads(){for(const c of team.querySelectorAll('canvas[data-portrait]'))attempted.delete(c);schedule();}
 retry.onclick=retryHeads;media.addEventListener('change',retryHeads);window.addEventListener('online',retryHeads);
 new MutationObserver(schedule).observe(team,{childList:true,subtree:true});
 window.SS2_PC_HEAD_OVERLAY={refresh:retryHeads,release:SS2_PC_HEAD_RELEASE};schedule();
}
