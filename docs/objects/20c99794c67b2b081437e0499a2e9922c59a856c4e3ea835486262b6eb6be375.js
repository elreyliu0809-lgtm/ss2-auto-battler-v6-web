/* Standalone local adaptation. Identity/assets follow the q9 source roster; mechanics are local. */
(function(r,f){if(typeof module==='object'&&module.exports)module.exports=f();else r.SS2Redgold=f();})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const rows=[
['800010','巧变张郃',1,2,3,'buy_buff','friend_attack','attack','800050',1],
['800020','锦衣马超',1,2,3,'after_attack_self','kill_shot','hurt','800060',2],
['800030','斗将甘宁',1,3,2,'sell_buff','after_attack_self','attack','800070',3],
['800040','闭月貂蝉',1,1,4,'end_front','summon_buff','friend_faint','800080',4],
['800090','神行夏侯渊',2,3,3,'roll_growth','weak_shot','start','800130',1],
['800100','弓神黄忠',2,3,4,'start_front_attack','friend_attack','attack','800140',2],
['800110','天香小乔',2,2,4,'food_health','hurt_friend','friend_faint','800150',3],
['800120','千幻左慈',2,2,4,'start_copy','start_copy','attack','800160',4],
['800170','恶来典韦',3,3,6,'hurt_friend','hurt_shield','hurt','800210',1],
['800180','义绝关羽',3,4,4,'after_attack_self','after_attack_splash','attack','800220',2],
['800190','不屈周泰',3,2,7,'armor','friend_faint','hurt','800230',3],
['800200','曜武华雄',3,4,4,'faint_soldier','faint_ox','hurt','800240',4],
['800250','帝皇侠',4,4,6,'friend_faint','after_attack_self','friend_faint','800260',5],
['800270','铁壁曹仁',4,3,7,'armor','hurt_shield','hurt','800310',1],
['800280','英风祝融',4,4,5,'summon_buff','friend_attack','friend_faint','800320',2],
['800290','侠烈凌统',4,5,5,'after_attack_splash','kill_shot','attack','800330',3],
['800300','陷阵高顺',5,5,6,'faint_buff','faint_ox','hurt','800340',4],
['800350','犬夜叉',5,6,6,'after_attack_self','hurt_shield','hurt','800360',5],
['800370','魏武曹操',5,5,7,'food_rebate','triple_shot','start','800380',1],
['800390','昭烈刘备',6,5,8,'end_levels','friend_faint','friend_faint','800400',2],
['800410','杀生丸',6,7,7,'start_level_attack','kill_shot','attack','800420',5],
['800430','无双吕布',6,7,7,'tier1_buy','after_attack_splash','start','800440',4]];
const triggerLabels={start:'战斗开始',hurt:'首次受伤且存活',attack:'首次攻击后且存活',friend_faint:'其他友军首次阵亡且自身存活'};
return Object.freeze({rows:Object.freeze(rows.map(x=>Object.freeze(x))),triggerLabels:Object.freeze(triggerLabels)});
});
