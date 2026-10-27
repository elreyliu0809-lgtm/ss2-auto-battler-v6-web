(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.SS2Content=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const VERSION='local-base-18-v1';
const rows=[
['1100180','张宝',1,2,2,'faint_buff','阵亡：随机一名友军+2L攻击/+L生命（战斗内）'],
['1100190','张梁',1,1,2,'faint_soldier','阵亡：在本位召唤L/L黄巾兵'],
['1100130','仁术华佗',1,1,3,'buy_buff','招募：随机其他一名友军永久+L攻击/+L生命'],
['1100060','奋武公孙瓒',2,2,3,'summon_buff','战斗中友军召唤：新召唤友军+L攻击'],
['1100030','坚城曹仁',2,3,3,'armor','战斗开始：自身获得护甲，伤害减少2L，最低1；与蒜甲取较高'],
['1100070','仙姿貂蝉',2,1,3,'income','回合开始：额外获得L金币'],
['1100050','枭姬孙尚香',3,2,3,'friend_attack','前方相邻友军攻击后：自身+2L攻击/+2L生命（战斗内）'],
['1100110','诡妙魏延',3,2,5,'hurt_friend','受伤且存活：身后相邻友军+L攻击/+2L生命（战斗内）'],
['1100100','灵断张春华',3,2,4,'end_front','结束购买：前方相邻友军永久+L攻击/+L生命'],
['1100140','奇策荀攸',4,1,3,'end_levels','结束购买：按阵位最多两名其他等级至少2友军永久+L攻击/+L生命'],
['1100150','烟云诸葛果',4,1,1,'faint_ox','阵亡：本位召唤5L/5L木牛，攻击附带对第二敌人5点伤害'],
['1100170','贤师张角',4,3,8,'swallow','战斗开始：吞下前方相邻友军；自身阵亡释放，恢复战前攻血再+2L/+2L'],
['1100120','筹略吕蒙',5,4,3,'weak_shot','战斗开始：对生命最低敌人造成3L伤害，并列随机'],
['1100160','国士陆逊',5,8,4,'back_shot','战斗开始：对敌方最后一名造成8L伤害'],
['1100080','威灵吕布',5,5,8,'kill_shot','自身击杀且存活：对敌方最前一名造成4L伤害'],
['1100010','齐天大圣',6,6,9,'hurt_shield','受伤且存活：获得抵消下次伤害的护盾，每场最多触发L次'],
['1100220','奇疾夏侯渊',6,10,4,'triple_shot','战斗开始：独立随机射击3次，各造成floor(自身攻击×L/2)伤害'],
['1100040','神威马超',6,6,8,'tier1_buy','购买1阶友军后：其他友军永久+L/+L，每回合最多3次']];
rows.push(...[["1100090","李寻欢",1,2,1,"sell_buff","出售：随机一名剩余友军永久+2L攻击/+L生命"],["1100250","弄雪蔡文姬",1,1,3,"food_health","购买军需：每名实际受益友军额外永久+L生命（含装备）"],["1100300","锦帆甘宁",2,3,3,"roll_growth","刷新商店：自身永久+L攻击，每回合最多2次"],["1100200","聂风",2,2,4,"end_economy","结束购买：金币至少3时自身永久+L攻击/+L生命"],["1100210","步惊云",3,4,3,"start_front_attack","战斗开始：前方相邻友军攻击+floor(自身攻击×L/2)，仅本场"],["1100240","胆烈文鸯",3,3,5,"after_attack_self","攻击后且存活：自身本场+L/+L，每场最多3次"],["1100260","演义刘备",4,3,5,"level_support","其他友军升级：每升一级该友军永久+L/+L"],["1100280","恶煞典韦",4,4,6,"friend_faint","其他友军阵亡且自身存活：自身本场+2L攻击/+L生命，每场最多3次"],["1100230","摧锋黄忠",5,7,4,"start_second","战斗开始：对敌方第二名造成6L伤害，没有第二名则选第一名"],["1100310","制胜张辽",5,5,6,"food_rebate","每回合首次购买军需：返还L金币，金币最多1000"],["1100290","震威关羽",6,7,7,"after_attack_splash","攻击后且存活：对当前敌方第二名造成4L伤害，每场最多2次，无目标不计次"],["1100270","演义张飞",6,6,8,"start_level_attack","战斗开始：自身本场攻击+L×其他友军等级之和"]]);
const LEGACY_UNIT_IDS=Object.freeze(rows.slice(0,18).map(r=>r[0]));
const foodRows=[['apple','丹药',1,'buff','指定友军永久+1攻击/+1生命'],['honey','蜜囊',1,'equipment','装备：阵亡追加召唤1/1蜜蜂；替换原装备'],['cupcake','军粮',2,'temporary','指定友军仅下一场+3攻击/+3生命；不替换装备'],['meat','利刃',2,'equipment','装备：攻击额外3伤害；替换原装备'],['salad','军宴',3,'random_buff','随机两名不同友军永久+1攻击/+1生命'],['garlic','蒜甲',3,'equipment','装备：单次伤害减少2，最低1；替换原装备'],['pear','灵丹',4,'buff','指定友军永久+2攻击/+2生命'],['melon','玉盾',5,'equipment','装备：每场抵消首次伤害至多20；替换原装备'],['mushroom','还魂符',6,'equipment','装备：阵亡后本位以1/1复活一次；替换原装备']];
const UNITS=Object.freeze(rows.map(r=>Object.freeze({id:r[0],name:r[1],tier:r[2],attack:r[3],health:r[4],ability:r[5],description:r[6],assetId:r[0]}))),FOODS=Object.freeze(foodRows.map(r=>Object.freeze({id:r[0],name:r[1],tier:r[2],kind:r[3],description:r[4]})));
return Object.freeze({VERSION,LEGACY_UNIT_IDS,UNITS,FOODS,BY_ID:Object.freeze(Object.fromEntries(UNITS.map(x=>[x.id,x]))),FOOD_BY_ID:Object.freeze(Object.fromEntries(FOODS.map(x=>[x.id,x])))});
});
