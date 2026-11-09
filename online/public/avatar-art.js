import {PRESETS,AVATAR_SIZE,defaultAvatar,normalizeAvatar} from './avatar-contract.js';
const circle=(c,x,y,r,color)=>{c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();};
const rounded=(c,x,y,w,h,r,color)=>{c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();};
export function drawPresetAvatar(presetId,canvas=document.createElement('canvas')){
  const p=PRESETS.find(p=>p.id===presetId)||PRESETS[0];canvas.width=canvas.height=AVATAR_SIZE;
  const c=canvas.getContext('2d');c.clearRect(0,0,AVATAR_SIZE,AVATAR_SIZE);c.save();c.beginPath();c.arc(96,96,96,0,Math.PI*2);c.clip();
  const gradient=c.createLinearGradient(10,0,180,192);gradient.addColorStop(0,p.background);gradient.addColorStop(1,p.shirt);c.fillStyle=gradient;c.fillRect(0,0,192,192);
  circle(c,42,38,60,'#ffffff13');circle(c,174,170,90,'#00000013');
  // Shoulders, neck and an expressive face remain legible at small head sizes.
  c.fillStyle=p.shirt;c.beginPath();c.ellipse(96,190,72,59,0,0,Math.PI*2);c.fill();
  if(p.style==='robot'){
    rounded(c,81,128,30,27,7,p.hair);rounded(c,51,51,90,89,25,p.hair);rounded(c,57,59,78,70,20,p.skin);
    circle(c,48,93,9,p.hair);circle(c,144,93,9,p.hair);rounded(c,76,83,11,14,5,p.hair);rounded(c,105,83,11,14,5,p.hair);
    c.strokeStyle=p.hair;c.lineWidth=4;c.lineCap='round';c.beginPath();c.moveTo(82,113);c.lineTo(110,113);c.stroke();
    c.beginPath();c.moveTo(96,51);c.lineTo(96,37);c.stroke();circle(c,96,34,6,p.skin);circle(c,96,170,8,p.background);
  }else{
    rounded(c,82,119,28,34,10,p.skin);c.fillStyle=p.hair;c.beginPath();c.ellipse(96,83,45,52,0,0,Math.PI*2);c.fill();
    circle(c,57,95,9,p.skin);circle(c,135,95,9,p.skin);c.fillStyle=p.skin;c.beginPath();c.ellipse(96,91,36,45,0,0,Math.PI*2);c.fill();
    c.fillStyle=p.hair;c.beginPath();c.moveTo(59,80);c.bezierCurveTo(54,43,84,28,107,39);c.bezierCurveTo(135,34,146,57,132,84);c.lineTo(126,69);c.bezierCurveTo(99,78,84,53,65,78);c.closePath();c.fill();
    if(p.id==='orbit'){for(let i=0;i<7;i++)circle(c,62+i*11,49+Math.sin(i)*5,13,p.hair);}
    circle(c,81,93,3.3,'#2c2528');circle(c,111,93,3.3,'#2c2528');
    c.strokeStyle='#83594f';c.lineWidth=2.4;c.lineCap='round';c.beginPath();c.moveTo(96,96);c.lineTo(94,105);c.lineTo(99,105);c.stroke();
    c.strokeStyle='#7d4849';c.lineWidth=3;c.beginPath();c.arc(96,108,12,.24*Math.PI,.76*Math.PI);c.stroke();
    if(p.style==='glasses'){c.strokeStyle='#302b2a';c.lineWidth=4;c.beginPath();c.roundRect(67,83,28,22,8);c.roundRect(101,83,28,22,8);c.moveTo(95,91);c.lineTo(101,91);c.stroke();}
    c.fillStyle='#ffffff28';c.beginPath();c.moveTo(73,148);c.lineTo(96,162);c.lineTo(119,148);c.lineTo(110,142);c.lineTo(96,151);c.lineTo(82,142);c.closePath();c.fill();
  }
  c.restore();return canvas;
}
export function loadAvatarImage(dataUrl){
  return new Promise((resolve,reject)=>{const img=new Image(),timer=setTimeout(()=>{img.onload=img.onerror=null;reject(Error('图片读取超时'));},6000);img.onload=()=>{clearTimeout(timer);resolve(img);};img.onerror=()=>{clearTimeout(timer);reject(Error('图片无法读取'));};img.src=dataUrl;});
}
export async function drawAvatarCanvas(value,seatIndex=0){
  let avatar;try{avatar=normalizeAvatar(value,{seat:seatIndex});}catch{avatar=defaultAvatar(seatIndex);}
  const canvas=drawPresetAvatar(avatar.kind==='preset'?avatar.id:defaultAvatar(seatIndex).id);
  if(avatar.kind==='image')try{const img=await loadAvatarImage(avatar.dataUrl),c=canvas.getContext('2d');c.clearRect(0,0,AVATAR_SIZE,AVATAR_SIZE);c.save();c.beginPath();c.arc(96,96,96,0,Math.PI*2);c.clip();c.drawImage(img,0,0,AVATAR_SIZE,AVATAR_SIZE);c.restore();}catch{}
  return canvas;
}
