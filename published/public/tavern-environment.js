import * as THREE from './assets/vendor/three.module.min.js';
import {woodTexture} from './tavern-models.js';

export function buildTavernEnvironment(kit,furniture){
 const {scene,mesh,geo,mat,rod,textures,low}=kit;
 const {wood,deepWood,brass,steel,paper}=furniture.materials;
 const environment=new THREE.Group();environment.name='warm-tavern-interior';scene.add(environment);const detailObjects=[];
 const plaster=mat(new THREE.MeshStandardMaterial({color:0x45413a,roughness:1}));
 const floorMaterial=mat(new THREE.MeshStandardMaterial({color:0x8d735b,map:woodTexture(textures,{dark:true}),roughness:.96,metalness:0}));
 const rugMaterial=mat(new THREE.MeshStandardMaterial({color:0x363d3a,roughness:1}));
 const floor=mesh(geo(new THREE.PlaneGeometry(26,22)),floorMaterial,environment);floor.rotation.x=-Math.PI/2;floor.position.y=-.035;
 const rug=mesh(geo(new THREE.CircleGeometry(5.15,96)),rugMaterial,environment);rug.rotation.x=-Math.PI/2;rug.position.y=-.019;
 const rugTrim=mesh(geo(new THREE.TorusGeometry(4.96,.015,4,96)),mat(new THREE.MeshStandardMaterial({color:0x8a7660,roughness:1})),environment);rugTrim.rotation.x=Math.PI/2;rugTrim.position.y=-.01;
 const rear=mesh(geo(new THREE.BoxGeometry(19,6,.18)),plaster,environment);rear.position.set(0,2.95,-6.6);
 for(const x of [-7,-3.3,3.3,7]){const pillar=mesh(geo(new THREE.BoxGeometry(.18,5.7,.25)),deepWood,environment);pillar.position.set(x,2.8,-6.4);}
 for(const y of [.45,4.8,5.7]){const beam=mesh(geo(new THREE.BoxGeometry(19,.18,.3)),deepWood,environment);beam.position.set(0,y,-6.35);}
 for(const x of [-8.5,8.5]){const side=mesh(geo(new THREE.BoxGeometry(.2,5.8,9)),plaster,environment);side.position.set(x,2.85,-2.4);}

 // Repeated bar joinery is instanced so the room stays inexpensive on mobile.
 const counter=new THREE.Group();counter.name='back-bar';counter.position.set(0,0,-5.3);environment.add(counter);
 const counterBase=mesh(geo(new THREE.BoxGeometry(8.8,1.22,.95)),deepWood,counter);counterBase.position.y=.66;
 const counterTop=mesh(geo(new THREE.BoxGeometry(9.1,.11,1.16)),wood,counter);counterTop.position.y=1.33;
 const panelGeo=geo(new THREE.BoxGeometry(1.3,.75,.03));const panels=new THREE.InstancedMesh(panelGeo,wood,6);const m=new THREE.Matrix4();for(let i=0;i<6;i++){m.makeTranslation(-3.65+i*1.46,.68,.494);panels.setMatrixAt(i,m);}counter.add(panels);
 const rail=rod(counter,[-4.25,.25,.72],[4.25,.25,.72],.025,.025,brass);rail.name='brass-foot-rail';
 for(const x of [-3.6,0,3.6])rod(counter,[x,.15,.48],[x,.25,.72],.018,.018,brass);

 const bottleColors=[0x365447,0x67543a,0x2d454b,0x76604a,0x4f5e43];
 const bottleGeo=geo(new THREE.CylinderGeometry(.07,.084,.34,10));const neckGeo=geo(new THREE.CylinderGeometry(.028,.033,.15,8));
 const bottleMats=bottleColors.map(color=>mat(new THREE.MeshStandardMaterial({color,roughness:.35,metalness:.05})));
 let bottleCount=0;
 for(const side of [-1,1]){
  for(const shelfY of [1.65,2.15]){
   const board=mesh(geo(new THREE.BoxGeometry(1.75,.075,.42)),wood,environment);board.position.set(side*2.5,shelfY,-6.06);
   for(const x of [-.65,.65]){const bracket=mesh(geo(new THREE.BoxGeometry(.045,.27,.25)),brass,environment);bracket.position.set(side*2.5+x,shelfY-.13,-6.13);}
   const count=low?4:6;
   for(let i=0;i<count;i++){const x=side*2.5+(i-(count-1)/2)*.25;const bottle=mesh(bottleGeo,bottleMats[(i+(side===1?2:0))%5],environment);bottle.position.set(x,shelfY+.205,-6.02);bottle.castShadow=false;const neck=mesh(neckGeo,bottle.material,environment);neck.position.set(x,shelfY+.445,-6.02);neck.castShadow=false;bottleCount++;}
  }
 }

 // Two shallow arched windows give a cool counterpoint to warm lamps.
 const windowCanvas=document.createElement('canvas');windowCanvas.width=256;windowCanvas.height=384;const wc=windowCanvas.getContext('2d');const night=wc.createLinearGradient(0,0,0,384);night.addColorStop(0,'#213b48');night.addColorStop(1,'#658186');wc.fillStyle=night;wc.fillRect(0,0,256,384);wc.fillStyle='rgba(224,225,209,.62)';wc.beginPath();wc.arc(173,81,24,0,Math.PI*2);wc.fill();wc.fillStyle='rgba(24,45,45,.50)';for(let i=0;i<7;i++){const x=i*49-12,h=85+(i%3)*24;wc.beginPath();wc.moveTo(x,384);wc.lineTo(x+23,384-h);wc.lineTo(x+46,384);wc.fill();}
 const windowTexture=new THREE.CanvasTexture(windowCanvas);windowTexture.colorSpace=THREE.SRGBColorSpace;textures.add(windowTexture);const glass=mat(new THREE.MeshBasicMaterial({map:windowTexture,color:0xa1b4b9}));
 const windowShape=new THREE.Shape();windowShape.moveTo(-.68,0);windowShape.lineTo(.68,0);windowShape.lineTo(.68,1.08);windowShape.absarc(0,1.08,.68,0,Math.PI,false);windowShape.lineTo(-.68,0);
 const windowGeo=geo(new THREE.ShapeGeometry(windowShape)),positions=windowGeo.attributes.position,uv=windowGeo.attributes.uv;for(let i=0;i<positions.count;i++)uv.setXY(i,(positions.getX(i)+.68)/1.36,positions.getY(i)/1.76);uv.needsUpdate=true;
 for(const x of [-3.85,3.85]){
  const window=mesh(windowGeo,glass,environment);window.position.set(x,1.2,-6.48);window.scale.set(.85,.85,1);window.castShadow=false;
  const points=[[-.73,0],[-.73,1.08]];for(let i=0;i<=20;i++){const a=Math.PI-i/20*Math.PI;points.push([Math.cos(a)*.73,1.08+Math.sin(a)*.73]);}points.push([.73,0]);
  for(let i=1;i<points.length;i++)rod(environment,[x+points[i-1][0]*.85,1.2+points[i-1][1]*.85,-6.4],[x+points[i][0]*.85,1.2+points[i][1]*.85,-6.4],.028,.028,deepWood);
  rod(environment,[x,1.22,-6.38],[x,2.68,-6.38],.018,.018,brass);rod(environment,[x-.56,1.97,-6.38],[x+.56,1.97,-6.38],.018,.018,brass);
 }

 const lampshade=mat(new THREE.MeshStandardMaterial({color:0xdbc79f,emissive:0xffcc83,emissiveIntensity:.58,roughness:.9,side:THREE.DoubleSide}));
 for(const x of [-1.55,1.55]){
  const mount=mesh(geo(new THREE.CylinderGeometry(.13,.13,.045,16)),brass,environment);mount.rotation.x=Math.PI/2;mount.position.set(x,2.9,-6.26);
  rod(environment,[x,2.9,-6.22],[x,2.81,-5.75],.025,.025,brass);
  const shade=mesh(geo(new THREE.CylinderGeometry(.17,.32,.28,24,1,true)),lampshade,environment);shade.position.set(x,2.75,-5.72);shade.castShadow=false;
  const light=new THREE.PointLight(0xffce90,low?2.6:4.2,7.5,2);light.position.set(x,2.57,-5.7);environment.add(light);
 }

 const signCanvas=document.createElement('canvas');signCanvas.width=768;signCanvas.height=256;const ctx=signCanvas.getContext('2d');ctx.fillStyle='#252d2a';ctx.fillRect(0,0,768,256);ctx.strokeStyle='#a48a58';ctx.lineWidth=4;ctx.strokeRect(15,15,738,226);ctx.textAlign='center';ctx.fillStyle='#c6ba9d';ctx.font='48px "Microsoft YaHei",sans-serif';ctx.fillText('增长酒馆',384,119);ctx.font='19px Georgia,serif';ctx.fillStyle='#8c9b8d';ctx.fillText('THE GROWTH TAVERN',384,172);
 const signTexture=new THREE.CanvasTexture(signCanvas);signTexture.colorSpace=THREE.SRGBColorSpace;textures.add(signTexture);
 const sign=mesh(geo(new THREE.PlaneGeometry(2.2,.74)),mat(new THREE.MeshStandardMaterial({map:signTexture,roughness:1})),environment);sign.name='tavern-sign';sign.position.set(0,2.1,-6.43);
 const frame=mesh(geo(new THREE.BoxGeometry(2.34,.88,.06)),deepWood,environment);frame.position.set(0,2.1,-6.49);

 // Brass balance on the bar: a quiet physical detail about trade-offs.
 const balance=new THREE.Group();balance.name='brass-balance';balance.position.set(2.4,1.4,-5.15);environment.add(balance);
 const base=mesh(geo(new THREE.CylinderGeometry(.22,.28,.045,20)),brass,balance);base.position.y=.025;
 rod(balance,[0,.04,0],[0,.81,0],.024,.018,brass);rod(balance,[-.43,.76,0],[.43,.76,0],.018,.018,brass);
 for(const side of [-1,1]){rod(balance,[side*.39,.76,0],[side*.39,.4,-.13],.005,.005,brass);rod(balance,[side*.39,.76,0],[side*.39,.4,.13],.005,.005,brass);const pan=mesh(geo(new THREE.CylinderGeometry(.15,.12,.025,20)),brass,balance);pan.position.set(side*.39,.385,0);}

 const leafMat=mat(new THREE.MeshStandardMaterial({color:0x4e6952,roughness:1,side:THREE.DoubleSide}));
 const potMat=mat(new THREE.MeshStandardMaterial({color:0x765847,roughness:.95}));
 for(const side of [-1,1]){
  const plant=new THREE.Group();plant.name='fern';plant.userData.optionalDetail=true;detailObjects.push(plant);plant.position.set(side*5.7,0,-3.15);environment.add(plant);
  const pot=mesh(geo(new THREE.CylinderGeometry(.31,.22,.45,16)),potMat,plant);pot.position.y=.225;
  for(let i=0;i<(low?6:10);i++){const a=i*2.399;const h=.85+(i%3)*.16;rod(plant,[0,.38,0],[Math.sin(a)*.42,h,Math.cos(a)*.42],.012,.004,leafMat);for(let j=1;j<=3;j++){const leaf=mesh(geo(new THREE.SphereGeometry(1,6,4)),leafMat,plant);leaf.scale.set(.055,.02,.2);leaf.position.set(Math.sin(a)*.12*j,.4+(h-.4)*j/3,Math.cos(a)*.12*j);leaf.rotation.set(.35,a,.3);leaf.castShadow=false;}}
 }
 for(const item of environment.children)if(item.position.z<-4)item.position.z+=1.25;
 return {environment,bottleCount,windowCount:2,lampCount:2,detailObjects,propNames:['walnut floor','woven rug','back bar','bottles','arched windows','wall sconces','brass balance','ferns']};
}
