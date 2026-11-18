/** Independent regression for historical public reference projection. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {knowledgeReferences,publicHostMessage,publicHostHistory} from '../worker/host-messages.js';

test('Historical reference keeps its stored version and wording after directory changes',()=>{
 const snapshot={id:'K-E12',title:'先前公开标题',chapter:'event',section:'已发布机制',summary:'先前版本的公开机制摘要。',source:'历史规则来源',sourceType:'game-rule',version:'historical-1.0'};
 const message={id:'ROOM:2:1',round:2,provider:'deepseek',text:'先前已发布的主持内容。',knowledgeIds:['K-E12'],knowledgeRefs:[snapshot]};
 const before=structuredClone(message),projected=publicHostHistory({game:{round:3},godHistory:[message]})[0];
 assert.notEqual(knowledgeReferences(['K-E12'])[0].version,snapshot.version);
 assert.deepEqual(projected.knowledgeRefs,[snapshot]);assert.deepEqual(message,before);
});
test('A forged stored snapshot never makes private E15 or unknown IDs public',()=>{
 const output=publicHostMessage({knowledgeIds:['K-E15','UNKNOWN'],knowledgeRefs:[{id:'K-E15',summary:'PRIVATE_SENTINEL'},{id:'UNKNOWN',summary:'UNKNOWN_SENTINEL'}]});
 assert.deepEqual(output.knowledgeIds,[]);assert.deepEqual(output.knowledgeRefs,[]);assert.doesNotMatch(JSON.stringify(output),/PRIVATE_SENTINEL|UNKNOWN_SENTINEL/);
});
test('Legacy messages without snapshots still resolve valid current public references',()=>{
 const output=publicHostMessage({text:'旧版主持内容。',knowledgeIds:['K01']});
 assert.deepEqual(output.knowledgeRefs,knowledgeReferences(['K01']));assert.deepEqual(output.knowledgeIds,['K01']);assert.ok(output.knowledgeRefs[0].source);
});
