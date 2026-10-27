/* Independent, bounded data adapter for the observed 3.5.51 assets. No vendor runtime. */
(function(global){
'use strict';
const rad=Math.PI/180,modAngle=x=>((x+180)%360+360)%360-180;
function fraction(f,p){if(f==='step')return 0;if(!Array.isArray(f))return p;let lo=0,hi=1,t=.5;for(let i=0;i<12;i++){t=(lo+hi)/2;let x=3*(1-t)**2*t*f[0]+3*(1-t)*t*t*f[2]+t**3;if(x<p)lo=t;else hi=t;}return 3*(1-t)**2*t*f[1]+3*(1-t)*t*t*f[3]+t**3;}
function sample(frames,time,kind='array'){
 if(!frames.length||time<frames[0].t)return null;
 let i=0;while(i+1<frames.length&&frames[i+1].t<=time)i++;
 const a=frames[i],b=frames[i+1];if(!b||kind==='discrete')return a;
 const p=fraction(a.curve,(time-a.t)/(b.t-a.t));return {a,b,p};
}
function values(line,t){let s=sample(line.frames,t);if(!s)return null;if(!s.b)return s.value;return s.a.value.map((v,i)=>v+(s.b.value[i]-v)*s.p);}
const apply=(m,x,y)=>[m.a*x+m.b*y+m.x,m.c*x+m.d*y+m.y];
function localWorld(b,v,parent){
 const [rotation,x,y,sx,sy,shx,shy]=v;let ax=(rotation+shx)*rad,ay=(rotation+90+shy)*rad;
 let la=Math.cos(ax)*sx,lb=Math.cos(ay)*sy,lc=Math.sin(ax)*sx,ld=Math.sin(ay)*sy;
 if(!parent)return {a:la,b:lb,c:lc,d:ld,x,y};
 let {a:pa,b:pb,c:pc,d:pd}=parent;const [wx,wy]=apply(parent,x,y);
 if(b.mode===2){let s=pa*pa+pc*pc,pr=0;if(s>1e-8){s=Math.abs(pa*pd-pb*pc)/s;pb=pc*s;pd=pa*s;pr=Math.atan2(pc,pa);}else{pa=pc=0;pr=Math.PI/2-Math.atan2(pd,pb);}ax-=pr;ay-=pr;la=Math.cos(ax)*sx;lb=Math.cos(ay)*sy;lc=Math.sin(ax)*sx;ld=Math.sin(ay)*sy;return {a:pa*la-pb*lc,b:pa*lb-pb*ld,c:pc*la+pd*lc,d:pc*lb+pd*ld,x:wx,y:wy};}
 return {a:pa*la+pb*lc,b:pa*lb+pb*ld,c:pc*la+pd*lc,d:pc*lb+pd*ld,x:wx,y:wy};
}
function worldPose(d,anim,t){
 let local=d.bones.map(b=>b.transform.slice()),world=[];
 for(const l of anim.bones){const v=values(l,t);if(!v)continue;const b=local[l.index],base=d.bones[l.index].transform;if(l.type===0)b[0]=base[0]+v[0];if(l.type===1){b[1]=base[1]+v[0];b[2]=base[2]+v[1];}if(l.type===2){b[3]=base[3]*v[0];b[4]=base[4]*v[1];}if(l.type===3){b[5]=base[5]+v[0];b[6]=base[6]+v[1];}}
 function initial(){world=d.bones.map((b,i)=>localWorld(b,local[i],b.parent<0?null:world[b.parent]));}
 // Array.map assigns the result only on completion; evaluate parents sequentially.
 world=[];for(let i=0;i<d.bones.length;i++){const b=d.bones[i];world.push(localWorld(b,local[i],b.parent<0?null:world[b.parent]));}
 function descendants(idx){const changed=new Set([idx]);for(let i=idx+1;i<d.bones.length;i++){let b=d.bones[i];if(changed.has(b.parent)){world[i]=localWorld(b,local[i],world[b.parent]);changed.add(i);}}}
 function rotate(idx,delta){const m=world[idx],c=Math.cos(delta),s=Math.sin(delta),{a,b,c:mc,d:md}=m;m.a=c*a-s*mc;m.b=c*b-s*md;m.c=s*a+c*mc;m.d=s*b+c*md;descendants(idx);}
 let ik=d.ik.map((c,i)=>({...c,index:i,kind:'ik'})),tr=d.transform.map((c,i)=>({...c,index:i,kind:'transform'}));
 for(const c of [...ik,...tr].sort((a,b)=>a.order-b.order)){
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
function triangle(ctx,img,src,dst){
 const [x0,y0,x1,y1,x2,y2]=src,[X0,Y0,X1,Y1,X2,Y2]=dst;let det=(x1-x0)*(y2-y0)-(x2-x0)*(y1-y0);if(Math.abs(det)<1e-8)return;
 let a=((X1-X0)*(y2-y0)-(X2-X0)*(y1-y0))/det,b=((Y1-Y0)*(y2-y0)-(Y2-Y0)*(y1-y0))/det,c=((x1-x0)*(X2-X0)-(x2-x0)*(X1-X0))/det,d=((x1-x0)*(Y2-Y0)-(x2-x0)*(Y1-Y0))/det;
 ctx.save();ctx.beginPath();ctx.moveTo(X0,Y0);ctx.lineTo(X1,Y1);ctx.lineTo(X2,Y2);ctx.closePath();ctx.clip();ctx.transform(a,b,c,d,X0-a*x0-c*y0,Y0-b*x0-d*y0);ctx.drawImage(img,0,0);ctx.restore();
}
class ActorRenderer{
 constructor(data){this.data=data;this.images={};this.errors=[];this.drawn=0;}
 async load(){const pages=new Set(Object.values(this.data).flatMap(d=>Object.values(d.atlas).map(x=>x.page)));await Promise.all([...pages].map(p=>new Promise((ok,no)=>{let im=new Image;im.onload=()=>{this.images[p]=im;ok();};im.onerror=()=>{this.errors.push(p);no(new Error('角色纹理缺失：'+p));};im.src=p;})));return this;}
 draw(ctx,id,action,time,x,y,scale=1,flip=false){
  const d=this.data[id];if(!d)throw Error('缺角色 '+id);const anim=d.animations[action]||d.animations.ready;time=Math.max(0,Math.min(time,anim.duration));const world=worldPose(d,anim,time);
  const attachments=d.slots.map(s=>s.attachment),alpha=d.slots.map(s=>parseInt(s.color.slice(6,8),16)/255);
  for(const l of anim.slots){if(l.type===0){const f=sample(l.frames,time,'discrete');if(f)attachments[l.index]=f.value;}else{let s=sample(l.frames,time);if(s){let a=s.b?parseInt(s.a.value.slice(6,8),16)+(parseInt(s.b.value.slice(6,8),16)-parseInt(s.a.value.slice(6,8),16))*s.p:parseInt(s.value.slice(6,8),16);alpha[l.index]=a/255;}}}
  let order=d.slots.map((_,i)=>i);for(const fr of anim.draw){if(fr.t>time)break;const result=Array(order.length).fill(-1),unchanged=[];let orig=0;for(const [slot,raw] of fr.changes){while(orig<slot)unchanged.push(orig++);const delta=raw>2147483647?raw-4294967296:raw;result[orig+delta]=orig++;}while(orig<result.length)unchanged.push(orig++);for(let i=result.length-1;i>=0;i--)if(result[i]===-1)result[i]=unchanged.pop();order=result;}
  ctx.save();ctx.translate(x,y);ctx.scale(flip?-scale:scale,-scale);
  for(const si of order){const name=attachments[si],slot=d.slots[si];if(!name||alpha[si]<.002)continue;let a=d.skins[0][si]?.[name];if(!a)continue;let region=d.atlas[a.path||a.name],img=region&&this.images[region.page];if(!img)continue;
   let verts=[],uv=[],tri=[];if(a.type===2){
    let n=a.weighted?a.v.reduce((s,v)=>s+2*v.length,0):a.v.length,line=anim.deform.find(l=>l.slot===si&&l.name===name&&l.skin===0),deform=line?denseDeform(line,time,n):new Float64Array(n),di=0;
    if(a.weighted){for(const influences of a.v){let X=0,Y=0;for(const [bi,vx,vy,w] of influences){let p=apply(world[bi],vx+deform[di++],vy+deform[di++]);X+=p[0]*w;Y+=p[1]*w;}verts.push(X,Y);}}
    else for(let i=0;i<a.v.length;i+=2)verts.push(...apply(world[slot.bone],a.v[i]+deform[i],a.v[i+1]+deform[i+1]));uv=a.uv;tri=a.tri;
   }else if(a.type===0){const [angle,ax,ay,sx,sy,width,height]=a.transform,[ow,oh]=region.orig,[offx,offy]=region.offset,[rw,rh]=region.size;let bx=-width*sx/2+offx*width/ow*sx,by=-height*sy/2+offy*height/oh*sy,w=rw*width/ow*sx,h=rh*height/oh*sy,c=Math.cos(angle*rad),s=Math.sin(angle*rad);for(const [vx,vy] of [[bx,by],[bx,by+h],[bx+w,by+h],[bx+w,by]])verts.push(...apply(world[slot.bone],c*vx-s*vy+ax,s*vx+c*vy+ay));uv=[0,1,0,0,1,0,1,1];tri=[0,1,2,2,3,0];}else continue;
   const tex=[];for(let i=0;i<uv.length;i+=2){const u=uv[i],v=uv[i+1];tex.push(region.xy[0]+(region.rotate?v*region.size[1]:u*region.size[0]),region.xy[1]+(region.rotate?(1-u)*region.size[0]:v*region.size[1]));}
   ctx.globalAlpha=alpha[si]*parseInt((a.color||'ffffffff').slice(6,8),16)/255;ctx.globalCompositeOperation=['source-over','lighter','multiply','screen'][slot.blend]||'source-over';
   for(let i=0;i<tri.length;i+=3){const ind=tri.slice(i,i+3),ss=ind.flatMap(j=>tex.slice(j*2,j*2+2)),dd=ind.flatMap(j=>verts.slice(j*2,j*2+2));if(dd.every(Number.isFinite))triangle(ctx,img,ss,dd);else this.errors.push('nonfinite '+id);}
  }
  ctx.restore();this.drawn++;
 }
}
global.SS2Renderer=ActorRenderer;
})(window);

