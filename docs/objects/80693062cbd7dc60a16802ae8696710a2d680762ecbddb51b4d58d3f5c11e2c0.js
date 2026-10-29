/* Presentation geometry and stat badges only. No state, RNG or executor imports. */
(function(r,f){if(typeof module==='object'&&module.exports)module.exports=f();else r.SS2BattlePresentation=f();})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const SIZE=Object.freeze({pc:Object.freeze({width:1400,height:480}),mobile:Object.freeze({width:720,height:1320})});
const cap=n=>Math.max(0,Math.min(50,Math.floor(Number(n)||0)));
function position(index,side,mobile){if(!Number.isInteger(index)||index<0||index>4||![0,1].includes(side))throw Error('Invalid presentation slot');if(mobile)return {x:index===0?(side===0?270:450):(side===0?134:586),y:index===0?230:430+(index-1)*220,scale:index===0?1:.55};return {x:side===0?610-index*127:790+index*127,y:index===0?265:280-(index%2)*15,scale:index===0?.95:.62};}
function labelPosition(index,side,mobile){const p=position(index,side,mobile),s=mobile?SIZE.mobile:SIZE.pc;return {left:100*p.x/s.width,top:100*(p.y+8)/s.height,width:mobile?(index===0?23:29):9.1};}
function badges(attack,health){return '<span class="stat-pair"><span class="stat-medallion stat-attack" role="img" aria-label="攻击 '+cap(attack)+'"><b>'+cap(attack)+'</b></span><span class="stat-medallion stat-health" role="img" aria-label="生命 '+cap(health)+'" data-zero="'+(cap(health)===0)+'"><b>'+cap(health)+'</b></span></span>';}
function board(ctx,mobile){const s=mobile?SIZE.mobile:SIZE.pc;ctx.save();ctx.lineWidth=mobile?3:2;ctx.strokeStyle='#f6e9bb99';ctx.setLineDash([8,9]);for(const side of [0,1]){ctx.beginPath();for(let i=4;i>=0;i--){const p=position(i,side,mobile);if(i===4)ctx.moveTo(p.x,p.y+5);else ctx.lineTo(p.x,p.y+5);}ctx.stroke();const p=position(0,side,mobile);ctx.setLineDash([]);ctx.fillStyle='#d4ae4666';ctx.strokeStyle='#ffdc75';ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(p.x,p.y+5,mobile?55:57,mobile?16:13,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.setLineDash([8,9]);}ctx.setLineDash([]);ctx.textAlign='center';ctx.fillStyle='#fff8df';ctx.strokeStyle='#244a43';ctx.lineWidth=5;ctx.font='bold '+(mobile?25:21)+'px Microsoft YaHei';const text='交锋',x=s.width/2,y=mobile?125:205;ctx.strokeText(text,x,y);ctx.fillText(text,x,y);ctx.restore();}
return Object.freeze({SIZE,position,labelPosition,badges,board,cap});
});




