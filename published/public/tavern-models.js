import * as THREE from './assets/vendor/three.module.min.js';

// All furniture is real geometry. Textures are deterministic local canvas art.
const woodTextures=new WeakMap();
export function woodTexture(textures,{dark=false}={}){
 const cached=woodTextures.get(textures)||new Map();woodTextures.set(textures,cached);if(cached.has(dark))return cached.get(dark);
 const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');
 x.fillStyle=dark?'#30251f':'#72503b';x.fillRect(0,0,512,512);let seed=170117;
 const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
 for(let i=0;i<310;i++){const y=random()*512;x.strokeStyle=i%3?'rgba(24,14,10,.14)':'rgba(218,176,117,.11)';x.lineWidth=.35+random()*1.2;x.beginPath();x.moveTo(0,y);x.bezierCurveTo(140,y+random()*18-9,370,y+random()*24-12,512,y+random()*18-9);x.stroke();}
 for(const y of [126,254,382]){x.fillStyle='rgba(18,12,8,.2)';x.fillRect(0,y,512,1);}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;textures.add(t);cached.set(dark,t);return t;
}

export function buildFurniture(kit){
 const {scene,mesh,geo,mat,ellipsoid,rod,tube,textures,low}=kit;
 const wood=mat(new THREE.MeshStandardMaterial({color:0xb18a66,map:woodTexture(textures),roughness:.76,metalness:.02}));
 const deepWood=mat(new THREE.MeshStandardMaterial({color:0x6d4d38,map:woodTexture(textures,{dark:true}),roughness:.79,metalness:.03}));
 const brass=mat(new THREE.MeshStandardMaterial({color:0xa78a55,roughness:.5,metalness:.68}));
 const steel=mat(new THREE.MeshStandardMaterial({color:0x33383b,roughness:.65,metalness:.35}));
 const leather=mat(new THREE.MeshStandardMaterial({color:0x3d3934,roughness:.94,metalness:0}));
 const paper=mat(new THREE.MeshStandardMaterial({color:0xdacfb4,roughness:1}));
 const table=new THREE.Group();table.name='roundtable-walnut-and-brass';scene.add(table);
 const tabletop=mesh(geo(new THREE.CylinderGeometry(3.04,3.08,.17,low?64:112)),wood,table);tabletop.position.y=1.035;
 const apron=mesh(geo(new THREE.CylinderGeometry(2.96,2.94,.23,64)),deepWood,table);apron.position.y=.85;
 const lip=mesh(geo(new THREE.TorusGeometry(3.045,.018,6,low?80:128)),brass,table);lip.rotation.x=Math.PI/2;lip.position.y=1.112;
 const inlay=mesh(geo(new THREE.TorusGeometry(1.43,.008,5,80)),brass,table);inlay.rotation.x=Math.PI/2;inlay.position.y=1.124;
 const stem=mesh(geo(new THREE.CylinderGeometry(.46,.7,.83,32)),deepWood,table);stem.position.y=.47;
 for(const a of [0,Math.PI/2]){const foot=mesh(geo(new THREE.BoxGeometry(2.2,.12,.32)),deepWood,table);foot.position.y=.1;foot.rotation.y=a;}
 for(let i=0;i<4;i++){const a=i*Math.PI/2;const rivet=mesh(geo(new THREE.SphereGeometry(.025,6,4)),brass,table);rivet.position.set(Math.sin(a)*3.02,.94,Math.cos(a)*3.02);}
 const mugMaterial=mat(new THREE.MeshStandardMaterial({color:0xb7b3a6,roughness:.8,metalness:.02}));
 const coffeeMaterial=mat(new THREE.MeshStandardMaterial({color:0x231b16,roughness:.54}));
 const covers=[0x364b4c,0x73513e,0x455c49,0x5f4b54].map(color=>mat(new THREE.MeshStandardMaterial({color,roughness:.94})));
 const angles=[-Math.PI/4,-3*Math.PI/4,3*Math.PI/4,Math.PI/4];
 for(let seat=0;seat<4;seat++){
  const a=angles[seat]+.25,r=2.53;const p=new THREE.Group();p.name='table-setting-'+seat;p.position.set(Math.sin(a)*r,1.127,Math.cos(a)*r);p.rotation.y=a;table.add(p);
  const coaster=mesh(geo(new THREE.CylinderGeometry(.19,.19,.012,24)),leather,p);coaster.position.y=.009;
  const mug=mesh(geo(new THREE.CylinderGeometry(.105,.092,.19,20,1,true)),mugMaterial,p);mug.position.y=.11;
  const coffee=mesh(geo(new THREE.CircleGeometry(.095,20)),coffeeMaterial,p);coffee.rotation.x=-Math.PI/2;coffee.position.y=.195;
  const handle=mesh(geo(new THREE.TorusGeometry(.065,.014,5,14,Math.PI*1.5)),mugMaterial,p);handle.position.set(.115,.12,0);handle.rotation.y=Math.PI/2;
  if(seat===0||seat===2){const note=new THREE.Group();note.name='notebook-and-pen';note.position.set(-.76,0,-.03);note.rotation.y=.18;p.add(note);const cover=mesh(geo(new THREE.BoxGeometry(.42,.025,.3)),covers[seat],note);cover.position.y=.021;const pages=mesh(geo(new THREE.BoxGeometry(.39,.018,.275)),paper,note);pages.position.y=.04;rod(note,[-.22,.075,.13],[.15,.075,.2],.012,.012,brass);}
 }
 return {table,tableHeight:1.12,tableRadius:3.08,materials:{wood,deepWood,brass,steel,leather,paper,covers}};
}

export function buildSeatedPerson(seat,kit,furniture){
 const {scene,mesh,geo,mat,ellipsoid,rod,tube}=kit;const {wood,deepWood,brass,steel,leather}=furniture.materials;
 const group=new THREE.Group();group.name='seat-'+seat+'-seated-person';group.userData.seat=seat;scene.add(group);
 const chair=new THREE.Group();chair.name='crafted-chair';group.add(chair);
 const seatBase=mesh(geo(new THREE.BoxGeometry(1.06,.095,.96)),deepWood,chair);seatBase.position.set(0,.75,-.07);
 ellipsoid(chair,[0,.83,-.05],[.54,.115,.48],leather);
 const back=mesh(geo(new THREE.BoxGeometry(.96,.66,.075)),wood,chair);back.position.set(0,1.49,-.5);back.rotation.x=-.08;
 ellipsoid(chair,[0,1.49,-.44],[.43,.29,.064],leather);
 for(const x of [-.49,.49]){rod(chair,[x,.67,-.45],[x,1.94,-.57],.036,.028,deepWood);rod(chair,[x,.68,.32],[x*1.23,.025,.48],.033,.044,deepWood);rod(chair,[x,.67,-.44],[x*1.16,.025,-.62],.033,.044,deepWood);}
 rod(chair,[-.49,1.94,-.57],[.49,1.94,-.57],.038,.038,wood);
 for(const x of [-.5,.5]){rod(chair,[x,.82,.22],[x,1.13,.19],.024,.024,brass);rod(chair,[x,1.13,.31],[x,1.17,-.35],.038,.038,wood);}
 const body=new THREE.Group();body.name='tailored-seated-body';group.add(body);body.rotation.y=seat===0?-.32:seat===3?.32:0;
 const colors=[0x354952,0x53665d,0x6d5947,0x5c515f];
 const jacket=mat(new THREE.MeshStandardMaterial({color:colors[seat],roughness:.92,metalness:0}));
 const pants=mat(new THREE.MeshStandardMaterial({color:0x34393a,roughness:.98}));
 const shirt=mat(new THREE.MeshStandardMaterial({color:0xb9b8a9,roughness:1}));
 const skin=mat(new THREE.MeshStandardMaterial({color:[0xcba98b,0xb58f73,0xc6aa8c,0xb89c84][seat],roughness:.93}));
 const shoes=mat(new THREE.MeshStandardMaterial({color:0x3a302a,roughness:.8}));
 const torsoShape=[new THREE.Vector2(.28,0),new THREE.Vector2(.33,.1),new THREE.Vector2(.36,.45),new THREE.Vector2(.43,.7),new THREE.Vector2(.37,.8),new THREE.Vector2(.16,.9)];
 const torso=mesh(geo(new THREE.LatheGeometry(torsoShape,24)),jacket,body);torso.position.set(0,.99,.045);torso.scale.z=.67;
 const lapelGeometry=points=>{const s=new THREE.Shape();points.forEach((p,i)=>i?s.lineTo(...p):s.moveTo(...p));s.closePath();return geo(new THREE.ShapeGeometry(s));};
 const chest=mesh(lapelGeometry([[-.14,0],[.14,0],[.11,-.42],[-.1,-.42]]),shirt,body);chest.position.set(0,1.85,.17);chest.rotation.x=-.22;
 for(const sign of [-1,1]){const lapel=mesh(lapelGeometry([[0,0],[sign*.24,-.15],[sign*.15,-.4],[sign*.045,-.16]]),jacket,body);lapel.position.set(sign*.1,1.91,.17);lapel.rotation.x=-.3;}
 for(let i=0;i<3;i++){const button=mesh(geo(new THREE.SphereGeometry(.018,6,4)),brass,body);button.scale.z=.3;button.position.set(.05,1.36+i*.115,.279);}
 const pocket=mesh(geo(new THREE.PlaneGeometry(.135,.13)),jacket,body);pocket.position.set(.22,1.63,.278);rod(body,[.15,1.7,.283],[.29,1.7,.283],.005,.005,shirt);
 ellipsoid(body,[0,.96,.08],[.33,.17,.28],pants);
 for(const side of [-1,1]){
  ellipsoid(body,[side*.395,1.7,.045],[.19,.205,.19],jacket);
  rod(body,[side*.4,1.69,.06],[side*.56,1.32,.48],.16,.12,jacket);
  rod(body,[side*.56,1.32,.48],[side*.36,1.23,1.02],.12,.085,jacket);
  rod(body,[side*.38,1.24,.93],[side*.35,1.21,1.035],.089,.087,shirt);
  const palm=ellipsoid(body,[side*.33,1.175,1.10],[.105,.055,.14],skin);palm.name='hand-'+side;
  for(let j=0;j<3;j++)rod(body,[side*.29+j*.018,1.17,1.19],[side*.29+j*.018,1.145,1.24],.011,.009,skin);
  rod(body,[side*.17,.96,.04],[side*.27,.64,.67],.17,.14,pants);
  rod(body,[side*.27,.64,.67],[side*.29,.18,.64],.14,.105,pants);
  ellipsoid(body,[side*.29,.105,.79],[.133,.08,.25],shoes);
 }
 rod(body,[0,1.86,.07],[0,2.08,.09],.12,.12,skin);
 const head=new THREE.Group();head.name='head-with-avatar';head.position.set(0,2.33,.1);body.add(head);
 ellipsoid(head,[0,0,0],[.285,.325,.265],skin);
 // Heads turn toward the conversation, rather than billboard the entire skull.
 const desiredWorldYaw=[.72,.26,-.26,-.72][seat];
 const groupYaw=[3*Math.PI/4,Math.PI/4,7*Math.PI/4,5*Math.PI/4][seat];
 head.rotation.y=desiredWorldYaw-groupYaw-body.rotation.y;head.rotation.x=-.13;
 const faceMat=mat(new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,side:THREE.DoubleSide}));
 const face=mesh(geo(new THREE.CircleGeometry(.266,40)),faceMat,head);face.name='player-avatar-texture';face.position.z=.269;face.scale.y=1.08;face.userData.avatar=true;face.castShadow=false;face.receiveShadow=false;
 const ring=mesh(geo(new THREE.TorusGeometry(.272,.007,5,40)),steel,head);ring.position.z=.267;ring.scale.y=1.08;ring.castShadow=false;
 return {seat,group,chair,body,head,face,ring,avatarSignature:null,avatarVersion:0,texture:null};
}
