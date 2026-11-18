import test from 'node:test';
import assert from 'node:assert/strict';
import {createRenderScheduler,resolveSceneQuality} from '../public/scene-runtime.js';

function clock(){let sequence=0,time=0;const queue=new Map(),frames=[];const scheduler=createRenderScheduler({requestFrame:fn=>{queue.set(++sequence,fn);return sequence;},cancelFrame:id=>queue.delete(id),onFrame:t=>frames.push(t)});return {scheduler,queue,frames,tick(){const batch=[...queue.values()];queue.clear();time+=16;for(const fn of batch)fn(time);}};}

test('idle scenes schedule nothing; repeated invalidation coalesces and stops after one frame',()=>{
 const c=clock();assert.equal(c.queue.size,0);
 for(let i=0;i<50;i++)c.scheduler.request();assert.equal(c.queue.size,1);
 c.tick();assert.equal(c.frames.length,1);assert.equal(c.queue.size,0);
 for(let i=0;i<100;i++)c.tick();assert.equal(c.frames.length,1);
});

test('continuous rotation stops while suspended and resumes without losing a pending update',()=>{
 const c=clock();c.scheduler.setContinuous(true);c.tick();c.tick();assert.equal(c.frames.length,2);
 c.scheduler.suspend(true);assert.equal(c.queue.size,0);c.scheduler.request();c.tick();assert.equal(c.frames.length,2);
 c.scheduler.suspend(false);c.tick();assert.equal(c.frames.length,3);
 c.scheduler.setContinuous(false);assert.equal(c.queue.size,0);
 c.scheduler.request();c.scheduler.destroy();assert.equal(c.queue.size,0);c.scheduler.request();assert.equal(c.queue.size,0);
});

test('automatic quality conservatively selects mobile and weak hardware without inventing a frame-rate measurement',()=>{
 assert.equal(resolveSceneQuality('auto',{width:390,dpr:3,cores:12}).effective,'low');
 assert.equal(resolveSceneQuality('auto',{width:1400,cores:4}).reason,'hardware');
 assert.equal(resolveSceneQuality('auto',{width:1400,memory:4}).effective,'low');
 assert.equal(resolveSceneQuality('auto',{width:1400,cores:8,memory:8}).effective,'high');
 const chosen=resolveSceneQuality('high',{width:390,dpr:3,cores:2});assert.equal(chosen.requested,'high');assert.equal(chosen.shadows,true);assert.equal(chosen.pixelRatio,1.5);
 const low=resolveSceneQuality('low',{width:1400,dpr:2});assert.equal(low.pixelRatio,1);assert.equal(low.shadows,false);assert.ok(low.markerBudget<chosen.markerBudget);
});
