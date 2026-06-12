/* ══════════════════════════════════════════════════
   PIRATE SIM GAME — 海賊船シミュレーター (perspective)
══════════════════════════════════════════════════ */
const PS = {
  running:false, raf:null, timerInt:null,
  canvas:null, ctx:null,
  LW:800, LH:480,
  HY_RATIO:0.40,
  player:null,
  enemies:[], pBullets:[], eBullets:[],
  chests:[], explosions:[], particles:[],
  keys:{left:false,right:false},
  timer:90, gold:0, enemiesSunk:0,
  wind:{angle:0,speed:0.4},
  windTimer:0, spawnTimer:0, chestTimer:0,
  lastTs:0, shake:0,
  _keydown:null, _keyup:null,
};

function startPirateSim() {
  const ps=PS;
  ps.running=false;
  if(ps.raf)      { cancelAnimationFrame(ps.raf); ps.raf=null; }
  if(ps.timerInt) { clearInterval(ps.timerInt); ps.timerInt=null; }
  if(ps._keydown) document.removeEventListener('keydown',ps._keydown);
  if(ps._keyup)   document.removeEventListener('keyup',  ps._keyup);

  ps.player={x:400,hp:100,maxHp:100,fireCd:0,invincible:0,speed:5};
  ps.enemies=[]; ps.pBullets=[]; ps.eBullets=[];
  ps.chests=[]; ps.explosions=[]; ps.particles=[];
  ps.keys={left:false,right:false};
  ps.gold=0; ps.enemiesSunk=0; ps.timer=90;
  ps.wind={angle:Math.random()*Math.PI*2, speed:0.3+Math.random()*0.4};
  ps.windTimer=300; ps.spawnTimer=50; ps.chestTimer=90;

  for(let i=0;i<2;i++) psSpawnEnemy();
  for(let i=0;i<2;i++) psSpawnChest();

  showScreen('piratesim');

  const canvas=document.getElementById('psCanvas');
  ps.canvas=canvas;
  const dw=Math.min(window.innerWidth,1080);
  const dh=Math.round(dw*ps.LH/ps.LW);
  canvas.width=ps.LW; canvas.height=ps.LH;
  canvas.style.width=dw+'px'; canvas.style.height=dh+'px';
  ps.ctx=canvas.getContext('2d');
  initPSOcean(dw, dh);

  ps._keydown=e=>{
    if(['ArrowLeft','a','A'].includes(e.key))  { ps.keys.left=true;  e.preventDefault(); }
    if(['ArrowRight','d','D'].includes(e.key)) { ps.keys.right=true; e.preventDefault(); }
    if(e.key===' ')                            { psFirePlayer();     e.preventDefault(); }
  };
  ps._keyup=e=>{
    if(['ArrowLeft','a','A'].includes(e.key))  ps.keys.left=false;
    if(['ArrowRight','d','D'].includes(e.key)) ps.keys.right=false;
  };
  document.addEventListener('keydown',ps._keydown);
  document.addEventListener('keyup',  ps._keyup);

  canvas.onclick=e=>{
    if(!ps.running) return;
    const r=canvas.getBoundingClientRect();
    const tx=(e.clientX-r.left)*(ps.LW/r.width);
    ps.player.x=ps.player.x*.65+tx*.35;
    psFirePlayer();
  };

  document.getElementById('psResult').style.display='none';

  ps.timerInt=setInterval(()=>{
    if(!ps.running) return;
    ps.timer--;
    if(ps.timer<=0){ ps.timer=0; endPirateSim(false); }
    else updatePSHud();
  },1000);

  ps.running=true; ps.lastTs=performance.now();
  ps.raf=requestAnimationFrame(psLoop);
}

function exitPirateSim() {
  const ps=PS; ps.running=false;
  if(ps.raf)      { cancelAnimationFrame(ps.raf); ps.raf=null; }
  if(ps.timerInt) { clearInterval(ps.timerInt); ps.timerInt=null; }
  if(ps._keydown) document.removeEventListener('keydown',ps._keydown);
  if(ps._keyup)   document.removeEventListener('keyup',  ps._keyup);
  disposePSOcean();
  showTitle();
}

function psKey(dir,down) { if(PS.keys) PS.keys[dir]=down; }

function psFirePlayer() {
  const p=PS.player;
  if(!PS.running||!p||p.fireCd>0) return;
  PS.pBullets.push({worldX:p.x, depth:0.91, speed:0.038});
  p.fireCd=20;
  if(typeof snd!=='undefined') snd.cannon();
}

function psSpawnEnemy() {
  const ps=PS, p=ps.player;
  const worldX=p.x+(Math.random()-.5)*460;
  const types=[
    {type:'merchant',speed:0.005,hp:30,gold:60,color:'#4080d0',fires:false,fireCdBase:999},
    {type:'pirate',  speed:0.011,hp:25,gold:35,color:'#cc2030',fires:true, fireCdBase:80},
    {type:'navy',    speed:0.008,hp:50,gold:50,color:'#304090',fires:true, fireCdBase:65},
  ];
  const t=types[Math.floor(Math.random()*types.length)];
  ps.enemies.push({worldX,depth:0.0,...t,maxHp:t.hp,
    fireCd:t.fireCdBase+Math.random()*40});
}

function psSpawnChest() {
  const ps=PS, p=ps.player;
  const worldX=p.x+(Math.random()-.5)*360;
  ps.chests.push({worldX,depth:0.0,speed:0.0045+Math.random()*0.002,
    gold:20+Math.floor(Math.random()*40)});
}

function psSpawnHit(sx,sy,big) {
  const maxR=big?88:55; PS.explosions.push({x:sx,y:sy,r:0,maxR,life:1,spd:big?3.5:2.2});
  if(typeof snd!=='undefined') { if(big) snd.explode(); else snd.hit(); }
  const n=big?10:5;
  for(let i=0;i<n;i++){
    const a=Math.random()*Math.PI*2, s=1.5+Math.random()*3;
    PS.particles.push({x:sx,y:sy,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,
      r:2+Math.random()*3,color:Math.random()>.4?'#ff8020':'#ffd040'});
  }
}

function psScreenPos(worldX,depth) {
  const ps=PS, HY=Math.round(ps.LH*ps.HY_RATIO);
  return {
    sx: ps.LW/2+(worldX-ps.player.x)*depth*2.6,
    sy: HY+(ps.LH-HY)*depth*0.88,
  };
}

function psLoop(ts) {
  if(!PS.running) return;
  const dt=Math.min((ts-PS.lastTs)/16.67,4);
  PS.lastTs=ts;
  psUpdate(dt);
  psDraw();
  PS.raf=requestAnimationFrame(psLoop);
}

function psUpdate(dt) {
  const ps=PS, p=ps.player;
  if(!p) return;

  if(ps.keys.left)  p.x-=p.speed*dt;
  if(ps.keys.right) p.x+=p.speed*dt;
  p.x=Math.max(ps.LW*.1,Math.min(ps.LW*.9,p.x));
  if(p.fireCd>0)     p.fireCd-=dt;
  if(p.invincible>0) p.invincible-=dt;

  for(let i=ps.enemies.length-1;i>=0;i--){
    const e=ps.enemies[i];
    e.depth+=e.speed*dt;
    if(e.fires&&e.depth>.48&&e.depth<.96){
      e.fireCd-=dt;
      if(e.fireCd<=0){
        e.fireCd=e.fireCdBase+Math.random()*40;
        const {sx,sy}=psScreenPos(e.worldX,e.depth);
        const tx=ps.LW/2, ty=ps.LH-55;
        const dx=tx-sx, dy=ty-sy, d=Math.sqrt(dx*dx+dy*dy)||1;
        const spd=3.5+e.depth*2.5;
        ps.eBullets.push({x:sx,y:sy,vx:dx/d*spd,vy:dy/d*spd,
          r:Math.max(3,e.depth*9),life:70});
      }
    }
    if(e.depth>=1.02){
      if(p.invincible<=0){ p.hp-=28; p.invincible=70; }
      psSpawnHit(ps.LW/2,ps.LH-60,true);
      ps.enemies.splice(i,1);
      if(p.hp<=0){ p.hp=0; endPirateSim(true); return; }
      continue;
    }
    const {sx}=psScreenPos(e.worldX,e.depth);
    if(sx<-300||sx>ps.LW+300){ ps.enemies.splice(i,1); continue; }
  }

  for(let i=ps.pBullets.length-1;i>=0;i--){
    const b=ps.pBullets[i];
    b.depth-=b.speed*dt;
    if(b.depth<=0.0){ ps.pBullets.splice(i,1); continue; }
    let hit=false;
    for(let j=ps.enemies.length-1;j>=0;j--){
      const e=ps.enemies[j];
      if(Math.abs(b.depth-e.depth)<.07&&Math.abs(b.worldX-e.worldX)<42+e.depth*28){
        e.hp-=22;
        const {sx,sy}=psScreenPos(e.worldX,e.depth);
        psSpawnHit(sx,sy,false); ps.pBullets.splice(i,1);
        if(e.hp<=0){
          ps.gold+=e.gold; ps.enemiesSunk++;
          psSpawnHit(sx,sy,true); ps.enemies.splice(j,1);
        }
        hit=true; break;
      }
    }
    if(hit) continue;
  }

  for(let i=ps.eBullets.length-1;i>=0;i--){
    const b=ps.eBullets[i];
    b.x+=b.vx*dt; b.y+=b.vy*dt; b.life-=dt;
    if(b.life<=0||b.y>ps.LH+20){ ps.eBullets.splice(i,1); continue; }
    if(p.invincible<=0&&b.y>ps.LH-115&&Math.abs(b.x-ps.LW/2)<85){
      p.hp-=10; p.invincible=40; ps.shake=16; psSpawnHit(b.x,b.y,false);
      ps.eBullets.splice(i,1);
      if(p.hp<=0){ p.hp=0; endPirateSim(true); return; }
    }
  }

  for(let i=ps.chests.length-1;i>=0;i--){
    const c=ps.chests[i];
    c.depth+=c.speed*dt;
    if(c.depth>=1.0){
      ps.gold+=c.gold; psSpawnHit(ps.LW/2,ps.LH-70,false); ps.chests.splice(i,1); continue;
    }
    const {sx}=psScreenPos(c.worldX,c.depth);
    if(sx<-200||sx>ps.LW+200){ ps.chests.splice(i,1); continue; }
  }

  for(let i=ps.explosions.length-1;i>=0;i--){
    const ex=ps.explosions[i]; ex.r+=ex.spd*dt; ex.life-=0.05*dt;
    if(ex.life<=0) ps.explosions.splice(i,1);
  }
  for(let i=ps.particles.length-1;i>=0;i--){
    const pt=ps.particles[i];
    pt.x+=pt.vx*dt; pt.y+=pt.vy*dt; pt.vy+=0.08*dt; pt.life-=0.045*dt;
    if(pt.life<=0) ps.particles.splice(i,1);
  }

  ps.spawnTimer-=dt;
  if(ps.spawnTimer<=0){if(ps.enemies.length<5)psSpawnEnemy();ps.spawnTimer=65+Math.random()*55;}
  ps.chestTimer-=dt;
  if(ps.chestTimer<=0){if(ps.chests.length<4)psSpawnChest();ps.chestTimer=95+Math.random()*70;}
  ps.shake=Math.max(0,(ps.shake||0)-1.6*dt);
  ps.windTimer-=dt;
  if(ps.windTimer<=0){
    ps.wind.angle+=(Math.random()-.5)*Math.PI*.8; ps.wind.speed=0.3+Math.random()*0.5;
    ps.windTimer=280+Math.random()*200;
  }
  updatePSHud();
}

function updatePSHud() {
  const ps=PS, p=ps.player; if(!p) return;
  document.getElementById('psHpBar').style.width=(Math.max(0,p.hp)/p.maxHp*100)+'%';
  document.getElementById('psHpLabel').textContent='HP '+Math.max(0,p.hp)+'/'+p.maxHp;
  document.getElementById('psGoldHud').textContent='💰 '+ps.gold+'G';
  document.getElementById('psTimerHud').textContent=ps.timer;
  const wn=['東','南東','南','南西','西','北西','北','北東'];
  const wi=Math.round(((ps.wind.angle%(Math.PI*2))+(Math.PI*2))%(Math.PI*2)/(Math.PI/4))%8;
  document.getElementById('psWindHud').textContent='🌬 '+wn[wi];
}

function psDraw() {
  const ps=PS, ctx=ps.ctx, W=ps.LW, H=ps.LH, p=ps.player;
  if(!ctx||!p) return;
  const HY=Math.round(H*ps.HY_RATIO), CVP=W/2;

  // Three.js ocean renders first (separate canvas behind)
  renderPSOcean();

  // Clear 2D canvas for transparent overlay
  ctx.clearRect(0,0,W,H);

  // Screen shake
  const shk=ps.shake||0;
  if(shk>0){ctx.save();ctx.translate((Math.random()-.5)*shk,(Math.random()-.5)*shk*.6);}

  // ── Sky (2D: stars/moon/clouds only — no fill background) ──

  // Stars
  const sT=Date.now()*.0004;
  for(let i=0;i<42;i++){
    const sx=(i*137.5+17)%W, sy=(i*61.8+9)%(HY*.86);
    const twk=Math.sin(sT+i*2.3)*.3+.7;
    ctx.globalAlpha=(.35+((i*31)%10)*.055)*twk; ctx.fillStyle='#fffce8';
    const sr=i%9===0?1.4:.68;
    ctx.beginPath(); ctx.arc(sx,sy,sr,0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha=1;

  // Moon (larger, with atmospheric glow layers)
  const mX=W*.78, mY=HY*.2;
  ctx.save();
  // Outer atmospheric halo
  const mHalo=ctx.createRadialGradient(mX,mY,18,mX,mY,75);
  mHalo.addColorStop(0,'rgba(180,200,245,.18)'); mHalo.addColorStop(.5,'rgba(160,185,235,.06)'); mHalo.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=mHalo; ctx.beginPath(); ctx.arc(mX,mY,75,0,Math.PI*2); ctx.fill();
  // Inner glow
  const mGlow=ctx.createRadialGradient(mX,mY,12,mX,mY,36);
  mGlow.addColorStop(0,'rgba(200,218,255,.35)'); mGlow.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=mGlow; ctx.beginPath(); ctx.arc(mX,mY,36,0,Math.PI*2); ctx.fill();
  // Moon disc
  ctx.shadowColor='rgba(200,215,255,.5)'; ctx.shadowBlur=20;
  ctx.fillStyle='#dce6f8';
  ctx.beginPath(); ctx.arc(mX,mY,22,0,Math.PI*2); ctx.fill();
  // Shadow (crescent effect)
  ctx.fillStyle='#08101e';
  ctx.beginPath(); ctx.arc(mX+8,mY-4,19,0,Math.PI*2); ctx.fill();
  ctx.restore();

  // Animated clouds (4 layers, different speeds/opacities)
  const cT=Date.now()*.000028;
  const clouds=[
    {ox:-.18,oy:.08,w:.38,h:.09,a:.18,spd:.6},{ox:.28,oy:.14,w:.32,h:.08,a:.14,spd:.4},
    {ox:-.38,oy:.22,w:.55,h:.12,a:.22,spd:.25},{ox:.08,oy:.28,w:.45,h:.1,a:.16,spd:.35},
    {ox:-.55,oy:.05,w:.28,h:.07,a:.12,spd:.5},{ox:.52,oy:.22,w:.36,h:.1,a:.2,spd:.3},
  ];
  for(const c of clouds){
    const cx=((c.ox+(cT*c.spd))%1.5-0.2)*W;
    const cy=c.oy*HY;
    const cw=c.w*W, ch=c.h*HY;
    ctx.save(); ctx.globalAlpha=c.a;
    const clG=ctx.createRadialGradient(cx,cy,ch*.1,cx,cy,cw*.52);
    clG.addColorStop(0,'rgba(55,75,115,1)'); clG.addColorStop(.55,'rgba(30,48,85,.75)'); clG.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=clG; ctx.beginPath(); ctx.ellipse(cx,cy,cw*.5,ch*.5,0,0,Math.PI*2); ctx.fill();
    // Cloud secondary blob
    ctx.fillStyle=clG; ctx.beginPath(); ctx.ellipse(cx+cw*.22,cy-ch*.1,cw*.32,ch*.4,0,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }

  // ── Sea (Three.js handles background; 2D draws overlays only) ──

  // Perspective grid lines (2D overlay on Three.js ocean)
  ctx.strokeStyle='rgba(0,80,180,.10)'; ctx.lineWidth=1;
  for(let i=-14;i<=14;i++){
    ctx.beginPath(); ctx.moveTo(CVP,HY); ctx.lineTo(CVP+i*(W/14),H); ctx.stroke();
  }
  // Racing-style center lane dashes
  const dashSegs=14;
  for(let d=0;d<dashSegs;d++){
    if(d%2===0) continue;
    const d0=d/dashSegs, d1=(d+1)/dashSegs;
    const y0=HY+(H-HY)*Math.pow(d0,.82), y1=HY+(H-HY)*Math.pow(d1,.82);
    const x0=CVP+(p.x-400)*d0*0.06, x1=CVP+(p.x-400)*d1*0.06;
    ctx.strokeStyle='rgba(200,175,80,.18)'; ctx.lineWidth=Math.max(1,d0*3);
    ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.stroke();
  }
  // Side lane edge lines
  const laneW=W*.28;
  ctx.strokeStyle='rgba(0,160,220,.10)'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(CVP-laneW*.05,HY+4); ctx.lineTo(CVP-laneW,H); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(CVP+laneW*.05,HY+4); ctx.lineTo(CVP+laneW,H); ctx.stroke();

  // Moonlight reflection path on ocean (bright vertical stripe like reference image)
  const moonPathX=W*.72;
  const mlPath=ctx.createLinearGradient(moonPathX-W*.22,HY,moonPathX+W*.22,HY);
  mlPath.addColorStop(0,'rgba(0,0,0,0)'); mlPath.addColorStop(.38,'rgba(175,195,235,.14)'); mlPath.addColorStop(.5,'rgba(190,210,250,.22)'); mlPath.addColorStop(.62,'rgba(175,195,235,.14)'); mlPath.addColorStop(1,'rgba(0,0,0,0)');
  const mlVert=ctx.createLinearGradient(0,HY,0,H);
  mlVert.addColorStop(0,'rgba(200,215,255,.0)'); mlVert.addColorStop(.3,'rgba(200,215,255,.1)'); mlVert.addColorStop(1,'rgba(200,215,255,.05)');
  ctx.fillStyle=mlVert; ctx.fillRect(0,HY,W,H-HY);
  // The shimmering stripe
  const mlStripe=ctx.createRadialGradient(moonPathX,HY+2,2,moonPathX,HY+2,W*.28);
  mlStripe.addColorStop(0,'rgba(200,218,255,.28)'); mlStripe.addColorStop(.45,'rgba(160,185,235,.1)'); mlStripe.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=mlStripe; ctx.fillRect(moonPathX-W*.3,HY,W*.6,H-HY);

  // Distant silhouette structures on horizon (like reference cities in background)
  ctx.save(); ctx.globalAlpha=.45;
  // Left structure (castle/city silhouette)
  const structs=[{x:W*.12,h:45,w:55},{x:W*.82,h:38,w:48}];
  for(const s of structs){
    ctx.fillStyle='rgba(12,16,30,.88)';
    ctx.fillRect(s.x-s.w/2, HY-s.h, s.w, s.h+2);
    // Tower spires
    for(let t2=-1;t2<=1;t2+=2){
      ctx.beginPath(); ctx.moveTo(s.x+t2*s.w*.35,HY-s.h); ctx.lineTo(s.x+t2*s.w*.35,HY-s.h-18); ctx.lineTo(s.x+t2*s.w*.35+t2*6,HY-s.h); ctx.closePath(); ctx.fill();
    }
    // Faint glow (lights of the city)
    const cityG=ctx.createRadialGradient(s.x,HY,1,s.x,HY,s.w*.8);
    cityG.addColorStop(0,'rgba(80,120,200,.12)'); cityG.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=cityG; ctx.fillRect(s.x-s.w,HY-s.h-5,s.w*2,s.h+5);
  }
  ctx.restore();

  const mistG=ctx.createLinearGradient(0,HY-18,0,HY+14);
  mistG.addColorStop(0,'rgba(80,120,180,0)'); mistG.addColorStop(.5,'rgba(80,120,180,.18)'); mistG.addColorStop(1,'rgba(80,120,180,0)');
  ctx.fillStyle=mistG; ctx.fillRect(0,HY-18,W,32);

  // ── Z-sort entities (far first) ──
  const ents=[
    ...ps.enemies.map(e=>({...e,_kind:'enemy'})),
    ...ps.chests.map(c=>({...c,_kind:'chest'})),
  ].sort((a,b)=>a.depth-b.depth);

  ents.forEach(ent=>{
    const {sx,sy}=psScreenPos(ent.worldX,ent.depth);
    if(sx<-260||sx>W+260) return;
    const scale=Math.max(.06,ent.depth*1.7+.06);
    // Depth fog: entities emerging from sea mist near horizon
    const fogAlpha = ent.depth < 0.18 ? ent.depth / 0.18 : 1.0;
    if(fogAlpha < 1) ctx.save(), ctx.globalAlpha = fogAlpha;
    if(ent._kind==='enemy'){
      if (!ent._has3D) drawPSEnemyFront(ctx,sx,sy,scale,ent.color,ent.type,ent.hp/ent.maxHp);
      if(ent.depth>.28){
        const bw=60*scale, bh=Math.max(2,5*scale), by=sy-42*scale;
        ctx.fillStyle='rgba(0,0,0,.6)'; ctx.fillRect(sx-bw/2,by,bw,bh);
        ctx.fillStyle=ent.hp/ent.maxHp>.5?'#40d060':'#e03020';
        ctx.fillRect(sx-bw/2,by,bw*(ent.hp/ent.maxHp),bh);
      }
      if(ent.depth<.25){
        ctx.font='9px sans-serif'; ctx.fillStyle='rgba(200,180,120,.5)'; ctx.textAlign='center';
        ctx.fillText({merchant:'商船',pirate:'海賊',navy:'軍艦'}[ent.type]||'',sx,sy+10);
      }
    } else {
      drawPSChestPersp(ctx,sx,sy,scale);
    }
    if(fogAlpha < 1) ctx.restore();
  });

  // ── Player cannonballs ──
  ps.pBullets.forEach(b=>{
    const {sx,sy}=psScreenPos(b.worldX,b.depth);
    if(sx<-20||sx>W+20) return;
    const r=Math.max(3,(1-b.depth)*12+3);
    // Smoke trail
    ctx.save();
    for(let i=1;i<=3;i++){
      const {sx:tx,sy:ty}=psScreenPos(b.worldX,Math.min(1,b.depth+i*.06));
      const tr=r*.65*(1-i*.22), ta=(1-i*.3)*.28;
      ctx.globalAlpha=ta; ctx.fillStyle='rgba(200,195,185,1)';
      ctx.beginPath(); ctx.arc(tx,ty,tr,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
    // Iron ball
    const ballG=ctx.createRadialGradient(sx-r*.3,sy-r*.3,r*.1,sx,sy,r);
    ballG.addColorStop(0,'#5a5850'); ballG.addColorStop(.6,'#282520'); ballG.addColorStop(1,'#100e0c');
    ctx.save(); ctx.shadowColor='rgba(255,180,20,.45)'; ctx.shadowBlur=6;
    ctx.fillStyle=ballG; ctx.beginPath(); ctx.arc(sx,sy,r,0,Math.PI*2); ctx.fill();
    // Highlight
    ctx.globalAlpha=.35; ctx.fillStyle='#8a8680';
    ctx.beginPath(); ctx.arc(sx-r*.28,sy-r*.3,r*.3,0,Math.PI*2); ctx.fill();
    ctx.restore();
  });

  // ── Enemy cannonballs ──
  ps.eBullets.forEach(b=>{
    // Fiery glow
    ctx.save();
    const egG=ctx.createRadialGradient(b.x,b.y,b.r*.2,b.x,b.y,b.r*2.8);
    egG.addColorStop(0,'rgba(255,160,20,.55)'); egG.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=egG; ctx.beginPath(); ctx.arc(b.x,b.y,b.r*2.8,0,Math.PI*2); ctx.fill();
    const ebG=ctx.createRadialGradient(b.x-b.r*.3,b.y-b.r*.3,b.r*.1,b.x,b.y,b.r);
    ebG.addColorStop(0,'#d04020'); ebG.addColorStop(.6,'#8a1808'); ebG.addColorStop(1,'#3a0802');
    ctx.fillStyle=ebG; ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fill();
    ctx.restore();
  });

  // ── Explosions (multi-layer fire) ──
  ps.explosions.forEach(ex=>{
    ctx.save();
    // Outer smoke ring
    ctx.globalAlpha=ex.life*.35;
    const smkG=ctx.createRadialGradient(ex.x,ex.y,ex.r*.5,ex.x,ex.y,ex.r*1.1);
    smkG.addColorStop(0,'rgba(130,118,100,.5)'); smkG.addColorStop(1,'rgba(80,72,60,0)');
    ctx.fillStyle=smkG; ctx.beginPath(); ctx.arc(ex.x,ex.y,ex.r*1.1,0,Math.PI*2); ctx.fill();
    // Fire ring
    ctx.globalAlpha=ex.life*.7;
    const firG=ctx.createRadialGradient(ex.x,ex.y,ex.r*.18,ex.x,ex.y,ex.r*.85);
    firG.addColorStop(0,'rgba(255,245,50,.0)'); firG.addColorStop(.4,'rgba(255,160,20,.9)'); firG.addColorStop(.75,'rgba(200,60,5,.6)'); firG.addColorStop(1,'rgba(80,20,0,0)');
    ctx.fillStyle=firG; ctx.beginPath(); ctx.arc(ex.x,ex.y,ex.r*.85,0,Math.PI*2); ctx.fill();
    // Core flash
    ctx.globalAlpha=ex.life*.85*(1-ex.r/ex.maxR||1);
    const coreG=ctx.createRadialGradient(ex.x,ex.y,0,ex.x,ex.y,ex.r*.42);
    coreG.addColorStop(0,'rgba(255,252,200,.95)'); coreG.addColorStop(.5,'rgba(255,200,60,.7)'); coreG.addColorStop(1,'rgba(255,100,10,0)');
    ctx.fillStyle=coreG; ctx.beginPath(); ctx.arc(ex.x,ex.y,ex.r*.42,0,Math.PI*2); ctx.fill();
    ctx.restore();
  });

  // ── Particles ──
  ps.particles.forEach(pt=>{
    ctx.save(); ctx.globalAlpha=Math.pow(pt.life,.6);
    const ptG=ctx.createRadialGradient(pt.x,pt.y,0,pt.x,pt.y,pt.r*pt.life+.5);
    ptG.addColorStop(0,pt.color); ptG.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=ptG; ctx.beginPath(); ctx.arc(pt.x,pt.y,pt.r*pt.life+.5,0,Math.PI*2); ctx.fill();
    ctx.restore();
  });

  // ── Player ship (rear / TPP view) ──
  drawPSPlayerRear(ctx,W,H,p);

  // ── Wind compass ──
  const wx=W-36, wy=H-46;
  ctx.save(); ctx.translate(wx,wy);
  ctx.strokeStyle='rgba(150,130,80,.5)'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.arc(0,0,20,0,Math.PI*2); ctx.stroke();
  ctx.rotate(ps.wind.angle);
  ctx.fillStyle='rgba(90,170,255,.82)';
  ctx.beginPath(); ctx.moveTo(0,-15); ctx.lineTo(4,2); ctx.lineTo(0,5); ctx.lineTo(-4,2); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.font='9px sans-serif'; ctx.fillStyle='rgba(130,170,200,.6)'; ctx.textAlign='center';
  ctx.fillText('風',wx,wy+28);

  // ── Danger flash ──
  const nearest=ps.enemies.reduce((m,e)=>Math.max(m,e.depth),0);
  if(nearest>.72){
    ctx.save(); ctx.globalAlpha=((nearest-.72)/.28)*(.18+Math.sin(Date.now()*.012)*.12);
    ctx.fillStyle='rgba(220,0,0,.35)'; ctx.fillRect(0,0,W,H); ctx.restore();
  }
  // ── Damage vignette ──
  if(shk>3){
    ctx.save();ctx.globalAlpha=shk/28;
    const dvG=ctx.createRadialGradient(W/2,H/2,H*.2,W/2,H/2,H*.75);
    dvG.addColorStop(0,'rgba(0,0,0,0)');dvG.addColorStop(1,'rgba(200,0,0,.65)');
    ctx.fillStyle=dvG;ctx.fillRect(0,0,W,H);ctx.restore();
  }
  if(shk>0)ctx.restore();
}

function drawPSEnemyFront(ctx,x,y,scale,color,type,hpRatio) {
  ctx.save(); ctx.translate(x,y); ctx.scale(scale,scale);
  const dmg=1-hpRatio;

  // Water reflection / shadow
  const shG=ctx.createRadialGradient(0,30,4,0,30,52);
  shG.addColorStop(0,'rgba(0,0,0,.38)'); shG.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=shG; ctx.beginPath(); ctx.ellipse(0,30,55,14,0,0,Math.PI*2); ctx.fill();

  // Bow spray (white foam at waterline)
  ctx.save(); ctx.globalAlpha=.45+(Math.sin(Date.now()*.003)*0.12);
  const spG=ctx.createRadialGradient(0,6,2,0,6,28);
  spG.addColorStop(0,'rgba(220,235,255,.7)'); spG.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=spG; ctx.beginPath(); ctx.ellipse(0,6,25,8,0,0,Math.PI*2); ctx.fill();
  ctx.restore();

  // === HULL ===
  // Dark wood base (outer hull)
  const hBase=ctx.createLinearGradient(-52,4,52,28);
  hBase.addColorStop(0,'#0e0a04'); hBase.addColorStop(.5,'#1a1206'); hBase.addColorStop(1,'#0e0a04');
  ctx.fillStyle=hBase;
  ctx.beginPath(); ctx.moveTo(-52,5); ctx.lineTo(52,5); ctx.lineTo(46,30); ctx.lineTo(-46,30); ctx.closePath(); ctx.fill();
  // Colored hull layer
  const hClr=ctx.createLinearGradient(-44,4,44,28);
  hClr.addColorStop(0,shadeHex(color,-30)); hClr.addColorStop(.5,color); hClr.addColorStop(1,shadeHex(color,-30));
  ctx.fillStyle=hClr; ctx.globalAlpha=.9;
  ctx.beginPath(); ctx.moveTo(-44,5); ctx.lineTo(44,5); ctx.lineTo(39,28); ctx.lineTo(-39,28); ctx.closePath(); ctx.fill();
  ctx.globalAlpha=1;
  // Hull plank lines
  ctx.strokeStyle='rgba(0,0,0,.22)'; ctx.lineWidth=.8;
  for(let i=-3;i<=3;i++){const px=i*12;ctx.beginPath();ctx.moveTo(px,5);ctx.lineTo(px*.84,28);ctx.stroke();}
  // Gold trim line at deck
  ctx.strokeStyle='rgba(180,138,15,.65)'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(-44,5); ctx.lineTo(44,5); ctx.stroke();

  // Prow / bowsprit
  const prowClr=ctx.createLinearGradient(0,-20,0,5);
  prowClr.addColorStop(0,'#0e0a04'); prowClr.addColorStop(1,shadeHex(color,-20));
  ctx.fillStyle=prowClr;
  ctx.beginPath(); ctx.moveTo(-14,4); ctx.lineTo(14,4); ctx.quadraticCurveTo(0,2,0,-22); ctx.closePath(); ctx.fill();
  // Figurehead glow (small ornament at prow tip)
  ctx.fillStyle='rgba(200,160,20,.55)';
  ctx.beginPath(); ctx.arc(0,-21,2.5,0,Math.PI*2); ctx.fill();

  // Cannon ports (both sides of hull)
  const cpClr='rgba(0,0,0,.75)';
  ctx.fillStyle=cpClr;
  for(const side of[-1,1]){
    const cx=side*48, cy=12, w=13, h=9;
    ctx.fillRect(cx-w/2,cy-h/2,w,h);
    // Canon barrel hint
    if(type==='navy'||type==='pirate'){
      ctx.fillStyle='rgba(30,25,18,.9)';
      ctx.fillRect(cx-w/2+1,cy-h/2+1,w-2,h-2);
      ctx.fillStyle=cpClr;
    }
    // Second gun port (navy only)
    if(type==='navy'){ctx.fillRect(cx-w/2,cy+8,w,h);}
  }

  // === MASTS ===
  const mastClr='#1a0e04';
  // Main mast
  ctx.strokeStyle=mastClr; ctx.lineWidth=5;
  ctx.beginPath(); ctx.moveTo(0,4); ctx.lineTo(0,-105); ctx.stroke();
  // Fore mast
  ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(-24,4); ctx.lineTo(-20,-72); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(24,4); ctx.lineTo(20,-72); ctx.stroke();
  // Yardarms
  ctx.lineWidth=3.5;
  ctx.beginPath(); ctx.moveTo(-52,-92); ctx.lineTo(52,-92); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-42,-60); ctx.lineTo(42,-60); ctx.stroke();
  ctx.lineWidth=2.5;
  ctx.beginPath(); ctx.moveTo(-30,-102); ctx.lineTo(30,-102); ctx.stroke();
  ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(-35,-70); ctx.lineTo(-12,-70); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(12,-70); ctx.lineTo(35,-70); ctx.stroke();
  // Rigging
  ctx.strokeStyle='rgba(50,35,12,.45)'; ctx.lineWidth=1;
  [[0,-105,-55,-2],[0,-105,55,-2],[0,-62,-40,-2],[0,-62,40,-2]].forEach(([x1,y1,x2,y2])=>{
    ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
  });

  // === SAILS ===
  const sailDmgAlpha=hpRatio>.5?1:.72;
  // Determine sail colors by type
  const sailColors={
    merchant:['rgba(210,200,165,.9)','rgba(190,182,148,.85)'],
    pirate:  ['rgba(28,24,18,.92)','rgba(22,18,14,.88)'],
    navy:    ['rgba(228,226,220,.92)','rgba(200,198,190,.85)'],
  };
  const [sc1,sc2]=sailColors[type]||sailColors.merchant;
  const sailBow=Math.sin(Date.now()*.0008)*3.5;

  // Main sail (tier 1 — lower large)
  ctx.globalAlpha=sailDmgAlpha;
  const s1G=ctx.createLinearGradient(-52,-92,52,-60);
  s1G.addColorStop(0,sc2); s1G.addColorStop(.5,sc1); s1G.addColorStop(1,sc2);
  ctx.fillStyle=s1G;
  ctx.beginPath();
  ctx.moveTo(-52,-60); ctx.quadraticCurveTo(-55+sailBow,-76,-50,-92);
  ctx.lineTo(50,-92); ctx.quadraticCurveTo(55-sailBow,-76,52,-60);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle='rgba(80,65,40,.3)'; ctx.lineWidth=.8; ctx.stroke();

  // Top sail (tier 2)
  const s2G=ctx.createLinearGradient(-32,-104,32,-92);
  s2G.addColorStop(0,sc2); s2G.addColorStop(.5,sc1); s2G.addColorStop(1,sc2);
  ctx.fillStyle=s2G;
  ctx.beginPath();
  ctx.moveTo(-32,-92); ctx.quadraticCurveTo(-35+sailBow*.6,-98,-30,-104);
  ctx.lineTo(30,-104); ctx.quadraticCurveTo(35-sailBow*.6,-98,32,-92);
  ctx.closePath(); ctx.fill(); ctx.stroke();

  // Side sails
  ctx.fillStyle=s2G;
  ctx.beginPath(); ctx.moveTo(-35,-50);ctx.quadraticCurveTo(-38+sailBow*.5,-60,-33,-72);ctx.lineTo(-12,-72);ctx.quadraticCurveTo(-14-sailBow*.3,-60,-12,-50);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.beginPath(); ctx.moveTo(12,-50);ctx.quadraticCurveTo(14-sailBow*.3,-60,12,-72);ctx.lineTo(33,-72);ctx.quadraticCurveTo(38-sailBow*.5,-60,35,-50);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.globalAlpha=1;

  // Type-specific sail markings
  if(type==='pirate'){
    ctx.save(); ctx.globalAlpha=.55; ctx.fillStyle='#050505';
    ctx.font='28px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('☠',0,-76); ctx.restore();
  } else if(type==='navy'){
    ctx.strokeStyle='rgba(190,5,5,.62)'; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.moveTo(0,-92); ctx.lineTo(0,-60); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-30,-76); ctx.lineTo(30,-76); ctx.stroke();
  } else {
    // Merchant: small blue company flag
    ctx.fillStyle='rgba(40,80,180,.45)';
    ctx.fillRect(-8,-106,16,9);
  }

  // Damage smoke (if hurt)
  if(dmg>.25){
    ctx.save(); ctx.globalAlpha=dmg*.4;
    const smkG=ctx.createRadialGradient(0,-52,2,0,-52,22+dmg*18);
    smkG.addColorStop(0,'rgba(150,140,125,.7)'); smkG.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=smkG; ctx.beginPath(); ctx.arc(0,-52,22+dmg*18,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

function shadeHex(hex,amt){
  const n=parseInt(hex.slice(1),16);
  const r=Math.max(0,Math.min(255,((n>>16)&255)+amt));
  const g=Math.max(0,Math.min(255,((n>>8)&255)+amt));
  const b=Math.max(0,Math.min(255,(n&255)+amt));
  return `rgb(${r},${g},${b})`;
}

function drawPSChestPersp(ctx,x,y,scale) {
  const s=Math.max(.28,scale);
  ctx.save(); ctx.translate(x,y); ctx.scale(s,s);
  const bob=Math.sin(Date.now()*.0032)*2.5;
  ctx.translate(0,bob);
  // Glow
  ctx.save();
  const glG=ctx.createRadialGradient(0,-2,2,0,-2,26);
  glG.addColorStop(0,'rgba(240,195,30,.55)'); glG.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=glG; ctx.beginPath(); ctx.arc(0,-2,26,0,Math.PI*2); ctx.fill();
  ctx.restore();
  // Chest shadow
  ctx.fillStyle='rgba(0,0,0,.35)';
  ctx.beginPath(); ctx.ellipse(0,10,16,5,0,0,Math.PI*2); ctx.fill();
  // Chest body
  const cBG=ctx.createLinearGradient(-14,0,14,16);
  cBG.addColorStop(0,'#7a3e08'); cBG.addColorStop(.5,'#5c2e06'); cBG.addColorStop(1,'#3a1c04');
  ctx.fillStyle=cBG; ctx.fillRect(-14,0,28,16);
  // Metal bands
  ctx.fillStyle='rgba(140,100,15,.7)'; ctx.fillRect(-14,6,28,2); ctx.fillRect(-14,2,2,14); ctx.fillRect(12,2,2,14);
  // Lid
  const cLG=ctx.createLinearGradient(-14,-12,14,0);
  cLG.addColorStop(0,'#9a5010'); cLG.addColorStop(.5,'#c86818'); cLG.addColorStop(1,'#7a3e08');
  ctx.fillStyle=cLG;
  ctx.beginPath(); ctx.moveTo(-14,0); ctx.lineTo(14,0); ctx.lineTo(13,-12); ctx.arcTo(0,-18,-13,-12,8); ctx.lineTo(-13,-12); ctx.closePath(); ctx.fill();
  // Lid band
  ctx.strokeStyle='rgba(150,110,18,.8)'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(-14,0); ctx.lineTo(14,0); ctx.stroke();
  // Lock
  const lkG=ctx.createRadialGradient(-1,-3,1,-1,-3,5);
  lkG.addColorStop(0,'#f0d040'); lkG.addColorStop(.5,'#c8a020'); lkG.addColorStop(1,'#8a6810');
  ctx.fillStyle=lkG; ctx.beginPath(); ctx.arc(0,-2,5,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='rgba(80,60,8,.8)'; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(0,-2,5,0,Math.PI*2); ctx.stroke();
  ctx.fillStyle='rgba(80,60,8,.6)'; ctx.fillRect(-2,0,4,4);
  // Sparkle
  const sp=Math.sin(Date.now()*.006)*.5+.5;
  ctx.save(); ctx.globalAlpha=sp*.8; ctx.fillStyle='#fffce0';
  ctx.beginPath(); ctx.arc(6,-9,1.5,0,Math.PI*2); ctx.fill();
  ctx.restore();
  ctx.restore();
}

function drawPSPlayerRear(ctx,W,H,player) {
  const T=Date.now(), drift=(player.x-400)*0.10;
  const cx=W/2+drift, cy=H-82;
  ctx.save(); ctx.translate(cx,cy);

  const sw=158, hullH=74;
  const galY=-hullH*.5;      // gallery top (local y = -37)
  const deckY=galY-4;        // deck rail   (local y = -41)
  const mastBase=deckY-3;    // mast base   (local y = -44)

  // ── WAKE ──
  const wkG=ctx.createRadialGradient(0,22,6,0,58,135);
  wkG.addColorStop(0,'rgba(160,210,245,.68)'); wkG.addColorStop(.45,'rgba(75,145,210,.22)'); wkG.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=wkG;
  ctx.beginPath(); ctx.moveTo(-7,3); ctx.lineTo(-140,112); ctx.quadraticCurveTo(-38,72,0,55); ctx.quadraticCurveTo(38,72,140,112); ctx.lineTo(7,3); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.globalAlpha=.42;
  for(let i=0;i<5;i++){
    const fw=(i-2)*22, fp=((T*.0009+i*.32)%1);
    ctx.strokeStyle=`rgba(200,235,255,${(1-fp)*.56})`; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(fw,4); ctx.lineTo(fw*2.5+Math.sin(fp*9)*5,22+fp*80); ctx.stroke();
  }
  ctx.restore();

  // ── HULL (very dark galleon stern) ──
  ctx.fillStyle='rgba(0,0,0,.4)';
  ctx.beginPath(); ctx.ellipse(0,hullH*.52+18,sw*.72,19,0,0,Math.PI*2); ctx.fill();
  const hG=ctx.createLinearGradient(0,galY,0,hullH*.52);
  hG.addColorStop(0,'#140b04'); hG.addColorStop(.45,'#0d0704'); hG.addColorStop(1,'#070402');
  ctx.fillStyle=hG;
  ctx.beginPath(); ctx.moveTo(-sw/2-24,hullH*.52); ctx.lineTo(sw/2+24,hullH*.52); ctx.lineTo(sw/2+2,galY); ctx.lineTo(-sw/2-2,galY); ctx.closePath(); ctx.fill();
  // Subtle wood sheen
  ctx.save(); ctx.globalAlpha=.06;
  for(let i=-4;i<=4;i++){ const bx=i*(sw/8); ctx.fillStyle='rgba(80,45,10,1)'; ctx.fillRect(bx-1,galY,2,hullH); }
  ctx.restore();

  // ── STERN GALLERY (ornate windows) ──
  const galW=sw*.9, galH=64;
  const galBg=ctx.createLinearGradient(0,galY,0,galY+galH);
  galBg.addColorStop(0,'#100808'); galBg.addColorStop(.5,'#181008'); galBg.addColorStop(1,'#100808');
  ctx.fillStyle=galBg; ctx.fillRect(-galW/2,galY,galW,galH);
  // Top gold border
  ctx.strokeStyle='rgba(172,126,16,.82)'; ctx.lineWidth=2.5;
  ctx.beginPath(); ctx.moveTo(-galW/2,galY+1); ctx.lineTo(galW/2,galY+1); ctx.stroke();
  // Decorative pilasters
  for(let i=0;i<=6;i++){
    const px=-galW/2+i*(galW/6);
    const pg=ctx.createLinearGradient(px-3,0,px+3,0);
    pg.addColorStop(0,'rgba(0,0,0,0)'); pg.addColorStop(.5,'rgba(155,112,15,.28)'); pg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=pg; ctx.fillRect(px-3,galY,6,galH);
  }

  // Upper tier: 3 arched windows
  for(let i=-1;i<=1;i++){
    const wx=i*(galW*.31), wy=galY+5, ww=30, wh=22;
    const flk=Math.sin(T*.007+i*1.4)*.06+.44;
    // Glow halo
    const wgG=ctx.createRadialGradient(wx,wy+wh*.55,0,wx,wy+wh*.55,32);
    wgG.addColorStop(0,`rgba(255,185,55,${flk*.55})`); wgG.addColorStop(.65,`rgba(220,130,20,.12)`); wgG.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=wgG; ctx.beginPath(); ctx.arc(wx,wy+wh*.55,32,0,Math.PI*2); ctx.fill();
    // Dark frame + arch
    ctx.fillStyle='#030202';
    ctx.beginPath(); ctx.rect(wx-ww/2,wy+wh*.32,ww,wh*.68); ctx.arc(wx,wy+wh*.32,ww/2,Math.PI,0); ctx.fill();
    // Amber glass
    ctx.fillStyle=`rgba(255,185,50,${flk})`;
    ctx.beginPath(); ctx.rect(wx-ww/2+2,wy+wh*.32+1,ww-4,wh*.68-2); ctx.arc(wx,wy+wh*.32,ww/2-2,Math.PI,0); ctx.fill();
    // Gold arch frame
    ctx.strokeStyle='rgba(162,116,14,.84)'; ctx.lineWidth=1.8;
    ctx.beginPath(); ctx.rect(wx-ww/2,wy+wh*.32,ww,wh*.68); ctx.stroke();
    ctx.beginPath(); ctx.arc(wx,wy+wh*.32,ww/2,Math.PI,0); ctx.stroke();
  }

  // Middle row: 5 rectangular windows
  const mwy=galY+33;
  for(let i=-2;i<=2;i++){
    const wx=i*(galW*.185), ww=18, wh=13;
    const flk=Math.sin(T*.008+i*.9)*.05+.36;
    ctx.fillStyle=`rgba(255,175,45,${flk*.4})`; ctx.fillRect(wx-ww/2-4,mwy-3,ww+8,wh+6);
    ctx.fillStyle='#040202'; ctx.fillRect(wx-ww/2,mwy,ww,wh);
    ctx.fillStyle=`rgba(255,175,45,${flk})`; ctx.fillRect(wx-ww/2+2,mwy+1,ww-4,wh-2);
    ctx.strokeStyle='rgba(152,108,12,.75)'; ctx.lineWidth=1.5; ctx.strokeRect(wx-ww/2,mwy,ww,wh);
    ctx.beginPath(); ctx.moveTo(wx,mwy); ctx.lineTo(wx,mwy+wh); ctx.moveTo(wx-ww/2,mwy+wh*.5); ctx.lineTo(wx+ww/2,mwy+wh*.5); ctx.stroke();
  }

  // Bottom gallery trim + balusters
  ctx.strokeStyle='rgba(168,122,14,.78)'; ctx.lineWidth=2.5;
  ctx.beginPath(); ctx.moveTo(-galW/2,galY+galH); ctx.lineTo(galW/2,galY+galH); ctx.stroke();
  for(let i=-5;i<=5;i++){
    ctx.fillStyle='rgba(160,115,16,.42)'; ctx.fillRect(i*(galW/11)-1.5,galY+galH-8,3,8);
  }

  // ── LANTERNS (like the reference — prominent golden glow) ──
  for(const side of[-1,1]){
    const lx=side*(galW/2+11), ly=galY+16;
    const flk=Math.sin(T*.008+side*2.1)*.12+.88;
    // Big warm glow
    const lgG=ctx.createRadialGradient(lx,ly,3,lx,ly,48);
    lgG.addColorStop(0,`rgba(255,205,60,${.55*flk})`); lgG.addColorStop(.4,`rgba(220,130,20,${.24*flk})`); lgG.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=lgG; ctx.beginPath(); ctx.arc(lx,ly,48,0,Math.PI*2); ctx.fill();
    // Pole
    ctx.strokeStyle='rgba(85,55,10,.92)'; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.moveTo(lx,ly-28); ctx.lineTo(lx,ly-14); ctx.stroke();
    // Pole tip
    ctx.fillStyle='rgba(85,55,10,.9)';
    ctx.beginPath(); ctx.moveTo(lx-5,ly-32); ctx.lineTo(lx+5,ly-32); ctx.lineTo(lx,ly-38); ctx.closePath(); ctx.fill();
    // Hexagonal cage body
    ctx.fillStyle='rgba(42,26,4,.94)';
    ctx.beginPath();
    for(let k=0;k<6;k++){const a=(k/6)*Math.PI*2-Math.PI/2; (k===0?ctx.moveTo:ctx.lineTo).call(ctx,lx+Math.cos(a)*9.5,ly-14+Math.sin(a)*9.5);}
    ctx.closePath(); ctx.fill();
    // Flame
    ctx.fillStyle=`rgba(255,218,60,${.92*flk})`;
    ctx.beginPath();
    for(let k=0;k<6;k++){const a=(k/6)*Math.PI*2-Math.PI/2; (k===0?ctx.moveTo:ctx.lineTo).call(ctx,lx+Math.cos(a)*6.5,ly-14+Math.sin(a)*6.5);}
    ctx.closePath(); ctx.fill();
    // Bottom tassel
    ctx.strokeStyle='rgba(95,65,10,.82)'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(lx,ly-4); ctx.lineTo(lx,ly+5); ctx.stroke();
    ctx.fillStyle='rgba(85,55,8,.88)'; ctx.beginPath(); ctx.arc(lx,ly+5,3.5,0,Math.PI*2); ctx.fill();
  }

  // ── DECK ──
  const dkG=ctx.createLinearGradient(0,deckY,0,deckY-18);
  dkG.addColorStop(0,'#180c05'); dkG.addColorStop(1,'#0c0804');
  ctx.fillStyle=dkG;
  ctx.beginPath(); ctx.moveTo(-sw/2-2,deckY); ctx.lineTo(sw/2+2,deckY); ctx.lineTo(sw/2+10,deckY-18); ctx.lineTo(-sw/2-10,deckY-18); ctx.closePath(); ctx.fill();
  ctx.strokeStyle='rgba(42,26,5,.6)'; ctx.lineWidth=1.5;
  for(let i=-6;i<=6;i++){const rx=i*(sw/12); ctx.beginPath(); ctx.moveTo(rx,deckY); ctx.lineTo(rx*1.06,deckY-18); ctx.stroke();}

  // ── RIGGING ──
  ctx.strokeStyle='rgba(48,30,8,.52)'; ctx.lineWidth=1;
  const rigs=[[0,mastBase-240,-105,mastBase-58],[0,mastBase-240,105,mastBase-58],[0,mastBase-168,-86,mastBase-30],[0,mastBase-168,86,mastBase-30],[-48,mastBase-162,-90,mastBase-74],[48,mastBase-162,90,mastBase-74],[-48,mastBase-104,-78,mastBase-44],[48,mastBase-104,78,mastBase-44]];
  for(const[x1,y1,x2,y2]of rigs){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}

  // ── MASTS ──
  ctx.strokeStyle='#0c0804'; ctx.lineWidth=10;
  ctx.beginPath(); ctx.moveTo(0,mastBase); ctx.lineTo(0,mastBase-240); ctx.stroke();
  ctx.lineWidth=6;
  ctx.beginPath(); ctx.moveTo(-48,mastBase); ctx.lineTo(-42,mastBase-162); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(48,mastBase);  ctx.lineTo(42,mastBase-162);  ctx.stroke();
  // Yardarms
  ctx.lineWidth=5;
  ctx.beginPath(); ctx.moveTo(-62,mastBase-82); ctx.lineTo(62,mastBase-82); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-50,mastBase-134); ctx.lineTo(50,mastBase-134); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-32,mastBase-182); ctx.lineTo(32,mastBase-182); ctx.stroke();
  ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(-72,mastBase-100); ctx.lineTo(-24,mastBase-100); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(24,mastBase-100);  ctx.lineTo(72,mastBase-100);  ctx.stroke();

  // ── SAILS (dark weathered charcoal — reference style) ──
  const Twv=Math.sin(T*.0009)*4.2;
  const mkSailClr=(a)=>{const g=ctx.createLinearGradient(-65,0,65,0); g.addColorStop(0,`rgba(18,16,14,${a})`); g.addColorStop(.35,`rgba(36,32,26,${a*.86})`); g.addColorStop(.65,`rgba(40,36,28,${a*.9})`); g.addColorStop(1,`rgba(18,16,14,${a})`); return g;};
  // Tier 1 (lowest, widest)
  ctx.fillStyle=mkSailClr(.93);
  ctx.beginPath(); ctx.moveTo(-62,mastBase-32); ctx.quadraticCurveTo(-69+Twv,mastBase-57,-58,mastBase-82); ctx.lineTo(58,mastBase-82); ctx.quadraticCurveTo(69-Twv,mastBase-57,62,mastBase-32); ctx.closePath(); ctx.fill();
  ctx.strokeStyle='rgba(55,48,35,.28)'; ctx.lineWidth=1; ctx.stroke();
  // Tier 2
  ctx.fillStyle=mkSailClr(.9);
  ctx.beginPath(); ctx.moveTo(-50,mastBase-86); ctx.quadraticCurveTo(-58+Twv*.82,mastBase-110,-48,mastBase-134); ctx.lineTo(48,mastBase-134); ctx.quadraticCurveTo(58-Twv*.82,mastBase-110,50,mastBase-86); ctx.closePath(); ctx.fill(); ctx.stroke();
  // Tier 3
  ctx.fillStyle=mkSailClr(.87);
  ctx.beginPath(); ctx.moveTo(-32,mastBase-138); ctx.quadraticCurveTo(-38+Twv*.55,mastBase-160,-30,mastBase-182); ctx.lineTo(30,mastBase-182); ctx.quadraticCurveTo(38-Twv*.55,mastBase-160,32,mastBase-138); ctx.closePath(); ctx.fill(); ctx.stroke();
  // Tier 4 (top gallant)
  ctx.fillStyle=mkSailClr(.84);
  ctx.beginPath(); ctx.moveTo(-17,mastBase-186); ctx.quadraticCurveTo(-21+Twv*.3,mastBase-202,-15,mastBase-220); ctx.lineTo(15,mastBase-220); ctx.quadraticCurveTo(21-Twv*.3,mastBase-202,17,mastBase-186); ctx.closePath(); ctx.fill();
  // Side sails
  ctx.fillStyle=mkSailClr(.89);
  ctx.beginPath(); ctx.moveTo(-72,mastBase-55); ctx.quadraticCurveTo(-77+Twv*.65,mastBase-77,-68,mastBase-100); ctx.lineTo(-24,mastBase-100); ctx.quadraticCurveTo(-28-Twv*.4,mastBase-77,-25,mastBase-55); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(25,mastBase-55); ctx.quadraticCurveTo(28-Twv*.4,mastBase-77,24,mastBase-100); ctx.lineTo(68,mastBase-100); ctx.quadraticCurveTo(77-Twv*.65,mastBase-77,72,mastBase-55); ctx.closePath(); ctx.fill(); ctx.stroke();
  // Moonlight highlight on sail edge
  ctx.save(); ctx.globalAlpha=.072; ctx.fillStyle='#b8cef0';
  ctx.beginPath(); ctx.moveTo(-50,mastBase-86); ctx.lineTo(-22,mastBase-86); ctx.lineTo(-20,mastBase-134); ctx.lineTo(-46,mastBase-134); ctx.closePath(); ctx.fill(); ctx.restore();

  // ── JOLLY ROGER FLAG ──
  const fwv=Math.sin(T*.005)*8, fY=mastBase-242;
  ctx.fillStyle='#050505';
  ctx.beginPath(); ctx.moveTo(0,fY); ctx.lineTo(36+fwv,fY+9); ctx.lineTo(34+fwv,fY+22); ctx.lineTo(0,fY+24); ctx.closePath(); ctx.fill();
  ctx.font='bold 13px sans-serif'; ctx.fillStyle='rgba(242,240,236,.94)'; ctx.textAlign='center';
  ctx.fillText('☠',18+fwv*.5,fY+18);

  ctx.restore();
}

function endPirateSim(sunk) {
  const ps=PS; ps.running=false;
  if(ps.timerInt){clearInterval(ps.timerInt);ps.timerInt=null;}
  if(ps._keydown) document.removeEventListener('keydown',ps._keydown);
  if(ps._keyup)   document.removeEventListener('keyup',  ps._keyup);

  document.getElementById('psResultIcon').textContent  =sunk?'💀':'🏴‍☠️';
  document.getElementById('psResultTitle').textContent =sunk?'撃沈された！':'航海終了！';
  document.getElementById('psResultTitle').style.color =sunk?'#ff4060':'#d4a830';
  document.getElementById('psResultGold').textContent  =ps.gold+'G 獲得';
  document.getElementById('psResultDetail').textContent='撃沈 '+ps.enemiesSunk+'隻';
  document.getElementById('psResult').style.display='flex';

  const best=parseInt(localStorage.getItem('psGoldBest')||'0');
  if(ps.gold>best){
    localStorage.setItem('psGoldBest',ps.gold);
    const el=document.getElementById('pirateBest');
    if(el) el.textContent='記録: '+ps.gold+'G';
  }
}

/* ══════════════════════════════════════════════════
   THREE.JS OCEAN BACKGROUND
   カメラ (0, 3.5, 25) → lookAt(0,0,0), FOV 60°
   → 地平線が画面上から約 40% に来る計算
══════════════════════════════════════════════════ */
let _psThree = null;


function _makeEnemy3D() {
  const g = new THREE.Group();
  // Shared materials (fewer objects = lighter WebGL load)
  const hullM  = new THREE.MeshPhongMaterial({ color: 0x110c06 });
  const colorM = new THREE.MeshPhongMaterial({ color: 0x4a6a9a, side: THREE.DoubleSide });
  const mastM  = new THREE.MeshPhongMaterial({ color: 0x1a0e04 });
  const sailM  = new THREE.MeshPhongMaterial({ color: 0xb8aa78, side: THREE.DoubleSide });
  const flagM  = new THREE.MeshPhongMaterial({ color: 0x880010, side: THREE.DoubleSide });

  // Hull (two-layer: dark outer + colored inner)
  const hull  = new THREE.Mesh(new THREE.BoxGeometry(4.8, 1.6, 8.0), hullM);
  hull.position.y = 0.8;
  g.add(hull);
  const cHull = new THREE.Mesh(new THREE.BoxGeometry(4.3, 1.3, 7.5), colorM);
  cHull.position.y = 0.82;
  g.add(cHull);

  // Bow cone pointing toward camera (+Z)
  const bow = new THREE.Mesh(new THREE.ConeGeometry(0.85, 3.0, 5), hullM);
  bow.rotation.x = -Math.PI / 2;
  bow.position.set(0, 0.85, 5.0);
  g.add(bow);

  // Main mast (single, center)
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 11.0, 6), mastM);
  mast.position.set(0, 7.3, -0.4);
  g.add(mast);

  // Single yardarm
  const ya = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.22, 0.22), mastM);
  ya.position.set(0, 11.8, -0.4);
  g.add(ya);

  // Main sail (large, faces camera from bow-on view)
  const sail = new THREE.Mesh(new THREE.PlaneGeometry(10.0, 7.0), sailM);
  sail.position.set(0, 8.4, -0.4);
  g.add(sail);

  // Top sail
  const topSail = new THREE.Mesh(new THREE.PlaneGeometry(7.0, 3.5), sailM);
  topSail.position.set(0, 11.0, -0.4);
  g.add(topSail);

  // Flag at masthead
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.85), flagM);
  flag.position.set(0.65, 12.8, -0.4);
  g.add(flag);

  g._colorMat = colorM;
  g._sailMat  = sailM;
  g._flagMat  = flagM;
  return g;
}


function _makePlayerHull() {
  const g = new THREE.Group();
  const hM  = new THREE.MeshPhongMaterial({ color: 0x1a0e06, shininess: 110, specular: new THREE.Color(0x1a2233) });
  const sM  = new THREE.MeshPhongMaterial({ color: 0x361a0a, shininess: 35 });
  const dM  = new THREE.MeshPhongMaterial({ color: 0x2a1608 });
  const rM  = new THREE.MeshPhongMaterial({ color: 0x0f0804 });
  const lM  = new THREE.MeshPhongMaterial({ color: 0xffbb40, emissive: 0xaa5500 });
  const cM  = new THREE.MeshPhongMaterial({ color: 0x1c1c1c, shininess: 100 });

  // Hull body (wide, seen bow-on from slightly behind)
  const hull = new THREE.Mesh(new THREE.BoxGeometry(9.0, 2.4, 7.0), hM);
  hull.position.y = 1.2;
  g.add(hull);
  // Colored hull stripe
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(8.5, 1.9, 6.6), sM);
  stripe.position.y = 1.25;
  g.add(stripe);
  // Deck surface
  const deck = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.2, 6.5), dM);
  deck.position.y = 2.5;
  g.add(deck);
  // Stern structure / cabin
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(8.0, 1.6, 1.8), hM);
  cabin.position.set(0, 3.5, -2.6);
  g.add(cabin);
  // Cabin windows (emissive yellow)
  const wM = new THREE.MeshPhongMaterial({ color: 0xffcc66, emissive: 0xaa7700 });
  [-2.2, 0, 2.2].forEach(wx => {
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.55, 0.1), wM);
    win.position.set(wx, 3.55, -3.55);
    g.add(win);
  });

  // Railing posts (port + starboard)
  for (let z = -2.5; z <= 2.5; z += 1.25) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 1.1, 5), rM);
    p.position.set(4.6, 2.95, z); g.add(p);
    const p2 = p.clone(); p2.position.x = -4.6; g.add(p2);
  }
  // Rail bar
  const rb = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 6.2), rM);
  rb.position.set(4.6, 3.42, 0); g.add(rb);
  const rb2 = rb.clone(); rb2.position.x = -4.6; g.add(rb2);

  // Stern lanterns
  [-1.2, 1.2].forEach(lx => {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), lM);
    l.position.set(lx, 4.4, -3.5);
    g.add(l);
  });

  // Cannons (port + starboard, 2 per side)
  [-1.8, 1.8].forEach(cz => {
    const cr = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.14, 1.4, 8), cM);
    cr.rotation.z = Math.PI / 2;
    cr.position.set(4.8, 2.55, cz); g.add(cr);
    const cl = cr.clone(); cl.position.x = -4.8; g.add(cl);
  });

  // Main mast (short – just the base above deck, most hidden off-screen top)
  const mastM = new THREE.MeshPhongMaterial({ color: 0x1c0c04, shininess: 30 });
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 6.0, 8), mastM);
  mast.position.set(0, 5.5, 0.5);
  g.add(mast);
  // Yardarm
  const ya = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.2, 0.2), mastM);
  ya.position.set(0, 8.4, 0.5);
  g.add(ya);
  // Main sail (hangs from yardarm, faces camera = faces +z)
  const sailM = new THREE.MeshPhongMaterial({ color: 0xccc09a, side: THREE.DoubleSide, shininess: 8 });
  const sail = new THREE.Mesh(new THREE.PlaneGeometry(8.8, 4.5), sailM);
  sail.position.set(0, 6.2, 0.5);
  g.add(sail);
  // Jolly Roger flag
  const flagM = new THREE.MeshPhongMaterial({ color: 0x0d0d0d, side: THREE.DoubleSide });
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.9), flagM);
  flag.position.set(0.7, 9.5, 0.5);
  g.add(flag);

  return g;
}

function initPSOcean(cssW, cssH) {
  if (typeof THREE === 'undefined') return;

  const tc = document.getElementById('psThreeCanvas');
  if (!tc) return;

  // Dispose previous instance
  if (_psThree) { _psThree.renderer.dispose(); _psThree = null; }

  // CSS size (full canvas — Three.js draws sky gradient + ocean)
  tc.style.width  = cssW + 'px';
  tc.style.height = cssH + 'px';
  tc.style.display = 'block';

  // Position it behind psCanvas (absolute, same top-left)
  const psC = document.getElementById('psCanvas');
  if (psC) {
    const pr = psC.parentElement.getBoundingClientRect();
    const cr = psC.getBoundingClientRect();
    tc.style.top = (cr.top - pr.top) + 'px';
  }

  const W = cssW, H = cssH;
  const renderer = new THREE.WebGLRenderer({ canvas: tc, antialias: true });
  renderer.setSize(W, H, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.0));
  renderer.setClearColor(0x00060e);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.88;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000c20, 0.022);

  // Camera: (0, 3.5, 25) → lookAt(0,0,0), FOV=60° → horizon at ~40% from top
  const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 250);
  camera.position.set(0, 3.5, 25);
  camera.lookAt(0, 0, 0);

  // ── Ocean geometry ──
  const geo = new THREE.PlaneGeometry(200, 140, 100, 75);
  geo.rotateX(-Math.PI / 2);

  const uniforms = {
    uTime:    { value: 0.0 },
    uDeep:    { value: new THREE.Color(0x001228) },
    uMid:     { value: new THREE.Color(0x001e42) },
    uShallow: { value: new THREE.Color(0x00315c) },
    uMoonDir: { value: new THREE.Vector3(-0.55, 0.60, -0.58).normalize() },
    uMoonCol: { value: new THREE.Color(0xaabfde) },
    uCamPos:  { value: camera.position },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */`
      uniform float uTime;
      varying float vHeight;
      varying vec3  vWorldPos;
      varying vec3  vNorm;

      float wave(float x, float z, float freq, float amp, float speed, float phase) {
        return sin(x * freq + z * freq * 0.6 + uTime * speed + phase) * amp;
      }

      void main() {
        vec3 pos = position;
        float x = pos.x * 0.06, z = pos.z * 0.06;

        float h = wave(x, z, 2.2,  1.10, 0.80, 0.00)
                + wave(x, z, 1.7,  0.75, 0.65, 1.57)
                + wave(x, z, 3.5,  0.45, 1.20, 0.90)
                + wave(x, z, 5.1,  0.25, 1.50, 2.10)
                + wave(x, z, 7.8,  0.14, 1.80, 3.40);
        pos.y = h;
        vHeight   = h;
        vWorldPos = pos;

        // Finite-difference normal
        float eps = 0.8;
        float hx = wave(x+eps*0.06,z,2.2,1.10,0.80,0.00)+wave(x+eps*0.06,z,1.7,0.75,0.65,1.57)
                 + wave(x+eps*0.06,z,3.5,0.45,1.20,0.90)+wave(x+eps*0.06,z,5.1,0.25,1.50,2.10)
                 + wave(x+eps*0.06,z,7.8,0.14,1.80,3.40);
        float hz = wave(x,z+eps*0.06,2.2,1.10,0.80,0.00)+wave(x,z+eps*0.06,1.7,0.75,0.65,1.57)
                 + wave(x,z+eps*0.06,3.5,0.45,1.20,0.90)+wave(x,z+eps*0.06,5.1,0.25,1.50,2.10)
                 + wave(x,z+eps*0.06,7.8,0.14,1.80,3.40);
        vNorm = normalize(vec3(-(hx - h) / eps, 1.0, -(hz - h) / eps));

        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3  uDeep;
      uniform vec3  uMid;
      uniform vec3  uShallow;
      uniform vec3  uMoonDir;
      uniform vec3  uMoonCol;
      uniform vec3  uCamPos;
      varying float vHeight;
      varying vec3  vWorldPos;
      varying vec3  vNorm;

      void main() {
        // Depth: far = deep blue, near = lighter
        float dist = length(vWorldPos - uCamPos);
        float d = clamp(dist / 80.0, 0.0, 1.0);
        vec3 base = mix(uShallow, mix(uMid, uDeep, d * 0.8), d);

        // Specular moonlight (Blinn-Phong)
        vec3 V = normalize(uCamPos - vWorldPos);
        vec3 H = normalize(uMoonDir + V);
        float spec  = pow(max(dot(vNorm, H), 0.0), 80.0);
        float spec2 = pow(max(dot(vNorm, H), 0.0),  6.0);
        base += uMoonCol * (spec * 0.9 + spec2 * 0.12);

        // Whitecaps on wave crests
        float foam = smoothstep(1.4, 2.6, vHeight);
        base = mix(base, vec3(0.50, 0.68, 0.92), foam * 0.40);

        // Moonlight shimmer path (angled band matching 2D code at x≈72%)
        float shimmerX = abs(vWorldPos.x - 7.0) / 28.0;
        base += uMoonCol * exp(-shimmerX * shimmerX * 1.8) * 0.10;

        gl_FragColor = vec4(base, 1.0);
      }
    `,
  });

  const ocean = new THREE.Mesh(geo, mat);
  ocean.position.set(0, 0, -25);
  scene.add(ocean);

  // Sky dome (simple sphere, inside-facing)
  const skyGeo = new THREE.SphereGeometry(200, 16, 8);
  skyGeo.scale(-1, 1, -1);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {},
    vertexShader: `
      varying float vY;
      void main() { vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
    `,
    fragmentShader: `
      varying float vY;
      void main() {
        float t = clamp(vY / 200.0, 0.0, 1.0);
        vec3 top    = vec3(0.002, 0.024, 0.055);
        vec3 bottom = vec3(0.005, 0.055, 0.135);
        gl_FragColor = vec4(mix(bottom, top, t), 1.0);
      }
    `,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  // ── Ambient + moonlight for 3D meshes ──
  scene.add(new THREE.AmbientLight(0x0c1c30, 1.0));
  const moonDirLight = new THREE.DirectionalLight(0x8aaacf, 1.4);
  moonDirLight.position.set(-6, 10, -8);
  scene.add(moonDirLight);

  // ── Foam spray particles on ocean surface ──
  const fCnt = 1100;
  const fPos = new Float32Array(fCnt * 3), fPh = new Float32Array(fCnt);
  for (let i = 0; i < fCnt; i++) {
    fPos[i*3]   = (Math.random() - 0.5) * 190;
    fPos[i*3+1] = Math.random() * 0.7;
    fPos[i*3+2] = (Math.random() - 0.5) * 140 - 25;
    fPh[i] = Math.random() * Math.PI * 2;
  }
  const foamGeo = new THREE.BufferGeometry();
  foamGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3));
  foamGeo.setAttribute('aPhase',   new THREE.BufferAttribute(fPh,  1));
  const foamMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `attribute float aPhase;uniform float uTime;varying float vA;
      void main(){
        vA=0.5+0.5*sin(uTime*1.3+aPhase);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
        gl_PointSize=2.0+vA*2.0;
      }`,
    fragmentShader: `varying float vA;
      void main(){
        float d=length(gl_PointCoord-vec2(0.5));
        if(d>0.5)discard;
        gl_FragColor=vec4(0.55,0.72,0.92,vA*0.30);
      }`,
    transparent: true, depthWrite: false,
  });
  scene.add(new THREE.Points(foamGeo, foamMat));

  // ── Player wake trail (V-shaped foam behind player ship) ──
  const wakeGeo = new THREE.PlaneGeometry(14, 30, 6, 20);
  wakeGeo.rotateX(-Math.PI / 2);
  const wakeMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    transparent: true, depthWrite: false,
    vertexShader: `varying vec2 vUv;uniform float uTime;
      void main(){
        vUv=uv;
        vec3 pos=position;
        pos.y+=sin(pos.z*0.65+uTime*2.2)*0.14*(1.0-uv.y);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(pos,1.0);
      }`,
    fragmentShader: `varying vec2 vUv;
      void main(){
        float cx=abs(vUv.x-0.5)*2.0;
        float spread=mix(0.08,0.98,vUv.y);
        float vShape=smoothstep(spread,spread*0.55,cx);
        float fade=pow(vUv.y,0.55);
        gl_FragColor=vec4(0.58,0.74,0.94,vShape*fade*0.24);
      }`,
  });
  const wake = new THREE.Mesh(wakeGeo, wakeMat);
  wake.position.set(0, 0.22, 4);
  scene.add(wake);

  // ── Decorative 3D ships on the horizon ──
  function makeShip3D() {
    const g = new THREE.Group();
    const hullM = new THREE.MeshPhongMaterial({ color: 0x100a06 });
    const sailM = new THREE.MeshPhongMaterial({ color: 0x6e7882, side: THREE.DoubleSide });
    const mastM = new THREE.MeshPhongMaterial({ color: 0x221408 });
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.65, 5.0), hullM);
    hull.position.y = 0.32;
    g.add(hull);
    const bow = new THREE.Mesh(new THREE.ConeGeometry(0.6, 2.0, 5, 1), hullM);
    bow.rotation.z = Math.PI / 2; bow.position.set(2.8, 0.32, 0);
    g.add(bow);
    [[-0.4, 3.8, -0.3], [0.9, 3.1, -0.3]].forEach(([mx, mh, mz]) => {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, mh, 6), mastM);
      mast.position.set(mx, mh / 2 + 0.65, mz);
      g.add(mast);
      const sail = new THREE.Mesh(new THREE.PlaneGeometry(1.4, mh * 0.7), sailM);
      sail.position.set(mx, mh * 0.55 + 0.65, mz);
      g.add(sail);
    });
    return g;
  }

  const hShips = [];
  for (let i = 0; i < 4; i++) {
    const ship = makeShip3D();
    const baseX = (Math.random() - 0.5) * 160;
    const depth = -38 - Math.random() * 18;
    ship.position.set(baseX, 0, depth);
    ship.rotation.y = Math.PI / 2 + (Math.random() - 0.5) * 0.4;
    ship.userData = { baseX, speed: 0.8 + Math.random() * 0.6, dir: Math.random() > 0.5 ? 1 : -1 };
    scene.add(ship);
    hShips.push(ship);
  }


  // ── Enemy ship mesh pool (synced each frame) ──
  const ENEMY_POOL = 8;
  const enemyPool  = [];
  for (let i = 0; i < ENEMY_POOL; i++) {
    const g = _makeEnemy3D();
    g.visible = false;
    scene.add(g);
    enemyPool.push(g);
  }
  const psRaycaster  = new THREE.Raycaster();
  const psOceanPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  // ── Player ship hull (foreground, stern toward camera) ──
  const playerHullMesh = _makePlayerHull();
  playerHullMesh.rotation.y = Math.PI;  // bow faces -z (toward enemies)
  playerHullMesh.position.set(0, 0, 19);
  scene.add(playerHullMesh);

  _psThree = { renderer, scene, camera, mat, foamMat, wakeMat, hShips,
               enemyPool, psRaycaster, psOceanPlane, playerHullMesh };
}

function renderPSOcean() {
  if (!_psThree) return;
  const t = Date.now() * 0.001;
  _psThree.mat.uniforms.uTime.value = t;
  if (_psThree.foamMat) _psThree.foamMat.uniforms.uTime.value = t;
  if (_psThree.wakeMat) _psThree.wakeMat.uniforms.uTime.value = t;
  if (_psThree.playerHullMesh) {
    const ph = _psThree.playerHullMesh;
    ph.position.y = Math.sin(t * 0.85) * 0.18;
    ph.rotation.z = Math.sin(t * 0.65 + 0.8) * 0.022;  // gentle roll
    ph.rotation.x = Math.sin(t * 1.05 + 1.5) * 0.010;  // slight pitch
  }
  if (_psThree.hShips) {
    for (const ship of _psThree.hShips) {
      const travelX = (t * ship.userData.speed * ship.userData.dir) % 220;
      ship.position.x = ship.userData.baseX + travelX;
      if (ship.position.x > 110) ship.position.x -= 220;
      if (ship.position.x < -110) ship.position.x += 220;
    }
  }

  // ── Sync 3D enemy meshes with game state ──
  try {
  if (_psThree.enemyPool && typeof PS !== 'undefined' && PS.enemies && PS.player) {
    PS.enemies.forEach(e => { e._has3D = false; });
    const pool    = _psThree.enemyPool;
    const enemies = PS.enemies;
    const rc      = _psThree.psRaycaster;
    const plane   = _psThree.psOceanPlane;
    const cam     = _psThree.camera;
    const LW = PS.LW, LH = PS.LH;
    // focal length: (LH/2)/tan(FOV_v/2) for FOV=60°
    const focalPx = 416;
    const hullPx  = 104; // 2D hull pixel width at scale=1
    const hullW   =  4.5; // 3D hull world width at mesh scale=1

    for (let i = 0; i < pool.length; i++) {
      const mesh = pool[i];
      if (i >= enemies.length) { mesh.visible = false; continue; }
      const ent = enemies[i];
      const sx = PS.LW/2 + (ent.worldX - PS.player.x) * ent.depth * 2.6;
      const sy = Math.round(LH * PS.HY_RATIO) + (LH - Math.round(LH * PS.HY_RATIO)) * ent.depth * 0.88;
      if (sx < -300 || sx > LW + 300) { mesh.visible = false; continue; }

      // Project 2D screen pos → 3D ocean plane
      const ndcX = (sx / LW) * 2 - 1;
      const ndcY = -(sy / LH) * 2 + 1;
      rc.setFromCamera(new THREE.Vector2(ndcX, ndcY), cam);
      const wp = new THREE.Vector3();
      if (!rc.ray.intersectPlane(plane, wp)) { mesh.visible = false; continue; }

      // Scale to match 2D visual size
      const s2D = Math.max(.06, ent.depth * 1.7 + .06);
      const dist = cam.position.distanceTo(wp);
      const s = s2D * hullPx * dist / (focalPx * hullW);
      mesh.scale.setScalar(s);

      // Position on water + small bob
      mesh.position.set(wp.x, Math.sin(t * 1.1 + i * 1.8) * 0.12, wp.z);

      // Bow faces camera
      mesh.rotation.y = Math.atan2(cam.position.x - wp.x, cam.position.z - wp.z);

      // Ship type colors
      const C = { pirate: 0x3a1a1a, navy: 0x1a3060, merchant: 0x4a6a9a };
      const S = { pirate: 0x141010, navy: 0xd0cdb8, merchant: 0xb8aa78 };
      const F = { pirate: 0x080808, navy: 0x102060, merchant: 0x880010 };
      if (mesh._colorMat) mesh._colorMat.color.setHex(C[ent.type] || C.merchant);
      if (mesh._sailMat)  mesh._sailMat.color.setHex(S[ent.type]  || S.merchant);
      if (mesh._flagMat)  mesh._flagMat.color.setHex(F[ent.type]  || F.merchant);

      mesh.visible = true;
      ent._has3D = true;
    }
  }
  } catch(e) { /* Three.js sync error — 2D fallback active */ }
  _psThree.renderer.render(_psThree.scene, _psThree.camera);
}

function disposePSOcean() {
  if (!_psThree) return;
  _psThree.renderer.dispose();
  const tc = document.getElementById('psThreeCanvas');
  if (tc) tc.style.display = 'none';
  _psThree = null;
}
