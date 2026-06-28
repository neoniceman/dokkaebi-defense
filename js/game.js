(function(){
"use strict";
const cv=document.getElementById('cv'), ctx=cv.getContext('2d');
const $=id=>document.getElementById(id);

// ---------- sprite assets (CraftPix · Tower Defense 2D Game Kit) ----------
const IMG={}, ESPRITE={}; let FX_BURST=[]; let _imgPending=0;
function _img(src){ const im=new Image(); _imgPending++;
  im.onload=im.onerror=()=>{ _imgPending--; }; im.src=src; return im; }
function loadAssets(){
  for(let i=1;i<=4;i++) IMG['map'+i]=_img('assets/maps/map'+i+'.png');
  ['archer','ballista','dark','frost','camp'].forEach(k=>IMG['t_'+k]=_img('assets/towers/'+k+'.png'));
  IMG.arrow=_img('assets/fx/arrow.png');
  IMG.ice=_img('assets/fx/ice.png');
  IMG.fireball=_img('assets/fx/fireball.png');
  IMG.u_archer=_img('assets/units/archer.png');
  IMG.u_knight=_img('assets/units/knight.png');
  const EFRAMES={goblin:10,brute:10,orc:10,imp:10,ogre:10,darkgob:10,king:10,bat:10,yeti:10,axer:10,
    boss:10,boss2:10,boss3:20,boss4:20};
  for(const k in EFRAMES){ ESPRITE[k]=[]; for(let i=0;i<EFRAMES[k];i++) ESPRITE[k][i]=_img('assets/enemies/'+k+'/f'+i+'.png'); }
  for(let i=0;i<12;i++) FX_BURST[i]=_img('assets/fx/burst/f'+i+'.png');
}
function imgReady(im){ return im && im.complete && im.naturalWidth>0; }
loadAssets();

// ---------- sound (Web Audio, synthesized — no files) + haptics ----------
const SFX={ on:true };
let _ac=null;
function ac(){ if(!_ac){ try{ _ac=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ _ac=null; } } return _ac; }
function vibe(ms){ if(SFX.on && navigator.vibrate){ try{ navigator.vibrate(ms); }catch(e){} } }
// a small tone helper
function tone(freq,dur,type,vol,slideTo){
  if(!SFX.on)return; const c=ac(); if(!c)return;
  const t0=c.currentTime;
  const o=c.createOscillator(), g=c.createGain();
  o.type=type||'sine'; o.frequency.setValueAtTime(freq,t0);
  if(slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1,slideTo),t0+dur);
  g.gain.setValueAtTime(0.0001,t0);
  g.gain.exponentialRampToValueAtTime(vol||0.15,t0+0.01);
  g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
  o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0+dur+0.02);
}
function noise(dur,vol,filterFreq){
  if(!SFX.on)return; const c=ac(); if(!c)return;
  const t0=c.currentTime, n=Math.floor(c.sampleRate*dur);
  const buf=c.createBuffer(1,n,c.sampleRate); const d=buf.getChannelData(0);
  for(let i=0;i<n;i++) d[i]=(Math.random()*2-1)*(1-i/n);
  const src=c.createBufferSource(); src.buffer=buf;
  const g=c.createGain(); g.gain.value=vol||0.12;
  if(filterFreq){ const f=c.createBiquadFilter(); f.type='lowpass'; f.frequency.value=filterFreq;
    src.connect(f); f.connect(g); } else src.connect(g);
  g.connect(c.destination); src.start(t0);
}
const SND={
  shoot(id){
    if(id==='kkachi') tone(900,0.06,'square',0.05,1300);
    else if(id==='bul') return; // flamethrower handled by loop
    else if(id==='seori') tone(700,0.12,'sine',0.06,1100);
    else if(id==='beom') { tone(180,0.16,'sawtooth',0.12,90); noise(0.1,0.08,800); }
    else tone(420,0.08,'triangle',0.08,300); // jangseung
  },
  kill(boss){ if(boss){ tone(160,0.5,'sawtooth',0.18,60); noise(0.4,0.16,1200); vibe([40,30,60]); }
    else { tone(330,0.12,'triangle',0.10,140); noise(0.08,0.06,1500); } },
  hurtLife(){ tone(200,0.18,'sawtooth',0.14,120); vibe(30); },
  upgrade(){ tone(523,0.10,'sine',0.10); setTimeout(()=>tone(784,0.12,'sine',0.10),90); vibe(15); },
  branch(){ tone(523,0.1,'sine',0.1); setTimeout(()=>tone(659,0.1,'sine',0.1),80); setTimeout(()=>tone(880,0.16,'sine',0.11),170); vibe([15,20,25]); },
  place(){ tone(300,0.08,'triangle',0.10,420); vibe(12); },
  wave(){ tone(440,0.12,'sine',0.09); setTimeout(()=>tone(660,0.14,'sine',0.09),110); },
  card(){ tone(740,0.09,'sine',0.08,920); vibe(10); },
  over(){ tone(300,0.5,'sawtooth',0.16,80); setTimeout(()=>tone(200,0.6,'sawtooth',0.16,60),200); vibe([60,40,120]); },
};
const toast=(m)=>{const t=$('toast');t.textContent=m;t.style.opacity=1;clearTimeout(t._t);t._t=setTimeout(()=>t.style.opacity=0,1400);};

// ---------- meta progression (permanent, saved) ----------
const META_UP={
  gold:{name:'두둑한 곳간', max:5, baseCost:8, step:1.6,
    desc:l=>'시작 금화 +'+(l*25)+' (현재 '+(120+l*25)+')',
    eff:l=>({startGold:l*25})},
  life:{name:'굳건한 성문', max:5, baseCost:10, step:1.7,
    desc:l=>'시작 생명 +'+(l*3)+' (현재 '+(20+l*3)+')',
    eff:l=>({startLife:l*3})},
  dmg:{name:'벼린 무기', max:5, baseCost:12, step:1.7,
    desc:l=>'모든 방어탑 피해 +'+(l*5)+'%',
    eff:l=>({dmgMul:1+l*0.05})},
  coin:{name:'복을 부르는 부적', max:5, baseCost:10, step:1.6,
    desc:l=>'런 종료 시 보석 +'+(l*15)+'%',
    eff:l=>({coinMul:1+l*0.15})},
};
const META_ORDER=['gold','life','dmg','coin'];
function metaLoad(){
  let m; try{ m=JSON.parse(localStorage.getItem('dokkaebi_meta')||'{}'); }catch(e){ m={}; }
  m.coins=m.coins||0; m.up=m.up||{};
  for(const k of META_ORDER) m.up[k]=m.up[k]||0;
  return m;
}
function metaSave(m){ try{ localStorage.setItem('dokkaebi_meta',JSON.stringify(m)); }catch(e){} }
let META=metaLoad();
function metaEffects(){
  const e={startGold:0,startLife:0,dmgMul:1,coinMul:1};
  for(const k of META_ORDER){ const v=META_UP[k].eff(META.up[k]||0);
    for(const p in v){ if(p.endsWith('Mul')) e[p]*=v[p]; else e[p]+=v[p]; } }
  return e;
}
function metaCost(k){ const u=META_UP[k]; const l=META.up[k]||0;
  if(l>=u.max)return null; return Math.round(u.baseCost*Math.pow(u.step,l)); }
// coins earned from a run based on waves survived
function runCoins(wave){ return Math.floor(wave*1.5 + Math.max(0,wave-10)*2); }

// ---------- responsive grid ----------
let W,H,CELL,COLS,ROWS,OX,OY, DPR=Math.min(devicePixelRatio||1,2);
function resize(){
  const st=document.getElementById('stage');
  let aw=st.clientWidth, ah=st.clientHeight;
  if(aw<10||ah<10){ // layout not ready yet — retry shortly
    return setTimeout(resize,60);
  }
  cv.style.width=aw+'px'; cv.style.height=ah+'px';
  cv.width=aw*DPR; cv.height=ah*DPR; ctx.setTransform(DPR,0,0,DPR,0,0);
  W=aw; H=ah;
  const portrait = H > W*1.3;
  // portrait phones: fewer columns (bigger cells) + more rows so the board
  // fills the tall screen instead of sitting as a thin strip in the middle
  COLS = portrait ? 11 : 15;
  const cw=Math.floor(W/COLS);
  ROWS=Math.max(9, Math.min(portrait?13:11, Math.floor(H/cw)));
  CELL=Math.min(cw, Math.floor(H/(ROWS+0.2)));
  OX=Math.floor((W-CELL*COLS)/2); OY=Math.floor((H-CELL*ROWS)/2);
  buildPath();
}
function ROWS0(ah,aw){ return ah>aw? 11:9; }
addEventListener('resize',resize);
addEventListener('orientationchange',()=>setTimeout(resize,200));

// ---------- path: 5 preset maps ----------
// Defined on a 15-col x 11-row reference grid as [col,row] corner waypoints.
// Paths are long and winding so no single tower can cover the whole route —
// placement choice (which stretch to guard) actually matters.
const MAPS=[
  { id:'gogae', name:'마른 뼈 사막', bg:'map1',
    corners:[[0,1],[14,1],[14,3],[0,3],[0,5],[14,5],[14,7],[0,7],[0,9],[14,9]],
    gate:{name:'왕성 정문', tiers:2, base:'#9a9184', roof:'#5a4a3a', dc:'#b23a2c', arches:1, scale:1.05} },
  { id:'sipja', name:'수정 동굴', bg:'map2',
    corners:[[0,1],[4,1],[4,5],[8,5],[8,1],[12,1],[12,6],[14,6],[14,8],[2,8],[2,10],[14,10]],
    gate:{name:'수정 관문', tiers:1, base:'#9a9184', roof:'#3f6f7a', dc:'#2f7a5f', arches:1, scale:1.18} },
  { id:'nagseon', name:'잿빛 협곡', bg:'map3',
    corners:[[0,1],[14,1],[14,9],[2,9],[2,3],[12,3],[12,7],[5,7],[5,5],[9,5]],
    gate:{name:'돌성문', tiers:1, base:'#8f877a', roof:'#3a3a42', dc:'#c8442e', arches:3, scale:1.12} },
  { id:'eotgal', name:'폐허의 숲', bg:'map4',
    corners:[[0,2],[11,2],[11,5],[3,5],[3,8],[14,8],[14,10],[6,10],[6,6],[0,6]],
    gate:{name:'고대 성채', tiers:1, base:'#a59c8c', roof:'#4a5a3a', dc:'#5d7a4f', arches:1, scale:0.92} },
  { id:'jangmun', name:'망자의 길', bg:'map3',
    corners:[[0,10],[2,10],[2,1],[5,1],[5,10],[8,10],[8,1],[11,1],[11,10],[14,10],[14,4]],
    gate:{name:'망자의 문', tiers:1, base:'#7d756a', roof:'#3a3a42', dc:'#8a6a3a', arches:1, scale:0.86} },
];
const REF_COLS=15, REF_ROWS=11;
let curMap=MAPS[0];
let PATH=[], BLOCKED=new Set();
function key(c,r){return c+','+r;}

function buildPath(){
  PATH=[]; BLOCKED.clear();
  const sx=(COLS-1)/(REF_COLS-1), sy=(ROWS-1)/(REF_ROWS-1);
  const C=curMap.corners.map(([c,r])=>[
    Math.round(c*sx), Math.min(ROWS-1,Math.max(0,Math.round(r*sy)))
  ]);
  for(let i=0;i<C.length;i++){
    const [c0,r0]=C[i];
    if(i===0){ PATH.push([c0,r0]); continue; }
    const [pc,pr]=C[i-1];
    if(c0!==pc){ const step=c0>pc?1:-1; for(let c=pc+step;c!==c0+step;c+=step) PATH.push([c,r0]); }
    else if(r0!==pr){ const step=r0>pr?1:-1; for(let r=pr+step;r!==r0+step;r+=step) PATH.push([c0,r]); }
  }
  PATH=PATH.filter((p,i)=>i===0||p[0]!==PATH[i-1][0]||p[1]!==PATH[i-1][1]);
  PATH.forEach(p=>BLOCKED.add(key(p[0],p[1])));
  WP=C.map(([c,r])=>cellCenter(c,r));
  PLEN=0; SEG=[];
  for(let i=1;i<WP.length;i++){const a=WP[i-1],b=WP[i];const d=Math.hypot(b.x-a.x,b.y-a.y);SEG.push({a,b,d,s:PLEN});PLEN+=d;}
}
function pickMap(){ curMap=MAPS[Math.floor(Math.random()*MAPS.length)]; buildPath(); }
let WP=[],SEG=[],PLEN=0;
function cellCenter(c,r){return {x:OX+c*CELL+CELL/2, y:OY+r*CELL+CELL/2};}
function posAt(dist){
  if(dist<=0)return {...WP[0],ang:0};
  for(const s of SEG){ if(dist<=s.s+s.d){const t=(dist-s.s)/s.d;
    return {x:s.a.x+(s.b.x-s.a.x)*t, y:s.a.y+(s.b.y-s.a.y)*t, ang:Math.atan2(s.b.y-s.a.y,s.b.x-s.a.x)};}}
  return {...WP[WP.length-1],ang:0};
}

// ---------- tower defs ----------
const TOWERS={
  jangseung:{name:'궁수탑',cost:50,range:2.4,rate:0.8,dmg:14,col:'#c8442e',kind:'single',unlocked:true,sprite:'t_archer',unit:'u_archer',
    desc:'길목을 지키는 궁수. 단일 대상 명중.'},
  kkachi:{name:'석궁탑',cost:70,range:3.0,rate:0.35,dmg:5,col:'#2f6f8f',kind:'single',unlocked:true,sprite:'t_ballista',unit:'u_knight',
    desc:'빠른 연사. 약하지만 끊임없이 쏜다.'},
  bul:{name:'흑마법탑',cost:90,range:1.9,rate:1.3,dmg:9,col:'#e0a82e',kind:'splash',splash:1.3,unlocked:false,sprite:'t_dark',
    desc:'범위 화염 마법. 뭉친 무리에 강하다.'},
  seori:{name:'빙결탑',cost:80,range:2.6,rate:1.1,dmg:4,col:'#7fb3c8',kind:'slow',slow:0.45,slowT:1.6,unlocked:false,sprite:'t_frost',
    desc:'적을 얼려 둔화. 피해는 적다.'},
  beom:{name:'전사 병영',cost:140,range:3.2,rate:1.6,dmg:42,col:'#9a3b22',kind:'single',unlocked:false,sprite:'t_camp',unit:'u_knight',
    desc:'일격필살의 대물. 느리지만 묵직하다.'},
};
const ORDER=['jangseung','kkachi','bul','seori','beom'];

// ---------- upgrade system (per-stat, independent) ----------
const MAXSTEP=5;                 // each stat upgradable 0..5
const STEP={dmg:0.30, rate:0.10, range:0.10, splash:0.12}; // base-fraction per step
const STAT_COSTF={dmg:0.55, rate:0.55, range:0.40, splash:0.45}; // ×base cost
const GROWTH=1.6;                // cost grows per step already bought (만렙 비용↑ → 타워 난사 억제)
// which stats each tower kind can upgrade
function statsFor(id){ const def=TOWERS[id];
  return def.kind==='splash'? ['dmg','rate','range','splash'] : ['dmg','rate','range']; }
// t.up = {dmg:0..5, rate:0, range:0, splash:0}
function lvl(t,stat){ return (t.up&&t.up[stat])||0; }
function statVal(def,stat,lv){
  if(stat==='rate')  return def.rate*(1-STEP.rate*lv);     // cooldown ↓ = faster
  if(stat==='splash')return (def.splash||0)*(1+STEP.splash*lv);
  return def[stat]*(1+STEP[stat]*lv);
}
function towerStat(t){
  const def=TOWERS[t.id];
  return {
    dmg:   statVal(def,'dmg',  lvl(t,'dmg')),
    range: statVal(def,'range',lvl(t,'range')),
    rate:  statVal(def,'rate', lvl(t,'rate')),
    splash:def.splash? statVal(def,'splash',lvl(t,'splash')):0,
  };
}
function stepCost(t,stat){ const def=TOWERS[t.id]; const cur=lvl(t,stat);
  if(cur>=MAXSTEP)return null;
  return Math.round(def.cost*STAT_COSTF[stat]*Math.pow(GROWTH,cur)); }
function totalSpent(t){ const def=TOWERS[t.id]; let spent=def.cost;
  for(const st of statsFor(t.id)){ for(let l=0;l<lvl(t,st);l++)
    spent+=Math.round(def.cost*STAT_COSTF[st]*Math.pow(GROWTH,l)); }
  return spent; }
function sellValue(t){ return Math.round(totalSpent(t)*0.6); }
function totalLevels(t){ let n=0; for(const st of statsFor(t.id)) n+=lvl(t,st); return n; }

// ---------- branch upgrades (path split at high level) ----------
const BRANCH_REQ=8; // total stat levels needed to unlock a branch choice
const BRANCHES={
  jangseung:[
    {id:'pierce', name:'관통', desc:'한 발이 적 2명을 꿰뚫는다.'},
    {id:'execute',name:'처형', desc:'체력 20% 이하 적을 즉시 처단한다.'},
  ],
  kkachi:[
    {id:'chain',  name:'연쇄', desc:'명중 시 근처 적에게 한 번 튕긴다.'},
    {id:'mark',   name:'약점', desc:'맞은 적이 받는 모든 피해 +25%.'},
  ],
  bul:[
    {id:'burn',   name:'화상', desc:'불이 붙어 2초간 지속 피해를 준다.'},
    {id:'blast',  name:'대폭발',desc:'폭발 범위가 크게 넓어진다.'},
  ],
  seori:[
    {id:'freeze', name:'빙결', desc:'25% 확률로 적을 완전히 얼린다.'},
    {id:'spread', name:'서리', desc:'둔화가 주변 적에게도 번진다.'},
  ],
  beom:[
    {id:'sunder', name:'방어무시',desc:'적의 방어력을 완전히 무시한다.'},
    {id:'roar',   name:'포효', desc:'처치 시 주변 적에게 피해가 터진다.'},
  ],
};
function branchCost(t){ const def=TOWERS[t.id]; return Math.round(def.cost*1.6); }
function canChooseBranch(t){ return !t.branch && totalLevels(t)>=BRANCH_REQ; }


// ---------- state ----------
let G;
function newGame(){
  const me=metaEffects();
  G={gold:120+me.startGold, life:20+me.startLife, maxLife:20+me.startLife, wave:0, running:true, inWave:false,
    towers:[],enemies:[],bullets:[],particles:[],
    spawnQ:[],spawnT:0, sel:null, panelT:null,
    buffs:{dmg:me.dmgMul, rate:1, range:1, gold:1},
    best:+(localStorage.getItem('dokkaebi_best')||0)};
  pickMap(); syncTray(); updateHUD(); closePanel();
}

// ---------- enemies ----------
// 적 spd는 "셀 36px" 기준 px/s. 화면이 커지면 CELL/SPD_REF로 비례 스케일해서
// (반지름이 ×CELL인 것과 동일하게) 화면 크기와 무관하게 보드 대비 속도를 일정하게 유지.
// → 큰 화면에서 적이 겹쳐 나오거나, 골인 지점까지 못 가서 문이 안 깎이던 문제 해결.
const SPD_REF=36;
const ETYPES={
  jab:{hp:34,spd:46,r:.30,col:'#6b5d8a',gold:6,name:'고블린',sprite:'goblin'},
  fast:{hp:22,spd:82,r:.26,col:'#4f8a6b',gold:7,name:'그림자 박쥐',sprite:'bat'},
  tank:{hp:120,spd:30,r:.40,col:'#8a4f4f',gold:14,name:'오우거',sprite:'ogre'},
  gold:{hp:50,spd:60,r:.32,col:'#e0a82e',gold:40,name:'보물 임프',sprite:'imp'},
  split:{hp:46,spd:50,r:.34,col:'#7a8a4f',gold:9,name:'분열 고블린',splits:true,sprite:'darkgob'},
  // ---- late-game ----
  armor:{hp:140,spd:34,r:.40,col:'#5b6b78',gold:22,name:'중갑병',armor:7,sprite:'brute'},      // flat armor per hit → rewards high damage
  swift:{hp:60,spd:120,r:.27,col:'#c25a8a',gold:20,name:'광전사 오크',sprite:'orc'},               // very fast → rewards rate/range
  heal:{hp:90,spd:42,r:.36,col:'#5f9a6b',gold:18,name:'주술사',regen:14,sprite:'king'},        // self-heal → rewards burst/splash
  yeti:{hp:130,spd:70,r:.38,col:'#b9c0c4',gold:18,name:'설인',regen:10,sprite:'yeti'},          // 빠르고 자가회복하는 거구
  axer:{hp:240,spd:34,r:.42,col:'#3f7a8a',gold:30,name:'푸른 도끼병',armor:6,sprite:'axer'},     // 중장 브루저(고체력+방어)
  boss:{hp:1400,spd:24,r:.62,col:'#7a2f55',gold:160,name:'마왕',armor:5,boss:true,sprite:'boss'}, // huge HP wall
};
// HP scaling per wave: 10웨이브까진 선형(초반 난이도 유지), 이후 준지수로 급상승.
// 플레이어 화력이 카드/업글로 곱셈 성장하므로 적 체력도 후반엔 곱셈으로 따라붙어
// '맵 앞에서 전멸'하는 추월 지점을 크게 뒤로 민다.
function hpScale(n){ return 1 + n*0.14 + (n>10 ? Math.pow(1.15, n-10)-1 : 0); }
function buildWave(n){
  const q=[]; const budget=8+n*6; let b=budget;
  const pool=['jab'];
  if(n>=2)pool.push('fast'); if(n>=4)pool.push('tank');
  if(n>=3)pool.push('split');
  if(n>=6)pool.push('armor');
  if(n>=8)pool.push('swift');
  if(n>=9)pool.push('yeti');
  if(n>=10)pool.push('heal');
  if(n>=11)pool.push('axer');
  const costs={jab:2,fast:2,tank:5,split:3,armor:6,swift:4,heal:5,yeti:5,axer:8};
  while(b>0){
    let t=pool[Math.floor(Math.random()*pool.length)];
    const cost=costs[t]||2;
    if(cost>b)t='jab';
    q.push(t); b-=(costs[t]||2);
  }
  if(n%4===0) q.splice(Math.floor(q.length/2),0,'gold'); // treat wave
  if(n>=12 && n%5===0){ q.push('boss'); } // boss every 5th wave from 12+
  return q;
}
const BOSS_SPRITES=['boss','boss2','boss3','boss4'];
function spawnEnemy(type){
  const base=ETYPES[type];
  const s=hpScale(G.wave);
  // 보스는 등장할 때마다 4종을 순환 (마왕·돌 골렘·해골 기사·심연의 군주)
  const sprite = base.boss ? BOSS_SPRITES[Math.floor(G.wave/5)%4] : base.sprite;
  G.enemies.push({type,x:WP[0].x,y:WP[0].y,dist:0,
    hp:base.hp*s, max:base.hp*s, spd:base.spd*(1+G.wave*0.018),
    r:base.r*CELL, col:base.col, gold:base.gold, name:base.name,
    splits:base.splits, armor:base.armor||0, regen:base.regen||0, boss:base.boss||false,
    sprite, seed:Math.floor(Math.random()*10),
    slowT:0, slowF:1, ang:0, burn:0, burnT:0, burnDmg:0, mark:0});
}

function startWave(){
  if(G.inWave)return;
  G.wave++; G.inWave=true;
  G.spawnQ=buildWave(G.wave); G.spawnT=0;
  updateHUD();
  SND.wave();
  toast('물결 '+G.wave+' — '+G.spawnQ.length+'마리');
}

// ---------- towers placement ----------
function syncTray(){
  const tray=$('tray'); tray.innerHTML='';
  ORDER.forEach(id=>{
    const t=TOWERS[id];
    const b=document.createElement('div');
    b.className='twrbtn'+(t.unlocked?'':' locked')+(G&&G.sel===id?' sel':'');
    b.innerHTML=towerSVG(id,38)+'<div class="nm">'+t.name+'</div><div class="cost">'+(t.unlocked?('금화 '+t.cost):'잠김')+'</div>';
    b.onclick=()=>{ if(!t.unlocked){toast('아직 잠긴 방어탑');return;}
      G.sel=(G.sel===id?null:id); closePanel(); syncTray(); };
    tray.appendChild(b);
  });
}
function placeAt(px,py){
  const c=Math.floor((px-OX)/CELL), r=Math.floor((py-OY)/CELL);
  if(c<0||c>=COLS||r<0||r>=ROWS){ closePanel(); return; }
  const existing=G.towers.find(t=>t.c===c&&t.r===r);
  if(!G.sel){
    // selection empty → tap a tower to manage it
    if(existing){ openPanel(existing); }
    else { closePanel(); }
    return;
  }
  if(BLOCKED.has(key(c,r))){toast('길 위엔 못 세운다');return;}
  if(existing){toast('이미 자리 있음');return;}
  const def=TOWERS[G.sel];
  if(G.gold<def.cost){toast('금화이 부족하다');return;}
  G.gold-=def.cost;
  G.towers.push({id:G.sel,c,r,...cellCenter(c,r),cd:0,ang:0,up:{dmg:0,rate:0,range:0,splash:0},branch:null});
  SND.place();
  updateHUD();
}

// ---------- combat ----------
function update(dt){
  if(!G.running)return;
  if(G.gateHurt>0) G.gateHurt-=dt;   // 성문 피격 번쩍임 감쇠
  // spawn
  if(G.inWave){
    G.spawnT-=dt;
    if(G.spawnQ.length && G.spawnT<=0){ spawnEnemy(G.spawnQ.shift()); G.spawnT=Math.max(0.35,0.9-G.wave*0.02);}
    if(G.spawnQ.length===0 && G.enemies.length===0){ endWave(); }
  }
  // enemies move
  for(const e of G.enemies){
    if(e.slowT>0){e.slowT-=dt; if(e.slowT<=0)e.slowF=1;}
    if(e.regen>0 && e.hp<e.max && !e.dead){ e.hp=Math.min(e.max, e.hp+e.regen*dt); }
    const sp=e.spd*e.slowF*(CELL/SPD_REF); // 속도를 셀 크기에 비례 → 화면 커져도 일관
    e.dist+=sp*dt;
    const p=posAt(e.dist); e.x=p.x; e.y=p.y; e.ang=p.ang;
    if(e.dist>=PLEN){ e.dead=true; G.life-=(e.boss?5:1); G.gateHurt=0.45; spawnHit(e.x,e.y,'#c8442e',e.boss?12:6); SND.hurtLife(); updateHUD();
      if(G.life<=0){gameOver();return;} }
  }
  // towers fire
  for(const t of G.towers){
    const def=TOWERS[t.id];
    const st=towerStat(t);
    t.cd-=dt;
    if(t.atk>0) t.atk-=dt/0.18;   // 공격 모션 감쇠 (~0.18초)
    const rng=st.range*CELL*G.buffs.range;
    // target = furthest along path in range
    let tgt=null,bd=-1;
    for(const e of G.enemies){ if(e.dead)continue;
      const d=Math.hypot(e.x-t.x,e.y-t.y);
      if(d<=rng && e.dist>bd){bd=e.dist;tgt=e;} }
    if(t.id==='bul'){
      // 불도깨비: continuous flamethrower — sprays a cone, no projectile
      t.flame=t.flame||0;
      if(tgt){
        t.ang=Math.atan2(tgt.y-t.y,tgt.x-t.x);
        t.flame=Math.min(1,t.flame+dt*4);            // ramp up
        // flamethrower hiss (throttled so it loops smoothly)
        t.fsnd=(t.fsnd||0)-dt; if(t.fsnd<=0){ t.fsnd=0.14; noise(0.16,0.05,1100); }
        const dps=(st.dmg*G.buffs.dmg)/0.9;          // continuous dmg/sec ≈ original
        const coneR=rng*0.95, half=0.42;             // cone reach & half-angle
        for(const e of G.enemies){ if(e.dead)continue;
          const dx=e.x-t.x, dy=e.y-t.y, d=Math.hypot(dx,dy);
          if(d>coneR) continue;
          let da=Math.atan2(dy,dx)-t.ang;
          da=Math.atan2(Math.sin(da),Math.cos(da));
          if(Math.abs(da)<=half){
            dealDamage(e, dps*dt, {ignoreArmor:false});
            if(t.branch==='burn' && !e.dead){ e.burn=1; e.burnT=2; e.burnDmg=st.dmg*0.4; }
          }
        }
      } else {
        t.flame=Math.max(0,t.flame-dt*3);            // fade out
      }
    } else if(tgt){ t.ang=Math.atan2(tgt.y-t.y,tgt.x-t.x);
      if(t.cd<=0){ t.cd=st.rate/G.buffs.rate; fire(t,def,tgt,st); } }
  }
  // damage-over-time (burn) ticks
  for(const e of G.enemies){ if(e.dead)continue;
    if(e.burn>0){ e.burnT-=dt;
      e.hp-=e.burnDmg*dt;
      if(e.burnT<=0)e.burn=0;
      if(e.hp<=0 && !e.dead){ killEnemy(e); }
    }
  }
  // bullets
  for(const b of G.bullets){
    b.t+=dt; const k=Math.min(1,b.t/b.dur);
    b.x=b.sx+(b.tx-b.sx)*k; b.y=b.sy+(b.ty-b.sy)*k;
    if(k>=1){ b.dead=true; applyHit(b); }
  }
  // particles
  for(const p of G.particles){ p.t+=dt; p.x+=p.vx*dt; p.y+=p.vy*dt;
    if(p.shape!=='ring'&&p.shape!=='coin'&&p.shape!=='star') p.vy+=120*dt;
    else if(p.shape==='star') p.vy+=40*dt;
    if(p.t>=p.life)p.dead=true; }
  G.enemies=G.enemies.filter(e=>!e.dead);
  G.bullets=G.bullets.filter(b=>!b.dead);
  G.particles=G.particles.filter(p=>!p.dead);
}
function fire(t,def,tgt,st){
  G.bullets.push({sx:t.x,sy:t.y,x:t.x,y:t.y,tx:tgt.x,ty:tgt.y,t:0,dur:0.12,
    col:def.col,def,tid:t.id,tgtRef:tgt,dmg:st.dmg,splash:st.splash,br:t.branch,twr:t});
  t.atk=1;            // 사수 공격 모션 트리거 (반동)
  SND.shoot(t.id);
}
// branch-aware damage: marks add bonus, sunder ignores armor
function dealDamage(e,dmg,opts){
  opts=opts||{};
  if(e.mark>0){ dmg*=1.25; e.mark=0; }  // 약점: consumed on next hit
  if(!opts.ignoreArmor && e.armor>0){ dmg=Math.max(dmg*0.1, dmg-e.armor); }
  e.hp-=dmg;
  if(e.hp<=0 && !e.dead){ killEnemy(e,opts); }
}
function killEnemy(e,opts){
  if(e.dead)return; opts=opts||{};
  e.dead=true;
  const g=Math.round(e.gold*G.buffs.gold); G.gold+=g;
  spawnDeath(e.x,e.y,e.col,e.boss);
  SND.kill(e.boss);
  // floating coin number
  G.particles.push({x:e.x,y:e.y-e.r,vx:0,vy:-40,t:0,life:0.8,col:'#e0a82e',shape:'coin',txt:'+'+g});
  if(e.boss) toast('마왕 처치! +'+g);
  // 포효: roar deals splash damage to nearby on kill
  if(opts.roar){
    const R=CELL*1.4;
    G.particles.push({x:e.x,y:e.y,vx:0,vy:0,t:0,life:0.4,col:'#9a3b22',shape:'ring',r0:R*0.7});
    for(const o of G.enemies){ if(o.dead||o===e)continue;
      if(Math.hypot(o.x-e.x,o.y-e.y)<=R){ dealDamage(o, opts.roarDmg||20, {}); } }
  }
  if(e.splits && e.max>20){
    for(let i=0;i<2;i++){ const n={...e,dead:false,splits:false,burn:0,mark:0,
      hp:e.max*0.35,max:e.max*0.35,r:e.r*0.7,dist:Math.max(0,e.dist-CELL*0.3*(i?1:-1)),gold:3};
      G.enemies.push(n); } }
  updateHUD();
}
function applyHit(b){
  const def=b.def; const br=b.br;
  let dmg=(b.dmg!=null?b.dmg:def.dmg)*G.buffs.dmg;
  if(def.kind==='splash'){
    let R=(b.splash||def.splash)*CELL;
    if(br==='blast') R*=1.7;             // 대폭발: bigger radius
    for(const e of G.enemies){ if(e.dead)continue;
      if(Math.hypot(e.x-b.x,e.y-b.y)<=R){
        dealDamage(e,dmg,{});
        if(br==='burn' && !e.dead){ e.burn=1; e.burnT=2; e.burnDmg=dmg*0.4; }
      } }
    spawnHit(b.x,b.y,def.col,10);
    G.particles.push({x:b.x,y:b.y,vx:0,vy:0,t:0,life:0.35,col:def.col,shape:'ring',r0:R*0.5});
  } else {
    const e=b.tgtRef;
    if(e&&!e.dead){
      // 처형: execute low-hp targets outright
      if(br==='execute' && e.hp/e.max<=0.2 && !e.boss){ killEnemy(e,{}); }
      else {
        dealDamage(e,dmg,{ignoreArmor:br==='sunder',
          roar:br==='roar', roarDmg:dmg*0.5});
        if(br==='mark' && !e.dead){ e.mark=1; }     // 약점 노출
      }
      if(def.kind==='slow' && e&&!e.dead){
        e.slowF=def.slow; e.slowT=def.slowT;
        if(br==='freeze' && Math.random()<0.25){ e.slowF=0; e.slowT=Math.max(e.slowT,1.2); } // 빙결
        if(br==='spread'){ // 서리 확산
          for(const o of G.enemies){ if(o.dead||o===e)continue;
            if(Math.hypot(o.x-e.x,o.y-e.y)<=CELL*1.3){ o.slowF=def.slow; o.slowT=def.slowT; } }
        }
      }
      // 관통: pierce a second enemy behind
      if(br==='pierce'){
        let second=null,bd=-1;
        for(const o of G.enemies){ if(o.dead||o===e)continue;
          if(Math.hypot(o.x-e.x,o.y-e.y)<=CELL*1.1 && o.dist>bd){bd=o.dist;second=o;} }
        if(second) dealDamage(second,dmg,{});
      }
      // 연쇄: chain bounce to a nearby enemy
      if(br==='chain'){
        let near=null,nd=1e9;
        for(const o of G.enemies){ if(o.dead||o===e)continue;
          const d=Math.hypot(o.x-e.x,o.y-e.y);
          if(d<=CELL*1.6 && d<nd){nd=d;near=o;} }
        if(near){ dealDamage(near,dmg*0.7,{}); spawnHit(near.x,near.y,def.col,3); }
      }
    }
    spawnHit(b.x,b.y,def.col,5);
  }
}
// legacy hurt kept for any external callers → routes through dealDamage
function hurt(e,dmg){ dealDamage(e,dmg,{}); }
function spawnHit(x,y,col,n){
  for(let i=0;i<n;i++){const a=Math.random()*6.28,s=30+Math.random()*70;
    G.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-20,t:0,life:0.4+Math.random()*0.3,col,shape:'spark',size:2});}
}
// rich death burst: shockwave ring + outward sparks + drifting embers
function spawnDeath(x,y,col,big){
  const N=big?22:12;
  // 벡터 폭발 스프라이트 (한 번 재생)
  if(FX_BURST.length) G.particles.push({x,y,vx:0,vy:0,t:0,life:big?0.55:0.4,shape:'fx',frames:FX_BURST,size:(big?2.6:1.5)*CELL});
  // shockwave ring
  G.particles.push({x,y,vx:0,vy:0,t:0,life:big?0.5:0.35,col:'#fff7e8',shape:'ring',r0:big?CELL*0.5:CELL*0.3});
  G.particles.push({x,y,vx:0,vy:0,t:0,life:big?0.6:0.4,col,shape:'ring',r0:big?CELL*0.35:CELL*0.2});
  for(let i=0;i<N;i++){const a=Math.random()*6.28,s=60+Math.random()*(big?160:110);
    G.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-30,t:0,life:0.45+Math.random()*0.4,col,
      shape:Math.random()<0.4?'spark':'chip',size:big?3:2});}
  if(big){ for(let i=0;i<6;i++){const a=Math.random()*6.28,s=20+Math.random()*50;
    G.particles.push({x,y,vx:Math.cos(a)*s,vy:-40-Math.random()*40,t:0,life:0.8,col:'#e0a82e',shape:'star',size:4});} }
}
// upgrade flourish: golden ring + rising sparkles
function spawnUpgrade(x,y){
  G.particles.push({x,y,vx:0,vy:0,t:0,life:0.5,col:'#e0a82e',shape:'ring',r0:CELL*0.4});
  for(let i=0;i<14;i++){const a=Math.random()*6.28,s=30+Math.random()*60;
    G.particles.push({x,y,vx:Math.cos(a)*s*0.5,vy:-50-Math.random()*70,t:0,life:0.6+Math.random()*0.4,
      col:Math.random()<0.5?'#e0a82e':'#fff3c0',shape:'star',size:3+Math.random()*2});}
}
// branch choice flourish: bigger, two-tone
function spawnBranchFx(x,y,col){
  G.particles.push({x,y,vx:0,vy:0,t:0,life:0.6,col:'#fff7e8',shape:'ring',r0:CELL*0.5});
  G.particles.push({x,y,vx:0,vy:0,t:0,life:0.75,col,shape:'ring',r0:CELL*0.35});
  for(let i=0;i<20;i++){const a=Math.random()*6.28,s=50+Math.random()*100;
    G.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-40,t:0,life:0.6+Math.random()*0.5,
      col:Math.random()<0.5?col:'#e0a82e',shape:'star',size:3+Math.random()*3});}
}

// ---------- wave end / cards ----------
function endWave(){
  G.inWave=false;
  const bonus=10+G.wave*2; G.gold+=bonus;
  if(G.wave>G.best){G.best=G.wave; localStorage.setItem('dokkaebi_best',G.best);}
  updateHUD();
  showCards();
}
const CARDPOOL=[
  {t:'예리한 부적',d:'모든 방어탑 피해 +10%',tag:'강화',rare:0,svg:'dmg',act:()=>G.buffs.dmg*=1.10},
  {t:'바람 신발',d:'모든 방어탑 공격속도 +8%',tag:'강화',rare:0,svg:'rate',act:()=>G.buffs.rate*=1.08},
  {t:'천리안',d:'모든 방어탑 사거리 +8%',tag:'강화',rare:0,svg:'range',act:()=>G.buffs.range*=1.08},
  {t:'금화 주머니',d:'처치 보상 +15%, 금화 40 즉시',tag:'재화',rare:0,svg:'gold',act:()=>{G.buffs.gold*=1.15;G.gold+=40;}},
  {t:'성벽 보수',d:'성문 생명 +6 회복',tag:'수호',rare:0,svg:'life',act:()=>{G.life+=6;}},
];
function unlockCard(id){const t=TOWERS[id];return {t:t.name+' 해금',d:t.desc,tag:'방어탑',rare:1,svg:id,act:()=>{t.unlocked=true;syncTray();}};}
function showCards(){
  closePanel();
  const choices=[];
  // offer an unlock if available
  const locked=ORDER.filter(id=>!TOWERS[id].unlocked);
  if(locked.length && G.wave>=2 && Math.random()<0.75){
    choices.push(unlockCard(locked[0]));
  }
  const pool=[...CARDPOOL];
  while(choices.length<3 && pool.length){
    choices.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
  }
  const crow=$('crow'); crow.innerHTML='';
  choices.forEach(c=>{
    const el=document.createElement('div'); el.className='card';
    el.innerHTML=cardSVG(c.svg)+'<div class="ct">'+c.t+'</div><div class="cd">'+c.d+'</div>'+
      '<span class="tag'+(c.rare?' rare':'')+'">'+c.tag+'</span>';
    el.onclick=()=>{ SND.card(); c.act(); $('cards').style.display='none'; updateHUD();
      setTimeout(startWave,300); };
    crow.appendChild(el);
  });
  $('cards').style.display='flex';
}

// ---------- rendering ----------
function draw(){
  ctx.clearRect(0,0,W,H);
  drawGround();
  drawPath();
  // range hint when selecting & hovering handled on pointer
  for(const t of G.towers) drawTower(t);
  for(const e of G.enemies) drawEnemy(e);
  for(const b of G.bullets) drawBullet(b);
  for(const p of G.particles) drawParticle(p);
  if(G.sel&&hover){ drawPlaceHint(); }
}
const ARROW_TOWERS={jangseung:1,kkachi:1,beom:1};
function drawBullet(b){
  const def=b.def, id=b.tid, ang=Math.atan2(b.ty-b.sy,b.tx-b.sx);
  const R=CELL*0.10;
  // 빙결탑 → 얼음 크리스탈 발사체
  const ice=IMG.ice;
  if(id==='seori' && imgReady(ice)){
    const h=CELL*0.42, w=h*(ice.naturalWidth/ice.naturalHeight);
    ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(ang+Math.PI/2);
    ctx.drawImage(ice,-w/2,-h/2,w,h); ctx.restore();
    return;
  }
  // 물리 발사체 — 탑마다 모양이 다름: 궁수=긴 화살 / 석궁=짧고 굵은 볼트 / 병영=묵직한 큰 화살
  const arrow=IMG.arrow;
  if(ARROW_TOWERS[id] && imgReady(arrow)){
    const h = id==='kkachi'? CELL*0.34 : id==='beom'? CELL*0.62 : CELL*0.5;
    const w = h*(arrow.naturalWidth/arrow.naturalHeight) * (id==='kkachi'? 2.1 : id==='beom'? 1.4 : 1);
    ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(ang+Math.PI/2);
    ctx.drawImage(arrow,-w/2,-h/2,w,h); ctx.restore();
    return;
  }
  ctx.save(); ctx.translate(b.x,b.y);
  if(id==='kkachi'){            // 까치: swift feather-dart with motion streak
    ctx.rotate(ang);
    ctx.strokeStyle=def.col+'88'; ctx.lineWidth=CELL*0.05; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(-CELL*0.28,0); ctx.lineTo(-CELL*0.04,0); ctx.stroke();
    ctx.fillStyle=def.col; ctx.strokeStyle='#1d3a47'; ctx.lineWidth=1.2;
    ctx.beginPath();
    ctx.moveTo(CELL*0.20,0); ctx.lineTo(-CELL*0.04,-CELL*0.09); ctx.lineTo(CELL*0.02,0); ctx.lineTo(-CELL*0.04,CELL*0.09);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if(id==='bul'){        // 불도깨비: flickering fireball with tail
    const fl=R*(1.6+Math.random()*0.5);
    ctx.fillStyle='#c8442e66';
    ctx.beginPath(); ctx.ellipse(-(b.x-b.sx)*0.05,-(b.y-b.sy)*0.05,fl*0.9,fl*0.5,ang,0,6.28); ctx.fill();
    const g=ctx.createRadialGradient(0,0,0,0,0,fl);
    g.addColorStop(0,'#fff7d0'); g.addColorStop(0.45,'#e0a82e'); g.addColorStop(1,'#c8442e');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,fl,0,6.28); ctx.fill();
  } else if(id==='seori'){      // 서리할멈: spinning frost crystal
    ctx.rotate(b.t*7); ctx.fillStyle='#dff1f8'; ctx.strokeStyle='#5f93a8'; ctx.lineWidth=1.5;
    ctx.beginPath(); for(let i=0;i<6;i++){const a=i*Math.PI/3; const rr=R*1.7;
      ctx[i?'lineTo':'moveTo'](Math.cos(a)*rr,Math.sin(a)*rr);} ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle='#7fb3c8'; ctx.lineWidth=1;
    for(let i=0;i<3;i++){const a=i*Math.PI/3; ctx.beginPath();
      ctx.moveTo(-Math.cos(a)*R*1.7,-Math.sin(a)*R*1.7); ctx.lineTo(Math.cos(a)*R*1.7,Math.sin(a)*R*1.7); ctx.stroke();}
  } else if(id==='beom'){       // 까치호랑이: heavy slug with long trail
    ctx.strokeStyle='#9a3b2255'; ctx.lineWidth=R*2.4; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(-(b.x-b.sx)*0.18,-(b.y-b.sy)*0.18); ctx.lineTo(0,0); ctx.stroke();
    ctx.fillStyle=def.col; ctx.strokeStyle='#241c16'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(0,0,R*1.9,0,6.28); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#ffffff55'; ctx.beginPath(); ctx.arc(-R*0.5,-R*0.5,R*0.5,0,6.28); ctx.fill();
  } else {                       // 장승: solid stone shot
    ctx.fillStyle=def?def.col:'#c8442e'; ctx.strokeStyle='#241c16'; ctx.lineWidth=1.8;
    ctx.beginPath(); ctx.arc(0,0,R*1.5,0,6.28); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#ffffff44'; ctx.beginPath(); ctx.arc(-R*0.4,-R*0.4,R*0.45,0,6.28); ctx.fill();
  }
  ctx.restore();
}
function drawParticle(p){
  const a=1-p.t/p.life; ctx.globalAlpha=Math.max(0,a);
  if(p.shape==='fx'){
    const fr=p.frames, idx=Math.min(fr.length-1,Math.floor((p.t/p.life)*fr.length)), im=fr[idx];
    ctx.globalAlpha=1;
    if(imgReady(im)) ctx.drawImage(im, p.x-p.size/2, p.y-p.size/2, p.size, p.size);
    ctx.globalAlpha=1; return;
  }
  if(p.shape==='ring'){
    ctx.strokeStyle=p.col; ctx.lineWidth=Math.max(1,p.r0*0.3*(1-a)+1);
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r0*(1+(1-a)*2.2),0,6.28); ctx.stroke();
  } else if(p.shape==='spark'){
    ctx.strokeStyle=p.col; ctx.lineWidth=2; ctx.lineCap='round';
    const vx=p.vx*0.04, vy=p.vy*0.04;
    ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p.x-vx,p.y-vy); ctx.stroke();
  } else if(p.shape==='star'){
    ctx.fillStyle=p.col; ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.t*8);
    const s=p.size||3; ctx.beginPath();
    for(let k=0;k<4;k++){const a2=k*Math.PI/2; ctx.lineTo(Math.cos(a2)*s,Math.sin(a2)*s); ctx.lineTo(Math.cos(a2+0.785)*s*0.4,Math.sin(a2+0.785)*s*0.4);} 
    ctx.closePath(); ctx.fill(); ctx.restore();
  } else if(p.shape==='coin'){
    ctx.fillStyle='#e0a82e'; ctx.strokeStyle='#241c16'; ctx.lineWidth=2.5;
    ctx.font='bold '+Math.round(CELL*0.3)+'px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.strokeText(p.txt,p.x,p.y); ctx.fillText(p.txt,p.x,p.y);
  } else if(p.shape==='chip'){
    ctx.fillStyle=p.col; ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.t*10);
    const s=p.size||2; ctx.fillRect(-s,-s,s*2,s*2); ctx.restore();
  } else {
    ctx.fillStyle=p.col; const s=p.size||2; ctx.fillRect(p.x-s,p.y-s,s*2,s*2);
  }
  ctx.globalAlpha=1;
}
function drawGround(){
  // illustrated map background (cover-fit, fills the stage)
  const im=IMG[(curMap&&curMap.bg)||'map1'];
  if(imgReady(im)){
    const ir=im.naturalWidth/im.naturalHeight, sr=W/H;
    let dw,dh; if(sr>ir){ dw=W; dh=W/ir; } else { dh=H; dw=H*ir; }
    ctx.drawImage(im,(W-dw)/2,(H-dh)/2,dw,dh);
  } else {
    ctx.fillStyle='#e3d6ba'; ctx.fillRect(0,0,W,H);
  }
}
function drawPath(){
  ctx.lineCap='round'; ctx.lineJoin='round';
  // worn lane over the illustrated map — translucent so the art shows through
  ctx.globalAlpha=.28; ctx.strokeStyle='#3a2a18'; ctx.lineWidth=CELL*0.78;
  strokePath(); ctx.globalAlpha=1;
  ctx.globalAlpha=.5; ctx.strokeStyle='#e8d9b5'; ctx.lineWidth=CELL*0.5; ctx.setLineDash([CELL*0.05,CELL*0.28]);
  strokePath(); ctx.globalAlpha=1; ctx.setLineDash([]);
  // gate at end — 성문(광화문풍): 석축 + 홍예문 + 단청 문루 + 기와지붕
  drawGate(WP[WP.length-1]);
  // 출발지: 잡귀가 기어나오는 도깨비굴
  drawSpawn(WP[0]);
}
function strokePath(){ctx.beginPath();ctx.moveTo(WP[0].x,WP[0].y);for(let i=1;i<WP.length;i++)ctx.lineTo(WP[i].x,WP[i].y);ctx.stroke();}
// 출발지: 도깨비굴(귀문) — 어두운 바위굴 입구 + 맥동하는 포털 빛 + 떠다니는 도깨비불
function drawSpawn(s){
  const u=CELL, cx=s.x, cy=s.y, T=performance.now()/1000;
  const pulse=0.5+0.5*Math.sin(T*2.2);          // 0~1 맥동
  ctx.save();
  // 바닥 그림자
  ctx.fillStyle='#00000028';
  ctx.beginPath(); ctx.ellipse(cx,cy+u*0.42,u*0.6,u*0.2,0,0,6.28); ctx.fill();
  // 으스스한 외곽 광채 (보라/청록)
  const halo=ctx.createRadialGradient(cx,cy,u*0.1,cx,cy,u*0.85);
  halo.addColorStop(0,'rgba(95,200,170,'+(0.30+pulse*0.22)+')');
  halo.addColorStop(0.5,'rgba(80,120,160,0.12)');
  halo.addColorStop(1,'rgba(80,120,160,0)');
  ctx.fillStyle=halo; ctx.beginPath(); ctx.arc(cx,cy,u*0.85,0,6.28); ctx.fill();
  // 바위 둔덕
  ctx.fillStyle='#332b38'; ctx.strokeStyle='#1d1726'; ctx.lineWidth=Math.max(1,u*0.03);
  ctx.beginPath();
  ctx.moveTo(cx-u*0.52,cy+u*0.38);
  ctx.quadraticCurveTo(cx-u*0.6,cy-u*0.5, cx,cy-u*0.56);
  ctx.quadraticCurveTo(cx+u*0.6,cy-u*0.5, cx+u*0.52,cy+u*0.38);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // 바위 균열/질감
  ctx.strokeStyle='#00000033'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(cx-u*0.3,cy-u*0.1); ctx.lineTo(cx-u*0.42,cy+u*0.3); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx+u*0.28,cy-u*0.18); ctx.lineTo(cx+u*0.4,cy+u*0.2); ctx.stroke();
  // 동굴 입구(아치)
  const mw=u*0.28, mTop=cy-u*0.12, mBot=cy+u*0.36;
  ctx.beginPath();
  ctx.moveTo(cx-mw,mBot); ctx.lineTo(cx-mw,mTop);
  ctx.arc(cx,mTop,mw,Math.PI,0); ctx.lineTo(cx+mw,mBot); ctx.closePath();
  // 입구 안쪽: 맥동하는 포털 빛 (안으로 갈수록 어두움)
  const portal=ctx.createRadialGradient(cx,cy+u*0.1,u*0.02,cx,cy+u*0.1,mw*1.6);
  portal.addColorStop(0,'rgba(120,230,200,'+(0.65+pulse*0.3)+')');
  portal.addColorStop(0.45,'rgba(70,150,150,0.5)');
  portal.addColorStop(1,'#0a0710');
  ctx.fillStyle=portal; ctx.fill();
  ctx.strokeStyle='#15101c'; ctx.lineWidth=Math.max(1.5,u*0.04);
  ctx.beginPath();
  ctx.moveTo(cx-mw,mBot); ctx.lineTo(cx-mw,mTop);
  ctx.arc(cx,mTop,mw,Math.PI,0); ctx.lineTo(cx+mw,mBot); ctx.stroke();
  // 떠다니는 도깨비불 3개
  for(let i=0;i<3;i++){
    const ph=T*1.4+i*2.1;
    const fx=cx+Math.cos(ph)*u*(0.34+0.08*Math.sin(T*1.7+i));
    const fy=cy-u*0.18+Math.sin(ph*0.9)*u*0.24;
    const fr=u*(0.06+0.02*Math.sin(T*5+i*2));     // 깜빡이는 크기
    const fl=0.6+0.4*Math.sin(T*4+i*1.7);
    const g=ctx.createRadialGradient(fx,fy,0,fx,fy,fr*2.6);
    g.addColorStop(0,'rgba(225,255,245,'+(0.9*fl)+')');
    g.addColorStop(0.4,'rgba(110,230,190,'+(0.6*fl)+')');
    g.addColorStop(1,'rgba(70,180,150,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(fx,fy,fr*2.6,0,6.28); ctx.fill();
    ctx.fillStyle='rgba(240,255,250,'+(0.9*fl)+')';
    ctx.beginPath(); ctx.arc(fx,fy,fr*0.5,0,6.28); ctx.fill();
  }
  ctx.restore();
}
// 골인 지점 성문 — 맵마다 이름·층수·홍예문 수·색이 다름 (curMap.gate 설정)
const GATE_DEFAULT={name:'성문', tiers:1, base:'#9a9184', roof:'#39414e', dc:'#b23a2c', arches:1, scale:1};
// 치켜 올라간 기와지붕 한 채 그리기 (처마선 ey, 용마루 ty, 반폭 RW)
function gateRoof(cx,ey,ty,RW,col,u){
  const RHW=RW*0.30;
  ctx.beginPath();
  ctx.moveTo(cx-RW, ey-u*0.05);
  ctx.quadraticCurveTo(cx, ey+u*0.10, cx+RW, ey-u*0.05);         // 늘어진 처마선
  ctx.quadraticCurveTo(cx+RW*0.55, ty+u*0.05, cx+RHW, ty);       // 오른 지붕면
  ctx.lineTo(cx-RHW, ty);                                        // 용마루
  ctx.quadraticCurveTo(cx-RW*0.55, ty+u*0.05, cx-RW, ey-u*0.05); // 왼 지붕면
  ctx.closePath();
  ctx.fillStyle=col; ctx.fill();
  ctx.strokeStyle='#20252e'; ctx.lineWidth=Math.max(1,u*0.03); ctx.stroke();
  ctx.strokeStyle='#ffffff26'; ctx.lineWidth=Math.max(1,u*0.022);// 처마 기와줄
  ctx.beginPath(); ctx.moveTo(cx-RW,ey-u*0.05); ctx.quadraticCurveTo(cx,ey+u*0.10,cx+RW,ey-u*0.05); ctx.stroke();
  ctx.strokeStyle='#c9d2dc'; ctx.lineWidth=Math.max(1.5,u*0.04); // 용마루 마루기와
  ctx.beginPath(); ctx.moveTo(cx-RHW,ty); ctx.lineTo(cx+RHW,ty); ctx.stroke();
  ctx.fillStyle='#20252e';                                       // 치미(양끝 장식)
  ctx.beginPath(); ctx.arc(cx-RHW,ty,u*0.045,0,6.28); ctx.fill();
  ctx.beginPath(); ctx.arc(cx+RHW,ty,u*0.045,0,6.28); ctx.fill();
}
function drawGate(g){
  const u=CELL, cx=g.x, cy=g.y;
  const gt=(curMap&&curMap.gate)||GATE_DEFAULT, sc=gt.scale||1;
  ctx.save(); ctx.lineJoin='round'; ctx.lineCap='round';
  const hurt=(G&&G.gateHurt>0)?G.gateHurt/0.45:0;   // 피격 번쩍임 세기 0~1
  // ----- 석축 (stone base wall) -----
  const baseT=cy-u*0.16, baseB=cy+u*0.52, twH=u*0.44*sc, bwH=u*0.52*sc;
  ctx.beginPath();
  ctx.moveTo(cx-bwH,baseB); ctx.lineTo(cx-twH,baseT);
  ctx.lineTo(cx+twH,baseT); ctx.lineTo(cx+bwH,baseB); ctx.closePath();
  ctx.fillStyle=gt.base; ctx.fill();
  ctx.strokeStyle='#4a4036'; ctx.lineWidth=Math.max(1,u*0.03); ctx.stroke();
  ctx.strokeStyle='#00000022'; ctx.lineWidth=1;                  // 돌 줄눈
  for(let i=1;i<3;i++){const y=baseT+(baseB-baseT)*i/3;
    ctx.beginPath(); ctx.moveTo(cx-bwH*(0.82+0.06*i),y); ctx.lineTo(cx+bwH*(0.82+0.06*i),y); ctx.stroke();}
  // ----- 홍예문 (1개 또는 3개) -----
  const archY=cy+u*0.04, nA=gt.arches===3?3:1;
  const arr=(nA===3? u*0.105 : u*0.17), spread=u*0.245*sc;
  (nA===3? [-1,0,1] : [0]).forEach(o=>{ const ax=cx+o*spread;
    ctx.fillStyle='#15110d';
    ctx.beginPath();
    ctx.moveTo(ax-arr,baseB); ctx.lineTo(ax-arr,archY);
    ctx.arc(ax,archY,arr,Math.PI,0); ctx.lineTo(ax+arr,baseB); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#cdbf9e'; ctx.lineWidth=Math.max(1.2,u*0.03);// 무지개 돌테
    ctx.beginPath(); ctx.arc(ax,archY,arr+u*0.02,Math.PI,0); ctx.stroke();
  });
  // ----- 문루 나무벽 + 단청 (1층) -----
  const wallB=baseT, wallT=cy-u*0.34, wallHW=u*0.40*sc;
  ctx.fillStyle='#6e4628'; ctx.fillRect(cx-wallHW,wallT,wallHW*2,wallB-wallT);
  ctx.strokeStyle='#3f2614'; ctx.lineWidth=Math.max(1,u*0.02);
  ctx.strokeRect(cx-wallHW,wallT,wallHW*2,wallB-wallT);
  for(let i=-1;i<=1;i++){const x=cx+i*wallHW*0.66;                // 기둥
    ctx.beginPath(); ctx.moveTo(x,wallT); ctx.lineTo(x,wallB); ctx.stroke();}
  ctx.fillStyle=gt.dc; ctx.fillRect(cx-wallHW,wallT,wallHW*2,u*0.07);   // 단청 띠
  ctx.fillStyle='#e8d28a';
  for(let x=cx-wallHW+u*0.03;x<cx+wallHW-u*0.02;x+=u*0.1) ctx.fillRect(x,wallT+u*0.0175,u*0.035,u*0.035);
  // ----- 지붕 (1층 또는 2층 누각) -----
  const RW=u*0.62*sc; let topY;
  if(gt.tiers===2){
    gateRoof(cx, cy-u*0.34, cy-u*0.60, RW, gt.roof, u);          // 아래 지붕
    const uwHW=wallHW*0.66, uwB=cy-u*0.60, uwT=cy-u*0.84;         // 위층 벽
    ctx.fillStyle='#6e4628'; ctx.fillRect(cx-uwHW,uwT,uwHW*2,uwB-uwT);
    ctx.strokeStyle='#3f2614'; ctx.lineWidth=Math.max(1,u*0.02); ctx.strokeRect(cx-uwHW,uwT,uwHW*2,uwB-uwT);
    ctx.fillStyle=gt.dc; ctx.fillRect(cx-uwHW,uwT,uwHW*2,u*0.05);
    gateRoof(cx, cy-u*0.84, cy-u*1.12, RW*0.72, gt.roof, u);      // 위 지붕
    topY=cy-u*1.12;
  } else {
    gateRoof(cx, cy-u*0.34, cy-u*0.72, RW, gt.roof, u);
    topY=cy-u*0.72;
  }
  // ----- 체력 게이지 (최상단 지붕 위, 맵별 성문 이름 표시) -----
  if(G && G.maxLife){
    const denom=Math.max(G.maxLife,G.life,1), rat=Math.max(0,Math.min(1,G.life/denom));
    const barW=Math.max(u*1.2, u*0.45+gt.name.length*u*0.24), barH=Math.max(4,u*0.17);
    const bx=cx-barW/2, by=Math.max(OY+3, topY-u*0.34);
    ctx.fillStyle='#1d1712'; ctx.fillRect(bx-2,by-2,barW+4,barH+4);     // 테두리
    ctx.fillStyle='#3a2c20'; ctx.fillRect(bx,by,barW,barH);            // 빈 게이지
    ctx.fillStyle=rat>0.5?'#6fbf52':rat>0.25?'#e0a82e':'#c8442e';      // 잔량 색
    ctx.fillRect(bx,by,barW*rat,barH);
    ctx.fillStyle='#ffffff33'; ctx.fillRect(bx,by,barW*rat,barH*0.4);  // 광택
    ctx.fillStyle='#f3ead6'; ctx.font='bold '+Math.round(u*0.17)+'px sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(gt.name, cx, by+barH/2+u*0.012);
  }
  // 피격 시 성문 전체가 붉게 번쩍
  if(hurt>0){
    ctx.globalAlpha=hurt*0.5; ctx.fillStyle='#c8442e';
    ctx.fillRect(cx-bwH, topY, bwH*2, baseB-topY);
    ctx.globalAlpha=1;
  }
  ctx.restore();
}

function drawPlaceHint(){
  const c=Math.floor((hover.x-OX)/CELL), r=Math.floor((hover.y-OY)/CELL);
  if(c<0||c>=COLS||r<0||r>=ROWS)return;
  const ok=!BLOCKED.has(key(c,r)) && !G.towers.some(t=>t.c===c&&t.r===r);
  const cx=OX+c*CELL+CELL/2, cy=OY+r*CELL+CELL/2;
  const def=TOWERS[G.sel];
  ctx.globalAlpha=.16; ctx.fillStyle=ok?'#2f6f8f':'#c8442e';
  ctx.beginPath();ctx.arc(cx,cy,def.range*CELL*G.buffs.range,0,6.28);ctx.fill();
  ctx.globalAlpha=.35; ctx.fillStyle=ok?'#2f6f8f':'#c8442e';
  ctx.fillRect(OX+c*CELL+2,OY+r*CELL+2,CELL-4,CELL-4); ctx.globalAlpha=1;
}

// ---- minhwa vector enemies (canvas) ----
function drawEnemy(e){
  const s=e.r, type=e.type;
  ctx.save(); ctx.translate(e.x,e.y);
  // healer aura
  if(e.regen>0){ ctx.globalAlpha=.18; ctx.fillStyle='#7ec46a';
    ctx.beginPath();ctx.arc(0,0,s*1.5,0,6.28);ctx.fill(); ctx.globalAlpha=1; }
  // shadow
  ctx.fillStyle='#0003'; ctx.beginPath();ctx.ellipse(0,s*0.9,s*0.9,s*0.32,0,0,6.28);ctx.fill();
  // walking sprite frame, flipped to face travel direction
  const fr=ESPRITE[e.sprite]; const im=fr && fr[Math.floor(performance.now()/90 + (e.seed||0))%fr.length];
  if(imgReady(im)){
    const h=s*3.4, w=h*(im.naturalWidth/im.naturalHeight);
    ctx.save(); if(Math.cos(e.ang)<0) ctx.scale(-1,1);
    ctx.drawImage(im, -w/2, -h*0.66, w, h); ctx.restore();
  } else {
    ctx.strokeStyle='#241c16'; ctx.lineWidth=Math.max(1.5,s*0.12); ctx.lineJoin='round';
    drawEnemyBody(e,s,type);
  }
  // ---- shared status overlays ----
  if(e.slowT>0){ctx.globalAlpha=.4;ctx.fillStyle='#bfe3f0';ctx.beginPath();ctx.arc(0,0,s,0,6.28);ctx.fill();ctx.globalAlpha=1;}
  if(e.burn>0){ctx.globalAlpha=.35+Math.random()*0.2;ctx.fillStyle='#e0612e';
    ctx.beginPath();ctx.arc(0,0,s*0.95,0,6.28);ctx.fill();ctx.globalAlpha=1;}
  if(e.mark>0){ctx.strokeStyle='#9a5b1e';ctx.lineWidth=s*0.1;
    ctx.beginPath();ctx.arc(0,0,s*1.15,0,6.28);ctx.stroke();ctx.strokeStyle='#241c16';}
  ctx.restore();
  // hp bar — 스프라이트 머리 위에 (스프라이트 높이 ≈ s*3.4, 상단 ≈ e.y-2.24s)
  if(e.hp<e.max){const w=s*2.1,hb=Math.max(3,s*(e.boss?0.22:0.18)); const by=e.y-s*2.4-hb;
    ctx.fillStyle='#0006';ctx.fillRect(e.x-w/2,by,w,hb);
    ctx.fillStyle=e.boss?'#e0a82e':'#7ec46a';ctx.fillRect(e.x-w/2,by,w*(e.hp/e.max),hb);}
}
function eyes(s,dx,dy,r){ // helper: pale eyes with dark pupils
  ctx.fillStyle='#f3ead6';ctx.beginPath();ctx.arc(-dx,dy,r,0,6.28);ctx.arc(dx,dy,r,0,6.28);ctx.fill();
  ctx.fillStyle='#241c16';ctx.beginPath();ctx.arc(-dx+r*0.1,dy+r*0.15,r*0.45,0,6.28);ctx.arc(dx+r*0.15,dy+r*0.15,r*0.45,0,6.28);ctx.fill();
}
function drawEnemyBody(e,s,type){
  const t=performance.now()/1000;
  if(type==='fast'){
    // 그림자: translucent wisp with a trailing tail, no legs
    ctx.globalAlpha=.78; ctx.fillStyle=e.col;
    ctx.beginPath(); ctx.arc(0,-s*0.1,s,Math.PI,0); // dome head
    ctx.quadraticCurveTo(s,s*0.6,s*0.4,s*0.9);
    ctx.quadraticCurveTo(0,s*0.6,-s*0.4,s*0.9);
    ctx.quadraticCurveTo(-s,s*0.6,-s,-s*0.1); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.globalAlpha=1;
    eyes(s,s*0.3,-s*0.12,s*0.2);
    return;
  }
  if(type==='gold'){
    // 금두꺼비: a fat golden toad, squat and wide
    ctx.fillStyle=e.col;
    ctx.beginPath(); ctx.ellipse(0,s*0.1,s*1.15,s*0.85,0,0,6.28); ctx.fill(); ctx.stroke();
    // eye bumps on top
    ctx.beginPath(); ctx.arc(-s*0.45,-s*0.45,s*0.34,0,6.28); ctx.arc(s*0.45,-s*0.45,s*0.34,0,6.28); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#fff7d0'; ctx.beginPath(); ctx.arc(-s*0.45,-s*0.45,s*0.18,0,6.28); ctx.arc(s*0.45,-s*0.45,s*0.18,0,6.28); ctx.fill();
    ctx.fillStyle='#241c16'; ctx.beginPath(); ctx.arc(-s*0.45,-s*0.42,s*0.09,0,6.28); ctx.arc(s*0.45,-s*0.42,s*0.09,0,6.28); ctx.fill();
    // wide mouth
    ctx.lineWidth=s*0.07; ctx.beginPath(); ctx.arc(0,s*0.15,s*0.6,0.1*Math.PI,0.9*Math.PI); ctx.stroke();
    // gold sparkles
    ctx.fillStyle='#fff7d0';
    for(const [x,y] of [[s*0.8,-s*0.7],[-s*0.85,s*0.2],[s*0.2,s*0.7]]){
      ctx.save(); ctx.translate(x,y); ctx.rotate(t*2);
      ctx.beginPath(); for(let k=0;k<4;k++){const a=k*Math.PI/2; ctx.lineTo(Math.cos(a)*s*0.16,Math.sin(a)*s*0.16); ctx.lineTo(Math.cos(a+0.785)*s*0.05,Math.sin(a+0.785)*s*0.05);} ctx.closePath(); ctx.fill(); ctx.restore();
    }
    return;
  }
  if(type==='tank'){
    // 독각귀: bulky one-horned brute
    ctx.fillStyle=e.col;
    ctx.beginPath(); ctx.arc(0,0,s,0,6.28); ctx.fill(); ctx.stroke();
    // single big horn
    ctx.beginPath(); ctx.moveTo(-s*0.22,-s*0.82); ctx.lineTo(0,-s*1.6); ctx.lineTo(s*0.22,-s*0.82); ctx.closePath(); ctx.fill(); ctx.stroke();
    // heavy brow
    ctx.lineWidth=s*0.12; ctx.beginPath(); ctx.moveTo(-s*0.5,-s*0.25); ctx.lineTo(-s*0.05,-s*0.12); ctx.moveTo(s*0.5,-s*0.25); ctx.lineTo(s*0.05,-s*0.12); ctx.stroke();
    eyes(s,s*0.32,-s*0.02,s*0.2);
    // fangs
    ctx.fillStyle='#f3ead6'; ctx.beginPath();
    ctx.moveTo(-s*0.18,s*0.3);ctx.lineTo(-s*0.1,s*0.55);ctx.lineTo(-s*0.26,s*0.35);ctx.closePath();
    ctx.moveTo(s*0.18,s*0.3);ctx.lineTo(s*0.1,s*0.55);ctx.lineTo(s*0.26,s*0.35);ctx.closePath(); ctx.fill();
    return;
  }
  if(type==='split'){
    // 분열귀: cracked body that looks about to divide
    ctx.fillStyle=e.col; ctx.beginPath(); ctx.arc(0,0,s,0,6.28); ctx.fill(); ctx.stroke();
    // small horns
    ctx.beginPath();ctx.moveTo(-s*0.5,-s*0.7);ctx.lineTo(-s*0.65,-s*1.15);ctx.lineTo(-s*0.28,-s*0.85);ctx.closePath();
    ctx.moveTo(s*0.5,-s*0.7);ctx.lineTo(s*0.65,-s*1.15);ctx.lineTo(s*0.28,-s*0.85);ctx.closePath();ctx.fill();ctx.stroke();
    eyes(s,s*0.3,-s*0.08,s*0.2);
    // jagged split seam
    ctx.strokeStyle='#241c16'; ctx.lineWidth=s*0.08;
    ctx.beginPath(); ctx.moveTo(0,-s*0.95); ctx.lineTo(-s*0.12,-s*0.4); ctx.lineTo(s*0.1,s*0.05); ctx.lineTo(-s*0.08,s*0.5); ctx.lineTo(s*0.05,s*0.95); ctx.stroke();
    return;
  }
  if(type==='armor'){
    // 갑주귀: armored helm + plated body
    ctx.fillStyle=e.col; ctx.beginPath(); ctx.arc(0,0,s,0,6.28); ctx.fill(); ctx.stroke();
    // helmet dome
    ctx.fillStyle='#9aa7b0'; ctx.beginPath(); ctx.arc(0,-s*0.15,s*0.95,Math.PI,0); ctx.lineTo(s*0.95,-s*0.05); ctx.lineTo(-s*0.95,-s*0.05); ctx.closePath(); ctx.fill(); ctx.stroke();
    // helm ridge + crest
    ctx.fillStyle='#cdd6dd'; ctx.beginPath(); ctx.moveTo(0,-s*1.5); ctx.lineTo(-s*0.12,-s*0.9); ctx.lineTo(s*0.12,-s*0.9); ctx.closePath(); ctx.fill(); ctx.stroke();
    // eye slit
    ctx.fillStyle='#241c16'; ctx.fillRect(-s*0.45,-s*0.18,s*0.3,s*0.12); ctx.fillRect(s*0.15,-s*0.18,s*0.3,s*0.12);
    ctx.fillStyle='#ffd34d'; ctx.fillRect(-s*0.4,-s*0.15,s*0.12,s*0.06); ctx.fillRect(s*0.2,-s*0.15,s*0.12,s*0.06);
    // chin plate
    ctx.strokeStyle='#9aa7b0'; ctx.lineWidth=s*0.14; ctx.beginPath(); ctx.arc(0,s*0.1,s*0.7,0.15*Math.PI,0.85*Math.PI); ctx.stroke();
    return;
  }
  if(type==='swift'){
    // 신속귀: sleek streamlined runner with speed lines
    ctx.strokeStyle='#ffffffaa'; ctx.lineWidth=s*0.1;
    for(let i=-1;i<2;i++){ ctx.beginPath(); ctx.moveTo(-s*1.9,i*s*0.45); ctx.lineTo(-s*1.0,i*s*0.45); ctx.stroke(); }
    ctx.strokeStyle='#241c16'; ctx.lineWidth=Math.max(1.5,s*0.12);
    ctx.fillStyle=e.col;
    // teardrop body, pointed forward (+x)
    ctx.beginPath(); ctx.moveTo(s*1.2,0); ctx.quadraticCurveTo(s*0.2,-s*0.95,-s*0.7,-s*0.5);
    ctx.quadraticCurveTo(-s,0,-s*0.7,s*0.5); ctx.quadraticCurveTo(s*0.2,s*0.95,s*1.2,0); ctx.closePath(); ctx.fill(); ctx.stroke();
    // swept-back horn
    ctx.beginPath(); ctx.moveTo(-s*0.2,-s*0.55);ctx.lineTo(-s*0.95,-s*0.95);ctx.lineTo(-s*0.1,-s*0.3);ctx.closePath(); ctx.fill(); ctx.stroke();
    eyes(s,s*0.18,-s*0.05,s*0.16);
    return;
  }
  if(type==='heal'){
    // 환쟁이: a sorcerer holding a glowing talisman/brush
    ctx.fillStyle=e.col; ctx.beginPath(); ctx.arc(0,0,s,0,6.28); ctx.fill(); ctx.stroke();
    // little cap
    ctx.fillStyle='#3a6a4a'; ctx.beginPath(); ctx.arc(0,-s*0.55,s*0.7,Math.PI,0); ctx.fill(); ctx.stroke();
    eyes(s,s*0.3,-s*0.05,s*0.2);
    // floating talisman with cross/charm
    const by=s*0.1+Math.sin(t*3)*s*0.12;
    ctx.fillStyle='#f3ead6'; ctx.strokeStyle='#c8442e'; ctx.lineWidth=s*0.06;
    ctx.beginPath(); ctx.rect(s*0.9,by-s*0.4,s*0.5,s*0.8); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#c8442e'; ctx.fillRect(s*1.1,by-s*0.25,s*0.1,s*0.5); ctx.fillRect(s*0.98,by-s*0.08,s*0.34,s*0.1);
    ctx.strokeStyle='#241c16';
    return;
  }
  if(e.boss){
    // 도깨비대왕: huge three-horned king with a crown
    ctx.fillStyle=e.col; ctx.beginPath(); ctx.arc(0,0,s,0,6.28); ctx.fill(); ctx.stroke();
    // crown of three horns
    ctx.fillStyle='#e0a82e';
    ctx.beginPath();
    ctx.moveTo(-s*0.55,-s*0.7); ctx.lineTo(-s*0.7,-s*1.5); ctx.lineTo(-s*0.3,-s*0.9); ctx.closePath();
    ctx.moveTo(0,-s*0.85); ctx.lineTo(0,-s*1.75); ctx.lineTo(s*0.28,-s*0.9); ctx.closePath();
    ctx.moveTo(s*0.55,-s*0.7); ctx.lineTo(s*0.7,-s*1.5); ctx.lineTo(s*0.3,-s*0.9); ctx.closePath();
    ctx.fill(); ctx.stroke();
    // crown band
    ctx.fillStyle='#c8442e'; ctx.beginPath(); ctx.roundRect(-s*0.65,-s*0.85,s*1.3,s*0.28,3); ctx.fill(); ctx.stroke();
    // fierce glowing eyes + brows
    ctx.lineWidth=s*0.1; ctx.beginPath(); ctx.moveTo(-s*0.55,-s*0.3);ctx.lineTo(-s*0.08,-s*0.12); ctx.moveTo(s*0.55,-s*0.3);ctx.lineTo(s*0.08,-s*0.12); ctx.stroke();
    ctx.fillStyle='#ffd34d'; ctx.beginPath(); ctx.arc(-s*0.32,-s*0.05,s*0.2,0,6.28); ctx.arc(s*0.32,-s*0.05,s*0.2,0,6.28); ctx.fill();
    ctx.fillStyle='#241c16'; ctx.beginPath(); ctx.arc(-s*0.32,-s*0.02,s*0.09,0,6.28); ctx.arc(s*0.32,-s*0.02,s*0.09,0,6.28); ctx.fill();
    // tusks
    ctx.fillStyle='#f3ead6'; ctx.beginPath();
    ctx.moveTo(-s*0.3,s*0.35);ctx.lineTo(-s*0.18,s*0.7);ctx.lineTo(-s*0.42,s*0.4);ctx.closePath();
    ctx.moveTo(s*0.3,s*0.35);ctx.lineTo(s*0.18,s*0.7);ctx.lineTo(s*0.42,s*0.4);ctx.closePath(); ctx.fill(); ctx.stroke();
    return;
  }
  // jab (default): plain little imp with two small horns
  ctx.fillStyle=e.col; ctx.beginPath(); ctx.arc(0,0,s,0,6.28); ctx.fill(); ctx.stroke();
  ctx.beginPath();ctx.moveTo(-s*0.5,-s*0.7);ctx.lineTo(-s*0.7,-s*1.2);ctx.lineTo(-s*0.25,-s*0.85);ctx.closePath();
  ctx.moveTo(s*0.5,-s*0.7);ctx.lineTo(s*0.7,-s*1.2);ctx.lineTo(s*0.25,-s*0.85);ctx.closePath();ctx.fill();ctx.stroke();
  eyes(s,s*0.32,-s*0.08,s*0.22);
  // small mouth
  ctx.lineWidth=s*0.06; ctx.beginPath(); ctx.arc(0,s*0.35,s*0.2,0.15*Math.PI,0.85*Math.PI); ctx.stroke();
}
function drawTower(t){
  const def=TOWERS[t.id]; const cx=t.x,cy=t.y,s=CELL*0.36;
  const tl=totalLevels(t); const headScale=1+Math.min(tl,10)*0.035;
  // range ring if this tower is open in panel
  if(G.panelT===t){
    const st=towerStat(t);
    ctx.globalAlpha=.14; ctx.fillStyle=def.col;
    ctx.beginPath();ctx.arc(cx,cy,st.range*CELL*G.buffs.range,0,6.28);ctx.fill();
    ctx.globalAlpha=.45; ctx.strokeStyle=def.col; ctx.lineWidth=2; ctx.setLineDash([6,5]);
    ctx.beginPath();ctx.arc(cx,cy,st.range*CELL*G.buffs.range,0,6.28);ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha=1;
  }
  // 불도깨비 flamethrower cone (drawn under the tower, in world space)
  if(t.id==='bul' && t.flame>0){
    const st=towerStat(t);
    const reach=st.range*CELL*G.buffs.range*0.95*t.flame;
    const half=0.42;
    ctx.save(); ctx.translate(cx,cy); ctx.rotate(t.ang);
    // layered flame: outer red, mid orange, inner yellow, with flicker
    const layers=[['#c8442e',1.0,0.5],['#e0a82e',0.82,0.62],['#ffd34d',0.6,0.72],['#fff3c0',0.34,0.85]];
    for(const [col,rf,af] of layers){
      const flick=0.9+Math.random()*0.2;
      ctx.globalAlpha=(0.55*af)*t.flame;
      ctx.fillStyle=col;
      ctx.beginPath(); ctx.moveTo(0,0);
      const rr=reach*rf*flick;
      ctx.arc(0,0,rr,-half,half);
      ctx.closePath(); ctx.fill();
    }
    // a few flame tongues / embers along the cone
    ctx.globalAlpha=t.flame;
    for(let i=0;i<5;i++){
      const a=(-half)+(i/4)*half*2 + (Math.random()-0.5)*0.1;
      const rr=reach*(0.5+Math.random()*0.5);
      ctx.fillStyle=Math.random()<0.5?'#ffd34d':'#e0a82e';
      ctx.beginPath(); ctx.arc(Math.cos(a)*rr,Math.sin(a)*rr,CELL*0.05*Math.random()+1,0,6.28); ctx.fill();
    }
    ctx.globalAlpha=1; ctx.restore();
  }
  ctx.save();ctx.translate(cx,cy);
  ctx.fillStyle='#0003';ctx.beginPath();ctx.ellipse(0,s*0.95,s*0.85,s*0.3,0,0,6.28);ctx.fill();
  const tim=IMG[def.sprite];
  if(imgReady(tim)){
    const h=CELL*1.12, w=h*(tim.naturalWidth/tim.naturalHeight);
    ctx.drawImage(tim, -w/2, -h*0.68, w, h);
    // 타워 위에 사수(인간형 유닛) 합성 — 목표 방향을 바라봄
    const uim=IMG[def.unit];
    if(uim && imgReady(uim)){
      const uh=CELL*0.78, uw=uh*(uim.naturalWidth/uim.naturalHeight);
      const atk=Math.max(0,t.atk||0);              // 1(방금 발사)→0(평상시)
      ctx.save();
      ctx.translate(0,-CELL*0.46);                 // 타워 상단 플랫폼에 발이 닿도록
      // 살짝 그림자
      ctx.globalAlpha=.25; ctx.fillStyle='#000';
      ctx.beginPath(); ctx.ellipse(0,0,uw*0.34,uh*0.1,0,0,6.28); ctx.fill(); ctx.globalAlpha=1;
      const flip = Math.cos(t.ang||0)>0;
      if(flip) ctx.scale(-1,1);                     // 적이 오른쪽이면 좌우 반전
      // ---- 공격 모션: 발사 순간 뒤로 움찔(반동) → 스프링백 + 살짝 들썩 ----
      const kick=Math.sin(atk*Math.PI);            // 0→1→0 (중간에 최대)
      ctx.translate(-atk*uw*0.16, -kick*uh*0.05);  // 뒤로 반동 + 살짝 위로
      ctx.rotate(-atk*0.18);                        // 뒤로 젖힘
      ctx.drawImage(uim, -uw/2, -uh*0.86, uw, uh);
      ctx.restore();
    }
  } else drawTowerBody(t,def,s,headScale);
  // branch rune above head — marks a tower that chose a path
  if(t.branch){
    const ry=-s*1.05;
    ctx.fillStyle='#e0a82e'; ctx.strokeStyle='#241c16'; ctx.lineWidth=1.6;
    ctx.save(); ctx.translate(0,ry); ctx.rotate(Math.PI/4);
    const d=s*0.30; ctx.beginPath(); ctx.rect(-d,-d,d*2,d*2); ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.fillStyle='#241c16';
    ctx.beginPath(); ctx.arc(0,ry,s*0.12,0,6.28); ctx.fill();
  }
  // total-level badge above the post
  if(tl>0){
    ctx.fillStyle='#e0a82e'; ctx.strokeStyle='#241c16'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.arc(0, s*1.05, s*0.34, 0, 6.28); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#241c16'; ctx.font='bold '+(s*0.42)+'px sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(tl, 0, s*1.08);
  }
  ctx.restore();
}
// ---- per-tower illustrated bodies (minhwa-flavored) ----
function drawTowerBody(t,def,s,headScale){
  const id=t.id, ang=t.ang+Math.PI/2;
  ctx.strokeStyle='#241c16'; ctx.lineWidth=Math.max(2,s*0.09); ctx.lineJoin='round';
  if(id==='jangseung'){
    // 장승: weathered wooden guardian post with a fierce carved face
    ctx.fillStyle='#9a7a4a'; ctx.beginPath(); ctx.roundRect(-s*0.42,-s*0.35,s*0.84,s*1.35,5); ctx.fill(); ctx.stroke();
    ctx.strokeStyle='#7a5e38'; ctx.lineWidth=1.2; ctx.globalAlpha=.5;
    for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(-s*0.3+i*s*0.3,-s*0.25);ctx.lineTo(-s*0.28+i*s*0.3,s*0.9);ctx.stroke();}
    ctx.globalAlpha=1; ctx.strokeStyle='#241c16'; ctx.lineWidth=Math.max(2,s*0.09);
    ctx.fillStyle='#3a2c20'; ctx.beginPath(); ctx.ellipse(0,-s*0.4,s*0.62,s*0.2,0,0,6.28); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(-s*0.32,-s*0.72,s*0.64,s*0.36,4); ctx.fill(); ctx.stroke();
    ctx.fillStyle=def.col; ctx.beginPath(); ctx.arc(-s*0.2,-s*0.02,s*0.16,0,6.28); ctx.arc(s*0.2,-s*0.02,s*0.16,0,6.28); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#241c16'; ctx.beginPath(); ctx.arc(-s*0.2,0,s*0.07,0,6.28); ctx.arc(s*0.2,0,s*0.07,0,6.28); ctx.fill();
    ctx.lineWidth=s*0.08; ctx.beginPath(); ctx.moveTo(-s*0.36,-s*0.2);ctx.lineTo(-s*0.04,-s*0.08); ctx.moveTo(s*0.36,-s*0.2);ctx.lineTo(s*0.04,-s*0.08); ctx.stroke();
    ctx.fillStyle='#c8442e'; ctx.beginPath(); ctx.moveTo(0,s*0.05);ctx.lineTo(-s*0.1,s*0.35);ctx.lineTo(s*0.1,s*0.35);ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.lineWidth=s*0.06; ctx.beginPath(); ctx.arc(0,s*0.45,s*0.22,0.1*Math.PI,0.9*Math.PI); ctx.stroke();
  } else if(id==='kkachi'){
    // 까치: a magpie perched on a small post
    ctx.fillStyle='#a6824f'; ctx.beginPath(); ctx.roundRect(-s*0.28,s*0.2,s*0.56,s*0.8,3); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#2b2b30'; ctx.beginPath(); ctx.ellipse(0,-s*0.1,s*0.5,s*0.62,0,0,6.28); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#f3ead6'; ctx.beginPath(); ctx.ellipse(s*0.06,s*0.05,s*0.28,s*0.4,0,0,6.28); ctx.fill();
    ctx.fillStyle=def.col; ctx.beginPath(); ctx.ellipse(-s*0.22,-s*0.05,s*0.22,s*0.4,0.3,0,6.28); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.rotate(t.ang+Math.PI/2);
    ctx.fillStyle='#2b2b30'; ctx.beginPath(); ctx.arc(0,-s*0.55,s*0.3,0,6.28); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#e0a82e'; ctx.beginPath(); ctx.moveTo(0,-s*1.0);ctx.lineTo(-s*0.12,-s*0.62);ctx.lineTo(s*0.12,-s*0.62);ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#f3ead6'; ctx.beginPath(); ctx.arc(-s*0.12,-s*0.6,s*0.07,0,6.28); ctx.arc(s*0.12,-s*0.6,s*0.07,0,6.28); ctx.fill();
    ctx.fillStyle='#241c16'; ctx.beginPath(); ctx.arc(-s*0.12,-s*0.6,s*0.035,0,6.28); ctx.arc(s*0.12,-s*0.6,s*0.035,0,6.28); ctx.fill();
    ctx.restore();
    ctx.fillStyle='#2b2b30'; ctx.beginPath(); ctx.moveTo(0,s*0.3);ctx.lineTo(-s*0.12,s*0.75);ctx.lineTo(s*0.12,s*0.75);ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if(id==='bul'){
    // 불도깨비: horned fire-demon head with a flaming mane
    ctx.save(); ctx.rotate(ang);
    const fl=0.9+Math.random()*0.2;
    ctx.fillStyle='#c8442e'; ctx.beginPath();
    for(let i=0;i<8;i++){const a=i/8*6.28; const rr=s*(0.7+(i%2?0.45:0.2))*fl;
      ctx[i?'lineTo':'moveTo'](Math.cos(a)*rr,Math.sin(a)*rr-s*0.4);} ctx.closePath(); ctx.fill();
    ctx.fillStyle='#e0a82e'; ctx.beginPath();
    for(let i=0;i<8;i++){const a=i/8*6.28+0.3; const rr=s*(0.5+(i%2?0.3:0.12))*fl;
      ctx[i?'lineTo':'moveTo'](Math.cos(a)*rr,Math.sin(a)*rr-s*0.4);} ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle='#7a2f1a'; ctx.beginPath(); ctx.arc(0,-s*0.4,s*0.6*headScale,0,6.28); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#3a2c20'; ctx.beginPath();
    ctx.moveTo(-s*0.4,-s*0.75);ctx.lineTo(-s*0.6,-s*1.25);ctx.lineTo(-s*0.16,-s*0.85);ctx.closePath();
    ctx.moveTo(s*0.4,-s*0.75);ctx.lineTo(s*0.6,-s*1.25);ctx.lineTo(s*0.16,-s*0.85);ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#ffd34d'; ctx.beginPath(); ctx.arc(-s*0.22,-s*0.45,s*0.12,0,6.28); ctx.arc(s*0.22,-s*0.45,s*0.12,0,6.28); ctx.fill();
    ctx.fillStyle='#241c16'; ctx.beginPath(); ctx.arc(-s*0.22,-s*0.45,s*0.05,0,6.28); ctx.arc(s*0.22,-s*0.45,s*0.05,0,6.28); ctx.fill();
    ctx.fillStyle='#f3ead6'; ctx.beginPath();
    ctx.moveTo(-s*0.12,-s*0.15);ctx.lineTo(-s*0.04,-s*0.02);ctx.lineTo(-s*0.18,-s*0.04);ctx.closePath();
    ctx.moveTo(s*0.12,-s*0.15);ctx.lineTo(s*0.04,-s*0.02);ctx.lineTo(s*0.18,-s*0.04);ctx.closePath(); ctx.fill();
  } else if(id==='seori'){
    // 서리할멈: hooded frost-crone with an icy crown
    ctx.save(); ctx.rotate(ang);
    ctx.globalAlpha=.25; ctx.fillStyle='#bfe3f0'; ctx.beginPath(); ctx.arc(0,-s*0.35,s*0.85,0,6.28); ctx.fill(); ctx.globalAlpha=1;
    ctx.fillStyle='#8fb0bf'; ctx.beginPath(); ctx.moveTo(0,-s*0.95);
    ctx.quadraticCurveTo(s*0.75,-s*0.5,s*0.5,s*0.9); ctx.lineTo(-s*0.5,s*0.9);
    ctx.quadraticCurveTo(-s*0.75,-s*0.5,0,-s*0.95); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#d8e8ee'; ctx.beginPath(); ctx.arc(0,-s*0.3,s*0.34,0,6.28); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#3a5560'; ctx.beginPath(); ctx.arc(-s*0.12,-s*0.32,s*0.05,0,6.28); ctx.arc(s*0.12,-s*0.32,s*0.05,0,6.28); ctx.fill();
    ctx.strokeStyle='#5f93a8'; ctx.lineWidth=s*0.04; ctx.beginPath(); ctx.arc(0,-s*0.18,s*0.1,1.05*Math.PI,1.95*Math.PI); ctx.stroke();
    ctx.fillStyle='#dff1f8'; ctx.strokeStyle='#5f93a8'; ctx.lineWidth=s*0.05;
    for(let i=-1;i<2;i++){ctx.beginPath();ctx.moveTo(i*s*0.22-s*0.07,-s*0.55);ctx.lineTo(i*s*0.22,-s*0.85);ctx.lineTo(i*s*0.22+s*0.07,-s*0.55);ctx.closePath();ctx.fill();ctx.stroke();}
    ctx.restore();
  } else if(id==='beom'){
    // 까치호랑이: folk-painting tiger head, striped and toothy
    ctx.save(); ctx.rotate(ang);
    ctx.fillStyle='#a6824f'; ctx.beginPath(); ctx.roundRect(-s*0.35,s*0.1,s*0.7,s*0.9,4); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#e0a050'; ctx.beginPath(); ctx.arc(0,-s*0.3,s*0.66*headScale,0,6.28); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(-s*0.5,-s*0.7,s*0.2,0,6.28); ctx.arc(s*0.5,-s*0.7,s*0.2,0,6.28); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#3a2c20'; ctx.beginPath(); ctx.arc(-s*0.5,-s*0.7,s*0.09,0,6.28); ctx.arc(s*0.5,-s*0.7,s*0.09,0,6.28); ctx.fill();
    ctx.strokeStyle='#241c16'; ctx.lineWidth=s*0.09; ctx.lineCap='round';
    ctx.beginPath();
    ctx.moveTo(-s*0.55,-s*0.45);ctx.lineTo(-s*0.32,-s*0.4);
    ctx.moveTo(s*0.55,-s*0.45);ctx.lineTo(s*0.32,-s*0.4);
    ctx.moveTo(-s*0.5,-s*0.15);ctx.lineTo(-s*0.28,-s*0.18);
    ctx.moveTo(s*0.5,-s*0.15);ctx.lineTo(s*0.28,-s*0.18);
    ctx.moveTo(0,-s*0.95);ctx.lineTo(0,-s*0.7); ctx.stroke();
    ctx.fillStyle='#f3ead6'; ctx.beginPath(); ctx.ellipse(0,-s*0.02,s*0.34,s*0.26,0,0,6.28); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(-s*0.26,-s*0.4,s*0.15,0,6.28); ctx.arc(s*0.26,-s*0.4,s*0.15,0,6.28); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#241c16'; ctx.beginPath(); ctx.arc(-s*0.26,-s*0.38,s*0.07,0,6.28); ctx.arc(s*0.26,-s*0.38,s*0.07,0,6.28); ctx.fill();
    ctx.fillStyle='#c8442e'; ctx.beginPath(); ctx.moveTo(0,-s*0.1);ctx.lineTo(-s*0.08,-s*0.02);ctx.lineTo(s*0.08,-s*0.02);ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#fff'; ctx.beginPath();
    ctx.moveTo(-s*0.1,s*0.08);ctx.lineTo(-s*0.04,s*0.22);ctx.lineTo(-s*0.16,s*0.1);ctx.closePath();
    ctx.moveTo(s*0.1,s*0.08);ctx.lineTo(s*0.04,s*0.22);ctx.lineTo(s*0.16,s*0.1);ctx.closePath(); ctx.fill();
    ctx.restore();
  } else {
    ctx.fillStyle='#a6824f'; ctx.beginPath();ctx.roundRect(-s*0.5,-s*0.2,s,s*1.2,4);ctx.fill();ctx.stroke();
    ctx.save(); ctx.rotate(ang);
    ctx.fillStyle=def.col;ctx.beginPath();ctx.arc(0,-s*0.4,s*0.62*headScale,0,6.28);ctx.fill();ctx.stroke();
    ctx.fillStyle='#241c16';ctx.beginPath();ctx.arc(-s*0.2,-s*0.45,s*0.1,0,6.28);ctx.arc(s*0.2,-s*0.45,s*0.1,0,6.28);ctx.fill();
    ctx.restore();
  }
}

// ---- SVG icons for tray & cards ----
function towerSVG(id,sz){const c=TOWERS[id].col;
  const sh='<ellipse cx="24" cy="42" rx="12" ry="3" fill="#0002"/>';
  if(id==='jangseung'){
    return '<svg viewBox="0 0 48 48">'+sh+
      '<rect x="16" y="12" width="16" height="30" rx="3" fill="#9a7a4a" stroke="#241c16" stroke-width="2.5"/>'+
      '<ellipse cx="24" cy="13" rx="12" ry="3.5" fill="#3a2c20" stroke="#241c16" stroke-width="2"/>'+
      '<rect x="18" y="6" width="12" height="8" rx="2" fill="#3a2c20" stroke="#241c16" stroke-width="2"/>'+
      '<circle cx="20" cy="22" r="3" fill="'+c+'" stroke="#241c16" stroke-width="1.5"/><circle cx="28" cy="22" r="3" fill="'+c+'" stroke="#241c16" stroke-width="1.5"/>'+
      '<path d="M24 25 L21 33 L27 33 Z" fill="#c8442e" stroke="#241c16" stroke-width="1.5"/></svg>';
  }
  if(id==='kkachi'){
    return '<svg viewBox="0 0 48 48">'+sh+
      '<rect x="19" y="30" width="10" height="14" rx="2" fill="#a6824f" stroke="#241c16" stroke-width="2"/>'+
      '<ellipse cx="24" cy="24" rx="13" ry="15" fill="#2b2b30" stroke="#241c16" stroke-width="2.5"/>'+
      '<ellipse cx="25" cy="27" rx="6" ry="9" fill="#f3ead6"/>'+
      '<ellipse cx="17" cy="22" rx="5" ry="9" fill="'+c+'" stroke="#241c16" stroke-width="1.5" transform="rotate(-18 17 22)"/>'+
      '<circle cx="24" cy="12" r="7" fill="#2b2b30" stroke="#241c16" stroke-width="2"/>'+
      '<path d="M24 1 L21 9 L27 9 Z" fill="#e0a82e" stroke="#241c16" stroke-width="1.5"/>'+
      '<circle cx="21.5" cy="11" r="1.5" fill="#f3ead6"/><circle cx="26.5" cy="11" r="1.5" fill="#f3ead6"/></svg>';
  }
  if(id==='bul'){
    return '<svg viewBox="0 0 48 48">'+sh+
      '<path d="M24 4 Q14 8 12 20 Q8 16 9 24 Q4 22 8 32 Q12 42 24 42 Q36 42 40 32 Q44 22 39 24 Q40 16 36 20 Q34 8 24 4Z" fill="#c8442e"/>'+
      '<path d="M24 10 Q17 13 16 22 Q12 26 18 30 Q14 34 24 36 Q34 34 30 30 Q36 26 32 22 Q31 13 24 10Z" fill="#e0a82e"/>'+
      '<circle cx="24" cy="24" r="9" fill="#7a2f1a" stroke="#241c16" stroke-width="2"/>'+
      '<path d="M16 16 L12 8 L20 14 Z M32 16 L36 8 L28 14 Z" fill="#3a2c20" stroke="#241c16" stroke-width="1.5"/>'+
      '<circle cx="21" cy="23" r="2.5" fill="#ffd34d"/><circle cx="27" cy="23" r="2.5" fill="#ffd34d"/></svg>';
  }
  if(id==='seori'){
    return '<svg viewBox="0 0 48 48">'+sh+
      '<circle cx="24" cy="24" r="18" fill="#bfe3f0" opacity="0.3"/>'+
      '<path d="M24 8 Q40 16 36 42 L12 42 Q8 16 24 8Z" fill="#8fb0bf" stroke="#241c16" stroke-width="2.5"/>'+
      '<circle cx="24" cy="22" r="8" fill="#d8e8ee" stroke="#241c16" stroke-width="2"/>'+
      '<circle cx="21" cy="21" r="1.6" fill="#3a5560"/><circle cx="27" cy="21" r="1.6" fill="#3a5560"/>'+
      '<path d="M18 12 L20 6 L22 12 M23 11 L25 4 L27 11 M28 12 L30 6 L32 12Z" fill="#dff1f8" stroke="#5f93a8" stroke-width="1.5"/></svg>';
  }
  if(id==='beom'){
    return '<svg viewBox="0 0 48 48">'+sh+
      '<rect x="18" y="32" width="12" height="12" rx="2" fill="#a6824f" stroke="#241c16" stroke-width="2"/>'+
      '<circle cx="14" cy="12" r="4" fill="#e0a050" stroke="#241c16" stroke-width="2"/><circle cx="34" cy="12" r="4" fill="#e0a050" stroke="#241c16" stroke-width="2"/>'+
      '<circle cx="24" cy="22" r="14" fill="#e0a050" stroke="#241c16" stroke-width="2.5"/>'+
      '<path d="M10 16 L16 18 M38 16 L32 18 M11 24 L17 23 M37 24 L31 23 M24 8 L24 13" stroke="#241c16" stroke-width="2" stroke-linecap="round" fill="none"/>'+
      '<ellipse cx="24" cy="26" rx="8" ry="6" fill="#f3ead6"/>'+
      '<circle cx="19" cy="20" r="3.5" fill="#fff" stroke="#241c16" stroke-width="1.5"/><circle cx="29" cy="20" r="3.5" fill="#fff" stroke="#241c16" stroke-width="1.5"/>'+
      '<circle cx="19" cy="20" r="1.6" fill="#241c16"/><circle cx="29" cy="20" r="1.6" fill="#241c16"/>'+
      '<path d="M24 24 L22 28 L26 28 Z" fill="#c8442e" stroke="#241c16" stroke-width="1"/></svg>';
  }
  // fallback
  return '<svg viewBox="0 0 48 48">'+sh+
    '<rect x="17" y="16" width="14" height="22" rx="3" fill="#a6824f" stroke="#241c16" stroke-width="2.5"/>'+
    '<circle cx="24" cy="15" r="10" fill="'+c+'" stroke="#241c16" stroke-width="2.5"/>'+
    '<circle cx="20.5" cy="15" r="2" fill="#241c16"/><circle cx="27.5" cy="15" r="2" fill="#241c16"/></svg>';}
function cardSVG(k){
  if(TOWERS[k])return towerSVG(k,54);
  const ic={dmg:'<path d="M24 6 L30 24 L24 42 L18 24 Z" fill="#c8442e" stroke="#241c16" stroke-width="2.5"/>',
    rate:'<path d="M14 8 L34 8 L20 26 L28 26 L14 44 L22 24 L14 24 Z" fill="#e0a82e" stroke="#241c16" stroke-width="2.5" stroke-linejoin="round"/>',
    range:'<circle cx="24" cy="24" r="16" fill="none" stroke="#2f6f8f" stroke-width="3"/><circle cx="24" cy="24" r="4" fill="#2f6f8f"/>',
    gold:'<circle cx="24" cy="24" r="15" fill="#e0a82e" stroke="#241c16" stroke-width="2.5"/><rect x="20" y="20" width="8" height="8" fill="#241c16"/>',
    life:'<path d="M24 40 C8 28 12 12 24 18 C36 12 40 28 24 40 Z" fill="#c8442e" stroke="#241c16" stroke-width="2.5" stroke-linejoin="round"/>'};
  return '<svg viewBox="0 0 48 48">'+(ic[k]||'')+'</svg>';
}

// ---------- HUD ----------
function updateHUD(){
  $('hWave').textContent=G.wave; $('hGold').textContent=Math.floor(G.gold);
  $('hLife').textContent=Math.max(0,G.life); $('hBest').textContent=G.best;
  const tt=$('title'); if(tt&&curMap) tt.innerHTML='성채 수호전<small>'+curMap.name+'</small>';
}

// ---------- upgrade panel ----------
function openPanel(t){
  G.panelT=t; G.sel=null; syncTray();
  renderPanel();
  $('panel').style.display='block';
}
function closePanel(){ if(G&&G.panelT){G.panelT=null;} $('panel').style.display='none'; }
function renderPanel(){
  const t=G.panelT; if(!t)return;
  const def=TOWERS[t.id];
  $('pName').textContent=def.name;
  $('pLv').textContent='총 '+totalLevels(t)+'단';
  const labels={dmg:'피해',rate:'공속',range:'사거리',splash:'범위'};
  const fmt={
    dmg:v=>Math.round(v), rate:v=>(1/v).toFixed(1)+'/초',
    range:v=>v.toFixed(1), splash:v=>v.toFixed(1),
  };
  let html='';
  for(const st of statsFor(t.id)){
    const cur=lvl(t,st);
    const val=statVal(def,st,cur);
    const cost=stepCost(t,st);
    // pips
    let pips=''; for(let i=0;i<MAXSTEP;i++) pips+='<span class="pip'+(i<cur?' on':'')+'"></span>';
    let btn;
    if(cost==null){ btn='<button class="ub max" disabled>최대<small>'+fmt[st](val)+'</small></button>'; }
    else { const dis=G.gold<cost?' disabled':'';
      btn='<button class="ub" data-stat="'+st+'"'+dis+'>▲ '+cost+'<small>'+fmt[st](val)+' → '+fmt[st](statVal(def,st,cur+1))+'</small></button>'; }
    html+='<div class="prow"><span class="nm">'+labels[st]+'</span>'+
      '<span class="pips">'+pips+'</span>'+btn+'</div>';
  }
  $('pRows').innerHTML=html;
  $('pRows').querySelectorAll('.ub[data-stat]').forEach(b=>{
    b.onclick=()=>doUpgrade(b.getAttribute('data-stat'));
  });
  // ---- branch section ----
  const branches=BRANCHES[t.id]; let bhtml='';
  if(t.branch){
    const chosen=branches.find(x=>x.id===t.branch);
    bhtml='<div class="brdone">⚜ '+chosen.name+'<small>'+chosen.desc+'</small></div>';
  } else if(canChooseBranch(t)){
    const cost=branchCost(t);
    bhtml='<div class="brhead">길을 정하라 · 🪙'+cost+'</div><div class="brrow">'+
      branches.map(x=>'<button class="brbtn" data-br="'+x.id+'"'+(G.gold<cost?' disabled':'')+'>'+
        '<b>'+x.name+'</b><small>'+x.desc+'</small></button>').join('')+'</div>';
  } else {
    const need=BRANCH_REQ-totalLevels(t);
    bhtml='<div class="brlock">길 해금까지 '+need+'단 더 강화</div>';
  }
  $('pBranch').innerHTML=bhtml;
  $('pBranch').querySelectorAll('.brbtn[data-br]').forEach(b=>{
    b.onclick=()=>chooseBranch(b.getAttribute('data-br'));
  });
  $('pSell').textContent='판매 · +'+sellValue(t);
}
function chooseBranch(brId){
  const t=G.panelT; if(!t||t.branch)return;
  const cost=branchCost(t);
  if(G.gold<cost){toast('금화이 부족하다');return;}
  G.gold-=cost; t.branch=brId; updateHUD(); renderPanel();
  spawnBranchFx(t.x,t.y,TOWERS[t.id].col);
  SND.branch();
  const b=BRANCHES[t.id].find(x=>x.id===brId);
  toast(TOWERS[t.id].name+' → '+b.name);
}
function doUpgrade(stat){
  const t=G.panelT; if(!t)return;
  const cost=stepCost(t,stat);
  if(cost==null)return; if(G.gold<cost){toast('금화이 부족하다');return;}
  if(!t.up)t.up={}; t.up[stat]=(t.up[stat]||0)+1;
  G.gold-=cost; updateHUD(); renderPanel();
  spawnUpgrade(t.x,t.y);
  SND.upgrade();
}
function doSell(){
  const t=G.panelT; if(!t)return;
  G.gold+=sellValue(t);
  G.towers=G.towers.filter(x=>x!==t);
  closePanel(); updateHUD();
}
$('pSell').onclick=doSell;
$('pClose').onclick=closePanel;
function openCodex(){ $('codexMenu').style.display='flex'; }
$('codexBtn').onclick=openCodex;
// sound toggle (persisted)
try{ if(localStorage.getItem('dokkaebi_sfx')==='0') SFX.on=false; }catch(e){}
function refreshSoundBtn(){ const b=$('soundBtn'); if(b) b.textContent=SFX.on?'🔊':'🔇'; }
$('soundBtn').onclick=()=>{ SFX.on=!SFX.on; try{ localStorage.setItem('dokkaebi_sfx',SFX.on?'1':'0'); }catch(e){}
  refreshSoundBtn(); if(SFX.on){ const c=ac(); if(c&&c.state==='suspended')c.resume(); SND.card(); } };
refreshSoundBtn();
$('overlayCodex').onclick=openCodex;
// delegated: works for the dynamically-rebuilt gameover buttons too
$('overlay').addEventListener('click',(e)=>{
  if(!e.target)return;
  if(e.target.id==='overlayCodex') openCodex();
  if(e.target.id==='shrineBtn') openShrine();
});
$('cmClose').onclick=()=>{ $('codexMenu').style.display='none'; };
$('codexMenu').onclick=(e)=>{ if(e.target.id==='codexMenu') $('codexMenu').style.display='none'; };

// ---------- in-game codex viewer (iframe) ----------
const CODEX_TITLE={ maps:'전장 일람', monsters:'마물 도감', towers:'방어탑 도감' };
function openCodexView(kind){
  const title=CODEX_TITLE[kind]; if(!title)return;
  $('codexMenu').style.display='none';
  $('cvTitle').textContent=title;
  const fr=$('cvFrame');
  // load the standalone codex page from /pages (kind = maps | monsters | towers)
  fr.src='pages/'+kind+'.html';
  $('codexView').style.display='flex';
}
$('cvBack').onclick=()=>{ $('codexView').style.display='none'; $('cvFrame').src='about:blank'; $('codexMenu').style.display='flex'; };
document.querySelectorAll('.cmlink[data-codex]').forEach(b=>{
  b.onclick=()=>openCodexView(b.getAttribute('data-codex'));
});

// ---------- shrine (meta upgrades) ----------
function refreshMenu(){
  const mb=$('menuBest'), mc=$('menuCoins');
  if(mb) mb.textContent=+(localStorage.getItem('dokkaebi_best')||0);
  if(mc) mc.textContent=META.coins;
}
function openShrine(){ renderShrine(); $('shrine').style.display='flex'; }
function renderShrine(){
  $('shCoins').textContent=META.coins;
  const list=$('shList'); list.innerHTML='';
  META_ORDER.forEach(k=>{
    const u=META_UP[k], lv=META.up[k]||0, cost=metaCost(k);
    const item=document.createElement('div'); item.className='shitem';
    let btn;
    if(cost==null) btn='<button class="sbuy max" disabled>최대 단계</button>';
    else btn='<button class="sbuy" data-k="'+k+'"'+(META.coins<cost?' disabled':'')+'>🪙 '+cost+' 강화</button>';
    item.innerHTML='<div class="sit"><span class="sname">'+u.name+'</span>'+
      '<span class="slv">'+lv+' / '+u.max+'</span></div>'+
      '<div class="sd">'+u.desc(lv)+'</div>'+btn;
    list.appendChild(item);
  });
  list.querySelectorAll('.sbuy[data-k]').forEach(b=>{
    b.onclick=()=>buyMeta(b.getAttribute('data-k'));
  });
}
function buyMeta(k){
  const cost=metaCost(k); if(cost==null)return;
  if(META.coins<cost){ toast('보석이 부족하다'); return; }
  META.coins-=cost; META.up[k]=(META.up[k]||0)+1; metaSave(META);
  renderShrine(); refreshMenu();
}
$('shrineBtn').onclick=openShrine;
$('shClose').onclick=()=>{ $('shrine').style.display='none'; };
$('shrine').onclick=(e)=>{ if(e.target.id==='shrine') $('shrine').style.display='none'; };
refreshMenu();

// ---------- input ----------
let hover=null;
function pointer(ev,type){
  const rect=cv.getBoundingClientRect();
  const x=(ev.touches?ev.touches[0]:ev).clientX-rect.left;
  const y=(ev.touches?ev.touches[0]:ev).clientY-rect.top;
  hover={x,y};
  if(type==='down'){ placeAt(x,y); }
}
cv.addEventListener('mousemove',e=>pointer(e,'move'));
cv.addEventListener('mousedown',e=>pointer(e,'down'));
cv.addEventListener('touchstart',e=>{e.preventDefault();pointer(e,'down');},{passive:false});
cv.addEventListener('touchmove',e=>{e.preventDefault();pointer(e,'move');},{passive:false});

// ---------- loop ----------
let last=0;
function loop(ts){
  const dt=Math.min(0.05,(ts-last)/1000||0); last=ts;
  if(G&&G.running) update(dt);
  if(G) draw();
  requestAnimationFrame(loop);
}

// ---------- buttons ----------
$('startBtn').onclick=()=>{ const c=ac(); if(c&&c.state==='suspended')c.resume(); $('overlay').style.display='none'; newGame(); toast(curMap.name+' — '+((curMap.gate&&curMap.gate.name)||'성문')+'을 지켜라'); startWave(); };
function gameOver(){
  G.running=false;
  SND.over();
  // award meta coins based on waves survived
  const me=metaEffects();
  const earned=Math.round(runCoins(G.wave)*me.coinMul);
  META.coins+=earned; metaSave(META);
  const ov=$('overlay');
  ov.innerHTML='<h1>성문이 뚫렸다</h1>'+
    '<div class="big">물결 '+G.wave+'까지 버텼다 · 최고 '+G.best+'</div>'+
    '<div class="sub">마물이 성문을 넘었다.<br>보석 <b style="color:#e0a82e">🪙 '+earned+'</b>을 모았다.</div>'+
    '<button class="btn" id="againBtn">다시 문을 연다</button>'+
    '<div id="menuRow">'+
      '<button class="menubtn" id="overlayCodex">📖 도감</button>'+
      '<button class="menubtn" id="shrineBtn">🏯 마법 제단</button>'+
    '</div>';
  ov.style.display='flex';
  $('againBtn').onclick=()=>{ ov.style.display='none'; newGame(); startWave(); };
  $('shrineBtn').onclick=openShrine;
  refreshMenu();
}

resize(); requestAnimationFrame(loop);
// re-measure once layout/fonts settle (mobile viewport quirk)
setTimeout(resize,100); addEventListener('load',resize);
})();
