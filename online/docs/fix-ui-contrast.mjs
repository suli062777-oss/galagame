import {readFile,writeFile} from 'node:fs/promises';
const u=new URL('../public/tavern-v3.css',import.meta.url);let css=await readFile(u,'utf8');css=css.replace('color:#fff7ed','color:#26170e');
for(const value of ['#867d6b','#867d6c','#7f755f','#726b5a','#83745b','#837155','#887d66','#8c826e','#8f877a','#79715f','#8c7f69','#8f846e','#85775d','#8f8167','#887e6d','#8b8375'])css=css.replaceAll(value,'#9b907a');
await writeFile(u,css,'utf8');
