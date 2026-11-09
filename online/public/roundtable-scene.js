import * as THREE from './assets/vendor/three.module.min.js';
import {territoryShares,territoryOwner,fibonacciPoint,PLAYER_COLORS} from './globe-math.js?v=20261109a';
import {drawAvatarCanvas} from './avatar-art.js?v=roundtable1';
export {territoryShares,PLAYER_COLORS};

const ANGLES=[-Math.PI/4,-Math.PI*3/4,Math.PI*3/4,Math.PI/4];
const TAU=Math.PI*2;
export function mountRoundtable(container,initialPlayers=[],options={}){
 let destroyed=false,players=initialPlayers,auto=options.autoRotate!==false,rotX=.12,rotY=-.5,globeZoom=1,raf=0,last=0,dragged=false;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const low=Boolean(options.lowPerformance||(navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=4));
 const shell=document.createElement('div');shell.className='globe-shell roundtable-scene';shell.style.cssText='position:relative;width:100%;height:100%;overflow:hidden;touch-action:pan-y';container.append(shell);
 let renderer;
 try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});}catch{
  shell.dataset.renderer='unavailable';
  const notice=document.createElement('p');notice.className='roundtable-unavailable';notice.setAttribute('role','status');notice.textContent='当前设备无法创建 WebGL，圆桌场景暂不可用。可以通过下方席位查看经营详情，行动仍可继续。';
  const roster=document.createElement('ol');roster.className='roundtable-fallback';roster.style.cssText='max-width:560px;margin:20px auto;padding:0 24px;line-height:2.2';shell.append(notice,roster);
  function fallbackUpdate(next){players=Array.isArray(next)?next:[];roster.replaceChildren();for(const p of players){const row=document.createElement('li'),button=document.createElement('button');button.type='button';button.textContent=`${p.name} · ${Number(p.score||0).toFixed(2)}分`;button.addEventListener('click',()=>options.onSeatClick?.(p));row.append(button);if(p.id===options.meId){const avatar=document.createElement('button');avatar.type='button';avatar.textContent='更换我的头像';avatar.style.marginLeft='16px';avatar.addEventListener('click',()=>options.onAvatarClick?.(p));row.append(avatar);}roster.append(row);}}
  fallbackUpdate(players);
  return{update:fallbackUpdate,setAutoRotate(){},zoomIn(){},zoomOut(){},destroy(){shell.remove();},getShares(){return territoryShares(players);}};
 }
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,low?1:1.6));renderer.setClearColor(0x000000,0);
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.22;
 renderer.shadowMap.enabled=!low;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 const canvas=renderer.domElement;canvas.tabIndex=0;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','四人圆桌：坐姿人物与可换头像。拖动中央球体旋转，滚轮或双指缩放，方向键和加减键可操作。');canvas.style.touchAction='none';shell.append(canvas);
 const labels=document.createElement('div');labels.className='roundtable-overlays';labels.style.cssText='position:absolute;inset:0;pointer-events:none';shell.append(labels);
 const scene=new THREE.Scene();
 const camera=new THREE.OrthographicCamera(-5,5,3,-3,.1,70);camera.position.set(0,6.5,14);camera.lookAt(0,1.35,0);
 const materials=[],geometries=[],textures=new Set(),people=[],interactive=[];
 const rememberMaterial=m=>{if(m.isMeshBasicMaterial)m.toneMapped=false;materials.push(m);return m;},rememberGeometry=g=>(geometries.push(g),g);
 const dark=rememberMaterial(new THREE.MeshStandardMaterial({color:0x202126,metalness:.33,roughness:.39}));
 const chairMat=rememberMaterial(new THREE.MeshStandardMaterial({color:0x121318,metalness:.45,roughness:.36}));
 const cushionMat=rememberMaterial(new THREE.MeshStandardMaterial({color:0x202025,metalness:.12,roughness:.62}));
 const blackMetal=rememberMaterial(new THREE.MeshStandardMaterial({color:0x18191c,metalness:.8,roughness:.3}));
 const orange=rememberMaterial(new THREE.MeshBasicMaterial({color:0xff5534}));
 const edgeMat=rememberMaterial(new THREE.MeshStandardMaterial({color:0x6e281e,emissive:0xe84226,emissiveIntensity:.2,metalness:.6,roughness:.45}));
 const ballGeo=rememberGeometry(new THREE.SphereGeometry(1,low?14:24,low?10:18));
 const limbGeo=rememberGeometry(new THREE.CylinderGeometry(1,1,1,low?10:16));
 function mesh(geo,mat,parent=scene){const o=new THREE.Mesh(geo,mat);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
 function ellipsoid(parent,at,scale,mat=dark){const o=mesh(ballGeo,mat,parent);o.position.set(...at);o.scale.set(...scale);return o;}
 function limb(parent,a,b,ra,rb,mat=dark){
  const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),length=va.distanceTo(vb);
  const geo=rememberGeometry(new THREE.CylinderGeometry(rb,ra,length,low?10:16));const o=mesh(geo,mat,parent);o.position.copy(va).lerp(vb,.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),vb.sub(va).normalize());return o;
 }
 function tube(parent,points,radius,mat){return mesh(rememberGeometry(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),low?32:64,radius,6,false)),mat,parent);}
 // Contact light and shadow are procedural canvas textures, not a background image.
 const floorCanvas=document.createElement('canvas');floorCanvas.width=floorCanvas.height=256;const fc=floorCanvas.getContext('2d');
 const gradient=fc.createRadialGradient(128,128,0,128,128,127);gradient.addColorStop(0,'rgba(183,47,24,.22)');gradient.addColorStop(.55,'rgba(79,24,18,.13)');gradient.addColorStop(1,'rgba(0,0,0,0)');fc.fillStyle=gradient;fc.fillRect(0,0,256,256);
 const floorTexture=new THREE.CanvasTexture(floorCanvas);textures.add(floorTexture);
 const floor=mesh(rememberGeometry(new THREE.PlaneGeometry(13,13)),rememberMaterial(new THREE.MeshBasicMaterial({map:floorTexture,transparent:true,depthWrite:false})));floor.rotation.x=-Math.PI/2;floor.position.y=-.04;floor.receiveShadow=false;
 const ground=mesh(rememberGeometry(new THREE.CircleGeometry(6.7,64)),rememberMaterial(new THREE.ShadowMaterial({opacity:.24})));ground.rotation.x=-Math.PI/2;ground.position.y=-.015;
 const table=new THREE.Group();table.name='code-roundtable';scene.add(table);
 const pedestal=mesh(rememberGeometry(new THREE.CylinderGeometry(1.1,1.38,.13,64)),blackMetal,table);pedestal.position.y=.07;
 const stem=mesh(rememberGeometry(new THREE.CylinderGeometry(.55,.8,.78,48)),blackMetal,table);stem.position.y=.48;
 const tabletop=mesh(rememberGeometry(new THREE.CylinderGeometry(3.14,3.18,.18,low?64:112)),rememberMaterial(new THREE.MeshStandardMaterial({color:0x201819,metalness:.52,roughness:.32})),table);tabletop.position.y=.99;
 const inner=mesh(rememberGeometry(new THREE.CylinderGeometry(2.98,2.98,.016,96)),rememberMaterial(new THREE.MeshStandardMaterial({color:0x171719,metalness:.42,roughness:.42})),table);inner.position.y=1.088;
 for(const [r,y,t,opacity] of [[3.16,1.1,.047,1],[3.19,1.065,.013,.85],[3.1,.91,.014,.45]]){
  const rim=mesh(rememberGeometry(new THREE.TorusGeometry(r,t,10,low?96:160)),rememberMaterial(new THREE.MeshBasicMaterial({color:0xff5534,transparent:opacity<1,opacity})),table);rim.rotation.x=Math.PI/2;rim.position.y=y;
 }
 const halo=mesh(rememberGeometry(new THREE.TorusGeometry(3.16,.095,8,128)),rememberMaterial(new THREE.MeshBasicMaterial({color:0xf74828,transparent:true,opacity:.11,depthWrite:false})),table);halo.rotation.x=Math.PI/2;halo.position.y=1.075;
 for(let i=0;i<4;i++){
  const ledMat=rememberMaterial(new THREE.MeshBasicMaterial({color:PLAYER_COLORS[i]}));
  const marker=mesh(rememberGeometry(new THREE.TorusGeometry(3.0,.013,6,48,.19)),ledMat,table);marker.rotation.x=Math.PI/2;marker.rotation.z=-ANGLES[i]-Math.PI/2-.095;marker.position.y=1.112;
 }
 scene.add(new THREE.HemisphereLight(0xfff0e3,0x10080a,1.5));
 const ambient=new THREE.AmbientLight(0xc6c6d4,.48);scene.add(ambient);
 const key=new THREE.DirectionalLight(0xfff3e9,3.4);key.position.set(-4,8,6);key.castShadow=!low;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-7;key.shadow.camera.right=7;key.shadow.camera.top=7;key.shadow.camera.bottom=-7;key.shadow.bias=-.001;key.shadow.normalBias=.03;scene.add(key);
 const fill=new THREE.DirectionalLight(0x9ba8be,1.3);fill.position.set(5,4,-4);scene.add(fill);
 const rimLight=new THREE.PointLight(0xff3e1f,18,13,2);rimLight.position.set(0,2.3,-4.2);scene.add(rimLight);
 const warmFront=new THREE.PointLight(0xff5533,10,10,2);warmFront.position.set(0,1.8,3.3);scene.add(warmFront);

 function createPerson(seat){
  const group=new THREE.Group();group.name=`seat-${seat}-seated-person`;group.userData.seat=seat;scene.add(group);interactive.push(group);
  const chair=new THREE.Group();chair.name='chair';group.add(chair);
  ellipsoid(chair,[0,.79,-.02],[.67,.15,.6],chairMat);
  ellipsoid(chair,[0,1.38,-.47],[.61,.84,.20],chairMat).rotation.x=-.13;
  ellipsoid(chair,[0,1.36,-.31],[.48,.67,.10],cushionMat).rotation.x=-.13;
  tube(chair,[[-.55,.88,-.45],[-.61,1.35,-.55],[-.47,2.05,-.61],[0,2.20,-.62],[.47,2.05,-.61],[.61,1.35,-.55],[.55,.88,-.45]],.017,edgeMat);
  for(const x of [-.46,.46])for(const z of [-.39,.32])limb(chair,[x,.75,z],[x*1.3,.035,z*1.36],.035,.024,blackMetal);
  const body=new THREE.Group();body.name='seated-body';group.add(body);
  ellipsoid(body,[0,.94,.03],[.39,.24,.34]);
  ellipsoid(body,[0,1.42,.08],[.39,.49,.27]).rotation.x=.12;
  ellipsoid(body,[0,1.79,.14],[.49,.37,.29]).rotation.x=.13;
  for(const side of [-1,1]){
   ellipsoid(body,[side*.42,1.81,.13],[.23,.26,.25]);
   limb(body,[side*.46,1.78,.17],[side*.66,1.30,.51],.19,.135);
   ellipsoid(body,[side*.66,1.30,.51],[.14,.15,.15]);
   limb(body,[side*.65,1.29,.52],[side*.36,1.18,.99],.135,.10);
   ellipsoid(body,[side*.32,1.16,1.03],[.13,.065,.18]);
   limb(body,[side*.23,.91,.08],[side*.30,.62,.68],.20,.17);
   ellipsoid(body,[side*.30,.62,.68],[.17,.18,.18]);
   limb(body,[side*.30,.61,.68],[side*.33,.16,.65],.15,.10);
   ellipsoid(body,[side*.33,.11,.78],[.14,.10,.27],chairMat);
  }
  limb(body,[0,1.97,.15],[0,2.22,.14],.14,.13);
  const head=new THREE.Group();head.name='head-with-avatar';head.position.set(0,2.44,.15);body.add(head);
  ellipsoid(head,[0,0,0],[.30,.36,.30]);
  const faceMat=rememberMaterial(new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,side:THREE.DoubleSide}));
  const face=mesh(rememberGeometry(new THREE.CircleGeometry(.278,48)),faceMat,head);face.name='player-avatar-texture';face.position.z=.307;face.userData.avatar=true;face.castShadow=false;face.receiveShadow=false;
  const faceRing=mesh(rememberGeometry(new THREE.TorusGeometry(.288,.012,6,48)),rememberMaterial(new THREE.MeshBasicMaterial({color:PLAYER_COLORS[seat]})),head);faceRing.position.z=.31;faceRing.castShadow=false;
  const label=document.createElement('div');label.className='roundtable-label';label.dataset.seat=seat;label.style.cssText='position:absolute;pointer-events:auto;transform:translate(-50%,-50%);text-align:center;';
  const detail=document.createElement('button');detail.type='button';detail.className='roundtable-detail';detail.style.cssText='background:none;border:0;color:inherit;padding:4px 8px;cursor:pointer;';
  const name=document.createElement('b');name.className='roundtable-person-name roundtable-name';name.style.display='block';
  const score=document.createElement('strong');score.className='roundtable-score';
  const state=document.createElement('span');state.className='roundtable-state';state.style.display='block';detail.append(name,score,state);label.append(detail);labels.append(label);
  const headHit=document.createElement('button');headHit.type='button';headHit.className='roundtable-head-hit';headHit.dataset.seat=seat;headHit.style.cssText='position:absolute;pointer-events:auto;transform:translate(-50%,-50%);width:54px;height:54px;background:none;border:0;border-radius:50%;color:transparent;cursor:pointer;';labels.append(headHit);
  detail.addEventListener('click',()=>{const p=players.find(p=>p.seat===seat)||players[seat];if(p)options.onSeatClick?.(p);});
  headHit.addEventListener('click',()=>{const p=players.find(p=>p.seat===seat)||players[seat];if(p)options.onAvatarClick?.(p);});
  return{seat,group,body,head,face,faceRing,label,detail,name,score,state,headHit,avatarSignature:null,avatarVersion:0,texture:null};
 }
 for(let i=0;i<4;i++)people.push(createPerson(i));

 const world=new THREE.Group();world.name='rotatable-competition-globe';world.position.y=2.40;scene.add(world);
 const uniforms={uShares:{value:new THREE.Vector4()},uC0:{value:new THREE.Color(PLAYER_COLORS[0])},uC1:{value:new THREE.Color(PLAYER_COLORS[1])},uC2:{value:new THREE.Color(PLAYER_COLORS[2])},uC3:{value:new THREE.Color(PLAYER_COLORS[3])}};
 const sphereMaterial=rememberMaterial(new THREE.ShaderMaterial({uniforms,vertexShader:`varying vec3 vP; varying vec3 vN; void main(){vP=normalize(position);vN=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,fragmentShader:`
 varying vec3 vP;varying vec3 vN;uniform vec4 uShares;uniform vec3 uC0;uniform vec3 uC1;uniform vec3 uC2;uniform vec3 uC3;
 void main(){float pi=3.14159265359;float phi=atan(vP.z,vP.x)/(2.0*pi)+.5;float t=fract(phi+.14*sin(vP.y*3.1)+.065*sin(vP.y*7.3));vec3 c=vec3(.055,.065,.075);float a=uShares.x,b=a+uShares.y,d=b+uShares.z,e=d+uShares.w;
 if(t<a)c=uC0;else if(t<b)c=uC1;else if(t<d)c=uC2;else if(t<e)c=uC3;
 float edge=min(min(abs(t-a),abs(t-b)),min(abs(t-d),abs(t-e)));edge=min(edge,min(t,1.0-t));
 float grid1=abs(fract(phi*42.0)-.5),grid2=abs(fract(acos(clamp(vP.y,-1.0,1.0))/pi*24.0)-.5);float grid=step(.465,max(grid1,grid2));
 float diffuse=.4+.6*max(dot(normalize(vN),normalize(vec3(-.4,.7,1.0))),0.0);float rim=pow(1.0-max(vN.z,0.0),3.0);c=mix(c*.62,c,diffuse);c*=1.0-.14*grid;c+=vec3(.1,.11,.14)*rim;if(edge<.0015)c=mix(c,vec3(.94),.3);gl_FragColor=vec4(c,1.0);}`}));
 const sphere=mesh(rememberGeometry(new THREE.SphereGeometry(1.8,low?64:112,low?48:72)),sphereMaterial,world);sphere.castShadow=false;sphere.receiveShadow=false;
 const marks=new THREE.Group();world.add(marks);
 const barGeo=rememberGeometry(new THREE.BoxGeometry(.032,1,.032)),nodeGeo=rememberGeometry(new THREE.SphereGeometry(.021,6,4));
 const barMats=PLAYER_COLORS.map(c=>rememberMaterial(new THREE.MeshStandardMaterial({color:c,metalness:.5,roughness:.3,emissive:c,emissiveIntensity:.15})));
 const linkMat=rememberMaterial(new THREE.LineBasicMaterial({color:0xd2dfea,transparent:true,opacity:.23}));
 let shares=territoryShares(players),lastEconomicSignature=null;
 function disposeMarks(){while(marks.children.length){const o=marks.children[0];marks.remove(o);if(o.userData.ownedGeometry)o.geometry.dispose();}}
 function updateEconomy(){const signature=JSON.stringify(players.map(p=>[p.id,p.score,p.users,p.profit,p.retention,p.bankrupt]));if(signature===lastEconomicSignature)return;lastEconomicSignature=signature;shares=territoryShares(players);uniforms.uShares.value.set(...shares.slice(0,4));disposeMarks();const amount=low?300:550,anchors=[null,null,null,null],counts=[0,0,0,0];
  for(let i=0;i<amount;i++){
   const point=fibonacciPoint(i,amount),owner=territoryOwner(...point,shares);if(owner>3)continue;
   const p=players[owner]||{},density=Math.min(.95,.25+Math.max(0,Number(p.users)||0)/1600);if((i*37%101)/101>density)continue;
   const n=new THREE.Vector3(...point),ret=Math.min(1,Math.max(0,Number(p.retention)||0));let h=.035+Math.min(.27,Math.max(0,Number(p.profit)||0)/9000)+(.03+ret*.05)*(i%7)/7;if(i%11===0)h+=.17;
   const bar=new THREE.Mesh(barGeo,barMats[owner]);bar.scale.y=h;bar.position.copy(n).multiplyScalar(1.8+h/2);bar.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),n);marks.add(bar);
   if(i%5===0){const dot=new THREE.Mesh(nodeGeo,barMats[owner]);dot.position.copy(n).multiplyScalar(1.82+h);marks.add(dot);if(anchors[owner]&&counts[owner]<8){const arr=[];for(let j=0;j<=24;j++)arr.push(anchors[owner].clone().lerp(n,j/24).normalize().multiplyScalar(1.84+Math.sin(j/24*Math.PI)*.25));const geom=new THREE.BufferGeometry().setFromPoints(arr),line=new THREE.Line(geom,linkMat);line.userData.ownedGeometry=true;marks.add(line);counts[owner]++;}anchors[owner]=n;}
  }
  shell.dataset.shares=JSON.stringify(shares);
 }
 async function updateAvatar(person,player){
  const signature=JSON.stringify(player?.avatar||null);if(signature===person.avatarSignature)return;person.avatarSignature=signature;const version=++person.avatarVersion;
  try{const image=await drawAvatarCanvas(player?.avatar,person.seat);if(destroyed||version!==person.avatarVersion)return;const texture=new THREE.CanvasTexture(image);texture.colorSpace=THREE.SRGBColorSpace;textures.add(texture);const old=person.texture;person.texture=texture;person.face.material.map=texture;person.face.material.needsUpdate=true;if(old){old.dispose();textures.delete(old);}}catch{}
 }
 function update(next){if(destroyed)return;players=Array.isArray(next)?next:[];updateEconomy();
  for(const person of people){
   const p=players.find(p=>p.seat===person.seat)||players[person.seat];const mine=p?.id===options.meId;
   person.body.visible=Boolean(p);person.headHit.hidden=!p;person.detail.disabled=!p;
   person.group.userData.playerId=p?.id||null;person.label.classList.toggle('is-me',mine);person.label.classList.toggle('is-empty',!p);person.headHit.classList.toggle('is-me',mine);
   person.name.textContent=p?(p.name+(mine?' · 你':'')):'等待朋友';
   person.score.textContent=p?Number(p.score||0).toFixed(2):'';
   person.state.textContent=p?(p.bankrupt?'已破产':p.submitted?'已提交':p.isBot?'练习脚本':mine?'点击头像更换':'玩家'):'空席';
   person.detail.setAttribute('aria-label',p?`查看${p.name}的经营详情，综合分${Number(p.score||0).toFixed(2)}`:`席位${person.seat+1}等待朋友`);
   person.headHit.setAttribute('aria-label',mine?'更换我的头像':p?`查看${p.name}的形象与经营详情`:'空席');
   person.headHit.title=mine?'点击更换我的头像':p?.name||'空席';
   if(p)void updateAvatar(person,p);
  }
  scene.updateMatrixWorld(true);positionLabels();
 }
 const viewPoint=new THREE.Vector3(),headPoint=new THREE.Vector3(),namePoint=new THREE.Vector3();
 let width=1,height=1,mobile=false;
 function toScreen(v){v.project(camera);return{x:(v.x*.5+.5)*width,y:(-.5*v.y+.5)*height};}
 function positionLabels(){
  scene.updateMatrixWorld(true);
  for(const person of people){
   person.head.getWorldPosition(headPoint);const hp=toScreen(headPoint.clone());
   person.headHit.style.left=hp.x+'px';person.headHit.style.top=hp.y+'px';
   // The compact label sits outside the chair, never in place of the body.
   const a=ANGLES[person.seat],r=mobile?3.6:4.12,back=person.seat===1||person.seat===2;
   if(back)namePoint.set(Math.sign(Math.sin(a))*(mobile?2.35:3.95),mobile?3.10:1.45,Math.cos(a)*3.8);
   else namePoint.set(Math.sin(a)*r,.40,Math.cos(a)*r);const np=toScreen(namePoint.clone());
   const labelWidth=mobile?108:168;person.label.style.width=labelWidth+'px';person.label.style.left=Math.max(labelWidth/2+2,Math.min(width-labelWidth/2-2,np.x))+'px';person.label.style.top=Math.max(26,Math.min(height-42,np.y-(mobile&&back?30:0)))+'px';
   person.headHit.dataset.headX=hp.x.toFixed(1);person.headHit.dataset.headY=hp.y.toFixed(1);
  }
 }
 function resize(){
  width=shell.clientWidth;height=shell.clientHeight||420;if(!width)return;mobile=width<=680;
  renderer.setSize(width,height);const aspect=width/height;
  const span=Math.max(5.0,(mobile?7.4:8.35)/aspect),half=span/2;
  camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  for(const person of people){const a=ANGLES[person.seat],radius=mobile?3.65:3.80;person.group.position.set(Math.sin(a)*radius,0,Math.cos(a)*radius);person.group.rotation.y=a+Math.PI;
   const inverse=person.group.quaternion.clone().invert();person.head.quaternion.copy(inverse.multiply(camera.quaternion));person.head.scale.setScalar(mobile?1.4:1);
  }
  positionLabels();shell.dataset.renderer='webgl';shell.dataset.scene='four-seated-people';shell.dataset.avatarMode='head-texture';
 }
 const observer=new ResizeObserver(resize);observer.observe(shell);
 const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),points=new Map();let lastPinch=0,primary=null,rotating=false;
 function hitAt(x,y){const rect=canvas.getBoundingClientRect();pointer.set(((x-rect.left)/rect.width)*2-1,-((y-rect.top)/rect.height)*2+1);raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects([...interactive,world],true);for(const hit of hits){let o=hit.object,avatar=Boolean(o.userData.avatar),seat;while(o){if(Number.isInteger(o.userData.seat)){seat=o.userData.seat;break;}o=o.parent;}if(seat!==undefined)return{seat,avatar};if(hit.object===sphere||hit.object.parent===marks)return{world:true};}return null;}
 const stopAuto=()=>{auto=false;options.onAutoRotateChange?.(false);};
 const down=e=>{points.set(e.pointerId,{x:e.clientX,y:e.clientY});if(points.size===1){primary={x:e.clientX,y:e.clientY,hit:hitAt(e.clientX,e.clientY)};dragged=false;rotating=Boolean(primary.hit?.world);}if(rotating||points.size===2)canvas.setPointerCapture(e.pointerId);if(points.size===2){const [a,b]=[...points.values()];lastPinch=Math.hypot(a.x-b.x,a.y-b.y);stopAuto();}};
 const move=e=>{if(!points.has(e.pointerId))return;const previous=points.get(e.pointerId);points.set(e.pointerId,{x:e.clientX,y:e.clientY});if(points.size===2){const [a,b]=[...points.values()],distance=Math.hypot(a.x-b.x,a.y-b.y);if(lastPinch)globeZoom=Math.max(.70,Math.min(1.16,globeZoom*distance/lastPinch));lastPinch=distance;dragged=true;e.preventDefault();}else if(rotating){if(Math.hypot(e.clientX-primary.x,e.clientY-primary.y)>4)dragged=true;if(dragged){stopAuto();rotY+=(e.clientX-previous.x)*.007;rotX=Math.max(-1.2,Math.min(1.2,rotX+(e.clientY-previous.y)*.007));}}};
 const end=e=>{const isClick=!dragged&&primary&&Math.hypot(e.clientX-primary.x,e.clientY-primary.y)<7;points.delete(e.pointerId);if(isClick){const hit=hitAt(e.clientX,e.clientY);if(hit&&Number.isInteger(hit.seat)){const p=players.find(p=>p.seat===hit.seat)||players[hit.seat];if(p)(hit.avatar?options.onAvatarClick:options.onSeatClick)?.(p);}}if(!points.size){primary=null;rotating=false;lastPinch=0;}};
 const cancel=e=>{points.delete(e.pointerId);primary=null;rotating=false;lastPinch=0;};
 const wheel=e=>{if(hitAt(e.clientX,e.clientY)?.world){e.preventDefault();globeZoom=Math.max(.70,Math.min(1.16,globeZoom-e.deltaY*.0008));}};
 const keydown=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-'].includes(e.key))return;e.preventDefault();stopAuto();if(e.key==='ArrowLeft')rotY-=.15;if(e.key==='ArrowRight')rotY+=.15;if(e.key==='ArrowUp')rotX=Math.max(-1.2,rotX-.12);if(e.key==='ArrowDown')rotX=Math.min(1.2,rotX+.12);if(e.key==='+'||e.key==='=')globeZoom=Math.min(1.16,globeZoom+.07);if(e.key==='-')globeZoom=Math.max(.70,globeZoom-.07);};
 canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move,{passive:false});canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',cancel);canvas.addEventListener('wheel',wheel,{passive:false});canvas.addEventListener('keydown',keydown);
 const visibility=()=>{if(!document.hidden&&!raf&&!destroyed){last=0;raf=requestAnimationFrame(frame);}};document.addEventListener('visibilitychange',visibility);
 function frame(time){raf=0;if(destroyed||document.hidden)return;const dt=last?Math.min(.05,(time-last)/1000):0;last=time;if(auto&&!rotating&&!reduced)rotY+=dt*.055;world.rotation.set(rotX,rotY,0);world.scale.setScalar(.73*globeZoom);renderer.render(scene,camera);shell.dataset.rotation=rotY.toFixed(3);shell.dataset.zoom=globeZoom.toFixed(2);raf=requestAnimationFrame(frame);}
 resize();update(players);raf=requestAnimationFrame(frame);
 return{update,setAutoRotate(value){auto=Boolean(value);},zoomIn(){globeZoom=Math.min(1.16,globeZoom+.07);},zoomOut(){globeZoom=Math.max(.70,globeZoom-.07);},getShares(){return shares.slice();},destroy(){destroyed=true;cancelAnimationFrame(raf);observer.disconnect();document.removeEventListener('visibilitychange',visibility);disposeMarks();canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',end);canvas.removeEventListener('pointercancel',cancel);canvas.removeEventListener('wheel',wheel);canvas.removeEventListener('keydown',keydown);for(const t of textures)t.dispose();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();renderer.dispose();shell.remove();}};
}
