import fs from 'node:fs';
const path=new URL('../public/app.js',import.meta.url);let source=fs.readFileSync(path,'utf8');
for(const [before,after] of [
 ['function hostKnowledgeMarkup(refs){',"function hostKnowledgeMarkup(refs,messageId='latest'){"],
 ['data-knowledge="${esc(ref.id||index)}"','data-knowledge="${esc(messageId+\':\'+(ref.id||index))}"'],
 ['hostKnowledgeMarkup(god.knowledgeRefs)','hostKnowledgeMarkup(god.knowledgeRefs,god.id||[god.round,god.generatedAt,god.provider,index].join(\':\'))']
]){if(!source.includes(before))throw Error(before);source=source.replace(before,after);}
fs.writeFileSync(path,source);console.log('History knowledge expansion keys now combine stable host message ID and knowledge ID.');
