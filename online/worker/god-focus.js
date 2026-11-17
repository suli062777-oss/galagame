/** Pick a teaching topic using public evidence only. This never changes a game. */
export function narrationFocus({phase,round,claims,productId}){
 if(phase==='finished'){
  const players=claims.filter(c=>c.id.startsWith('P')&&!c.bankrupt).sort((a,b)=>(a.metrics.rank||99)-(b.metrics.rank||99)||b.metrics.score-a.metrics.score);
  return {reason:'final-public-result',claimIds:[players[0]?.id||'C0'],knowledgeIds:['K12']};
 }
 const currentWorld=claims.filter(c=>c.id.startsWith('W')&&c.round===round);
 const world=currentWorld.filter(c=>c.eventId&&['fact','verification'].includes(c.type)).at(-1)||currentWorld.find(c=>c.type==='forecast')||(currentWorld.length===1?currentWorld[0]:null);
 if(world)return {reason:'latest-published-world-message',claimIds:[world.id],knowledgeIds:[world.type==='rumor'||world.type==='forecast'?'K13':world.eventId?'K-'+world.eventId:'K13']};
 const settled=claims.filter(c=>c.id.startsWith('L'));
 if(settled.length){const claim=settled[Math.max(0,round-2)%settled.length];return {reason:'rotate-through-settled-seats',claimIds:[claim.id],knowledgeIds:[claim.actionId?'K-'+claim.actionId:'K12']};}
 return {reason:'opening-product-goal',claimIds:['C0'],knowledgeIds:[productId?'K-'+productId:'K02']};
}

/** Only relevant public evidence is sent to the model. Provenance remains in the
 * full server input and in the displayed citation records, not in token overhead. */
export function modelNarrationInput(input){
 const focus=input.focus;
 const claims=focus?input.claims.filter(c=>focus.claimIds.includes(c.id)):input.claims;
 let cards=focus?input.knowledge.filter(k=>focus.knowledgeIds.includes(k.id)):input.knowledge;
 if(!cards.length)cards=input.knowledge.filter(k=>k.id==='K13').slice(0,1);
 if(!cards.length)cards=input.knowledge.slice(0,1);
 return {version:input.version,promptVersion:input.promptVersion,narrationContract:input.narrationContract,phase:input.phase,round:input.round,product:input.product,focus:focus?.reason||'public-evidence',claims:claims.map(({id,type,text,seat,metrics,actionId,eventId,targetSeats})=>({id,type,text,seat,metrics,actionId,eventId,...(targetSeats?{targetSeats}:{})})),knowledge:cards.map(({id,title,text,mechanicsText})=>({id,title,text:mechanicsText||text}))};
}
