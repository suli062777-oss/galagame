import fs from 'node:fs';
const path=new URL('../public/app.js',import.meta.url);
let app=fs.readFileSync(path,'utf8');
const before="\n updateReceipt();if($('#default-description'))";
if(!app.includes(before))throw Error('updateGame initial receipt source changed');
app=app.replace(before,"\n updateActionEstimate();updateReceipt();if($('#default-description'))");
fs.writeFileSync(path,app);
console.log('Initialize/recalculate the current selection budget before the room receipt update.');
