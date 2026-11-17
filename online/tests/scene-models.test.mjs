import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/assets/vendor/three.module.min.js';
import {buildFurniture,buildSeatedPerson} from '../public/tavern-models.js';
import {buildTavernEnvironment} from '../public/tavern-environment.js';
import {batchStaticMeshes} from '../public/scene-runtime.js';

// Geometry-level checks do not replace browser screenshots or WebGL testing.
// Only canvas painting is stubbed: every mesh, transform and bounding box is real Three.
function fixture(){
 const prior=globalThis.document;
 const context=new Proxy({createLinearGradient:()=>({addColorStop(){}})}, {get(target,key){return key in target?target[key]:()=>{};},set(target,key,value){target[key]=value;return true;}});
 globalThis.document={createElement:()=>({width:512,height:512,getContext:()=>context})};
 const scene=new THREE.Scene(),geometries=[],materials=[],textures=new Set();
 const geo=g=>(geometries.push(g),g),mat=m=>(materials.push(m),m);
 const sphere=geo(new THREE.SphereGeometry(1,16,12));
 function mesh(g,m,parent=scene){const node=new THREE.Mesh(g,m);parent.add(node);return node;}
 function ellipsoid(parent,p,s,m){const node=mesh(sphere,m,parent);node.position.set(...p);node.scale.set(...s);return node;}
 function rod(parent,a,b,ra,rb,m){const first=new THREE.Vector3(...a),last=new THREE.Vector3(...b);const node=mesh(geo(new THREE.CylinderGeometry(rb,ra,first.distanceTo(last),12)),m,parent);node.position.copy(first).lerp(last,.5);node.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),last.sub(first).normalize());return node;}
 const kit={scene,mesh,geo,mat,ellipsoid,rod,textures,low:false};
 const furniture=buildFurniture(kit);
 const people=Array.from({length:4},(_,seat)=>{const person=buildSeatedPerson(seat,kit,furniture);const angle=[-Math.PI/4,-3*Math.PI/4,3*Math.PI/4,Math.PI/4][seat];person.group.position.set(Math.sin(angle)*3.68,0,Math.cos(angle)*3.68);person.group.rotation.y=angle+Math.PI;return person;});
 const environment=buildTavernEnvironment(kit,furniture);
 scene.updateMatrixWorld(true);
 return {scene,furniture,people,environment,dispose(){for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();globalThis.document=prior;}};
}

test('four real seated bodies have correctly attached heads and visible face planes',()=>{
 const f=fixture();try{
  const camera=new THREE.Vector3(0,7.8,13.5);
  for(const p of f.people){
   assert.equal(p.head.parent,p.body);assert.equal(p.face.parent,p.head);assert.deepEqual(p.head.scale.toArray(),[1,1,1]);
   const normal=new THREE.Vector3(0,0,1).transformDirection(p.head.matrixWorld);
   const towardCamera=camera.clone().sub(p.head.getWorldPosition(new THREE.Vector3())).normalize();
   assert.ok(normal.dot(towardCamera)>.35,`seat ${p.seat} face is turned away`);
  }
 }finally{f.dispose();}
});

test('all palms meet the tabletop instead of sinking inside its slab',()=>{
 const f=fixture();try{
  for(const p of f.people)for(const side of [-1,1]){
   const palm=p.body.getObjectByName('hand-'+side);const bounds=new THREE.Box3().setFromObject(palm);
   assert.ok(bounds.min.y>=f.furniture.tableHeight-1e-5,`seat ${p.seat} hand penetrates table`);
   assert.ok(bounds.min.y-f.furniture.tableHeight<.02,'hand floats above table');
  }
 }finally{f.dispose();}
});

test('tavern furniture and atmospheric props contain finite geometry without external assets',()=>{
 const f=fixture();try{
  for(const name of ['back-bar','brass-balance','tavern-sign','fern'])assert.ok(f.scene.getObjectByName(name),name+' missing');
  let triangles=0,meshes=0;
  f.scene.traverse(node=>{if(node.isMesh){meshes++;for(const value of node.geometry.attributes.position.array)assert.ok(Number.isFinite(value));const count=node.geometry.index?.count||node.geometry.attributes.position.count;triangles+=count/3;}});
  assert.ok(meshes>4,'scene was flattened into a picture');
  assert.ok(triangles<250000,'procedural room geometry exceeded its triangle budget');
 }finally{f.dispose();}
});

test('static material batches preserve actual world bounds and triangles while reducing submitted meshes',t=>{
 const f=fixture(),owned=[];try{
  const roots=[f.environment.environment,f.furniture.table,...f.people.map(p=>p.chair),...f.environment.detailObjects];
  const count=()=>{let meshes=0,triangles=0;f.scene.traverse(n=>{if(n.isMesh){meshes++;triangles+=(n.geometry.index?.count||n.geometry.attributes.position.count)/3*(n.isInstancedMesh?n.count:1);}});return {meshes,triangles};};
  const before=count(),bounds=roots.map(root=>new THREE.Box3().setFromObject(root,true));
  const result=roots.map(root=>batchStaticMeshes(root,g=>(owned.push(g),g)));f.scene.updateMatrixWorld(true);
  const after=count();
  roots.forEach((root,i)=>{const current=new THREE.Box3().setFromObject(root,true);assert.ok(current.min.distanceTo(bounds[i].min)<1e-5,'batch moved its minimum world bound');assert.ok(current.max.distanceTo(bounds[i].max)<1e-5,'batch moved its maximum world bound');});
  assert.equal(after.triangles,before.triangles,'batch changed visible geometric detail');
  assert.ok(after.meshes<before.meshes*.75,`mesh count did not materially decrease: ${before.meshes} to ${after.meshes}`);
  assert.equal(result.reduce((n,r)=>n+r.drawsSaved,0),before.meshes-after.meshes);
  t.diagnostic(JSON.stringify({scope:'CPU geometry fixture, not GPU timing',before,after,batches:result}));
  // Every interactive head and all real hands remain independently attached.
  for(const p of f.people){assert.equal(p.face.parent,p.head);assert.ok(p.body.getObjectByName('hand--1'));assert.ok(p.body.getObjectByName('hand-1'));}
 }finally{for(const geometry of owned)geometry.dispose();f.dispose();}
});
