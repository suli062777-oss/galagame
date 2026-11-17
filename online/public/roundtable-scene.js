import * as THREE from './assets/vendor/three.module.min.js';
import {territoryShares,territoryOwner,fibonacciPoint,PLAYER_COLORS} from './globe-math.js?v=20261109a';
import {drawAvatarCanvas} from './avatar-art.js?v=roundtable1';
import {buildFurniture,buildSeatedPerson} from './tavern-models.js?v=20261117v3';
import {buildTavernEnvironment} from './tavern-environment.js?v=20261117v3';
import {createRenderScheduler,resolveSceneQuality,batchStaticMeshes} from './scene-runtime.js';
export {territoryShares,PLAYER_COLORS};
const ANGLES=[-Math.PI/4,-3*Math.PI/4,3*Math.PI/4,Math.PI/4];
const SPACE=Object.freeze({seatRadius:3.68,baseScale:.62,minimumZoom:.84,maximumZoom:1.12,globeRadius:1.8,markRadius:2.02,clearance:.13});

export function mountRoundtable(container,initialPlayers=[],options={}){
 let destroyed=false,players=initialPlayers,auto=options.autoRotate===true,rotX=.10,rotY=-.48,globeZoom=1,last=0,dragged=false,dirty=true,scheduler=null,onScreen=true;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const low=false; // Full character geometry is retained in every runtime quality mode.
 const device=()=>({width:shell.clientWidth,coarse:matchMedia('(pointer: coarse)').matches,cores:navigator.hardwareConcurrency,memory:navigator.deviceMemory,dpr:devicePixelRatio||1});
 function requestRender(){dirty=true;scheduler?.request();}
 const shell=document.createElement('div');shell.className='globe-shell roundtable-scene tavern-scene-v3';shell.style.cssText='position:relative;width:100%;height:100%;overflow:hidden;touch-action:pan-y';container.append(shell);
 let quality=resolveSceneQuality(options.quality||(options.lowPerformance?'low':'auto'),device());
 let renderer;
 try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:quality.effective==='high',powerPreference:'low-power'});}catch{
  shell.dataset.renderer='unavailable';const notice=document.createElement('p');notice.className='roundtable-unavailable';notice.setAttribute('role','status');notice.textContent='当前设备无法显示三维场景，仍可通过席位与行动区完成经营。';shell.append(notice);
  const list=document.createElement('ol');shell.append(list);
  function update(next){players=Array.isArray(next)?next:[];list.replaceChildren();for(const p of players){const item=document.createElement('li'),button=document.createElement('button');button.type='button';button.textContent=p.name+(p.id===options.meId?' · 你':'');button.addEventListener('click',()=>options.onSeatClick?.(p));item.append(button);if(p.id===options.meId){const a=document.createElement('button');a.type='button';a.textContent='更换头像';a.addEventListener('click',()=>options.onAvatarClick?.(p));item.append(a);}list.append(item);}}
  update(players);return {update,setAutoRotate(){},zoomIn(){},zoomOut(){},getShares(){return territoryShares(players);},getDiagnostics(){return {renderer:'unavailable',seatCount:4,quality};},setQuality(mode){quality=resolveSceneQuality(mode,device());return quality;},destroy(){shell.remove();}};
 }
 renderer.setPixelRatio(quality.pixelRatio);renderer.setClearColor(0x191a19,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.16;
 renderer.shadowMap.enabled=quality.shadows;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
 const canvas=renderer.domElement;canvas.tabIndex=0;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','四位经营者围坐在暖木圆桌旁。拖动中央球体旋转，方向键旋转，加减键缩放。点击自己的头像可更换。');canvas.style.cssText='display:block;width:100%;height:100%;touch-action:pan-y';shell.append(canvas);
 const globeHit=document.createElement('div');globeHit.className='roundtable-globe-hit';globeHit.setAttribute('aria-hidden','true');globeHit.style.cssText='position:absolute;touch-action:none;border-radius:50%;background:transparent;pointer-events:auto;cursor:grab';shell.append(globeHit);
 const labels=document.createElement('div');labels.className='roundtable-overlays';labels.style.cssText='position:absolute;inset:0;pointer-events:none';shell.append(labels);
 const scene=new THREE.Scene();scene.fog=new THREE.Fog(0x191b1a,16,32);
 const camera=new THREE.OrthographicCamera(-5,5,3,-3,.1,60);camera.position.set(0,7.2,15);camera.lookAt(0,1.35,0);
 const materials=[],geometries=[],textures=new Set(),people=[],interactive=[];
 const geometryCache=new Map();
 const mat=m=>{if(m.isMeshBasicMaterial)m.toneMapped=false;materials.push(m);return m;};
 const geo=g=>{if(g.parameters&&['BoxGeometry','CylinderGeometry','SphereGeometry','CircleGeometry','TorusGeometry','PlaneGeometry'].includes(g.type)){const key=g.type+JSON.stringify(g.parameters),prior=geometryCache.get(key);if(prior){g.dispose();return prior;}geometryCache.set(key,g);}geometries.push(g);return g;};
 const sphereGeo=geo(new THREE.SphereGeometry(1,low?14:24,low?10:18));
 function mesh(g,m,parent=scene){const o=new THREE.Mesh(g,m);o.castShadow=!low;o.receiveShadow=!low;parent.add(o);return o;}
 function ellipsoid(parent,at,scale,m){const o=mesh(sphereGeo,m,parent);o.position.set(...at);o.scale.set(...scale);return o;}
 function rod(parent,a,b,ra,rb,m){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b);const o=mesh(geo(new THREE.CylinderGeometry(rb,ra,1,low?8:12)),m,parent);o.scale.y=start.distanceTo(end);o.position.copy(start).lerp(end,.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.sub(start).normalize());return o;}
 function tube(parent,points,radius,m){return mesh(geo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),32,radius,5,false)),m,parent);}
 const kit={scene,mesh,geo,mat,ellipsoid,rod,tube,textures,low};
 const furniture=buildFurniture(kit),interior=buildTavernEnvironment(kit,furniture);
 interior.environment.traverse(node=>{if(node.isMesh)node.castShadow=false;});
 const staticBatches=[batchStaticMeshes(interior.environment,geo),batchStaticMeshes(furniture.table,geo)];
 for(const detail of interior.detailObjects||[])staticBatches.push(batchStaticMeshes(detail,geo));
 scene.add(new THREE.HemisphereLight(0xffeed5,0x293039,1.4));
 const key=new THREE.DirectionalLight(0xffe0ba,2.5);key.position.set(-3.8,8,6);key.castShadow=!low;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-6,right:6,top:6,bottom:-6});key.shadow.bias=-.0005;key.shadow.normalBias=.035;scene.add(key);
 const fill=new THREE.DirectionalLight(0xc3d4d5,1.55);fill.position.set(6,5,4);scene.add(fill);
 const rearLight=new THREE.DirectionalLight(0xe4b77b,1.0);rearLight.position.set(0,5,-6);scene.add(rearLight);
 const playerAt=seat=>players.find(p=>p.seat===seat);
 function createPerson(seat){
  const person=buildSeatedPerson(seat,kit,furniture);staticBatches.push(batchStaticMeshes(person.chair,geo));interactive.push(person.group);person.group.position.set(Math.sin(ANGLES[seat])*SPACE.seatRadius,0,Math.cos(ANGLES[seat])*SPACE.seatRadius);person.group.rotation.y=ANGLES[seat]+Math.PI;
  const label=document.createElement('div');label.className='roundtable-label';label.dataset.seat=seat;label.style.cssText='position:absolute;pointer-events:auto;transform:translate(-50%,-50%);text-align:center;width:auto;max-width:142px';
  const detail=document.createElement('button');detail.type='button';detail.className='roundtable-detail';detail.style.cssText='display:inline-flex;align-items:center;gap:6px;min-height:44px;max-width:100%;padding:4px 8px;border:0;border-radius:8px;color:#eee9df;background:transparent;cursor:pointer;font:inherit;line-height:1.35;text-shadow:0 1px 4px rgba(16,18,17,.85)';
  const name=document.createElement('b');name.className='roundtable-person-name roundtable-name';name.style.cssText='font-size:13px;font-weight:500;max-width:112px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
  const status=document.createElement('span');status.className='roundtable-submitted-indicator';status.style.cssText='width:5px;height:5px;flex-shrink:0;border-radius:50%;background:#a7b6a4';status.setAttribute('aria-hidden','true');detail.append(name,status);label.append(detail);labels.append(label);
  const headHit=document.createElement('button');headHit.type='button';headHit.className='roundtable-head-hit';headHit.dataset.seat=seat;headHit.style.cssText='position:absolute;pointer-events:auto;transform:translate(-50%,-50%);width:48px;height:48px;background:transparent;border:0;border-radius:50%;color:transparent;cursor:pointer';labels.append(headHit);
  detail.addEventListener('click',()=>{const p=playerAt(seat);if(p)options.onSeatClick?.(p);});headHit.addEventListener('click',()=>{const p=playerAt(seat);if(p)options.onAvatarClick?.(p);});
  return Object.assign(person,{label,detail,name,status,headHit});
 }
 for(let seat=0;seat<4;seat++)people.push(createPerson(seat));
 const world=new THREE.Group();world.name='rotatable-competition-globe';scene.add(world);
 const uniforms={uShares:{value:new THREE.Vector4()},uC0:{value:new THREE.Color(PLAYER_COLORS[0])},uC1:{value:new THREE.Color(PLAYER_COLORS[1])},uC2:{value:new THREE.Color(PLAYER_COLORS[2])},uC3:{value:new THREE.Color(PLAYER_COLORS[3])}};
 const sphereMaterial=mat(new THREE.ShaderMaterial({uniforms,vertexShader:`varying vec3 vP;varying vec3 vN;void main(){vP=normalize(position);vN=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,fragmentShader:`
 varying vec3 vP;varying vec3 vN;uniform vec4 uShares;uniform vec3 uC0;uniform vec3 uC1;uniform vec3 uC2;uniform vec3 uC3;
 void main(){float pi=3.14159265359;float phi=atan(vP.z,vP.x)/(2.0*pi)+.5;float t=fract(phi+.14*sin(vP.y*3.1)+.065*sin(vP.y*7.3));vec3 c=vec3(.12,.165,.18);float a=uShares.x,b=a+uShares.y,d=b+uShares.z,e=d+uShares.w;if(t<a)c=uC0;else if(t<b)c=uC1;else if(t<d)c=uC2;else if(t<e)c=uC3;
 float edge=min(min(abs(t-a),abs(t-b)),min(abs(t-d),abs(t-e)));edge=min(edge,min(t,1.0-t));float grid1=abs(fract(phi*28.0)-.5),grid2=abs(fract(acos(clamp(vP.y,-1.0,1.0))/pi*16.0)-.5);float grid=step(.465,max(grid1,grid2));float diffuse=.55+.45*max(dot(normalize(vN),normalize(vec3(-.4,.7,1.0))),0.0);c=mix(c*.68,c,diffuse);c+=vec3(.05,.063,.067)*grid;c+=vec3(.045,.055,.06)*pow(1.0-max(vN.z,0.0),3.0);if(edge<.0015)c=mix(c,vec3(.72),.14);gl_FragColor=vec4(c,1.0);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`}));
 const sphere=mesh(geo(new THREE.SphereGeometry(SPACE.globeRadius,low?56:88,low?40:60)),sphereMaterial,world);sphere.castShadow=false;sphere.receiveShadow=false;
 const marks=new THREE.Group();marks.name='economic-surface-markers';world.add(marks);
 const barGeo=geo(new THREE.BoxGeometry(.026,1,.026)),nodeGeo=geo(new THREE.SphereGeometry(.018,6,4));
 const markerMaterials=PLAYER_COLORS.map(color=>mat(new THREE.MeshStandardMaterial({color,metalness:.18,roughness:.65})));
 let shares=[],economicSignature='',width=1,height=1,mobile=false;
 function disposeMarks(){while(marks.children.length)marks.remove(marks.children[0]);}
 function updateEconomy(force=false){
  const ordered=Array.from({length:4},(_,seat)=>playerAt(seat)||{});const signature=JSON.stringify(ordered.map(p=>[p.id,p.score,p.users,p.profit,p.retention,p.bankrupt]));if(!force&&signature===economicSignature)return false;economicSignature=signature;
  shares=territoryShares(ordered);uniforms.uShares.value.set(...shares.slice(0,4));disposeMarks();const amount=quality.markerBudget;
  for(let i=0;i<amount;i++){const point=fibonacciPoint(i,amount),owner=territoryOwner(...point,shares);if(owner>3)continue;const p=ordered[owner],density=Math.min(.72,.25+Math.max(0,Number(p.users)||0)/1800);if((i*37%101)/101>density)continue;const n=new THREE.Vector3(...point),ret=Math.max(0,Math.min(1,Number(p.retention)||0));const h=Math.min(.16,.025+Math.min(.08,Math.max(0,Number(p.profit)||0)/16000)+(.015+ret*.025)*(i%5)/5+(i%17===0?.035:0));const bar=new THREE.Mesh(barGeo,markerMaterials[owner]);bar.scale.y=h;bar.position.copy(n).multiplyScalar(1.8+h/2);bar.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),n);marks.add(bar);if(i%7===0){const dot=new THREE.Mesh(nodeGeo,markerMaterials[owner]);dot.position.copy(n).multiplyScalar(1.82+h);marks.add(dot);}}
  shell.dataset.shares=JSON.stringify(shares);requestRender();return true;
 }
 const avatarToken=avatar=>avatar?.kind==='image'?avatar.dataUrl:'preset:'+(avatar?.id||'default');
 async function updateAvatar(person,player){
  const signature=avatarToken(player?.avatar);if(signature===person.avatarSignature)return;person.avatarSignature=signature;const version=++person.avatarVersion;
  try{const image=await drawAvatarCanvas(player?.avatar,person.seat);if(destroyed||version!==person.avatarVersion)return;const texture=new THREE.CanvasTexture(image);texture.colorSpace=THREE.SRGBColorSpace;textures.add(texture);const old=person.texture;person.texture=texture;person.face.material.map=texture;person.face.material.needsUpdate=true;if(old){old.dispose();textures.delete(old);}requestRender();}catch{}
 }
 let uiSignature='',idleUpdates=0,projectionCount=0,diagnosticReads=0,deferredPlayers=false;
 function update(next){
  if(destroyed)return;players=Array.isArray(next)?next:[];if(document.hidden||!onScreen){deferredPlayers=true;return;}deferredPlayers=false;updateEconomy();
  for(const person of people){const p=playerAt(person.seat);if(p&&avatarToken(p.avatar)!==person.avatarSignature)void updateAvatar(person,p);}
  const signature=JSON.stringify(Array.from({length:4},(_,seat)=>{const p=playerAt(seat);return p?[p.id,p.name,p.isBot,p.submitted,p.score]:null;}));
  if(signature===uiSignature){idleUpdates++;return;}uiSignature=signature;
  let occupancyChanged=false;
  for(const person of people){const p=playerAt(person.seat),mine=p?.id===options.meId;if(person.body.visible!==Boolean(p))occupancyChanged=true;person.body.visible=Boolean(p);person.headHit.hidden=!p;person.detail.disabled=!p;person.group.userData.playerId=p?.id||null;person.label.classList.toggle('is-me',mine);person.label.classList.toggle('is-empty',!p);person.headHit.classList.toggle('is-me',mine);const shortName=p?.isBot?p.name.split('·')[0].trim():p?.name;person.name.textContent=p?shortName+(mine?' · 你':''):'空席';person.detail.title=p?.name||'空席';person.status.hidden=!p?.submitted;person.status.dataset.state=p?.submitted?'submitted':'waiting';person.detail.setAttribute('aria-label',p?`${p.name}${mine?'，你的席位':''}，${p.submitted?'已提交':'尚未提交'}，综合分${Number(p.score||0).toFixed(2)}`:'此席位尚未入席');person.headHit.setAttribute('aria-label',mine?'更换我的头像':p?`查看${p.name}的经营资料`:'空席');person.headHit.title=mine?'更换我的头像':p?.name||'';}
  if(occupancyChanged){renderer.shadowMap.needsUpdate=true;requestRender();}
  // Names and submission dots are DOM-only; unchanged economics need no WebGL work.
 }
 function setWorldTransform(){const scale=SPACE.baseScale*globeZoom;world.scale.setScalar(scale);world.position.y=furniture.tableHeight+SPACE.clearance+SPACE.markRadius*scale;world.rotation.set(rotX,rotY,0);}
 function project(v){v.project(camera);return {x:(v.x*.5+.5)*width,y:(-.5*v.y+.5)*height};}
 function projectedBox(object){projectionCount++;const b=new THREE.Box3().setFromObject(object);const points=[];for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])points.push(project(new THREE.Vector3(x,y,z)));const xs=points.map(p=>p.x),ys=points.map(p=>p.y);return {left:Math.min(...xs),top:Math.min(...ys),right:Math.max(...xs),bottom:Math.max(...ys)};}
 function positionLabels(){
  scene.updateMatrixWorld();
  for(const person of people){const hp=project(person.head.getWorldPosition(new THREE.Vector3()));const bounds=projectedBox(person.head);person.projectedHead=bounds;const hitSize=Math.max(44,Math.min(56,bounds.bottom-bounds.top+6));person.headHit.style.width=person.headHit.style.height=hitSize+'px';person.headHit.style.left=hp.x+'px';person.headHit.style.top=hp.y+'px';const labelWidth=mobile?106:142;person.label.style.maxWidth=labelWidth+'px';person.label.style.left=Math.max(labelWidth/2+4,Math.min(width-labelWidth/2-4,hp.x))+'px';person.label.style.top=Math.max(24,bounds.top-34)+'px';person.headHit.dataset.headX=hp.x.toFixed(1);person.headHit.dataset.headY=hp.y.toFixed(1);person.headHit.dataset.avatarSeat=String(person.seat);}
  positionGlobeHit();
 }
 function positionGlobeHit(){
  const globeCenter=project(world.getWorldPosition(new THREE.Vector3())),globePixelRadius=SPACE.globeRadius*world.scale.x*height/(camera.top-camera.bottom);
  Object.assign(globeHit.style,{left:(globeCenter.x-globePixelRadius)+'px',top:(globeCenter.y-globePixelRadius)+'px',width:(globePixelRadius*2)+'px',height:(globePixelRadius*2)+'px'});
 }
 function resize(){
  width=shell.clientWidth;height=shell.clientHeight||420;if(!width)return;mobile=width<=680;setQuality(quality.requested);renderer.setSize(width,height);const aspect=width/height;
  setWorldTransform();scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);const bounds={x:0,y:0};
  for(const object of [furniture.table,world,...people.map(p=>p.group)]){const box=new THREE.Box3().setFromObject(object);for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const point=new THREE.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse);bounds.x=Math.max(bounds.x,Math.abs(point.x));bounds.y=Math.max(bounds.y,Math.abs(point.y));}}
  const halfHeight=Math.max(3.05,bounds.y+.25,(bounds.x+.24)/aspect);camera.left=-halfHeight*aspect;camera.right=halfHeight*aspect;camera.top=halfHeight;camera.bottom=-halfHeight;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  setWorldTransform();positionLabels();requestRender();shell.dataset.renderer='webgl';shell.dataset.scene='four-seated-people-v3';shell.dataset.avatarMode='head-texture';shell.dataset.environment='warm-timber-tavern';writeDiagnostics();
 }
 const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),points=new Map();let primary=null,rotating=false,lastPinch=0;
 function hitAt(x,y){const rect=canvas.getBoundingClientRect();pointer.set(((x-rect.left)/rect.width)*2-1,-((y-rect.top)/rect.height)*2+1);raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects([...interactive,world],true);for(const hit of hits){let o=hit.object,avatar=Boolean(o.userData.avatar),seat;while(o){if(Number.isInteger(o.userData.seat)){seat=o.userData.seat;break;}o=o.parent;}if(seat!==undefined)return {seat,avatar};if(hit.object===sphere||hit.object.parent===marks)return {world:true};}return null;}
 const stopAuto=()=>{auto=false;scheduler?.setContinuous(false);options.onAutoRotateChange?.(false);};
 const down=e=>{points.set(e.pointerId,{x:e.clientX,y:e.clientY});if(points.size===1){primary={x:e.clientX,y:e.clientY,hit:hitAt(e.clientX,e.clientY)};dragged=false;rotating=Boolean(primary.hit?.world);}if(rotating||points.size===2)e.currentTarget.setPointerCapture(e.pointerId);if(points.size===2){const [a,b]=[...points.values()];lastPinch=Math.hypot(a.x-b.x,a.y-b.y);stopAuto();}};
 const move=e=>{if(!points.has(e.pointerId))return;const previous=points.get(e.pointerId);points.set(e.pointerId,{x:e.clientX,y:e.clientY});if(points.size===2){const [a,b]=[...points.values()],distance=Math.hypot(a.x-b.x,a.y-b.y);if(lastPinch)globeZoom=Math.max(SPACE.minimumZoom,Math.min(SPACE.maximumZoom,globeZoom*distance/lastPinch));lastPinch=distance;dragged=true;dirty=true;setWorldTransform();scene.updateMatrixWorld();positionGlobeHit();requestRender();e.preventDefault();}else if(rotating){if(Math.hypot(e.clientX-primary.x,e.clientY-primary.y)>4)dragged=true;if(dragged){stopAuto();rotY+=(e.clientX-previous.x)*.007;rotX=Math.max(-1.05,Math.min(1.05,rotX+(e.clientY-previous.y)*.007));requestRender();e.preventDefault();}}};
 const end=e=>{const click=!dragged&&primary&&Math.hypot(e.clientX-primary.x,e.clientY-primary.y)<7;points.delete(e.pointerId);if(click){const hit=hitAt(e.clientX,e.clientY);if(hit&&Number.isInteger(hit.seat)){const p=playerAt(hit.seat);if(p)(hit.avatar?options.onAvatarClick:options.onSeatClick)?.(p);}}if(!points.size){primary=null;rotating=false;lastPinch=0;}};
 const cancel=e=>{points.delete(e.pointerId);primary=null;rotating=false;lastPinch=0;};
 const zoom=delta=>{globeZoom=Math.max(SPACE.minimumZoom,Math.min(SPACE.maximumZoom,globeZoom+delta));setWorldTransform();scene.updateMatrixWorld();positionGlobeHit();requestRender();};
 const wheel=e=>{if(hitAt(e.clientX,e.clientY)?.world){e.preventDefault();zoom(-e.deltaY*.00065);}};
 const keydown=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-'].includes(e.key))return;e.preventDefault();stopAuto();if(e.key==='ArrowLeft')rotY-=.15;if(e.key==='ArrowRight')rotY+=.15;if(e.key==='ArrowUp')rotX=Math.max(-1.05,rotX-.12);if(e.key==='ArrowDown')rotX=Math.min(1.05,rotX+.12);if(e.key==='+'||e.key==='=')zoom(.06);if(e.key==='-')zoom(-.06);requestRender();};
 for(const target of [canvas,globeHit]){target.addEventListener('pointerdown',down);target.addEventListener('pointermove',move,{passive:false});target.addEventListener('pointerup',end);target.addEventListener('pointercancel',cancel);target.addEventListener('wheel',wheel,{passive:false});}canvas.addEventListener('keydown',keydown);
 let frameCount=0,renderCount=0,activeFrames=0,idleCallbacks=0,renderCpuTotal=0,renderCpuLast=0,renderCpuMax=0;
 const renderTimes=[],callbackTimes=[];
 function setQuality(mode){
  const next=resolveSceneQuality(mode,device()),changed=next.effective!==quality.effective||next.pixelRatio!==quality.pixelRatio;
  quality=next;shell.dataset.quality=quality.effective;
  if(changed||!sphere.geometry.userData.quality){
   renderer.setPixelRatio(quality.pixelRatio);renderer.shadowMap.enabled=quality.shadows;renderer.shadowMap.needsUpdate=true;
   if(sphere.geometry.userData.quality!==quality.effective){sphere.geometry=geo(new THREE.SphereGeometry(SPACE.globeRadius,quality.effective==='low'?56:88,quality.effective==='low'?40:60));sphere.geometry.userData.quality=quality.effective;}
   for(const detail of interior.detailObjects||[])detail.visible=quality.effective==='high';
   updateEconomy(true);requestRender();
  }
  return {...quality};
 }
 function zoomBounds(value){const scale=SPACE.baseScale*value,centerY=furniture.tableHeight+SPACE.clearance+SPACE.markRadius*scale;return {zoom:value,scale,centerY,globeBottom:centerY-SPACE.globeRadius*scale,allMarkersBottom:centerY-SPACE.markRadius*scale,tableTop:furniture.tableHeight,minimumClearance:SPACE.clearance};}
 function getDiagnostics(){diagnosticReads++;const now=performance.now();while(renderTimes.length&&renderTimes[0]<now-1000)renderTimes.shift();while(callbackTimes.length&&callbackTimes[0]<now-1000)callbackTimes.shift();const fps=renderTimes.length,callbackFps=callbackTimes.length,rect=shell.getBoundingClientRect();return {version:3,renderer:'webgl',viewport:{width,height,mobile},seatCount:4,occupiedSeats:people.filter(p=>p.body.visible).length,avatarSeats:people.map(p=>({seat:p.seat,hasTexture:Boolean(p.face.material.map),textureUuid:p.texture?.uuid||null,avatarVersion:p.avatarVersion,avatarPreset:playerAt(p.seat)?.avatar?.kind==='preset'?playerAt(p.seat).avatar.id:null,headScale:p.head.scale.toArray(),head:p.projectedHead,label:{left:p.label.getBoundingClientRect().left-rect.left,top:p.label.getBoundingClientRect().top-rect.top,width:p.label.offsetWidth,height:p.label.offsetHeight}})),globe:{minimumZoom:SPACE.minimumZoom,maximumZoom:SPACE.maximumZoom,current:zoomBounds(globeZoom),default:zoomBounds(1),maximum:zoomBounds(SPACE.maximumZoom),conservativeLocalRadius:SPACE.markRadius,markerCount:marks.children.length},environment:{bottleCount:interior.bottleCount,windowCount:interior.windowCount,lampCount:interior.lampCount,propNames:interior.propNames,objectCount:interior.environment.children.length},quality:{...quality,antialias:renderer.getContextAttributes()?.antialias},frameCount,renderCount,fps,callbackFps,fpsWindowMs:1000,renderMode:auto&&!reduced?'continuous':'on-demand',drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometryCount:renderer.info.memory.geometries,textureCount:renderer.info.memory.textures,performance:{activeFrames,idleCallbacks,idleUpdates,projectionCount,diagnosticReads,suspended:document.hidden||!onScreen,scheduler:scheduler?.getState(),renderCpuMs:{last:renderCpuLast,mean:renderCount?renderCpuTotal/renderCount:0,max:renderCpuMax},staticBatches,sharedGeometries:geometries.length},defaultAutoRotate:false};}
 function writeDiagnostics(){const d=getDiagnostics();shell.dataset.sceneBounds=JSON.stringify({viewport:d.viewport,seats:d.avatarSeats,globe:d.globe,frameCount,renderCount,fps:d.fps,drawCalls:d.drawCalls,environmentObjects:d.environment.objectCount});}
 function drawScene(){const start=performance.now();setWorldTransform();scene.updateMatrixWorld();renderer.render(scene,camera);renderCpuLast=performance.now()-start;renderCpuTotal+=renderCpuLast;renderCpuMax=Math.max(renderCpuMax,renderCpuLast);renderCount++;renderTimes.push(performance.now());while(renderTimes.length>500)renderTimes.shift();dirty=false;}
 function captureSceneImage(){if(destroyed||document.hidden||!onScreen)return null;drawScene();return canvas.toDataURL('image/png');}
 shell.getSceneDiagnostics=getDiagnostics;container.getSceneDiagnostics=getDiagnostics;shell.captureSceneImage=captureSceneImage;
 function frame(time){if(destroyed)return;const dt=last?Math.min(.05,(time-last)/1000):0;last=time;frameCount++;callbackTimes.push(performance.now());while(callbackTimes.length>500)callbackTimes.shift();if(auto&&!reduced){activeFrames++;rotY+=dt*.04;dirty=true;}if(dirty)drawScene();else idleCallbacks++;shell.dataset.rotation=rotY.toFixed(3);shell.dataset.zoom=globeZoom.toFixed(2);}
 scheduler=createRenderScheduler({requestFrame:callback=>requestAnimationFrame(callback),cancelFrame:id=>cancelAnimationFrame(id),onFrame:frame,isVisible:()=>!document.hidden&&onScreen});
 const observer=new ResizeObserver(resize);observer.observe(shell);
 const visibility=()=>{last=0;scheduler.suspend(document.hidden||!onScreen);if(!document.hidden&&onScreen){if(deferredPlayers)update(players);requestRender();}};document.addEventListener('visibilitychange',visibility);
 const intersection=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{onScreen=entries[0].isIntersecting;visibility();},{rootMargin:'80px'}):null;intersection?.observe(shell);
 resize();update(players);
 scene.updateMatrixWorld(true);scene.traverse(node=>{if(node!==world){node.updateMatrix();node.matrixAutoUpdate=false;}});scene.matrixWorldAutoUpdate=false;
 scheduler.setContinuous(auto&&!reduced);requestRender();
 return {update,setAutoRotate(value){auto=Boolean(value);last=0;scheduler.setContinuous(auto&&!reduced);requestRender();},zoomIn(){zoom(.06);},zoomOut(){zoom(-.06);},getShares(){return shares.slice();},getDiagnostics,setQuality,getSceneSnapshot:captureSceneImage,destroy(){destroyed=true;scheduler.destroy();observer.disconnect();intersection?.disconnect();document.removeEventListener('visibilitychange',visibility);for(const target of [canvas,globeHit]){target.removeEventListener('pointerdown',down);target.removeEventListener('pointermove',move);target.removeEventListener('pointerup',end);target.removeEventListener('pointercancel',cancel);target.removeEventListener('wheel',wheel);}canvas.removeEventListener('keydown',keydown);for(const t of textures)t.dispose();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();renderer.dispose();if(container.getSceneDiagnostics===getDiagnostics)delete container.getSceneDiagnostics;shell.remove();}};
}
