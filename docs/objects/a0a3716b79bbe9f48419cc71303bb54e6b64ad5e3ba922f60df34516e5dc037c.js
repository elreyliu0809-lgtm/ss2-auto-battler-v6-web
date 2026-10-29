/* Independent, bounded data adapter for the observed 3.5.51 assets. No vendor runtime. */
(function(global){
'use strict';
const rad=Math.PI/180,modAngle=x=>((x+180)%360+360)%360-180;
const tintCache=new WeakMap(),rgba=s=>[0,2,4,6].map(i=>parseInt((s||'ffffffff').slice(i,i+2),16)/255);
const orderedFrameCache=new WeakMap();
function chronologicalFrames(frames){
 let ordered=orderedFrameCache.get(frames);if(ordered)return ordered;
 // Source exports occasionally contain late keys before early keys. Sample a
 // stable chronological view without rewriting the authored carrier or times.
 let descending=false;for(let i=1;i<frames.length;i++)if(frames[i].t<frames[i-1].t){descending=true;break;}
 ordered=descending?frames.map((frame,index)=>({frame,index})).sort((a,b)=>a.frame.t-b.frame.t||a.index-b.index).map(x=>x.frame):frames;
 orderedFrameCache.set(frames,ordered);return ordered;
}
function tintedRegion(image,region,color){
 if(color.slice(0,3).every(v=>v>.999))return {image,x:0,y:0};
 const [x,y]=region.xy,w=region.rotate?region.size[1]:region.size[0],h=region.rotate?region.size[0]:region.size[1],rgb=color.slice(0,3).map(v=>Math.round(v*255)),key=[x,y,w,h,...rgb].join(':');let cache=tintCache.get(image);if(!cache){cache=new Map();tintCache.set(image,cache);}if(cache.has(key))return cache.get(key);
 const canvas=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,x,y,w,h,0,0,w,h);const pixels=ctx.getImageData(0,0,w,h);for(let i=0;i<pixels.data.length;i+=4)for(let c=0;c<3;c++)pixels.data[i+c]=Math.round(pixels.data[i+c]*rgb[c]/255);ctx.putImageData(pixels,0,0);const value={image:canvas,x,y};if(cache.size>=64)cache.delete(cache.keys().next().value);cache.set(key,value);return value;
}
function fraction(f,p){if(f==='step')return 0;if(!Array.isArray(f))return p;let lo=0,hi=1,t=.5;for(let i=0;i<12;i++){t=(lo+hi)/2;let x=3*(1-t)**2*t*f[0]+3*(1-t)*t*t*f[2]+t**3;if(x<p)lo=t;else hi=t;}return 3*(1-t)**2*t*f[1]+3*(1-t)*t*t*f[3]+t**3;}
function sample(frames,time,kind='array'){
 frames=chronologicalFrames(frames);
 if(!frames.length||time<frames[0].t)return null;
 let i=0;while(i+1<frames.length&&frames[i+1].t<=time)i++;
 const a=frames[i],b=frames[i+1];if(!b||kind==='discrete')return a;
 const p=fraction(a.curve,(time-a.t)/(b.t-a.t));return {a,b,p};
}
function values(line,t,rotation=false){let s=sample(line.frames,t);if(!s)return null;if(!s.b)return s.value;return s.a.value.map((v,i)=>v+(rotation?modAngle(s.b.value[i]-v):s.b.value[i]-v)*s.p);}
const apply=(m,x,y)=>[m.a*x+m.b*y+m.x,m.c*x+m.d*y+m.y];
function localWorld(b,v,parent){
 const [rotation,x,y,sx,sy,shx,shy]=v;let ax=(rotation+shx)*rad,ay=(rotation+90+shy)*rad;
 let la=Math.cos(ax)*sx,lb=Math.cos(ay)*sy,lc=Math.sin(ax)*sx,ld=Math.sin(ay)*sy;
 if(!parent)return {a:la,b:lb,c:lc,d:ld,x,y};
 let {a:pa,b:pb,c:pc,d:pd}=parent;const [wx,wy]=apply(parent,x,y);
 if(b.mode===1)return {a:la,b:lb,c:lc,d:ld,x:wx,y:wy};
 if(b.mode===3||b.mode===4){
  // Carry the direction of the local rotation through the parent, discard its
  // axis lengths/shear, then apply this bone's own scale and shear.
  const r=rotation*rad;let ux=pa*Math.cos(r)+pb*Math.sin(r),uy=pc*Math.cos(r)+pd*Math.sin(r),length=Math.hypot(ux,uy);
  if(length>1e-8){ux/=length;uy/=length;}else{ux=1;uy=0;}
  const reflection=b.mode===3&&pa*pd-pb*pc<0?-1:1,vx=-uy*reflection,vy=ux*reflection;
  return {a:(ux*Math.cos(shx*rad)+vx*Math.sin(shx*rad))*sx,c:(uy*Math.cos(shx*rad)+vy*Math.sin(shx*rad))*sx,
   b:(ux*Math.cos((90+shy)*rad)+vx*Math.sin((90+shy)*rad))*sy,d:(uy*Math.cos((90+shy)*rad)+vy*Math.sin((90+shy)*rad))*sy,x:wx,y:wy};
 }
 if(b.mode===2){let s=pa*pa+pc*pc,pr=0;if(s>1e-8){s=Math.abs(pa*pd-pb*pc)/s;pb=pc*s;pd=pa*s;pr=Math.atan2(pc,pa);}else{pa=pc=0;pr=Math.PI/2-Math.atan2(pd,pb);}ax-=pr;ay-=pr;la=Math.cos(ax)*sx;lb=Math.cos(ay)*sy;lc=Math.sin(ax)*sx;ld=Math.sin(ay)*sy;return {a:pa*la-pb*lc,b:pa*lb-pb*ld,c:pc*la+pd*lc,d:pc*lb+pd*ld,x:wx,y:wy};}
 return {a:pa*la+pb*lc,b:pa*lb+pb*ld,c:pc*la+pd*lc,d:pc*lb+pd*ld,x:wx,y:wy};
}
function attachmentVertices(d,a,slot,world,anim,t,name,skin=0){
 const n=a.weighted?a.v.reduce((s,v)=>s+2*v.length,0):a.v.length,line=anim.deform.find(l=>l.slot===slot&&l.name===name&&l.skin===skin),deform=line?denseDeform(line,t,n):new Float64Array(n),out=[];let di=0;
 if(a.weighted){for(const influences of a.v){let x=0,y=0;for(const [bi,vx,vy,w]of influences){const p=apply(world[bi],vx+deform[di++],vy+deform[di++]);x+=p[0]*w;y+=p[1]*w;}out.push(x,y);}}
 else for(let i=0;i<a.v.length;i+=2)out.push(...apply(world[d.slots[slot].bone],a.v[i]+deform[i],a.v[i+1]+deform[i+1]));
 return out;
}
function pathSampler(flat,closed=false,subdivisions=64){
 const raw=[];for(let i=0;i<flat.length;i+=2)raw.push([flat[i],flat[i+1]]);
 const pts=closed?raw.slice(1).concat([raw[0],raw[1]]):raw.slice(1,-1),curves=[];let length=0;
 function at(c,t){const q=1-t,x=q*q*q*c[0][0]+3*q*q*t*c[1][0]+3*q*t*t*c[2][0]+t*t*t*c[3][0],y=q*q*q*c[0][1]+3*q*q*t*c[1][1]+3*q*t*t*c[2][1]+t*t*t*c[3][1];let dx=3*q*q*(c[1][0]-c[0][0])+6*q*t*(c[2][0]-c[1][0])+3*t*t*(c[3][0]-c[2][0]),dy=3*q*q*(c[1][1]-c[0][1])+6*q*t*(c[2][1]-c[1][1])+3*t*t*(c[3][1]-c[2][1]);if(Math.hypot(dx,dy)<1e-9){dx=c[3][0]-c[0][0];dy=c[3][1]-c[0][1];}return {x,y,angle:Math.atan2(dy,dx)};}
 for(let i=0;i+3<pts.length;i+=3){const c=pts.slice(i,i+4),samples=[{distance:0,t:0}],start=length;let prev=at(c,0),own=0;for(let j=1;j<=subdivisions;j++){const p=at(c,j/subdivisions);own+=Math.hypot(p.x-prev.x,p.y-prev.y);samples.push({distance:own,t:j/subdivisions});prev=p;}
  const dx=c[3][0]-c[0][0],dy=c[3][1]-c[0][1],chord=Math.hypot(dx,dy),project=p=>((p[0]-c[0][0])*dx+(p[1]-c[0][1])*dy)/(chord*chord),p1=project(c[1]),p2=project(c[2]),straight=chord>1e-9&&c.slice(1,3).every(p=>Math.abs((p[0]-c[0][0])*dy-(p[1]-c[0][1])*dx)<chord*1e-8)&&p1>=0&&p2>=p1&&p2<=1;
  if(straight)own=chord;length+=own;curves.push({c,start,length:own,samples,straight});}
 if(!curves.length)throw Error('Source path has no cubic segment');
 function point(distance){if(closed&&length>1e-9)distance=((distance%length)+length)%length;
  if(distance<0||distance>length){const p=distance<0?at(curves[0].c,0):at(curves.at(-1).c,1),extra=distance<0?distance:distance-length;return {x:p.x+Math.cos(p.angle)*extra,y:p.y+Math.sin(p.angle)*extra,angle:p.angle};}
  const c=curves.find(c=>distance<=c.start+c.length)||curves.at(-1),local=distance-c.start;
  if(c.straight){const p=c.c[0],q=c.c[3],fraction=local/c.length;return {x:p[0]+(q[0]-p[0])*fraction,y:p[1]+(q[1]-p[1])*fraction,angle:Math.atan2(q[1]-p[1],q[0]-p[0])};}
  let hi=1;while(hi<c.samples.length-1&&c.samples[hi].distance<local)hi++;const a=c.samples[hi-1],b=c.samples[hi],f=b.distance>a.distance?(local-a.distance)/(b.distance-a.distance):0;return at(c.c,a.t+(b.t-a.t)*f);
 }
 return {length,point};
}
function worldPose(d,anim,t){
 let local=d.bones.map(b=>b.transform.slice()),world=[];
 for(const l of anim.bones){const v=values(l,t,l.type===0);if(!v)continue;const b=local[l.index],base=d.bones[l.index].transform;if(l.type===0)b[0]=base[0]+v[0];if(l.type===1){b[1]=base[1]+v[0];b[2]=base[2]+v[1];}if(l.type===2){b[3]=base[3]*v[0];b[4]=base[4]*v[1];}if(l.type===3){b[5]=base[5]+v[0];b[6]=base[6]+v[1];}}
 function initial(){world=d.bones.map((b,i)=>localWorld(b,local[i],b.parent<0?null:world[b.parent]));}
 // Array.map assigns the result only on completion; evaluate parents sequentially.
 world=[];for(let i=0;i<d.bones.length;i++){const b=d.bones[i];world.push(localWorld(b,local[i],b.parent<0?null:world[b.parent]));}
 function descendants(idx){const changed=new Set([idx]);for(let i=idx+1;i<d.bones.length;i++){let b=d.bones[i];if(changed.has(b.parent)){world[i]=localWorld(b,local[i],world[b.parent]);changed.add(i);}}}
 function rotate(idx,delta){const m=world[idx],c=Math.cos(delta),s=Math.sin(delta),{a,b,c:mc,d:md}=m;m.a=c*a-s*mc;m.b=c*b-s*md;m.c=s*a+c*mc;m.d=s*b+c*md;descendants(idx);}
 let ik=d.ik.map((c,i)=>({...c,index:i,kind:'ik'})),tr=d.transform.map((c,i)=>({...c,index:i,kind:'transform'})),paths=(d.path||[]).map((c,i)=>({...c,index:i,kind:'path'}));
 for(const c of [...ik,...tr,...paths].sort((a,b)=>a.order-b.order)){
  if(c.kind==='path'){
   const slot=d.slots[c.target];let name=slot.attachment;for(const line of anim.slots)if(line.index===c.target&&line.type===0){const f=sample(line.frames,t,'discrete');if(f)name=f.value;}
   const a=name&&d.skins[0][c.target]?.[name];if(!a||a.type!==4)continue;
   const v=c.values.slice();for(const line of anim.path||[])if(line.index===c.index){const value=values(line,t);if(value){if(line.type===0)v[1]=value[0];else if(line.type===1)v[2]=value[0];else{v[3]=value[0];v[4]=value[1];}}}
   const [offset,position,spacing,rotateMix,translateMix]=v;if(!rotateMix&&!translateMix)continue;
   const curve=pathSampler(attachmentVertices(d,a,c.target,world,anim,t,name),a.closed),locations=[],[positionMode,spacingMode,rotateMode]=c.modes;
   let distance=position*(positionMode===1?curve.length:1);locations.push(curve.point(distance));
   for(const bi of c.bones){const bone=d.bones[bi],m=world[bi],setupLength=bone.transform[7],worldLength=setupLength*Math.hypot(m.a,m.c);let step=spacing;
    if(spacingMode===2)step*=curve.length;else if(spacingMode===0)step=setupLength>1e-8?(setupLength+spacing)*worldLength/setupLength:spacing;
    distance+=step;locations.push(curve.point(distance));}
   const target=world[slot.bone],offsetAngle=offset*rad*(target.a*target.d-target.b*target.c<0?-1:1);
   for(let j=0;j<c.bones.length;j++){const bi=c.bones[j],m=world[bi],p=locations[j],q=locations[j+1];m.x+=(p.x-m.x)*translateMix;m.y+=(p.y-m.y)*translateMix;
    if(rotateMode===2){const oldLength=d.bones[bi].transform[7]*Math.hypot(m.a,m.c);if(oldLength>1e-8){const factor=1+(Math.hypot(q.x-p.x,q.y-p.y)/oldLength-1)*rotateMix;m.a*=factor;m.c*=factor;}}
    if(rotateMix){const angle=rotateMode===0?p.angle:Math.atan2(q.y-p.y,q.x-p.x);rotate(bi,modAngle((angle+offsetAngle-Math.atan2(m.c,m.a))/rad)*rad*rotateMix);}else descendants(bi);
   }
   continue;
  }
  const target=world[c.target];if(c.kind==='ik'){
   let mix=c.mix,bend=c.bend===255?-1:1,line=anim.ik.find(x=>x.index===c.index),s=line&&sample(line.frames,t);
   if(s){if(s.b){mix=s.a.mix+(s.b.mix-s.a.mix)*s.p;bend=s.a.bend===255?-1:1;}else{mix=s.mix;bend=s.bend===255?-1:1;}}
   if(Math.abs(mix)<1e-7)continue;
   if(c.bones.length===1){const i=c.bones[0],m=world[i];let desired=Math.atan2(target.y-m.y,target.x-m.x),angle=Math.atan2(m.c,m.a);rotate(i,modAngle((desired-angle)/rad)*rad*mix);}
   else{
    const [i,j]=c.bones,p=world[i],ch=world[j];let dx=target.x-p.x,dy=target.y-p.y,l1=Math.hypot(ch.x-p.x,ch.y-p.y),l2=d.bones[j].transform[7]*Math.hypot(ch.a,ch.c),dist=Math.hypot(dx,dy);
    if(l1<1e-5||l2<1e-5)continue;let cos=Math.max(-1,Math.min(1,(dist*dist-l1*l1-l2*l2)/(2*l1*l2))),elbow=Math.acos(cos)*bend,desired=Math.atan2(dy,dx)-Math.atan2(l2*Math.sin(elbow),l1+l2*cos),old=Math.atan2(ch.y-p.y,ch.x-p.x);
    rotate(i,modAngle((desired-old)/rad)*rad*mix);const q=world[j];rotate(j,modAngle((Math.atan2(target.y-q.y,target.x-q.x)-Math.atan2(q.c,q.a))/rad)*rad*mix);
   }
  }else{
   let v=c.values.slice(),line=anim.transform.find(x=>x.index===c.index),a=line&&values(line,t);if(a)v.splice(6,4,...a);
   for(const i of c.bones){const m=world[i];if(v[6])rotate(i,modAngle((Math.atan2(target.c,target.a)-Math.atan2(m.c,m.a))/rad+v[0])*rad*v[6]);
    if(v[7]){const p=apply(target,v[1],v[2]);m.x+=(p[0]-m.x)*v[7];m.y+=(p[1]-m.y)*v[7];}
    if(v[8]){let sx=Math.hypot(m.a,m.c),sy=Math.hypot(m.b,m.d),tx=Math.hypot(target.a,target.c),ty=Math.hypot(target.b,target.d);if(sx>1e-8){let z=1+(tx+v[3]-sx)*v[8]/sx;m.a*=z;m.c*=z;}if(sy>1e-8){let z=1+(ty+v[4]-sy)*v[8]/sy;m.b*=z;m.d*=z;}}
    if(v[9]){let old=Math.atan2(m.d,m.b),desired=Math.atan2(target.d,target.b)-Math.atan2(target.c,target.a)+Math.atan2(m.c,m.a)+v[5]*rad,l=Math.hypot(m.b,m.d),ang=old+modAngle((desired-old)/rad)*rad*v[9];m.b=Math.cos(ang)*l;m.d=Math.sin(ang)*l;}
    descendants(i);
   }
  }
 }
 return world;
}
function denseDeform(line,t,n){const out=new Float64Array(n),s=sample(line.frames,t);if(!s)return out;function add(f,w){for(let i=0;i<f.value.length;i++)out[f.start+i]+=f.value[i]*w;}if(s.b){add(s.a,1-s.p);add(s.b,s.p);}else add(s,1);return out;}
function resolveAttachment(d,slot,name,skin=0,seen=new Set()){
 const key=skin+':'+slot+':'+name;if(seen.has(key))throw Error('Cyclic linked mesh '+key);seen.add(key);
 const a=d.skins[skin]?.[slot]?.[name];if(!a)return null;if(a.type!==3)return {...a,deformName:name,deformSkin:skin};
 const parentSkin=a.skin?d.skinNames?.indexOf(a.skin):0;
 if(parentSkin===undefined||parentSkin<0)throw Error('Unresolved linked mesh skin '+a.skin);
 const parent=resolveAttachment(d,slot,a.parent,parentSkin,seen);if(!parent||parent.type!==2)throw Error('Missing linked mesh parent '+a.parent);
 return {...parent,name:a.name,path:a.path,color:a.color,deformName:a.deform?parent.deformName:name,deformSkin:a.deform?parent.deformSkin:skin};
}
function triangle(ctx,img,src,dst){
 const [x0,y0,x1,y1,x2,y2]=src,[X0,Y0,X1,Y1,X2,Y2]=dst;let det=(x1-x0)*(y2-y0)-(x2-x0)*(y1-y0);if(Math.abs(det)<1e-8)return;
 let a=((X1-X0)*(y2-y0)-(X2-X0)*(y1-y0))/det,b=((Y1-Y0)*(y2-y0)-(Y2-Y0)*(y1-y0))/det,c=((x1-x0)*(X2-X0)-(x2-x0)*(X1-X0))/det,d=((x1-x0)*(Y2-Y0)-(x2-x0)*(Y1-Y0))/det;
 ctx.save();ctx.beginPath();ctx.moveTo(X0,Y0);ctx.lineTo(X1,Y1);ctx.lineTo(X2,Y2);ctx.closePath();ctx.clip();ctx.transform(a,b,c,d,X0-a*x0-c*y0,Y0-b*x0-d*y0);ctx.drawImage(img,0,0);ctx.restore();
}
class ActorRenderer{
 constructor(data,imageBase='assets/actors/'){this.data=data;this.imageBase=imageBase;this.images={};this.errors=[];this.drawn=0;}
 async load(options={}){if(!global.SS2SceneResources)throw Error('场景资源调度器未载入');return global.SS2SceneResources.loadRenderer(this,options);}
 draw(ctx,id,action,time,x,y,scale=1,flip=false){
  const d=this.data[id];if(!d)throw Error('缺角色 '+id);if(d.format==='legacy-timeline-v1'){if(!global.SS2TimelineRenderer)throw Error('旧版分层播放器未载入');return global.SS2TimelineRenderer.draw(ctx,d,this.images,action,time,x,y,scale,flip);}const anim=d.animations[action]||d.animations.ready;time=Math.max(0,Math.min(time,anim.duration));const world=worldPose(d,anim,time);
  const attachments=d.slots.map(s=>s.attachment),colors=d.slots.map(s=>rgba(s.color));
  for(const l of anim.slots){if(l.type===0){const f=sample(l.frames,time,'discrete');if(f)attachments[l.index]=f.value;}else{let s=sample(l.frames,time);if(s){const a=rgba(s.b?s.a.value:s.value),b=s.b?rgba(s.b.value):a;colors[l.index]=a.map((v,i)=>v+(b[i]-v)*(s.b?s.p:0));}}}
  let order=d.slots.map((_,i)=>i);for(const fr of chronologicalFrames(anim.draw)){if(fr.t>time)break;const result=Array(order.length).fill(-1),unchanged=[];let orig=0;for(const [slot,raw] of fr.changes){while(orig<slot)unchanged.push(orig++);const delta=raw>2147483647?raw-4294967296:raw;result[orig+delta]=orig++;}while(orig<result.length)unchanged.push(orig++);for(let i=result.length-1;i>=0;i--)if(result[i]===-1)result[i]=unchanged.pop();order=result;}
  ctx.save();ctx.translate(x,y);ctx.scale(flip?-scale:scale,-scale);
  for(const si of order){const name=attachments[si],slot=d.slots[si];if(!name||colors[si][3]<.002)continue;let a=resolveAttachment(d,si,name);if(!a)continue;let region=d.atlas[a.path||a.name],img=region&&this.images[region.page];if(!img)continue;
   let verts=[],uv=[],tri=[];if(a.type===2){
    let n=a.weighted?a.v.reduce((s,v)=>s+2*v.length,0):a.v.length,line=anim.deform.find(l=>l.slot===si&&l.name===a.deformName&&l.skin===a.deformSkin),deform=line?denseDeform(line,time,n):new Float64Array(n),di=0;
    if(a.weighted){for(const influences of a.v){let X=0,Y=0;for(const [bi,vx,vy,w] of influences){let p=apply(world[bi],vx+deform[di++],vy+deform[di++]);X+=p[0]*w;Y+=p[1]*w;}verts.push(X,Y);}}
    else for(let i=0;i<a.v.length;i+=2)verts.push(...apply(world[slot.bone],a.v[i]+deform[i],a.v[i+1]+deform[i+1]));uv=a.uv;tri=a.tri;
   }else if(a.type===0){const [angle,ax,ay,sx,sy,width,height]=a.transform,[ow,oh]=region.orig,[offx,offy]=region.offset,[rw,rh]=region.size;let bx=-width*sx/2+offx*width/ow*sx,by=-height*sy/2+offy*height/oh*sy,w=rw*width/ow*sx,h=rh*height/oh*sy,c=Math.cos(angle*rad),s=Math.sin(angle*rad);for(const [vx,vy] of [[bx,by],[bx,by+h],[bx+w,by+h],[bx+w,by]])verts.push(...apply(world[slot.bone],c*vx-s*vy+ax,s*vx+c*vy+ay));uv=[0,1,0,0,1,0,1,1];tri=[0,1,2,2,3,0];}else continue;
   const tex=[];for(let i=0;i<uv.length;i+=2){const u=uv[i],v=uv[i+1];tex.push(region.xy[0]+(region.rotate?v*region.size[1]:u*region.size[0]),region.xy[1]+(region.rotate?(1-u)*region.size[0]:v*region.size[1]));}
   const tint=rgba(a.color).map((v,i)=>v*colors[si][i]),raster=tintedRegion(img,region,tint);ctx.globalAlpha=tint[3];ctx.globalCompositeOperation=['source-over','lighter','multiply','screen'][slot.blend]||'source-over';
   for(let i=0;i<tri.length;i+=3){const ind=tri.slice(i,i+3),ss=ind.flatMap(j=>[tex[j*2]-raster.x,tex[j*2+1]-raster.y]),dd=ind.flatMap(j=>verts.slice(j*2,j*2+2));if(dd.every(Number.isFinite))triangle(ctx,raster.image,ss,dd);else this.errors.push('nonfinite '+id);}
  }
  ctx.restore();this.drawn++;
 }
}
global.SS2Renderer=ActorRenderer;
global.SS2RenderMath=Object.freeze({values,localWorld,worldPose,resolveAttachment,pathSampler,attachmentVertices,sample,denseDeform,chronologicalFrames});
})(window);

