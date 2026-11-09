// Equal-area longitude partition. phi -> phi + f(y) has Jacobian 1.
export const NEUTRAL_BASE = 600;
export const PLAYER_COLORS = ['#e04748', '#dbb367', '#55c3ae', '#799ce9'];
export function territoryShares(players) {
  const scores = Array.from({length:4},(_,i)=>players[i]?.bankrupt ? 0 : Math.max(0,Number(players[i]?.score)||0));
  const denominator = NEUTRAL_BASE + scores.reduce((a,b)=>a+b,0);
  return [...scores.map(x=>x/denominator),NEUTRAL_BASE/denominator];
}
export function warpedLongitude(x,y,z) {
  const a=Math.atan2(z,x)/(2*Math.PI)+.5+.14*Math.sin(y*3.1)+.065*Math.sin(y*7.3);
  return a-Math.floor(a);
}
export function territoryOwner(x,y,z,shares) {
  const t=warpedLongitude(x,y,z); let edge=0;
  for(let i=0;i<4;i++){edge+=shares[i];if(t<edge)return i;}
  return 4;
}
export function fibonacciPoint(i,n) { const y=1-2*(i+.5)/n,r=Math.sqrt(1-y*y),phi=i*2.399963229728653;return [r*Math.cos(phi),y,r*Math.sin(phi)]; }
