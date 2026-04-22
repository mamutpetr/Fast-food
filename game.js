/* ═══════════════════════════════════════════════════════════
   SWEETBUCKS COFFEE — game.js
   Isometric Canvas 2D · Cafe Life visual style
   Yellow counter · white tile floor · wood walls · green aprons
   ═══════════════════════════════════════════════════════════ */
(function(){
'use strict';

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

/* ── Isometric math ── */
// 45° classic iso: tile width 80, height 40
const TW = 80, TH = 40;
function iso(wx, wy){ return { sx:(wx-wy)*TW/2, sy:(wx+wy)*TH/2 }; }
function isoZ(wx,wy,wz){ return { sx:(wx-wy)*TW/2, sy:(wx+wy)*TH/2 - wz*32 }; }

const ROWS = 14, COLS = 12;
let originX=0, originY=0, W=0, H=0;

function toScreen(wx,wy,wz=0){
  const p = isoZ(wx,wy,wz);
  return { x: p.sx+originX, y: p.sy+originY };
}

/* ── Palette (Sweetbucks / Cafe Life) ── */
const P = {
  // Floor
  floorA:'#f0ebe0',  floorB:'#e6e0d4',  floorLine:'#d8d0c0',
  // Walls (wood paneling)
  wallFaceA:'#c8864a', wallFaceB:'#a06030', wallTop:'#e8a86a', wallDark:'#6b3a1f',
  // Counter (yellow!)
  ctrTop:'#f5c842', ctrFront:'#e09a10', ctrSide:'#c87808', ctrLine:'#b06006',
  // Counter back wall wood
  backWall:'#8b5e3c', backWallTop:'#a07040',
  // Tables (dark wood like in screenshots)
  tblTop:'#5c3a20', tblFront:'#3d2010', tblSide:'#2e1808',
  tblClean:'#5c3a20', tblDirty:'#4a3020',
  // Chairs (light tan)
  chairTop:'#c8a878', chairFront:'#a08050',
  // Floor mat (position markers - grey squares like in game)
  mat:'rgba(0,0,0,0.07)', matBorder:'rgba(0,0,0,0.12)',
  // Player
  plrShirt:'#ffffff', plrApron:'#3a7d44', plrPants:'#3a5080',
  plrSkin:'#f0c090', plrHair:'#2a1a0a',
  // Guest  
  gstColors:['#e8a870','#90c8e0','#c090d0','#80c8a0','#e0c060','#d08080'],
  // Machine (grey/silver on counter)
  machine:'#c0b8b0', machineDark:'#908880', machineRed:'#d43030',
  // Coffee beans display
  beans:'#6b3a1f',
  // Misc
  shadow:'rgba(80,40,0,0.18)',
  progressBg:'rgba(0,0,0,0.35)',
  progGreen:'#3a7d44', progRed:'#d43030', progGold:'#f5c842',
  speechBg:'#fffaf0', speechBorder:'#c8864a',
  money:'#f5c842', green:'#3a7d44',
  white:'#ffffff',
};

/* ── World layout ── */
// Counter: top-right strip, y=0..1, x=COLS-3..COLS
const CTR_X = COLS-4, CTR_Y = 0, CTR_W = 4, CTR_D = 1.5;
// Back wall behind counter
const BACK_X = CTR_X, BACK_Y = 0;
// Entrance: left edge, middle
const ENT_WX = 0, ENT_WY = ROWS/2;
// Table definitions (world coords)
const TABLE_DEFS = [
  {wx:3,wy:3},{wx:6.5,wy:3},{wx:10,wy:3},
  {wx:3,wy:7},{wx:6.5,wy:7},{wx:10,wy:7},
  {wx:3,wy:11},{wx:6.5,wy:11},
];
const INIT_TABLES = 3;

/* ── State ── */
let W2, H2, lastTime=0, DT=0;
let money=0, totalEarned=0, gameLevel=1;
let paused=false, gameStarted=false;
let spawnClock=2.5, guestId=0;
let particles=[];

/* ── Upgrades ── */
const UPG = {
  table:   {label:'Extra Table',  icon:'🪑', desc:'Unlock a new table slot',      costs:[60,120,200,300,450], lv:0, max:5},
  speed:   {label:'Faster Barista',icon:'👟',desc:'Move quicker around the cafe', costs:[80,150,260,400],     lv:0, max:4},
  brew:    {label:'Faster Brewing',icon:'⚡',desc:'Reduce order preparation time',costs:[100,180,300],        lv:0, max:3},
  marketing:{label:'Marketing',   icon:'📣',desc:'More customers arrive',         costs:[70,150,280],         lv:0, max:3},
};
const getSpeed  = ()=> 3.6 + UPG.speed.lv*0.75;
const getBrewT  = ()=> 4.0 - UPG.brew.lv*0.9;
const getSpawnT = ()=> Math.max(2.8, 5.5 - UPG.marketing.lv*0.85);

/* ── Tables ── */
let tables=[];
function buildTables(n){
  tables=[];
  for(let i=0;i<n&&i<TABLE_DEFS.length;i++){
    const d=TABLE_DEFS[i];
    tables.push({id:i,wx:d.wx,wy:d.wy,state:'empty',guest:null,cash:0});
  }
}

/* ── Player ── */
let PL = {wx:1.5, wy:ROWS/2, wz:0, r:0.4,
  carry:null, following:null,
  cleanTimer:0, cleanTarget:null,
  step:0, faceRight:true,
};

/* ── Guests ── */
const GS={Q:'Q',F:'F',S:'S',WF:'WF',E:'E',L:'L',G:'G'};
const MENU=['☕','🧁','🥐','🍰','🍵'];
const EARN=[22,28,32,36,24];
const GEMOJI=['🧑','👩','👨','🧒','👧','🧔'];

let guests=[];

function spawnGuest(){
  const qn=guests.filter(g=>g.state===GS.Q).length;
  if(qn>=4)return;
  const id=++guestId;
  const fi=Math.floor(Math.random()*MENU.length);
  const col=P.gstColors[id%P.gstColors.length];
  guests.push({
    id, col, state:GS.Q,
    wx:ENT_WX+0.5, wy:ENT_WY,
    r:0.38,
    food:MENU[fi], earn:EARN[fi],
    table:null, seatWx:0, seatWy:0,
    patience:28, pTimer:0,
    orderDelay:1.8,
    brewTimer:0, brewDone:false,
    eatTime:5+Math.random()*2, eatTimer:0,
    qPos:qn, tgtWx:0, tgtWy:0,
    spd:2.8+Math.random()*0.5,
    bob:Math.random()*Math.PI*2,
    walk:0,
    emoji:GEMOJI[id%GEMOJI.length],
  });
  requeue();
}

function requeue(){
  let qi=0;
  guests.filter(g=>g.state===GS.Q).forEach(g=>{
    g.qPos=qi++;
    g.tgtWx=ENT_WX+1.2+g.qPos*1.1;
    g.tgtWy=ENT_WY;
  });
}

/* ══ INPUT ══ */
const JOY={active:false,sx:0,sy:0,dx:0,dy:0,maxR:37};
const KEYS={};
let actPressed=false, actLatch=false;

const joyZone=document.getElementById('joy-zone');
joyZone.addEventListener('touchstart',e=>{
  e.preventDefault();
  const t=e.touches[0], r=joyZone.getBoundingClientRect();
  JOY.active=true;
  JOY.sx=r.left+r.width/2; JOY.sy=r.top+r.height/2;
  updateJoy(t.clientX,t.clientY);
},{passive:false});
joyZone.addEventListener('touchmove',e=>{
  e.preventDefault();
  if(JOY.active)updateJoy(e.touches[0].clientX,e.touches[0].clientY);
},{passive:false});
joyZone.addEventListener('touchend',()=>{
  JOY.active=false; JOY.dx=0; JOY.dy=0;
  document.getElementById('joy-knob').style.transform='translate(-50%,-50%)';
});
function updateJoy(cx,cy){
  const dx=cx-JOY.sx, dy=cy-JOY.sy;
  const d=Math.hypot(dx,dy), c=Math.min(d,JOY.maxR), a=Math.atan2(dy,dx);
  JOY.dx=(c/JOY.maxR)*Math.cos(a); JOY.dy=(c/JOY.maxR)*Math.sin(a);
  document.getElementById('joy-knob').style.transform=
    `translate(calc(-50% + ${Math.cos(a)*c}px),calc(-50% + ${Math.sin(a)*c}px))`;
}
window.addEventListener('keydown',e=>{keys[e.key]=true; if(e.key===' '){e.preventDefault();doAction();}});
window.addEventListener('keyup',  e=>{keys[e.key]=false;});
// fix: keys vs KEYS consistency
const keys=KEYS;

const actBtn=document.getElementById('act-btn');
actBtn.addEventListener('touchstart',e=>{e.preventDefault();doAction();},{passive:false});
actBtn.addEventListener('click',doAction);

function getMoveInput(){
  let dx=JOY.dx, dy=JOY.dy;
  if(keys['ArrowLeft']||keys['a']){dx-=0.707;dy+=0.707;}
  if(keys['ArrowRight']||keys['d']){dx+=0.707;dy-=0.707;}
  if(keys['ArrowUp']||keys['w']){dx+=0.707;dy+=0.707;}
  if(keys['ArrowDown']||keys['s']){dx-=0.707;dy-=0.707;}
  const l=Math.hypot(dx,dy); if(l>1){dx/=l;dy/=l;}
  return {dx,dy};
}

/* ══ COLLISION ══ */
function walkable(wx,wy){
  if(wx<0.35||wx>COLS-0.35||wy<0.35||wy>ROWS-0.35)return false;
  // counter zone
  if(wx>=CTR_X-0.6&&wx<=COLS-0.2&&wy>=CTR_Y-0.2&&wy<=CTR_Y+CTR_D+0.6)return false;
  // tables
  for(const t of tables){
    if(Math.hypot(wx-t.wx-0.5,wy-t.wy-0.5)<0.95)return false;
  }
  return true;
}

function moveE(e,dx,dy,spd){
  const nx=e.wx+dx*spd*DT, ny=e.wy+dy*spd*DT;
  if(walkable(nx,e.wy))e.wx=nx;
  if(walkable(e.wx,ny))e.wy=ny;
}

function wd(a,b){return Math.hypot(a.wx-b.wx,a.wy-b.wy);}

function nearCounter(){
  return PL.wx>=CTR_X-1.4&&PL.wx<=COLS-0.3&&
         PL.wy>=CTR_Y-0.5&&PL.wy<=CTR_Y+CTR_D+1.2;
}
function nearTable(t){return Math.hypot(PL.wx-t.wx-0.5,PL.wy-t.wy-0.5)<1.6;}
function nearGuest(g){return wd(PL,g)<1.5;}

/* ══ ACTION ══ */
let lastAct=0;
function doAction(){
  const now=performance.now();
  if(now-lastAct<280)return;
  lastAct=now;

  // 1. Deliver food
  if(PL.carry){
    const t=tables.find(t=>t.state==='occupied'&&t.guest&&
      t.guest.state===GS.WF&&t.guest.food===PL.carry&&nearTable(t));
    if(t){
      t.guest.state=GS.E; t.guest.eatTimer=t.guest.eatTime;
      t.guest.brewDone=false; PL.carry=null;
      spawnPts(t.wx+0.5,t.wy+0.5,P.progGreen,8);
      toast(`${t.guest.food} served! 😋`); refreshActBtn(); return;
    }
    toast('No guest waiting for this!'); return;
  }

  // 2. Pick up from counter
  if(!PL.carry&&!PL.following&&nearCounter()){
    const ready=guests.find(g=>g.state===GS.WF&&g.brewDone);
    if(ready){PL.carry=ready.food;ready.brewDone=false;toast(`Grabbed ${PL.carry}!`);refreshActBtn();return;}
    const cook=guests.find(g=>g.state===GS.WF&&!g.brewDone&&g.brewTimer<=0);
    if(cook){cook.brewTimer=getBrewT();toast('Brewing… ⏳');return;}
    toast('Nothing ready yet');return;
  }

  // 3. Seat following guest
  if(PL.following){
    const t=tables.find(t=>t.state==='empty'&&nearTable(t));
    if(t){seatGuest(PL.following,t);PL.following=null;refreshActBtn();return;}
    toast('Walk to an empty table 🪑'); return;
  }

  // 4. Greet queuing guest
  if(!PL.following&&!PL.carry){
    const g=guests.find(g=>g.state===GS.Q&&nearGuest(g));
    if(g){
      const ft=tables.find(t=>t.state==='empty');
      if(ft){
        g.state=GS.F; PL.following=g;
        g.table=ft; ft.state='occupied'; ft.guest=g;
        requeue(); toast('Lead them to a table! 🪑'); refreshActBtn();
      } else toast('No free tables! 😬');
      return;
    }
  }

  // 5. Start cleaning
  if(!PL.carry&&!PL.following){
    const d=tables.find(t=>t.state==='dirty'&&nearTable(t));
    if(d&&PL.cleanTarget!==d){
      PL.cleanTarget=d; PL.cleanTimer=2.0; toast('Cleaning… 🧹');
    }
  }
}

function seatGuest(g,t){
  g.state=GS.S;
  g.seatWx=t.wx+0.5; g.seatWy=t.wy+0.8;
  g.wx=g.seatWx; g.wy=g.seatWy;
  g.orderDelay=1.8;
  spawnPts(t.wx+0.5,t.wy+0.5,P.money,6);
}

function finishEat(g){
  g.state=GS.L;
  if(g.table){g.table.state='dirty';g.table.cash=g.earn;g.table.guest=null;}
  g.tgtWx=ENT_WX-0.4; g.tgtWy=ENT_WY;
}

function leaveAngry(g){
  g.state=GS.L;
  if(g.table){g.table.state='empty';g.table.guest=null;g.table=null;}
  g.tgtWx=ENT_WX-0.4; g.tgtWy=ENT_WY;
  requeue(); toast('Guest left angry 😡');
}

/* ══ GUEST UPDATE ══ */
function updateGuests(){
  guests.forEach(g=>{
    switch(g.state){
      case GS.Q:
        moveTo(g,g.tgtWx,g.tgtWy,g.spd);
        g.pTimer+=DT; if(g.pTimer>g.patience)leaveAngry(g);
        g.bob+=DT*3; break;
      case GS.F:
        moveTo(g,PL.wx,PL.wy+0.75,3.4);
        g.walk+=DT*6; break;
      case GS.S:
        g.wx=g.seatWx;g.wy=g.seatWy;
        g.orderDelay-=DT;
        if(g.orderDelay<=0)g.state=GS.WF; break;
      case GS.WF:
        g.wx=g.seatWx;g.wy=g.seatWy;
        if(g.brewTimer>0){g.brewTimer-=DT;if(g.brewTimer<=0)g.brewDone=true;}
        g.pTimer+=DT; if(g.pTimer>g.patience*1.7)leaveAngry(g); break;
      case GS.E:
        g.wx=g.seatWx;g.wy=g.seatWy;
        g.eatTimer-=DT; if(g.eatTimer<=0)finishEat(g);
        g.bob+=DT*1.5; break;
      case GS.L:
        moveTo(g,g.tgtWx,g.tgtWy,g.spd);
        g.walk+=DT*6;
        if(wd(g,{wx:g.tgtWx,wy:g.tgtWy})<0.3)g.state=GS.G; break;
    }
  });
  guests=guests.filter(g=>g.state!==GS.G);
}

function moveTo(e,tx,ty,spd){
  const dx=tx-e.wx,dy=ty-e.wy,d=Math.hypot(dx,dy);
  if(d<0.05)return;
  const s=Math.min(spd*DT,d);
  e.wx+=(dx/d)*s; e.wy+=(dy/d)*s;
}

/* ══ PLAYER UPDATE ══ */
function updatePlayer(){
  const {dx,dy}=getMoveInput();
  const spd=getSpeed();
  if(Math.abs(dx)>.05||Math.abs(dy)>.05){
    PL.step+=DT*7;
    if(dx>.1)PL.faceRight=true;
    if(dx<-.1)PL.faceRight=false;
  }
  moveE(PL,dx,dy,spd);

  // Cleaning progress
  if(PL.cleanTimer>0&&PL.cleanTarget){
    const t=PL.cleanTarget;
    if(t.state==='dirty'&&nearTable(t)){
      PL.cleanTimer-=DT;
      if(PL.cleanTimer<=0){
        money+=t.cash; totalEarned+=t.cash;
        spawnMoney(t.wx+0.5,t.wy+0.5,t.cash);
        t.state='empty';t.guest=null;t.cash=0;
        PL.cleanTarget=null; updateHUD(); toast('💰 Collected!');
      }
    } else {PL.cleanTarget=null;PL.cleanTimer=0;}
  }
  if(PL.carry||PL.following){PL.cleanTarget=null;PL.cleanTimer=0;}
  refreshActBtn();
}

/* ══ PARTICLES ══ */
function spawnPts(wx,wy,col,n){
  for(let i=0;i<n;i++){
    const a=Math.random()*Math.PI*2, s=1+Math.random()*1.8;
    particles.push({wx,wy,wz:.2,vx:Math.cos(a)*s,vy:Math.sin(a)*s,vz:1.5+Math.random(),
      life:.6+Math.random()*.3,maxLife:.9,r:3+Math.random()*4,col,text:null});
  }
}
function spawnMoney(wx,wy,amt){
  particles.push({wx,wy,wz:.5,vx:0,vy:-.5,vz:2.5,life:1.3,maxLife:1.3,r:0,col:P.money,text:`+${amt}🪙`});
}
function updatePts(){
  particles.forEach(p=>{
    p.wx+=p.vx*DT;p.wy+=p.vy*DT;p.wz+=p.vz*DT;
    p.vz-=2.5*DT;p.life-=DT;
  });
  particles=particles.filter(p=>p.life>0);
}

/* ══ RESIZE ══ */
function resize(){
  W=canvas.width=window.innerWidth;
  H=canvas.height=window.innerHeight;
  W2=W/2;H2=H/2;
  // Center grid
  const cp=isoZ(COLS/2,ROWS/2,0);
  originX=W2-cp.sx;
  originY=H2-cp.sy+30;
}
window.addEventListener('resize',resize);

/* ══ DRAW HELPERS ══ */

// Draw iso quad from 4 world corners (all same z)
function isoQuad(pts,fill,stroke,sw=1.5){
  const sc=pts.map(([wx,wy,wz=0])=>toScreen(wx,wy,wz));
  ctx.beginPath();
  ctx.moveTo(sc[0].x,sc[0].y);
  for(let i=1;i<sc.length;i++)ctx.lineTo(sc[i].x,sc[i].y);
  ctx.closePath();
  if(fill){ctx.fillStyle=fill;ctx.fill();}
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=sw;ctx.stroke();}
}

// Iso box: wx,wy = bottom-left corner, wz=base, bw/bd/bh = dimensions
function isoBox(wx,wy,wz,bw,bd,bh,cTop,cLeft,cRight,outline=null){
  const ow=outline||'rgba(0,0,0,0.08)';
  // Right face
  isoQuad([
    [wx+bw,wy,   wz+bh],[wx+bw,wy+bd,wz+bh],
    [wx+bw,wy+bd,wz   ],[wx+bw,wy,   wz   ]
  ],cRight,ow);
  // Left face
  isoQuad([
    [wx,   wy+bd,wz+bh],[wx+bw,wy+bd,wz+bh],
    [wx+bw,wy+bd,wz   ],[wx,   wy+bd,wz   ]
  ],cLeft,ow);
  // Top face
  isoQuad([
    [wx,   wy,   wz+bh],[wx+bw,wy,   wz+bh],
    [wx+bw,wy+bd,wz+bh],[wx,   wy+bd,wz+bh]
  ],cTop,ow);
}

function isoEllipse(wx,wy,wz,rx,ry,col,alpha=1){
  const p=toScreen(wx,wy,wz);
  ctx.globalAlpha=alpha;
  ctx.beginPath();ctx.ellipse(p.x,p.y,rx,ry,0,0,Math.PI*2);
  ctx.fillStyle=col;ctx.fill();
  ctx.globalAlpha=1;
}

function isoEmoji(emoji,wx,wy,wz,sz,alpha=1){
  const p=toScreen(wx,wy,wz);
  ctx.globalAlpha=alpha;
  ctx.font=`${sz}px serif`;ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(emoji,p.x,p.y);
  ctx.globalAlpha=1;
}

function isoLabel(text,wx,wy,wz,sz,col,alpha=1){
  const p=toScreen(wx,wy,wz);
  ctx.globalAlpha=alpha;
  ctx.font=`bold ${sz}px Nunito,sans-serif`;
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillStyle=col;ctx.fillText(text,p.x,p.y);
  ctx.globalAlpha=1;
}

function progressBar(wx,wy,pct,fg,bw=36,bh=6){
  const p=toScreen(wx,wy,0);
  const bx=p.x-bw/2,by=p.y-bh/2;
  ctx.beginPath();ctx.roundRect(bx,by,bw,bh,bh/2);
  ctx.fillStyle=P.progressBg;ctx.fill();
  if(pct>0){
    ctx.save();
    ctx.beginPath();ctx.roundRect(bx,by,bw,bh,bh/2);ctx.clip();
    ctx.fillStyle=fg;ctx.fillRect(bx,by,bw*pct,bh);
    ctx.restore();
  }
}

/* ══ DRAW FLOOR ══ */
function drawFloor(){
  for(let x=0;x<COLS;x++){
    for(let y=0;y<ROWS;y++){
      const alt=(x+y)%2===0;
      const col=alt?P.floorA:P.floorB;
      // Tile top face
      isoQuad([
        [x,y,0],[x+1,y,0],[x+1,y+1,0],[x,y+1,0]
      ],col,P.floorLine,.4);
    }
  }

  // Floor mat markers (like the grey squares in screenshots)
  const matPositions=[
    {wx:2,wy:1.5},{wx:5.5,wy:1.5},{wx:9,wy:1.5},
    {wx:2,wy:5.5},{wx:5.5,wy:5.5},{wx:9,wy:5.5},
    {wx:2,wy:9.5},{wx:5.5,wy:9.5},
    {wx:1,wy:ENT_WY-1},{wx:1,wy:ENT_WY},{wx:1,wy:ENT_WY+1},
  ];
  matPositions.forEach(({wx,wy})=>{
    isoQuad([[wx+.1,wy+.1,0.01],[wx+.9,wy+.1,0.01],[wx+.9,wy+.9,0.01],[wx+.1,wy+.9,0.01]],
      P.mat,P.matBorder,1);
  });
}

/* ══ DRAW WALLS ══ */
function drawWalls(){
  // Back wall (wy = 0, goes from x=0 to COLS)
  for(let x=0;x<COLS;x++){
    isoBox(x,0,0,1,.15,2.2,P.wallTop,P.wallFaceA,P.wallFaceB);
  }
  // Right wall (wx = COLS, goes from y=0 to ROWS)
  for(let y=0;y<ROWS;y++){
    isoBox(COLS-.15,y,0,.15,1,2.2,P.wallTop,P.wallFaceA,P.wallFaceB);
  }
  // Back wall wood paneling detail
  for(let x=0;x<CTR_X;x+=2){
    isoBox(x+.1,.05,.2,.8,.05,.1,P.wallFaceA,P.wallFaceA,P.wallFaceA,'rgba(0,0,0,0.05)');
  }
}

/* ══ DRAW COUNTER (yellow Sweetbucks style) ══ */
function drawCounter(){
  // Back display wall behind counter
  for(let x=CTR_X;x<COLS;x++){
    isoBox(x,0,0,1,.15,3.0,P.backWallTop,P.backWall,P.wallDark);
  }

  // Counter sign (SWEETBUCKS COFFEE — dark brown strip with yellow text)
  const signY=0,.05;
  // Sign strip on back wall
  const sp1=toScreen(CTR_X,0,2.6), sp2=toScreen(COLS,0,2.6),
        sp3=toScreen(COLS,0,2.2), sp4=toScreen(CTR_X,0,2.2);
  ctx.beginPath();
  ctx.moveTo(sp1.x,sp1.y);ctx.lineTo(sp2.x,sp2.y);
  ctx.lineTo(sp3.x,sp3.y);ctx.lineTo(sp4.x,sp4.y);
  ctx.closePath();
  ctx.fillStyle='#3d2010';ctx.fill();
  // Sign text
  isoLabel('SWEETBUCKS COFFEE',CTR_X+CTR_W/2,.07,2.4,10,'#f5c842');

  // Main counter body (tall yellow box)
  isoBox(CTR_X,CTR_Y,0,CTR_W,CTR_D,.85,P.ctrTop,P.ctrFront,P.ctrSide);
  // Counter top ledge accent
  isoBox(CTR_X-.05,CTR_Y-.05,.82,CTR_W+.1,CTR_D+.05,.06,P.ctrLine,P.ctrFront,P.ctrSide);

  // Espresso machine (grey box with red buttons)
  isoBox(COLS-2.2,CTR_Y+.2,.85,.8,.8,.9,P.machine,P.machineDark,P.machineDark);
  isoBox(COLS-2.0,CTR_Y+.25,1.5,.4,.35,.3,P.machineRed,'#b02020','#901818');
  // Machine top
  isoEmoji('☕',COLS-1.8,CTR_Y+.6,1.8,14);

  // Blender (grey cylinder shape)
  isoBox(CTR_X+.4,CTR_Y+.3,.85,.5,.5,1.0,P.machine,'#b0a8a0','#909088');
  isoEllipse(CTR_X+.65,CTR_Y+.8,1.87,8,5,'#d0c8c0');

  // Coffee beans display
  isoBox(COLS-1.0,CTR_Y+.3,.85,.6,.6,.5,P.beans,'#4a2810','#3a1e08');
  isoEmoji('☕',COLS-.7,CTR_Y+.6,1.4,12);

  // Cooking indicators per waiting guest
  const cooking=guests.filter(g=>g.state===GS.WF);
  cooking.forEach((g,i)=>{
    const fx=CTR_X+.8+i*0.9, fy=CTR_Y+.7;
    if(g.brewDone){
      isoEmoji(g.food,fx,fy,.95,18);
    } else if(g.brewTimer>0){
      const pct=1-g.brewTimer/getBrewT();
      progressBar(fx,fy-.5,pct,P.progRed,26,5);
      isoEmoji(g.food,fx,fy,.95,13,.5);
    }
  });

  // Counter barista staff indicator
  isoLabel('KITCHEN',CTR_X+CTR_W/2,CTR_Y+CTR_D+.5,-.1,9,P.ctrTop);
}

/* ══ DRAW TABLES ══ */
function drawTables(){
  tables.forEach(t=>{
    const isDirty=t.state==='dirty';
    const topC=isDirty?P.tblDirty:P.tblClean;

    // Shadow
    isoEllipse(t.wx+.5,t.wy+.5,0,22,13,P.shadow);

    // Table legs
    [[.12,.12],[.76,.12],[.12,.76],[.76,.76]].forEach(([ox,oy])=>{
      isoBox(t.wx+ox,t.wy+oy,0,.12,.12,.42,P.tblFront,P.tblSide,P.tblSide);
    });

    // Chairs (light tan like screenshots)
    isoBox(t.wx-.25,t.wy+.2,.0,.2,.6,.35,P.chairTop,P.chairFront,P.chairFront);
    isoBox(t.wx+1.05,t.wy+.2,.0,.2,.6,.35,P.chairTop,P.chairFront,P.chairFront);
    isoBox(t.wx+.1,t.wy+1.05,.0,.8,.2,.35,P.chairTop,P.chairFront,P.chairFront);

    // Table top slab
    isoBox(t.wx,t.wy,.42,1,1,.1,topC,P.tblFront,P.tblSide);
    // Table top border highlight
    isoBox(t.wx+.05,t.wy+.05,.52,.9,.9,.03,'rgba(255,255,255,.08)',null,null,null);

    if(isDirty){
      isoEmoji('🍽️',t.wx+.5,t.wy+.5,.58,18);
      if(t.cash>0){
        isoEmoji('💰',t.wx+.75,t.wy+.8,.58,14);
        isoLabel(`${t.cash}`,t.wx+1.05,t.wy+.8,.7,9,P.money);
      }
      // Clean progress
      if(PL.cleanTarget===t&&PL.cleanTimer>0){
        progressBar(t.wx+.5,t.wy-.4,1-PL.cleanTimer/2,P.progGreen,44,7);
        isoEmoji('🧹',t.wx+.5,t.wy-.7,.5,15);
      }
    } else if(t.state==='empty'){
      // empty cup on table
      isoEmoji('🫙',t.wx+.5,t.wy+.5,.58,13,.4);
    }

    // Table number
    isoLabel(`T${t.id+1}`,t.wx+.5,t.wy+.1,.58,8,'rgba(255,255,255,.6)');
  });
}

/* ══ DRAW GUESTS ══ */
function drawGuests(){
  const sorted=[...guests].sort((a,b)=>a.wy-b.wy);
  sorted.forEach(g=>{
    if(g.state===GS.G)return;
    const bob=(g.state===GS.Q||g.state===GS.F||g.state===GS.L)
      ?Math.sin(g.bob)*.05:0;
    const wz=.06+bob;

    // Shadow
    isoEllipse(g.wx,g.wy,0,13,7,P.shadow);

    // Body — draw as small barista-style figure
    const p=toScreen(g.wx,g.wy,wz);
    // Torso
    ctx.beginPath();ctx.ellipse(p.x,p.y,12,9,0,0,Math.PI*2);
    ctx.fillStyle=g.col;ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,.12)';ctx.lineWidth=1.5;ctx.stroke();

    // Face emoji
    isoEmoji(g.emoji,g.wx,g.wy,wz+.22,15);

    // Patience bar
    if(g.state===GS.Q){
      const pct=1-g.pTimer/g.patience;
      progressBar(g.wx,g.wy-.65,pct,pct>.4?P.progGreen:P.progRed,28,5);
    }

    // Order bubble
    if(g.state===GS.WF||g.state===GS.E){
      drawBubble(g,wz);
    }

    // Eat bar
    if(g.state===GS.E){
      const pct=1-g.eatTimer/g.eatTime;
      progressBar(g.wx,g.wy-.65,pct,P.progGold,28,5);
    }

    // Ready glow
    if(g.state===GS.WF&&g.brewDone){
      const pc=toScreen(g.wx,g.wy-.9,wz);
      ctx.beginPath();ctx.arc(pc.x,pc.y,11,0,Math.PI*2);
      ctx.fillStyle='rgba(58,125,68,.25)';ctx.fill();
      isoEmoji('✅',g.wx,g.wy-.9,wz,11);
    }
  });
}

function drawBubble(g,wz){
  const p=toScreen(g.wx,g.wy-.95,wz+.45);
  const bw=34,bh=30,br=8;
  const bx=p.x-bw/2,by=p.y-bh;
  ctx.beginPath();ctx.roundRect(bx,by,bw,bh,br);
  ctx.fillStyle=P.speechBg;ctx.fill();
  ctx.strokeStyle=P.speechBorder;ctx.lineWidth=1.5;ctx.stroke();
  // Tail
  ctx.beginPath();ctx.moveTo(p.x-5,by+bh);ctx.lineTo(p.x+5,by+bh);
  ctx.lineTo(p.x,by+bh+6);ctx.closePath();
  ctx.fillStyle=P.speechBg;ctx.fill();
  ctx.strokeStyle=P.speechBorder;ctx.lineWidth=1.5;ctx.stroke();
  // Food
  ctx.font='15px serif';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(g.food,p.x,by+bh/2);
  // Status dot
  ctx.beginPath();ctx.arc(bx+bw-5,by+5,5,0,Math.PI*2);
  ctx.fillStyle=g.state===GS.E?P.progGreen:P.progRed;ctx.fill();
}

/* ══ DRAW PLAYER (barista with green apron) ══ */
function drawPlayer(){
  const bob=Math.sin(PL.step*.5)*.04;
  const wz=.08+bob;

  // Shadow
  isoEllipse(PL.wx,PL.wy,0,16,9,P.shadow);

  const p=toScreen(PL.wx,PL.wy,wz);

  // Pants (dark)
  ctx.beginPath();ctx.ellipse(p.x,p.y+4,10,7,0,0,Math.PI*2);
  ctx.fillStyle=P.plrPants;ctx.fill();

  // Shirt (white)
  ctx.beginPath();ctx.ellipse(p.x,p.y,13,9,0,0,Math.PI*2);
  ctx.fillStyle=P.plrShirt;ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,.1)';ctx.lineWidth=1.5;ctx.stroke();

  // Green apron overlay
  ctx.beginPath();ctx.ellipse(p.x,p.y+1,9,7,0,0,Math.PI*2);
  ctx.fillStyle=P.plrApron;ctx.fill();

  // Head
  const ph=toScreen(PL.wx,PL.wy,wz+.35);
  ctx.beginPath();ctx.ellipse(ph.x,ph.y,9,7,0,0,Math.PI*2);
  ctx.fillStyle=P.plrSkin;ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,.1)';ctx.lineWidth=1;ctx.stroke();

  // Hair / cap
  ctx.beginPath();ctx.ellipse(ph.x,ph.y-3,9,5,0,Math.PI,0);
  ctx.fillStyle=P.plrHair;ctx.fill();

  // Carry item
  if(PL.carry){
    const pc=toScreen(PL.wx,PL.wy,wz+.65);
    ctx.beginPath();ctx.arc(pc.x,pc.y,13,0,Math.PI*2);
    ctx.fillStyle='rgba(255,250,240,.92)';ctx.fill();
    ctx.strokeStyle=P.ctrTop;ctx.lineWidth=1.5;ctx.stroke();
    ctx.font='13px serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(PL.carry,pc.x,pc.y);
  }

  if(PL.following){
    isoEmoji('👇',PL.wx,PL.wy-.95,wz+.45,13);
  }

  // Clean bar above player
  if(PL.cleanTarget&&PL.cleanTimer>0){
    progressBar(PL.wx,PL.wy-.9,1-PL.cleanTimer/2,P.progGreen,42,6);
  }
}

/* ══ DRAW ENTRANCE ══ */
function drawEntrance(){
  // Green entry mat
  isoQuad([
    [-.3,ENT_WY-.7,0.01],[.5,ENT_WY-.7,0.01],
    [.5,ENT_WY+.7,0.01],[-.3,ENT_WY+.7,0.01]
  ],P.green,'rgba(0,0,0,.07)',.8);
  // Door frame
  isoBox(-.2,ENT_WY-.5,0,.2,1,1.6,P.wallTop,P.progGreen,P.progGreen);
  isoLabel('IN/OUT',.0,ENT_WY+.8,1.5,8,P.green);
}

/* ══ DRAW PARTICLES ══ */
function drawParticles(){
  particles.forEach(p=>{
    const a=p.life/p.maxLife;
    const sc=toScreen(p.wx,p.wy,p.wz);
    ctx.globalAlpha=a;
    if(p.text){
      ctx.font='bold 14px Nunito,sans-serif';
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillStyle=p.col;ctx.fillText(p.text,sc.x,sc.y);
    } else {
      ctx.beginPath();ctx.arc(sc.x,sc.y,p.r,0,Math.PI*2);
      ctx.fillStyle=p.col;ctx.fill();
    }
  });
  ctx.globalAlpha=1;
}

/* ══ MAIN DRAW ══ */
function draw(){
  ctx.clearRect(0,0,W,H);
  // bg gradient
  const bg=ctx.createLinearGradient(0,0,0,H);
  bg.addColorStop(0,'#d8cbb8'); bg.addColorStop(1,'#f0e8d8');
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);

  drawFloor();
  drawWalls();
  drawEntrance();
  drawCounter();
  drawTables();
  drawGuests();
  drawPlayer();
  drawParticles();
}

/* ══ HUD ══ */
function updateHUD(){
  document.getElementById('money-val').textContent=money;
  document.getElementById('level-val').textContent=`Lv ${gameLevel}`;
  document.getElementById('shop-bal').textContent=money;
}

let toastTO=null;
function toast(msg){
  const el=document.getElementById('toast');
  el.textContent=msg; el.classList.add('show');
  clearTimeout(toastTO);
  toastTO=setTimeout(()=>el.classList.remove('show'),1900);
}

function refreshActBtn(){
  const icon=document.getElementById('act-icon');
  const lbl=document.getElementById('act-lbl');
  const btn=document.getElementById('act-btn');
  if(PL.carry){
    icon.textContent=PL.carry;lbl.textContent='SERVE';btn.classList.add('pulse');
  } else if(PL.following){
    icon.textContent='🪑';lbl.textContent='SEAT';btn.classList.add('pulse');
  } else if(nearCounter()){
    const r=guests.find(g=>g.state===GS.WF&&g.brewDone);
    icon.textContent=r?r.food:'⚡';lbl.textContent=r?'GRAB':'BREW';
    r?btn.classList.add('pulse'):btn.classList.remove('pulse');
  } else {
    const qg=guests.find(g=>g.state===GS.Q&&nearGuest(g));
    const dt2=tables.find(t=>t.state==='dirty'&&nearTable(t));
    if(qg){icon.textContent='🤝';lbl.textContent='GREET';btn.classList.add('pulse');}
    else if(dt2){icon.textContent='🧹';lbl.textContent='CLEAN';btn.classList.add('pulse');}
    else{icon.textContent='✋';lbl.textContent='ACT';btn.classList.remove('pulse');}
  }
}

/* ══ SHOP ══ */
function openShop(){
  paused=true;
  document.getElementById('shop-bal').textContent=money;
  renderShop();
  document.getElementById('shop-wrap').classList.remove('hidden');
}
function closeShop(){
  paused=false;
  document.getElementById('shop-wrap').classList.add('hidden');
}

function renderShop(){
  const c=document.getElementById('shop-list'); c.innerHTML='';
  Object.entries(UPG).forEach(([key,u])=>{
    const isMax=u.lv>=u.max, cost=u.costs[u.lv], canAfford=money>=(cost||0);
    let dots='';
    for(let i=0;i<u.max;i++)dots+=`<div class="dot${i<u.lv?' on':''}"></div>`;
    const el=document.createElement('div'); el.className='s-item';
    el.innerHTML=`
      <div class="s-icon">${u.icon}</div>
      <div class="s-info">
        <div class="s-name">${u.label}</div>
        <div class="s-desc">${u.desc}</div>
        <div class="s-dots">${dots}</div>
      </div>
      <button class="s-buy${isMax?' maxed':''}" data-k="${key}"
        ${isMax||!canAfford?'disabled':''}>
        ${isMax?'✓ MAX':`🪙${cost}`}
      </button>`;
    c.appendChild(el);
  });
  c.querySelectorAll('.s-buy').forEach(b=>b.addEventListener('click',()=>buyUpg(b.dataset.k)));
}

function buyUpg(key){
  const u=UPG[key];
  if(u.lv>=u.max)return;
  const cost=u.costs[u.lv];
  if(money<cost){toast('Not enough coins 🪙');return;}
  money-=cost; u.lv++;
  if(key==='table'){
    const i=tables.length;
    if(i<TABLE_DEFS.length){
      tables.push({id:i,wx:TABLE_DEFS[i].wx,wy:TABLE_DEFS[i].wy,state:'empty',guest:null,cash:0});
      toast('New table added! 🪑');
    }
  } else if(key==='speed') toast('Moving faster! 👟');
  else if(key==='brew')    toast('Kitchen upgraded! ⚡');
  else if(key==='marketing')toast('More guests! 📣');
  gameLevel=1+Object.values(UPG).reduce((s,u)=>s+u.lv,0);
  updateHUD(); renderShop();
  document.getElementById('shop-bal').textContent=money;
}

/* ══ LOOP ══ */
function loop(ts){
  DT=Math.min((ts-lastTime)/1000,.05);
  lastTime=ts;
  if(!paused){
    updatePlayer();
    updateGuests();
    updatePts();
    spawnClock-=DT;
    if(spawnClock<=0){spawnClock=getSpawnT();spawnGuest();}
  }
  draw();
  requestAnimationFrame(loop);
}

/* ══ BINDINGS ══ */
document.getElementById('shop-btn').addEventListener('click',openShop);
document.getElementById('shop-x').addEventListener('click',closeShop);
document.getElementById('shop-scrim').addEventListener('click',closeShop);

document.getElementById('claim-btn').addEventListener('click',()=>{
  if(money<=0){toast('No coins yet! 🪙');return;}
  const tg=window.Telegram?.WebApp;
  if(tg){tg.sendData(JSON.stringify({discount:money,totalEarned}));tg.close();}
  else{toast(`Claimed 🪙${money}!`);money=0;updateHUD();}
});

document.getElementById('splash-btn').addEventListener('click',()=>{
  document.getElementById('splash').classList.add('hidden');
  gameStarted=true; lastTime=performance.now();
  requestAnimationFrame(loop);
});

// Telegram
const tg=window.Telegram?.WebApp;
if(tg){tg.expand();tg.ready();tg.setHeaderColor('#3d2010');tg.setBackgroundColor('#e8d8c0');}

/* ══ INIT ══ */
resize();
buildTables(INIT_TABLES);
updateHUD();

})();

