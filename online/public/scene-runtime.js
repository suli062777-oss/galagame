import * as THREE from './assets/vendor/three.module.min.js';

// No timer runs while a scene is idle. A burst of input coalesces into one frame.
export function createRenderScheduler({requestFrame,cancelFrame,onFrame,isVisible=()=>true}){
 let pending=0,requested=false,continuous=false,suspended=false,destroyed=false;
 function schedule(){if(!destroyed&&!suspended&&isVisible()&&!pending&&(requested||continuous))pending=requestFrame(frame);}
 function frame(time){pending=0;if(destroyed||suspended||!isVisible())return;requested=false;onFrame(time);schedule();}
 return {
  request(){requested=true;schedule();},
  setContinuous(value){continuous=Boolean(value);if(!continuous&&!requested&&pending){cancelFrame(pending);pending=0;}schedule();},
  suspend(value){suspended=Boolean(value);if(suspended&&pending){cancelFrame(pending);pending=0;}else schedule();},
  getState(){return {pending:Boolean(pending),requested,continuous,suspended,destroyed};},
  destroy(){destroyed=true;if(pending)cancelFrame(pending);pending=0;requested=continuous=false;}
 };
}

export function resolveSceneQuality(mode='auto',device={}){
 const requested=['auto','high','low'].includes(mode)?mode:'auto';
 let reason='desktop',effective='high';
 if(requested!=='auto'){effective=requested;reason='selected';}
 else if((device.width>0&&device.width<=680)||device.coarse){effective='low';reason='mobile';}
 else if((device.cores>0&&device.cores<=4)||(device.memory>0&&device.memory<=4)){effective='low';reason='hardware';}
 return {requested,effective,reason,pixelRatio:Math.min(device.dpr||1,effective==='low'?1:1.5),shadows:effective==='high',markerBudget:effective==='low'?72:120};
}

// Bake static scenery into material batches once, keeping genuine geometry,
// normals, UVs and lighting. Interactive heads/bodies are never passed here.
export function batchStaticMeshes(root,ownGeometry){
 root.updateWorldMatrix(true,true);
 const inverse=root.matrixWorld.clone().invert(),groups=new Map();
 root.traverse(node=>{
  if(!node.isMesh||node.isInstancedMesh||Array.isArray(node.material)||!node.visible)return;
  let parent=node.parent;while(parent&&parent!==root){if(parent.userData.optionalDetail)return;parent=parent.parent;}
  const key=[node.material.uuid,node.castShadow,node.receiveShadow,node.renderOrder].join(':');
  if(!groups.has(key))groups.set(key,[]);groups.get(key).push(node);
 });
 let sourceMeshes=0,batches=0;
 for(const nodes of groups.values()){
  if(nodes.length<2)continue;
  const positions=[],normals=[],uvs=[];
  for(const node of nodes){
   const copy=node.geometry.index?node.geometry.toNonIndexed():node.geometry.clone();
   copy.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,node.matrixWorld));
   positions.push(copy.attributes.position.array);normals.push(copy.attributes.normal.array);
   uvs.push(copy.attributes.uv?.array||new Float32Array(copy.attributes.position.count*2));copy.dispose();
  }
  const join=arrays=>{const result=new Float32Array(arrays.reduce((n,a)=>n+a.length,0));let offset=0;for(const array of arrays){result.set(array,offset);offset+=array.length;}return result;};
  const geometry=ownGeometry(new THREE.BufferGeometry());
  geometry.setAttribute('position',new THREE.BufferAttribute(join(positions),3));
  geometry.setAttribute('normal',new THREE.BufferAttribute(join(normals),3));
  geometry.setAttribute('uv',new THREE.BufferAttribute(join(uvs),2));geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const first=nodes[0],batch=new THREE.Mesh(geometry,first.material);batch.name='static-material-batch';batch.castShadow=first.castShadow;batch.receiveShadow=first.receiveShadow;batch.renderOrder=first.renderOrder;root.add(batch);
  for(const node of nodes)node.removeFromParent();sourceMeshes+=nodes.length;batches++;
 }
 return {sourceMeshes,batches,drawsSaved:sourceMeshes-batches};
}
