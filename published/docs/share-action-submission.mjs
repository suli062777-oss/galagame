import {readFile,writeFile} from 'node:fs/promises';
const url=new URL('../public/app.js',import.meta.url);let app=await readFile(url,'utf8');
const helper=`async function submitRoomAction(action){
 if(submitting||!currentState||!action)return false;
 const round=currentState.round,key=roomActionKey(currentState);submitting=true;submissionError='';submissionUncertain=false;unconfirmedAction={key,action:structuredClone(action)};if($('#action-error'))$('#action-error').textContent='';updateReceipt();
 try{await act('action',{round,action,requestId:uid()});if(roomActionKey(currentState)===key){const accepted=currentState.me?.action||action;draftState={key,action:structuredClone(accepted),dirty:false};submissionUncertain=false;unconfirmedAction=null;applyActionToInputs(accepted);roomUi.actionOpen=false;setRoomSheets();}toast('服务端已接收，截止前仍可更新。');return true;}
 catch(error){submissionError=error.message;submissionUncertain=!error.confirmedRejected;if($('#action-error'))$('#action-error').textContent=submissionUncertain?'连接中断，提交结果尚未确认。恢复连接后会自动核对。':error.message;return false;}
 finally{submitting=false;updateReceipt();}
}
`;
app=app.replace('function closeRoomSheets(){',helper+'function closeRoomSheets(){');
const start=app.indexOf("case 'accept-suggestion':"),end=app.indexOf("case 'agent':",start);if(start<0||end<0)throw Error('Suggestion boundary missing');app=app.slice(0,start)+"case 'accept-suggestion':{const a=currentState.me.suggestion?.action||currentState.me.suggestion;if(a)await submitRoomAction(a);break;}\n "+app.slice(end);
const submit=app.indexOf("if(form.id==='action-form'){"),profile=app.indexOf("if(form.id==='profile-form')",submit);if(submit<0||profile<0)throw Error('Submit boundary missing');app=app.slice(0,submit)+"if(form.id==='action-form'){await submitRoomAction(selectedAction());}\n "+app.slice(profile);
await writeFile(url,app,'utf8');
