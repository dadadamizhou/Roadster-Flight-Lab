import assert from 'node:assert/strict';
import {MAPS,height} from '../public/game/physics.js';
import {makeWorld,disposeWorld,pose,trackUp} from '../public/game/world.js';
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({font:'',textAlign:'',fillStyle:'',fillText(){}})})};
for(const map of Object.values(MAPS)){
 const world=makeWorld(map);assert.equal(world.chunkCount,3);
 const ringId=world.ringData[0].id,obstacleId=world.obstacles[0].id;assert(world.collectRing(ringId));assert(!world.collectRing(ringId));assert(world.passObstacle(obstacleId));
 let disposed=0;world.root.traverse(o=>{o.geometry?.addEventListener('dispose',()=>disposed++);});
 for(const s of [640,1280,1920,6400,9600,12800]){world.update(s);assert.equal(world.chunkCount,4);assert.equal(world.root.children.length,4);assert.equal(world.ringData.length,world.ringMeshes.length);assert.equal(new Set(world.ringData.map(r=>r.id)).size,world.ringData.length);assert(world.ringData.every(r=>r.s>=Math.floor(s/640)*640-640));}
 world.update(0);assert(world.ringData.find(r=>r.id===ringId).collected);assert(!world.ringMeshes[world.ringData.findIndex(r=>r.id===ringId)].visible);assert(world.obstacles.find(o=>o.id===obstacleId).passed);assert(!world.passObstacle(obstacleId),'backtracking cannot re-award a passed obstacle');
 assert(disposed>0,'old GPU resources are disposed');
 const wall=pose(880,0,1,map),base=pose(880,0,0,map);assert(Math.abs(wall.y-base.y)<.001,'wall normal is horizontal');assert(trackUp(1700,map).y<-.99,'ceiling normal points down');assert(pose(1700,0,1,map).y<height(1700,map));
 disposeWorld(world.root);
}
console.log('All three worlds stream at most four chunks; disposed resources and banked geometry verified.');
