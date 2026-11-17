// Versioned own-seat snapshots. No token or private content enters the tag.
export function roomEtag(room,playerId,now){
 const presence=room.players.map(p=>p.agentConnected&&now-(p.agentLastSeen||0)<60000?'1':'0').join('');
 return `"${room.id}:${Math.max(0,Math.floor(Number(room.version)||0))}:${playerId}:${presence}"`;
}
export function phaseIsDue(room,now){return room.game.ruleVersion&&['preparing','decision','settling'].includes(room.phase)&&Number.isFinite(room.deadline)&&now>=room.deadline;}
// If-None-Match uses weak comparison (RFC 9110 §13.1.2). Hosting proxies
// can weaken our emitted tag; commas inside a quoted opaque tag are data.
export function etagMatches(header,current){
 if(typeof header!=='string'||typeof current!=='string')return false;
 const value=header.trim(),expected=current.replace(/^W\//,'');
 if(value==='*')return true;
 let cursor=0,found=false,matched=false;
 const member=/[\t ]*(?:W\/)?("[\x21\x23-\x7e\x80-\xff]*")[\t ]*(?:,|$)/y;
 while(cursor<value.length){
  const empty=/^[\t ]*,/.exec(value.slice(cursor));
  if(empty){cursor+=empty[0].length;continue;}
  member.lastIndex=cursor;const match=member.exec(value);
  if(!match)return false;
  found=true;matched=matched||match[1]===expected;cursor=member.lastIndex;
 }
 return found&&matched;
}
