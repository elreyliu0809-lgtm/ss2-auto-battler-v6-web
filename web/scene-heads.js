/* Verified display dependencies for the current team/shop; no rule, save or RNG access. */
(function(root){'use strict';const checked=new Set(),spec=root.SS2_SCENE_HEAD_SPEC,pathsFor=ids=>[...new Set(ids.map(id=>spec.heads[String(id)]).filter(Boolean))];
async function prepare(ids,valid=()=>true){const paths=pathsFor(ids);if(!valid())throw Error('画面准备已取消');if(!paths.every(p=>checked.has(p))){try{await root.SS2_CACHE_REQUEST('ENSURE',{release:spec.release,paths});}catch(error){throw Error('人物资源尚未准备完成，请联网后重试');}}if(!valid())throw Error('画面准备已取消');for(const p of paths)checked.add(p);}
root.SS2PrepareSceneHeads=prepare;root.SS2SceneHeads=Object.freeze({ready:ids=>pathsFor(ids).every(p=>checked.has(p)),pathsFor,release:spec.release});
})(globalThis);
