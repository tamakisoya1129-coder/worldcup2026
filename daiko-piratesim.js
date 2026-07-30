/* ══════════════════════════════════════════════════
   PIRATE SIM — 「七つの海の覇者」
   ローグライト航海バトル
   ・海域(leg)を進むほど強敵。5海域ごとにボス
   ・海域クリアで補給港 → 強化カードを1枚選ぶ
   ・風・天候・コンボ・スキル・貫通/焼夷/会心 etc.

   座標系:
     worldX … 海上の横位置（カメラは自船を追従）
     depth  … 0=水平線 / 1=自船の位置
   画面座標は psScreenPos() で射影する。
   敵弾も「ワールド座標」で飛ぶので、操舵で避けられる。
══════════════════════════════════════════════════ */

const PS_CFG = {
  LW: 800, LH: 480, HY_RATIO: 0.40,
  PPW: 2.6,               // px per worldX at depth=1
  MIN_X: 80, MAX_X: 720,
  B_DEPTH0: 0.91,         // 砲弾の発射深度
  B_SPEED: 0.038,         // 砲弾の深度速度
  HIT_D: 0.065,           // 命中判定の深度許容
  RAM_W: 105,             // 衝突判定のworldX幅
};

/* ─── 敵アーキタイプ ─── */
const PS_ENEMIES = {
  merchant: { name:'商船',   hp:34, spd:0.0050, gold:72, color:'#4080d0', hw:38, sail:'merchant',
              weaveF:0.0009, weaveA:9 },
  cutter:   { name:'快速艇', hp:18, spd:0.0182, gold:30, color:'#20a070', hw:26, sail:'merchant',
              weaveF:0.0024, weaveA:20, ram:true },
  pirate:   { name:'海賊船', hp:28, spd:0.0110, gold:42, color:'#cc2030', hw:34, sail:'pirate',
              weaveF:0.0015, weaveA:15, fires:true, cd:82 },
  navy:     { name:'軍艦',   hp:58, spd:0.0080, gold:60, color:'#304090', hw:40, sail:'navy',
              weaveF:0.0010, weaveA:11, fires:true, cd:74, volley:2 },
  bombard:  { name:'砲艦',   hp:46, spd:0.0044, gold:66, color:'#8a5020', hw:36, sail:'navy',
              weaveF:0.0008, weaveA:13, mortar:true, cd:150, hold:0.54 },
  ghost:    { name:'幽霊船', hp:52, spd:0.0100, gold:98, color:'#50e0c8', hw:34, sail:'ghost',
              weaveF:0.0017, weaveA:19, fires:true, cd:62, phase:true },
};

/* ─── 天候 ─── */
const PS_WEATHER = {
  moon:  { name:'月夜',   icon:'🌙', windMul:0.8, fog:0.00, rock:0.5, goldMul:1.00 },
  calm:  { name:'凪',     icon:'✨', windMul:0.5, fog:0.00, rock:0.3, goldMul:1.00 },
  fog:   { name:'濃霧',   icon:'🌫', windMul:0.9, fog:1.00, rock:0.5, goldMul:1.18 },
  storm: { name:'嵐',     icon:'⛈',  windMul:2.2, fog:0.22, rock:1.6, goldMul:1.35 },
};

/* ─── 強化カード ─── */
const PS_UPGRADES = [
  { id:'dmg',   icon:'💣', name:'重砲弾',     max:6, rar:'c', desc:'砲撃ダメージ +20%',                 apply:s=>{ s.dmgMul*=1.20; } },
  { id:'rate',  icon:'⚡', name:'速射装填',   max:6, rar:'c', desc:'装填時間 -14%',                     apply:s=>{ s.cdMul*=0.86; } },
  { id:'hull',  icon:'🛡', name:'装甲板',     max:6, rar:'c', desc:'最大HP +28（即時回復つき）',        apply:s=>{ s.maxHp+=28; s.hp=Math.min(s.maxHp,s.hp+28); } },
  { id:'sail',  icon:'⛵', name:'新しい帆',   max:5, rar:'c', desc:'操舵速度 +14%',                     apply:s=>{ s.speed*=1.14; } },
  { id:'gold',  icon:'💰', name:'略奪の腕',   max:5, rar:'c', desc:'獲得金貨 +30%',                     apply:s=>{ s.goldMul*=1.30; } },
  { id:'watch', icon:'🔭', name:'見張り台',   max:3, rar:'c', desc:'漂流物が増え、回収範囲が広がる',    apply:s=>{ s.pickRate*=1.45; s.magnet+=30; } },
  { id:'medic', icon:'🩹', name:'修理班',     max:4, rar:'c', desc:'海域クリア時に HP20% 回復',         apply:s=>{ s.legHeal+=0.20; } },
  { id:'guns',  icon:'🔱', name:'増設砲門',   max:3, rar:'r', desc:'同時砲撃数 +1',                     apply:s=>{ s.guns+=1; } },
  { id:'pierce',icon:'➡️', name:'貫通弾',     max:3, rar:'r', desc:'砲弾が敵を1隻多く貫通する',         apply:s=>{ s.pierce+=1; } },
  { id:'burn',  icon:'🔥', name:'焼夷弾',     max:4, rar:'r', desc:'命中した敵が炎上（継続ダメージ）',  apply:s=>{ s.burn+=7; } },
  { id:'dodge', icon:'🌊', name:'波乗り航法', max:4, rar:'r', desc:'被弾回避 +12%',                     apply:s=>{ s.dodge=Math.min(.6,s.dodge+.12); } },
  { id:'crit',  icon:'🎯', name:'必殺の一撃', max:4, rar:'r', desc:'会心率 +12%（ダメージ2.2倍）',      apply:s=>{ s.crit=Math.min(.75,s.crit+.12); } },
  { id:'armor', icon:'🪖', name:'重装甲',     max:4, rar:'r', desc:'被ダメージ -13%',                   apply:s=>{ s.dmgRed=1-(1-s.dmgRed)*0.87; } },
  { id:'cmd',   icon:'📯', name:'号令改良',   max:4, rar:'r', desc:'スキル再使用時間 -20%',             apply:s=>{ s.skillCdMul*=0.80; } },
  { id:'rage',  icon:'☠️', name:'死中に活',   max:3, rar:'e', desc:'HP35%以下で砲撃 +45%',              apply:s=>{ s.rage+=0.45; } },
  { id:'chain', icon:'🌪', name:'鎖弾',       max:2, rar:'e', desc:'撃沈時に周囲へ爆発が連鎖する',      apply:s=>{ s.chain+=1; } },
];

/* ─── 船長スキル ─── */
const PS_SKILLS = [
  { id:'broadside', icon:'💥', name:'一斉射撃', cd:780,  key:'1' },
  { id:'repair',    icon:'🔧', name:'応急修理', cd:1500, key:'2' },
  { id:'fullsail',  icon:'📯', name:'追い風',   cd:1250, key:'3' },
];

/* ─── 称号 ─── */
const PS_RANKS = [
  { g:80000, t:'🏆 伝説の大提督' }, { g:40000, t:'👑 海賊王' },
  { g:20000, t:'⚔️ 歴戦の船長' },   { g:10000, t:'🧭 一人前の航海士' },
  { g:4000,  t:'⚓ 水夫' },         { g:0,     t:'🪣 見習い' },
];

/* ══════════════════ STATE ══════════════════ */
const PS = {
  running:false, phase:'idle',   // idle | brief | play | port | over
  raf:null, canvas:null, ctx:null,
  LW:PS_CFG.LW, LH:PS_CFG.LH, HY_RATIO:PS_CFG.HY_RATIO,
  player:null, st:null,
  enemies:[], pBullets:[], eShells:[], mortars:[], zones:[],
  pickups:[], explosions:[], particles:[], splashes:[], floaters:[],
  keys:{left:false,right:false},
  leg:1, quota:0, sunkInLeg:0, spawnQueue:0, weather:null,
  gold:0, totalSunk:0, combo:0, comboT:0, elapsed:0,
  wind:{angle:0,speed:0.4}, windTimer:0,
  spawnTimer:0, pickTimer:0, lastTs:0, shake:0,
  aimX:400, banner:null, boss:null, ink:0, lightning:0,
  skills:[], upLv:{}, cards:[], extraCost:0, rerollCost:0, repairCost:0,
  _keydown:null, _keyup:null, _pointer:null,
};

/* ══════════════════ 効果音（このゲーム専用） ══════════════════ */
const psSnd = (() => {
  let _c = null;
  const ac = () => {
    if (!_c) _c = new (window.AudioContext || window.webkitAudioContext)();
    if (_c.state === 'suspended') _c.resume();
    return _c;
  };
  const tone = (f, type, g0, dur, f2, delay=0) => {
    try {
      const c = ac(), t = c.currentTime + delay;
      const o = c.createOscillator(), g = c.createGain();
      o.connect(g); g.connect(c.destination);
      o.type = type; o.frequency.setValueAtTime(f, t);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
      g.gain.setValueAtTime(g0, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.start(t); o.stop(t + dur);
    } catch(e) {}
  };
  const nz = (g0, dur, cut=2200, delay=0) => {
    try {
      const c = ac(), t = c.currentTime + delay;
      const n = Math.ceil(c.sampleRate * dur);
      const b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
      for (let i=0;i<n;i++) d[i] = Math.random()*2-1;
      const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      f.type='lowpass'; f.frequency.value=cut;
      s.buffer=b; s.connect(f); f.connect(g); g.connect(c.destination);
      g.gain.setValueAtTime(g0, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.start(t); s.stop(t + dur);
    } catch(e) {}
  };
  return {
    cannon()  { tone(78,'sine',.42,.34,18); nz(.5,.16,620); },
    charged() { tone(58,'sine',.55,.55,14); nz(.7,.26,480); tone(140,'sawtooth',.18,.24,40); },
    explode() { tone(52,'sine',.55,.55,12); nz(.85,.30,450); tone(110,'sawtooth',.18,.2,30); },
    hit()     { tone(400,'square',.14,.08,220); nz(.18,.06,3200); },
    crit()    { tone(1100,'square',.16,.10,600); tone(1650,'sine',.12,.14,900); },
    splash()  { nz(.3,.22,900); tone(300,'sine',.08,.16,120); },
    coin()    { tone(900,'sine',.2,.14); tone(1300,'sine',.13,.12,null,.06); },
    heal()    { [520,660,880].forEach((f,i)=>tone(f,'sine',.16,.20,null,i*.07)); },
    power()   { tone(320,'sawtooth',.18,.28,900); tone(660,'sine',.12,.3,null,.06); },
    alarm()   { tone(220,'square',.16,.18,180); tone(220,'square',.16,.18,180,.26); },
    horn()    { tone(96,'sawtooth',.30,.9,72); tone(146,'sawtooth',.16,.9,110); },
    roar()    { tone(64,'sawtooth',.38,1.3,34); nz(.4,1.1,320); },
    levelup() { [523,659,784,1046].forEach((f,i)=>tone(f,'triangle',.20,.26,null,i*.09)); },
    fail()    { tone(200,'sawtooth',.28,.9,60); nz(.3,.7,400); },
    click()   { tone(1150,'sine',.07,.06); },
  };
})();

/* ══════════════════ ユーティリティ ══════════════════ */
const psR   = (a,b)=>a+Math.random()*(b-a);
const psRi  = (a,b)=>Math.floor(psR(a,b+1));
const psPick= arr=>arr[Math.floor(Math.random()*arr.length)];
const psClamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function psScreenPos(worldX, depth) {
  const HY = Math.round(PS.LH * PS.HY_RATIO);
  return {
    sx: PS.LW/2 + (worldX - PS.player.x) * depth * PS_CFG.PPW,
    sy: HY + (PS.LH - HY) * depth * 0.88,
  };
}
function psWindAcc() {
  const w = PS.wind, wm = PS.weather ? PS.weather.windMul : 1;
  return Math.cos(w.angle) * w.speed * wm * 0.055;
}
function psWindName() {
  const n = ['東','南東','南','南西','西','北西','北','北東'];
  const a = ((PS.wind.angle % (Math.PI*2)) + Math.PI*2) % (Math.PI*2);
  return n[Math.round(a / (Math.PI/4)) % 8];
}

/* ══════════════════ 起動 / 終了 ══════════════════ */
function startPirateSim() {
  psTeardownInput();
  const ps = PS;
  if (ps.raf) { cancelAnimationFrame(ps.raf); ps.raf = null; }

  ps.st = {
    maxHp:100, hp:100, speed:5.0,
    dmg:22, dmgMul:1, cdMul:1, guns:1, pierce:0,
    goldMul:1, burn:0, dodge:0, crit:0, dmgRed:0,
    rage:0, chain:0, legHeal:0, skillCdMul:1,
    pickRate:1, magnet:0,
  };
  ps.player = { x:400, fireCd:0, inv:0, charge:0, charging:false, roll:0 };
  ps.enemies=[]; ps.pBullets=[]; ps.eShells=[]; ps.mortars=[]; ps.zones=[];
  ps.pickups=[]; ps.explosions=[]; ps.particles=[]; ps.splashes=[]; ps.floaters=[];
  ps.keys={left:false,right:false};
  ps.gold=0; ps.totalSunk=0; ps.combo=0; ps.comboT=0; ps.elapsed=0;
  ps.leg=0; ps.boss=null; ps.ink=0; ps.lightning=0; ps.shake=0;
  ps.aimX=400; ps.upLv={}; ps.extraCost=140; ps.rerollCost=60;
  ps.skills = PS_SKILLS.map(s => ({ ...s, t:0 }));
  ps.buffs = { fullsail:0 };

  showScreen('piratesim');

  const canvas = document.getElementById('psCanvas');
  ps.canvas = canvas;
  canvas.width = ps.LW; canvas.height = ps.LH;
  ps.ctx = canvas.getContext('2d');
  psFitCanvas(true);
  if (!ps._resize) {
    ps._resize = () => { if (PS.running) psFitCanvas(true); };
    window.addEventListener('resize', ps._resize);
    window.addEventListener('orientationchange', ps._resize);
  }

  psSetupInput();
  const res = document.getElementById('psResult');
  if (res) res.style.display = 'none';
  psClosePort();

  ps.running = true;
  ps.lastTs = performance.now();
  psStartLeg();
  ps.raf = requestAnimationFrame(psLoop);
}

/* CSSが決めた実寸を測り、2Dと3Dのキャンバスをぴったり重ねる */
function psFitCanvas(rebuild3D) {
  const ps = PS, canvas = ps.canvas;
  if (!canvas) return;
  canvas.style.width = '';           // まずCSS（width:100%/max-width）に任せる
  canvas.style.height = '';
  const rect = canvas.getBoundingClientRect();
  const dw = Math.round(rect.width) || Math.round(Math.min(window.innerWidth * 0.94, 1080));
  const dh = Math.round(dw * ps.LH / ps.LW);
  canvas.style.height = dh + 'px';   // 800:480 の比率を保つ
  if (rebuild3D) initPSOcean(dw, dh);
}

function exitPirateSim() {
  const ps = PS;
  ps.running = false; ps.phase = 'idle';
  if (ps.raf) { cancelAnimationFrame(ps.raf); ps.raf = null; }
  psTeardownInput();
  psClosePort();
  const res = document.getElementById('psResult');
  if (res) res.style.display = 'none';
  disposePSOcean();
  showTitle();
}

/* ══════════════════ 入力 ══════════════════ */
function psSetupInput() {
  const ps = PS, canvas = ps.canvas;

  ps._keydown = e => {
    if (ps.phase !== 'play') return;
    const k = e.key;
    if (['ArrowLeft','a','A'].includes(k))  { ps.keys.left = true;  e.preventDefault(); }
    if (['ArrowRight','d','D'].includes(k)) { ps.keys.right = true; e.preventDefault(); }
    if (k === ' ') { psChargeStart(); e.preventDefault(); }
    if (k === '1') psUseSkill(0);
    if (k === '2') psUseSkill(1);
    if (k === '3') psUseSkill(2);
  };
  ps._keyup = e => {
    const k = e.key;
    if (['ArrowLeft','a','A'].includes(k))  ps.keys.left = false;
    if (['ArrowRight','d','D'].includes(k)) ps.keys.right = false;
    if (k === ' ') { psChargeRelease(); e.preventDefault(); }
  };
  document.addEventListener('keydown', ps._keydown);
  document.addEventListener('keyup',   ps._keyup);

  // 照準（マウス/タッチ位置 → worldX）
  ps._pointer = e => {
    if (!ps.player) return;
    const r = canvas.getBoundingClientRect();
    const cx = (e.touches ? e.touches[0].clientX : e.clientX);
    const sx = (cx - r.left) * (ps.LW / r.width);
    ps.aimX = ps.player.x + psClamp((sx - ps.LW/2) * 0.62, -210, 210);
  };
  canvas.addEventListener('pointermove', ps._pointer);
  canvas.addEventListener('pointerdown', e => { ps._pointer(e); psChargeStart(); });
  canvas.addEventListener('pointerup',   () => psChargeRelease());
  canvas.addEventListener('pointerleave',() => psChargeRelease());
}

function psTeardownInput() {
  const ps = PS;
  if (ps._keydown) document.removeEventListener('keydown', ps._keydown);
  if (ps._keyup)   document.removeEventListener('keyup',   ps._keyup);
  ps._keydown = ps._keyup = null;
}

function psKey(dir, down) { if (PS.keys) PS.keys[dir] = down; }

/* ══════════════════ 海域（leg）進行 ══════════════════ */
function psLegPlan(n) {
  // ボス海域は 5 の倍数
  if (n % 4 === 0) {
    return { boss: (n / 4) % 2 === 1 ? 'flagship' : 'kraken',
             count: 3 + Math.floor(n/4),
             pool: ['pirate','cutter','navy'] };   // 護衛艦
  }
  const count  = 5 + Math.round(n * 1.5);
  const pool   = ['merchant','pirate'];
  if (n >= 2) pool.push('cutter');
  if (n >= 3) pool.push('navy');
  if (n >= 3) pool.push('bombard');
  if (n >= 5) pool.push('ghost','navy');
  if (n >= 7) pool.push('ghost','bombard','navy');
  return { boss:null, count, pool };
}

function psStartLeg() {
  const ps = PS;
  ps.leg++;
  const plan = psLegPlan(ps.leg);
  ps.plan = plan;
  ps.quota = plan.count;
  ps.sunkInLeg = 0;
  ps.spawnQueue = plan.count;
  ps.enemies = []; ps.eShells = []; ps.mortars = []; ps.zones = [];
  ps.pBullets = []; ps.pickups = []; ps.boss = null; ps.ink = 0;
  ps.spawnTimer = 40; ps.pickTimer = 120;
  ps.weather = PS_WEATHER[ plan.boss ? 'storm' : psPick(['moon','calm','fog','storm','moon','calm']) ];
  ps.wind = { angle: psR(0, Math.PI*2), speed: psR(0.3, 0.8) };
  ps.windTimer = 300;
  ps.player.inv = 90;

  psApplyWeather3D();

  ps.banner = plan.boss
    ? { title:`⚠ 第${ps.leg}海域 — ボス出現`, sub:(plan.boss==='flagship'?'亡霊提督の旗艦が待ち構えている':'深淵よりクラーケンが浮上する'), t:200, danger:true }
    : { title:`🧭 第${ps.leg}海域 — ${ps.weather.icon} ${ps.weather.name}`, sub:`撃沈ノルマ ${ps.quota}隻`, t:170, danger:false };

  if (plan.boss) { psSnd.horn(); psSpawnBoss(plan.boss); }
  else psSnd.levelup();

  ps.phase = 'play';
  psUpdateHud();
}

function psLegClear() {
  const ps = PS;
  ps.phase = 'port';
  ps.eShells = []; ps.mortars = []; ps.zones = [];
  const heal = Math.round(ps.st.maxHp * ps.st.legHeal);
  if (heal > 0) { ps.st.hp = Math.min(ps.st.maxHp, ps.st.hp + heal); psSnd.heal(); }
  const bonus = Math.round(45 * ps.leg * (ps.weather ? ps.weather.goldMul : 1) * ps.st.goldMul);
  ps.gold += bonus;
  ps.legBonus = bonus;
  psSnd.levelup();
  psOpenPort();
}

/* ══════════════════ 補給港 ══════════════════ */
function psAvailableUpgrades() {
  return PS_UPGRADES.filter(u => (PS.upLv[u.id] || 0) < u.max);
}
function psRollCards(n = 3) {
  const pool = psAvailableUpgrades().slice();
  const w = { c: 62, r: 30, e: 8 };
  const out = [];
  while (out.length < n && pool.length) {
    let total = pool.reduce((s, u) => s + w[u.rar], 0);
    let r = Math.random() * total, idx = 0;
    for (let i = 0; i < pool.length; i++) { r -= w[pool[i].rar]; if (r <= 0) { idx = i; break; } }
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}
function psOpenPort() {
  const ps = PS;
  ps.cards = psRollCards(3);
  ps.rerollCost = 60 + ps.leg * 15;
  ps.extraCost  = 140 + ps.leg * 45;
  ps.repairCost = Math.max(0, Math.ceil((ps.st.maxHp - ps.st.hp) * (3.2 + ps.leg * 0.9)));
  ps.picked = false;
  psRenderPort();
  const el = document.getElementById('psPort');
  if (el) el.style.display = 'flex';
}
function psClosePort() {
  const el = document.getElementById('psPort');
  if (el) el.style.display = 'none';
}
function psRenderPort() {
  const ps = PS, st = ps.st;
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.innerHTML = v; };

  set('psPortTitle', `⚓ 補給港 — 第${ps.leg}海域 制圧`);
  set('psPortSub',   `航海ボーナス <b>+${ps.legBonus||0}G</b>　／　次は <b>第${ps.leg+1}海域</b>${(ps.leg+1)%4===0?' <span class="ps-warn">⚠ ボス</span>':''}`);

  set('psPortStats', `
    <span>❤️ HP ${Math.round(st.hp)}/${st.maxHp}</span>
    <span>💰 ${ps.gold}G</span>
    <span>💥 砲撃 ${Math.round(st.dmg*st.dmgMul)}</span>
    <span>🔱 ${st.guns}門</span>
    <span>⚡ 装填 ${(st.cdMul*100).toFixed(0)}%</span>
    <span>⛵ 速力 ${(st.speed).toFixed(1)}</span>
    ${st.crit>0?`<span>🎯 会心 ${(st.crit*100|0)}%</span>`:''}
    ${st.dodge>0?`<span>🌊 回避 ${(st.dodge*100|0)}%</span>`:''}`);

  set('psPortCards', ps.cards.map((u, i) => {
    const lv = ps.upLv[u.id] || 0;
    const rar = { c:'常', r:'稀', e:'極' }[u.rar];
    return `<button class="ps-card ps-card-${u.rar}" onclick="psPickCard(${i})" ${ps.picked?'disabled':''}>
      <span class="ps-card-rar">${rar}</span>
      <span class="ps-card-icon">${u.icon}</span>
      <span class="ps-card-name">${u.name}</span>
      <span class="ps-card-lv">Lv${lv} → ${lv+1} / ${u.max}</span>
      <span class="ps-card-desc">${u.desc}</span>
    </button>`;
  }).join('') || '<p class="ps-card-empty">すべての強化が最大レベルに達した。</p>');

  const btn = (id, label, cost, fn, ok) =>
    `<button class="ps-port-btn" id="${id}" onclick="${fn}" ${ok?'':'disabled'}>${label}${cost!=null?` <b>${cost}G</b>`:''}</button>`;

  set('psPortActions',
    btn('psRepairBtn', '🔧 完全修理', ps.repairCost, 'psBuyRepair()', ps.repairCost>0 && ps.gold>=ps.repairCost) +
    btn('psRerollBtn', '🎲 引き直し', ps.rerollCost, 'psReroll()',    !ps.picked && ps.gold>=ps.rerollCost && ps.cards.length>0) +
    btn('psExtraBtn',  '➕ もう1枚',  ps.extraCost,  'psBuyExtra()',   ps.picked && ps.gold>=ps.extraCost && psAvailableUpgrades().length>0) +
    `<button class="ps-port-btn ps-port-sail" onclick="psSail()">⛵ 出航する</button>`);
}
function psPickCard(i) {
  const ps = PS;
  if (ps.picked) return;
  const u = ps.cards[i];
  if (!u) return;
  ps.upLv[u.id] = (ps.upLv[u.id] || 0) + 1;
  u.apply(ps.st);
  ps.picked = true;
  psSnd.power();
  psRenderPort();
}
function psBuyExtra() {
  const ps = PS;
  if (ps.gold < ps.extraCost) return;
  ps.gold -= ps.extraCost;
  ps.extraCost = Math.round(ps.extraCost * 1.8);
  ps.cards = psRollCards(3);
  ps.picked = false;
  psSnd.coin();
  psRenderPort();
}
function psReroll() {
  const ps = PS;
  if (ps.picked || ps.gold < ps.rerollCost) return;
  ps.gold -= ps.rerollCost;
  ps.rerollCost = Math.round(ps.rerollCost * 1.6);
  ps.cards = psRollCards(3);
  psSnd.click();
  psRenderPort();
}
function psBuyRepair() {
  const ps = PS;
  if (ps.gold < ps.repairCost || ps.repairCost <= 0) return;
  ps.gold -= ps.repairCost;
  ps.st.hp = ps.st.maxHp;
  ps.repairCost = 0;
  psSnd.heal();
  psRenderPort();
}
function psSail() {
  psClosePort();
  psSnd.horn();
  PS.lastTs = performance.now();
  psStartLeg();
}

/* ══════════════════ 出現 ══════════════════ */
function psSpawnEnemy() {
  const ps = PS;
  if (ps.spawnQueue <= 0) return;
  ps.spawnQueue--;
  const type = psPick(ps.plan.pool || ['pirate']);
  const d = PS_ENEMIES[type];
  const sc  = 1 + (ps.leg - 1) * 0.26;
  const gsc = 1 + (ps.leg - 1) * 0.11;
  ps.enemies.push({
    type, ...d,
    worldX: ps.player.x + psR(-270, 270),
    depth: 0,
    hp: Math.round(d.hp * sc), maxHp: Math.round(d.hp * sc),
    gold: Math.round(d.gold * gsc),
    spd: d.spd * (1 + (ps.leg - 1) * 0.02),
    fireCd: (d.cd || 999) * psR(0.6, 1.2),
    ph: psR(0, Math.PI*2),
    burn: 0, burnT: 0, phaseT: psR(0, 160), visible: true,
  });
}

function psSpawnBoss(kind) {
  const ps = PS;
  const tier = Math.ceil(ps.leg / 4);
  const hp = Math.round((kind === 'flagship' ? 620 : 700) * (1 + (tier - 1) * 0.75));
  const b = {
    isBoss: true, kind, type: kind,
    name: kind === 'flagship' ? '亡霊提督の旗艦' : '深淵のクラーケン',
    worldX: ps.player.x, depth: kind === 'flagship' ? 0.55 : 0.70,
    hp, maxHp: hp, gold: Math.round(900 * tier),
    hw: kind === 'flagship' ? 92 : 105,
    color: kind === 'flagship' ? '#2a1838' : '#3a1050',
    phase: 1, state: 'idle', stateT: 90, sub: 0,
    ph: 0, burn: 0, burnT: 0, visible: true, tier,
    baseDepth: kind === 'flagship' ? 0.55 : 0.70,
  };
  ps.boss = b;
  ps.enemies.push(b);
}

function psSpawnPickup(force) {
  const ps = PS;
  const r = Math.random();
  let kind = 'chest';
  if (r > 0.62 && r <= 0.80) kind = 'repair';
  else if (r > 0.80 && r <= 0.92) kind = 'powder';
  else if (r > 0.92) kind = 'rum';
  ps.pickups.push({
    kind,
    worldX: ps.player.x + psR(-240, 240),
    depth: 0, spd: psR(0.0048, 0.0072),
    gold: kind === 'chest' ? Math.round(psR(30, 70) * (1 + ps.leg * 0.16)) : 0,
    ph: psR(0, 6.28),
  });
}

/* ══════════════════ 砲撃 ══════════════════ */
function psFlightFrames() { return PS_CFG.B_DEPTH0 / PS_CFG.B_SPEED; }

function psMakeBullet(targetX, dmg, opts = {}) {
  const ps = PS, p = ps.player;
  const ff = psFlightFrames();
  ps.pBullets.push({
    worldX: p.x,
    depth: PS_CFG.B_DEPTH0,
    vx: (targetX - p.x) / ff,
    speed: PS_CFG.B_SPEED * (opts.fast || 1),
    dmg,
    pierce: (opts.pierce != null ? opts.pierce : ps.st.pierce),
    big: !!opts.big,
    hitSet: [],
  });
}

function psEffDmg() {
  const st = PS.st;
  let d = st.dmg * st.dmgMul;
  if (st.rage > 0 && st.hp / st.maxHp <= 0.35) d *= (1 + st.rage);
  return d;
}

function psChargeStart() {
  if (PS.phase !== 'play' || !PS.player) return;
  PS.player.charging = true;
}
function psChargeRelease() {
  const ps = PS, p = ps.player;
  if (!p) return;
  const ch = p.charge;
  p.charging = false; p.charge = 0;
  if (ps.phase !== 'play') return;
  if (p.fireCd > 0) return;
  psFire(ch);
}
function psFirePlayer() {   // モバイルのタップ砲撃（HTMLから呼ばれる）
  if (PS.phase !== 'play' || !PS.player || PS.player.fireCd > 0) return;
  psFire(0);
}

function psFire(charge = 0) {
  const ps = PS, p = ps.player, st = ps.st;
  const full = charge >= 1;
  const mul  = 1 + charge * 1.6;
  const n    = st.guns;
  const base = psEffDmg() * mul / (1 + (n - 1) * 0.22);   // 多門化は総火力を少し逓減
  for (let i = 0; i < n; i++) {
    const off = n === 1 ? 0 : (i - (n - 1) / 2) * 26;
    psMakeBullet(ps.aimX + off, base, {
      big: full, pierce: st.pierce + (full ? 1 : 0),
    });
  }
  p.fireCd = 20 * st.cdMul * (ps.buffs.fullsail > 0 ? 0.5 : 1) * (1 + charge * 0.5);
  ps.shake = Math.max(ps.shake, full ? 9 : 4);
  psMuzzleFlash(full);
  full ? psSnd.charged() : psSnd.cannon();
}

function psMuzzleFlash(big) {
  const ps = PS, W = ps.LW, H = ps.LH;
  for (const side of [-1, 1]) {
    const x = W/2 + side * (big ? 74 : 62) + (ps.player.x - 400) * 0.10;
    const y = H - 100;
    ps.explosions.push({ x, y, r:0, maxR: big?46:30, life:.85, spd: big?3.0:2.2, warm:true });
    for (let i = 0; i < (big?7:4); i++) {
      const a = psR(-Math.PI*0.9, -Math.PI*0.1);
      ps.particles.push({ x, y, vx:Math.cos(a)*psR(1,3.4), vy:Math.sin(a)*psR(1,3.4),
        life:1, r:psR(1.5,3.5), color: Math.random()>.5?'#ffd070':'#ff9030' });
    }
  }
}

/* ══════════════════ スキル ══════════════════ */
function psUseSkill(i) {
  const ps = PS, sk = ps.skills[i];
  if (!sk || ps.phase !== 'play' || sk.t > 0) return;
  sk.t = sk.cd * ps.st.skillCdMul;

  if (sk.id === 'broadside') {
    const d = psEffDmg() * 0.75;
    for (let k = -3; k <= 3; k++) psMakeBullet(ps.aimX + k * 42, d, { pierce: ps.st.pierce + 1 });
    ps.shake = 14; psMuzzleFlash(true); psSnd.charged();
    psFloat('一斉射撃！', ps.LW/2, ps.LH - 150, '#ffca50', 20);
  } else if (sk.id === 'repair') {
    const h = Math.round(ps.st.maxHp * 0.32);
    ps.st.hp = Math.min(ps.st.maxHp, ps.st.hp + h);
    ps.player.inv = Math.max(ps.player.inv, 70);
    psSnd.heal();
    psFloat('+' + h, ps.LW/2, ps.LH - 150, '#60ffa0', 22);
  } else if (sk.id === 'fullsail') {
    ps.buffs.fullsail = 420;
    psSnd.power();
    psFloat('追い風！', ps.LW/2, ps.LH - 150, '#7ad0ff', 20);
  }
  psUpdateHud();
}

/* ══════════════════ ダメージ処理 ══════════════════ */
function psFloat(text, x, y, color, size = 15) {
  PS.floaters.push({ text, x, y, color, size, life: 1, vy: -0.9 });
}
function psAddGold(n, x, y) {
  const ps = PS;
  const mul = (1 + Math.min(ps.combo, 20) * 0.05) * ps.st.goldMul * (ps.weather ? ps.weather.goldMul : 1);
  const g = Math.max(1, Math.round(n * mul));
  ps.gold += g;
  psFloat('+' + g + 'G', x, y, '#ffd450', 15);
  psSnd.coin();
}
function psSpawnHit(sx, sy, big, warm) {
  const ps = PS;
  ps.explosions.push({ x:sx, y:sy, r:0, maxR: big?92:52, life:1, spd: big?3.6:2.2, warm });
  big ? psSnd.explode() : psSnd.hit();
  const n = big ? 14 : 5;
  for (let i = 0; i < n; i++) {
    const a = psR(0, Math.PI*2), s = psR(1.4, big?5.5:4.2);
    ps.particles.push({ x:sx, y:sy, vx:Math.cos(a)*s, vy:Math.sin(a)*s, life:1,
      r:psR(2,5), color: Math.random()>.4?'#ff8020':'#ffd040' });
  }
}
function psSplash(sx, sy, scale = 1) {
  PS.splashes.push({ x:sx, y:sy, r:0, life:1, s:scale });
  psSnd.splash();
}

function psDamageEnemy(e, dmg, sx, sy, opts = {}) {
  const ps = PS, st = ps.st;
  if (!e || e.hp <= 0) return;
  if (e.phase && !e.visible && !e.isBoss) { psFloat('MISS', sx, sy, '#88c0d0', 13); return; }

  let d = dmg, crit = false;
  if (!opts.noCrit && Math.random() < st.crit) { d *= 2.2; crit = true; }
  e.hp -= d;
  if (st.burn > 0 && !opts.noBurn) { e.burn = st.burn; e.burnT = Math.max(e.burnT, 240); }

  psFloat(Math.round(d) + (crit ? '!' : ''), sx + psR(-10,10), sy - 14,
          crit ? '#ffe060' : '#ffffff', crit ? 20 : 14);
  if (crit) psSnd.crit();
  psSpawnHit(sx, sy, false);

  if (e.hp <= 0) psKillEnemy(e, sx, sy);
}

function psRemoveEnemy(e) {
  const idx = PS.enemies.indexOf(e);
  if (idx >= 0) PS.enemies.splice(idx, 1);
  return idx >= 0;
}

function psKillEnemy(e, sx, sy) {
  const ps = PS;
  if (!psRemoveEnemy(e)) return;   // 二重撃沈を防ぐ

  psSpawnHit(sx, sy, true);
  ps.shake = Math.max(ps.shake, e.isBoss ? 30 : 10);
  psAddGold(e.gold, sx, sy - 30);
  ps.totalSunk++;
  ps.combo++; ps.comboT = 260;

  if (e.isBoss) {
    ps.boss = null;
    psSnd.roar();
    ps.banner = { title:'🏴‍☠️ 撃沈！', sub:`${e.name} を沈めた`, t:180, danger:false };
    for (let i = 0; i < 5; i++)
      setTimeout(() => { if (PS.running) psSpawnHit(sx + psR(-90,90), sy + psR(-50,40), true); }, i * 170);
    for (let i = 0; i < 4; i++) psSpawnPickup(true);
    // 旗艦の沈没とともに艦隊は瓦解する
    ps.enemies.slice().forEach(o => {
      const q = psScreenPos(o.worldX, o.depth);
      psSpawnHit(q.sx, q.sy, true);
      psAddGold(Math.round(o.gold * 0.5), q.sx, q.sy - 24);
    });
    ps.enemies = [];
    ps.spawnQueue = 0;
    ps.sunkInLeg = ps.quota;    // ボス撃破で海域クリア
  } else {
    ps.sunkInLeg++;
    // 鎖弾：周囲へ連鎖爆発
    if (ps.st.chain > 0) {
      const r = 60 + ps.st.chain * 30;
      ps.enemies.slice().forEach(o => {
        if (ps.enemies.indexOf(o) < 0) return;
        if (o !== e && Math.abs(o.worldX - e.worldX) < r && Math.abs(o.depth - e.depth) < 0.18) {
          const p2 = psScreenPos(o.worldX, o.depth);
          psDamageEnemy(o, psEffDmg() * 0.6 * ps.st.chain, p2.sx, p2.sy, { noCrit:true, noBurn:true });
        }
      });
    }
    if (Math.random() < 0.34 * ps.st.pickRate) psSpawnPickup();
  }
  psUpdateHud();
}

function psHurtPlayer(dmg, sx, sy) {
  const ps = PS, st = ps.st, p = ps.player;
  if (p.inv > 0) return;
  if (Math.random() < st.dodge) {
    psFloat('回避!', ps.LW/2, ps.LH - 130, '#7ad0ff', 16);
    p.inv = 22;
    return;
  }
  const d = Math.max(1, Math.round(dmg * (1 - st.dmgRed)));
  st.hp -= d;
  p.inv = 46;
  ps.shake = Math.max(ps.shake, 16);
  ps.combo = 0; ps.comboT = 0;
  psFloat('-' + d, ps.LW/2 + psR(-30,30), ps.LH - 120, '#ff5060', 18);
  if (sx != null) psSpawnHit(sx, sy, false);
  psSnd.alarm();
  if (st.hp <= 0) { st.hp = 0; endPirateSim(true); }
  psUpdateHud();
}

/* ══════════════════ メインループ ══════════════════ */
function psLoop(ts) {
  const ps = PS;
  if (!ps.running) return;
  const dt = Math.min((ts - ps.lastTs) / 16.67, 4);
  ps.lastTs = ts;
  if (ps.phase === 'play') psUpdate(dt);
  else psUpdateIdle(dt);
  psDraw();
  ps.raf = requestAnimationFrame(psLoop);
}

function psUpdateIdle(dt) {
  // 港・リザルト中も演出だけは動かす
  const ps = PS;
  psStepFx(dt);
  ps.shake = Math.max(0, ps.shake - 1.6 * dt);
}

function psStepFx(dt) {
  const ps = PS;
  for (let i = ps.explosions.length - 1; i >= 0; i--) {
    const e = ps.explosions[i];
    e.r += e.spd * dt; e.life -= 0.05 * dt;
    if (e.life <= 0) ps.explosions.splice(i, 1);
  }
  for (let i = ps.particles.length - 1; i >= 0; i--) {
    const p = ps.particles[i];
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 0.08 * dt; p.life -= 0.045 * dt;
    if (p.life <= 0) ps.particles.splice(i, 1);
  }
  for (let i = ps.splashes.length - 1; i >= 0; i--) {
    const s = ps.splashes[i];
    s.r += 1.6 * dt; s.life -= 0.035 * dt;
    if (s.life <= 0) ps.splashes.splice(i, 1);
  }
  for (let i = ps.floaters.length - 1; i >= 0; i--) {
    const f = ps.floaters[i];
    f.y += f.vy * dt; f.vy *= 0.97; f.life -= 0.016 * dt;
    if (f.life <= 0) ps.floaters.splice(i, 1);
  }
  if (ps.ink > 0) ps.ink -= 0.004 * dt;
  if (ps.lightning > 0) ps.lightning -= 0.06 * dt;
}

function psUpdate(dt) {
  const ps = PS, p = ps.player, st = ps.st;
  if (!p) return;

  ps.elapsed += dt / 60;

  /* ─ バナー ─ */
  if (ps.banner) { ps.banner.t -= dt; if (ps.banner.t <= 0) ps.banner = null; }

  /* ─ バフ・クールダウン ─ */
  if (ps.buffs.fullsail > 0) ps.buffs.fullsail -= dt;
  ps.skills.forEach(s => { if (s.t > 0) s.t = Math.max(0, s.t - dt); });
  if (ps.comboT > 0) { ps.comboT -= dt; if (ps.comboT <= 0) ps.combo = 0; }

  /* ─ 操舵 ─ */
  const spd = st.speed * (ps.buffs.fullsail > 0 ? 1.6 : 1) * (p.charging ? 0.7 : 1);
  if (ps.keys.left)  p.x -= spd * dt;
  if (ps.keys.right) p.x += spd * dt;
  // 嵐は船を流す
  if (ps.weather && ps.weather.rock > 1) p.x += Math.cos(ps.wind.angle) * ps.wind.speed * 0.55 * dt;
  p.x = psClamp(p.x, PS_CFG.MIN_X, PS_CFG.MAX_X);
  ps.aimX = psClamp(ps.aimX, p.x - 210, p.x + 210);

  if (p.fireCd > 0) p.fireCd -= dt;
  if (p.inv > 0)    p.inv -= dt;
  if (p.charging && p.fireCd <= 0) p.charge = Math.min(1, p.charge + dt / 72);

  /* ─ 風 ─ */
  ps.windTimer -= dt;
  if (ps.windTimer <= 0) {
    ps.wind.angle += psR(-0.9, 0.9);
    ps.wind.speed  = psR(0.3, 0.85);
    ps.windTimer   = psR(260, 460);
  }
  const windAcc = psWindAcc();

  /* ─ 出現 ─ */
  const maxAlive = Math.min(9, 3 + Math.floor(ps.leg / 1.6));
  ps.spawnTimer -= dt;
  if (ps.spawnTimer <= 0) {
    const alive = ps.enemies.filter(e => !e.isBoss).length;
    if (alive < maxAlive && ps.spawnQueue > 0) psSpawnEnemy();
    ps.spawnTimer = Math.max(28, 70 - ps.leg * 2.5) + psR(0, 40);
  }
  ps.pickTimer -= dt;
  if (ps.pickTimer <= 0) {
    if (ps.pickups.length < 4) psSpawnPickup();
    ps.pickTimer = (150 + psR(0, 90)) / st.pickRate;
  }

  /* ─ 敵 ─
     連鎖爆発・炎上死・ボス撃破は走査中に配列を縮めるので、
     スナップショットを回して「まだ生きているか」を毎回確かめる。 */
  const enemySnapshot = ps.enemies.slice();
  for (let i = enemySnapshot.length - 1; i >= 0; i--) {
    const e = enemySnapshot[i];
    if (ps.enemies.indexOf(e) < 0) continue;   // すでに沈んだ
    if (e.isBoss) { psUpdateBoss(e, dt); continue; }

    // 前進 + 横揺れ + 自機へ寄る
    const hold = e.hold != null ? e.hold : 1.05;
    if (e.depth < hold) e.depth += e.spd * dt;
    e.ph += dt;
    const homing = e.ram ? 0.010 : 0.0012;
    e.worldX += Math.sin(e.ph * e.weaveF * 60) * e.weaveA * 0.02 * dt
              + (p.x - e.worldX) * homing * dt;

    // 炎上
    if (e.burnT > 0) {
      e.burnT -= dt;
      e.hp -= e.burn * dt / 60;
      if (Math.random() < 0.06 * dt) {
        const q = psScreenPos(e.worldX, e.depth);
        ps.particles.push({ x:q.sx+psR(-12,12), y:q.sy-psR(0,26), vx:psR(-.4,.4), vy:-psR(.6,1.6),
          life:1, r:psR(1.5,3), color:'#ff7020' });
      }
      if (e.hp <= 0) { const q = psScreenPos(e.worldX, e.depth); psKillEnemy(e, q.sx, q.sy); continue; }
    }

    // 幽霊船の実体化サイクル
    if (e.phase) {
      e.phaseT -= dt;
      if (e.phaseT <= 0) { e.visible = !e.visible; e.phaseT = e.visible ? 190 : 110; }
    }

    // 攻撃
    if (e.depth > 0.30 && e.depth < 1.0) {
      e.fireCd -= dt;
      if (e.fireCd <= 0) {
        e.fireCd = (e.cd || 90) * psR(0.75, 1.3) / (1 + ps.leg * 0.03);
        if (e.mortar) psFireMortar(e);
        else if (e.fires && (!e.phase || e.visible)) {
          const n = e.volley || 1;
          for (let k = 0; k < n; k++) psFireShell(e, k * 8);
        }
      }
    }

    // 自機到達
    if (e.depth >= 1.05) {
      const q = psScreenPos(e.worldX, e.depth);
      if (Math.abs(e.worldX - p.x) < PS_CFG.RAM_W) {
        psHurtPlayer((e.ram ? 16 : 26) * (1 + ps.leg * 0.05), ps.LW/2, ps.LH - 70);
        psSpawnHit(ps.LW/2, ps.LH - 66, true);
      } else {
        psSplash(q.sx, ps.LH - 40, 1.3);
        psFloat('逃げられた', q.sx, ps.LH - 110, '#8090a0', 13);
      }
      psRemoveEnemy(e);
      ps.spawnQueue++;   // 討ち漏らした分は増援として戻す（ノルマ到達不能を防ぐ）
      if (st.hp <= 0) return;
      continue;
    }
    const q = psScreenPos(e.worldX, e.depth);
    if (q.sx < -420 || q.sx > ps.LW + 420) { psRemoveEnemy(e); ps.spawnQueue++; }
  }

  /* ─ 自弾 ─ */
  for (let i = ps.pBullets.length - 1; i >= 0; i--) {
    const b = ps.pBullets[i];
    b.depth -= b.speed * dt;
    b.vx += windAcc * dt;
    b.worldX += b.vx * dt;

    if (b.depth <= 0.015) {
      const q = psScreenPos(b.worldX, Math.max(0.02, b.depth));
      psSplash(q.sx, q.sy, 0.6);
      ps.pBullets.splice(i, 1);
      continue;
    }
    let removed = false;
    for (let j = ps.enemies.length - 1; j >= 0; j--) {
      const e = ps.enemies[j];
      if (b.hitSet.indexOf(e) >= 0) continue;
      if (e.phase && !e.visible) continue;
      const dTol = PS_CFG.HIT_D + (e.isBoss ? 0.05 : 0);
      if (Math.abs(b.depth - e.depth) < dTol && Math.abs(b.worldX - e.worldX) < e.hw) {
        const q = psScreenPos(e.worldX, e.depth);
        b.hitSet.push(e);
        psDamageEnemy(e, b.dmg * (b.big ? 1.15 : 1), q.sx, q.sy);
        if (b.pierce > 0) { b.pierce--; }
        else { ps.pBullets.splice(i, 1); removed = true; }
        break;
      }
    }
    if (removed) continue;
  }

  /* ─ 敵弾（ワールド座標） ─ */
  for (let i = ps.eShells.length - 1; i >= 0; i--) {
    const s = ps.eShells[i];
    s.depth += s.vd * dt;
    s.worldX += s.vx * dt;
    if (s.depth >= 1.02) {
      const q = psScreenPos(s.worldX, 1);
      if (Math.abs(s.worldX - p.x) < 92) psHurtPlayer(s.dmg, ps.LW/2, ps.LH - 96);
      else psSplash(q.sx, ps.LH - 46, 0.9);
      ps.eShells.splice(i, 1);
      if (st.hp <= 0) return;
      continue;
    }
    const q = psScreenPos(s.worldX, s.depth);
    if (q.sx < -300 || q.sx > ps.LW + 300) ps.eShells.splice(i, 1);
  }

  /* ─ 臼砲（着弾予告） ─ */
  for (let i = ps.mortars.length - 1; i >= 0; i--) {
    const m = ps.mortars[i];
    m.t -= dt;
    if (m.t <= 0) {
      const q = psScreenPos(m.worldX, 0.98);
      psSpawnHit(q.sx, ps.LH - 60, true);
      if (Math.abs(m.worldX - p.x) < m.r) psHurtPlayer(m.dmg, null);
      else psSplash(q.sx, ps.LH - 50, 1.5);
      ps.mortars.splice(i, 1);
      if (st.hp <= 0) return;
    }
  }

  /* ─ 危険地帯（クラーケンの触手など） ─ */
  for (let i = ps.zones.length - 1; i >= 0; i--) {
    const z = ps.zones[i];
    z.t -= dt;
    if (z.sweep) z.worldX += z.sweep * dt;
    if (z.t <= 0 && !z.done) {
      z.done = true; z.t = 26;
      const q = psScreenPos(z.worldX, 0.95);
      psSpawnHit(q.sx, ps.LH - 90, true);
      ps.shake = Math.max(ps.shake, 20);
      if (Math.abs(z.worldX - p.x) < z.r) psHurtPlayer(z.dmg, null);
      if (st.hp <= 0) return;
    } else if (z.done && z.t <= 0) ps.zones.splice(i, 1);
  }

  /* ─ 漂流物 ─ */
  for (let i = ps.pickups.length - 1; i >= 0; i--) {
    const c = ps.pickups[i];
    c.depth += c.spd * dt;
    c.ph += dt;
    // 見張り台（磁力）
    if (st.magnet > 0 && c.depth > 0.75) c.worldX += (p.x - c.worldX) * 0.004 * (st.magnet / 30) * dt;
    if (c.depth >= 1.0) {
      const near = Math.abs(c.worldX - p.x) < (95 + st.magnet);
      const q = psScreenPos(c.worldX, 1);
      if (near) psCollect(c);
      else { psSplash(q.sx, ps.LH - 44, 0.7); psFloat('見失った', q.sx, ps.LH - 120, '#7a8898', 12); }
      ps.pickups.splice(i, 1);
      continue;
    }
    const q = psScreenPos(c.worldX, c.depth);
    if (q.sx < -300 || q.sx > ps.LW + 300) ps.pickups.splice(i, 1);
  }

  psStepFx(dt);
  ps.shake = Math.max(0, ps.shake - 1.6 * dt);

  /* ─ 海域クリア判定 ─ */
  if (ps.sunkInLeg >= ps.quota && ps.spawnQueue <= 0 && !ps.boss) {
    const rest = ps.enemies.filter(e => !e.isBoss).length;
    if (rest === 0) { psLegClear(); return; }
  }

  psUpdateHud();
}

function psCollect(c) {
  const ps = PS, st = ps.st;
  const y = ps.LH - 130;
  if (c.kind === 'chest') {
    psAddGold(c.gold, ps.LW/2, y);
  } else if (c.kind === 'repair') {
    const h = Math.round(st.maxHp * 0.16);
    st.hp = Math.min(st.maxHp, st.hp + h);
    psFloat('+' + h + ' HP', ps.LW/2, y, '#60ffa0', 18);
    psSnd.heal();
  } else if (c.kind === 'powder') {
    ps.buffs.fullsail = Math.max(ps.buffs.fullsail, 330);
    psFloat('火薬樽！速射', ps.LW/2, y, '#ffa040', 17);
    psSnd.power();
  } else {
    ps.player.inv = Math.max(ps.player.inv, 300);
    psFloat('ラム酒！無敵', ps.LW/2, y, '#ff90d0', 17);
    psSnd.power();
  }
  psUpdateHud();
}

/* ─── 敵の攻撃生成 ─── */
function psFireShell(e, delayLead) {
  const ps = PS, p = ps.player;
  const flight = (1 - e.depth) / 0.013;
  const lead = (ps.keys.right ? 1 : ps.keys.left ? -1 : 0) * ps.st.speed * flight * 0.55;
  const target = p.x + lead + psR(-40, 40) + (delayLead || 0);
  ps.eShells.push({
    worldX: e.worldX, depth: e.depth,
    vd: 0.013 * psR(0.9, 1.15),
    vx: (target - e.worldX) / flight,
    dmg: (e.type === 'navy' ? 12 : 10) * (1 + ps.leg * 0.07),
  });
  psSnd.cannon();
}
function psFireMortar(e) {
  const ps = PS, p = ps.player;
  ps.mortars.push({
    worldX: p.x + psR(-70, 70), r: 105, t: 105, max: 105,
    dmg: 18 * (1 + PS.leg * 0.07),
  });
  psSnd.cannon();
}

/* ══════════════════ ボスAI ══════════════════ */
function psUpdateBoss(b, dt) {
  const ps = PS, p = ps.player;
  b.ph += dt;

  if (b.burnT > 0) {
    b.burnT -= dt; b.hp -= b.burn * dt / 60;
    if (b.hp <= 0) { const q = psScreenPos(b.worldX, b.depth); psKillEnemy(b, q.sx, q.sy); return; }
  }
  if (b.phase === 1 && b.hp / b.maxHp <= 0.5) {
    b.phase = 2; b.state = 'idle'; b.stateT = 40;
    ps.banner = { title:'⚠ 激昂', sub:`${b.name} が本気を出した`, t:130, danger:true };
    psSnd.roar(); ps.shake = 26;
  }
  const fast = b.phase === 2 ? 0.62 : 1;

  b.stateT -= dt;
  if (b.kind === 'flagship') psBossFlagship(b, dt, fast);
  else psBossKraken(b, dt, fast);
}

function psBossFlagship(b, dt, fast) {
  const ps = PS, p = ps.player;
  if (b.state !== 'charge') {
    b.worldX += Math.sin(b.ph * 0.012) * 0.9 * dt + (p.x - b.worldX) * 0.0018 * dt;
    b.depth += (b.baseDepth + Math.sin(b.ph * 0.006) * 0.06 - b.depth) * 0.02 * dt;
  }

  if (b.state === 'idle' && b.stateT <= 0) {
    const opts = b.phase === 2 ? ['volley','broadside','charge','summon'] : ['volley','broadside','charge'];
    b.state = psPick(opts); b.sub = 0;
    b.stateT = b.state === 'charge' ? 90 : 20;
    if (b.state === 'charge') { psSnd.horn(); ps.banner = { title:'⚠ 突進', sub:'進路から離れろ！', t:80, danger:true }; }
  }
  else if (b.state === 'volley') {
    if (b.stateT <= 0) {
      for (let k = -2; k <= 2; k++) {
        const flight = (1 - b.depth) / 0.014;
        ps.eShells.push({ worldX:b.worldX, depth:b.depth, vd:0.014,
          vx:((p.x + k * 55) - b.worldX) / flight, dmg:12*(1+ps.leg*0.06) });
      }
      psSnd.cannon(); b.sub++; b.stateT = 34 * fast;
      if (b.sub >= 3) { b.state = 'idle'; b.stateT = 130 * fast; }
    }
  }
  else if (b.state === 'broadside') {
    if (b.stateT <= 0) {
      const flight = (1 - b.depth) / 0.016;
      ps.eShells.push({ worldX:b.worldX, depth:b.depth, vd:0.016,
        vx:((p.x + psR(-120,120)) - b.worldX) / flight, dmg:9*(1+ps.leg*0.06) });
      psSnd.hit(); b.sub++; b.stateT = 9 * fast;
      if (b.sub >= 12) { b.state = 'idle'; b.stateT = 140 * fast; }
    }
  }
  else if (b.state === 'charge') {
    if (b.stateT > 0) { b.warn = true; }
    else {
      b.warn = false;
      b.depth += 0.011 * dt;
      b.worldX += (p.x - b.worldX) * 0.004 * dt;
      if (b.depth >= 1.02) {
        if (Math.abs(b.worldX - p.x) < 135) { psHurtPlayer(30*(1+ps.leg*0.05), ps.LW/2, ps.LH - 70); psSpawnHit(ps.LW/2, ps.LH-66, true); }
        else psSplash(ps.LW/2 + (b.worldX - p.x) * 2.6, ps.LH - 40, 2);
        b.depth = 0.16; b.state = 'idle'; b.stateT = 150 * fast;
        ps.shake = 24;
      }
    }
  }
  else if (b.state === 'summon') {
    const before = ps.enemies.length;
    for (let i = 0; i < 2; i++) {
      const t = psPick(['pirate','cutter','navy']);
      const d = PS_ENEMIES[t], sc = 1 + (ps.leg - 1) * 0.26;
      ps.enemies.push({ type:t, ...d, worldX:b.worldX + psR(-120,120), depth:Math.max(0.05,b.depth-0.28),
        hp:Math.round(d.hp*sc), maxHp:Math.round(d.hp*sc), gold:Math.round(d.gold*(1+ps.leg*0.1)),
        fireCd:(d.cd||999)*psR(.6,1.2), ph:psR(0,6.28), burn:0, burnT:0, phaseT:0, visible:true });
    }
    psSnd.alarm();
    psFloat('護衛艦 出現！', ps.LW/2, 170, '#ff8060', 17);
    b.state = 'idle'; b.stateT = 170 * fast;
  }
}

function psBossKraken(b, dt, fast) {
  const ps = PS, p = ps.player;
  b.worldX += Math.sin(b.ph * 0.008) * 1.1 * dt + (p.x - b.worldX) * 0.0012 * dt;
  b.depth += (b.baseDepth + Math.sin(b.ph * 0.005) * 0.05 - b.depth) * 0.02 * dt;
  // 渦：自機を引き寄せる（第2段階）
  if (b.phase === 2) p.x += (b.worldX - p.x) * 0.0016 * dt;

  if (b.state === 'idle' && b.stateT <= 0) {
    b.state = psPick(b.phase === 2 ? ['tentacle','ink','sweep','tentacle'] : ['tentacle','ink','sweep']);
    b.sub = 0; b.stateT = 10;
  }
  else if (b.state === 'tentacle') {
    if (b.stateT <= 0) {
      const n = b.phase === 2 ? 3 : 2;
      for (let i = 0; i < n; i++)
        ps.zones.push({ worldX: p.x + psR(-230, 230), r: 78, t: 78, max: 78,
                        dmg: 20*(1+ps.leg*0.05), kind:'tentacle' });
      psSnd.roar();
      b.state = 'idle'; b.stateT = 190 * fast;
    }
  }
  else if (b.state === 'sweep') {
    if (b.stateT <= 0) {
      const dir = Math.random() > 0.5 ? 1 : -1;
      ps.zones.push({ worldX: p.x - dir * 300, r: 70, t: 150, max: 150, dmg: 18*(1+ps.leg*0.05),
                      sweep: dir * 2.6, kind:'sweep' });
      psSnd.roar();
      b.state = 'idle'; b.stateT = 200 * fast;
    }
  }
  else if (b.state === 'ink') {
    if (b.stateT <= 0) {
      const flight = (1 - b.depth) / 0.015;
      for (let k = -1; k <= 1; k++)
        ps.eShells.push({ worldX:b.worldX, depth:b.depth, vd:0.015,
          vx:((p.x + k * 70) - b.worldX) / flight, dmg:11*(1+ps.leg*0.06), ink:true });
      psSnd.hit(); b.sub++; b.stateT = 40 * fast;
      if (b.sub >= 2) { ps.ink = 1; b.state = 'idle'; b.stateT = 175 * fast; }
    }
  }
}

/* ══════════════════ HUD（DOM） ══════════════════ */
function psUpdateHud() {
  const ps = PS, st = ps.st;
  if (!st) return;
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  const bar = document.getElementById('psHpBar');
  if (bar) bar.style.width = (Math.max(0, st.hp) / st.maxHp * 100) + '%';
  set('psHpLabel', 'HP ' + Math.max(0, Math.round(st.hp)) + '/' + st.maxHp);
  set('psGoldHud', '💰 ' + ps.gold + 'G');
  set('psLegHud',  '🧭 第' + ps.leg + '海域');
  set('psQuotaHud', ps.boss ? '☠ BOSS' : '☠ ' + Math.min(ps.sunkInLeg, ps.quota) + '/' + ps.quota);
  set('psWindHud', '🌬 ' + psWindName() + ' ' + '●'.repeat(Math.max(1, Math.round(ps.wind.speed * 3.5))));
  const m = Math.floor(ps.elapsed / 60), s = Math.floor(ps.elapsed % 60);
  set('psTimerHud', m + ':' + String(s).padStart(2, '0'));

  const cb = document.getElementById('psComboHud');
  if (cb) {
    if (ps.combo >= 2) { cb.style.display = ''; cb.textContent = '🔥 x' + (1 + Math.min(ps.combo,20) * 0.05).toFixed(2); }
    else cb.style.display = 'none';
  }
  ps.skills.forEach((sk, i) => {
    const el = document.getElementById('psSkill' + i);
    if (!el) return;
    const total = sk.cd * st.skillCdMul;
    const ratio = sk.t > 0 ? sk.t / total : 0;
    el.classList.toggle('ready', sk.t <= 0);
    const fill = el.querySelector('.ps-skill-cd');
    if (fill) fill.style.height = (ratio * 100) + '%';
    const num = el.querySelector('.ps-skill-num');
    if (num) num.textContent = sk.t > 0 ? Math.ceil(sk.t / 60) : sk.key;
  });
}

/* ══════════════════ 描画 ══════════════════ */
function psDraw() {
  const ps = PS, ctx = ps.ctx, W = ps.LW, H = ps.LH, p = ps.player;
  if (!ctx || !p) return;
  const HY = Math.round(H * ps.HY_RATIO), CVP = W / 2;
  const wx = ps.weather || PS_WEATHER.moon;

  renderPSOcean();
  ctx.clearRect(0, 0, W, H);
  // three.js が使えないときは2Dで空と海を描く
  if (!_psThree) psDrawFallbackBackdrop(ctx, W, H, HY, wx);

  const shk = ps.shake || 0;
  if (shk > 0) { ctx.save(); ctx.translate(psR(-shk,shk)*.5, psR(-shk,shk)*.3); }

  psDrawSky(ctx, W, H, HY, wx);
  psDrawSeaOverlay(ctx, W, H, HY, CVP, p, wx);

  // 着弾予告・危険地帯（水面）
  psDrawTelegraphs(ctx, W, H);

  // 照準
  if (ps.phase === 'play') psDrawAim(ctx, W, H);

  // Zソート描画
  const ents = [
    ...ps.enemies.map(e => ({ ref:e, depth:e.depth, kind:'enemy' })),
    ...ps.pickups.map(c => ({ ref:c, depth:c.depth, kind:'pick' })),
  ].sort((a, b) => a.depth - b.depth);

  ents.forEach(o => {
    const e = o.ref;
    const q = psScreenPos(e.worldX, e.depth);
    if (q.sx < -300 || q.sx > W + 300) return;
    const fog = psFogAlpha(e.depth, wx);
    if (fog <= 0.02) return;
    ctx.save(); ctx.globalAlpha = fog;
    if (o.kind === 'enemy') psDrawEnemy(ctx, e, q.sx, q.sy);
    else psDrawPickup(ctx, e, q.sx, q.sy);
    ctx.restore();
  });

  psDrawBullets(ctx, W, H, wx);
  psDrawFx(ctx);
  drawPSPlayerRear(ctx, W, H, p);
  psDrawFloaters(ctx);
  psDrawOverlays(ctx, W, H, HY, wx);

  if (shk > 0) ctx.restore();
}

/* three.js なしでも成立する空＋海の下地 */
function psDrawFallbackBackdrop(ctx, W, H, HY, wx) {
  const T = Date.now(), storm = wx.name === '嵐';

  const sky = ctx.createLinearGradient(0, 0, 0, HY);
  if (storm) { sky.addColorStop(0, '#04060f'); sky.addColorStop(1, '#0a1424'); }
  else       { sky.addColorStop(0, '#01060e'); sky.addColorStop(.6, '#031228'); sky.addColorStop(1, '#062040'); }
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, HY);

  const sea = ctx.createLinearGradient(0, HY, 0, H);
  if (storm) { sea.addColorStop(0, '#03121f'); sea.addColorStop(.5, '#02182c'); sea.addColorStop(1, '#010a16'); }
  else       { sea.addColorStop(0, '#063056'); sea.addColorStop(.45, '#031e3f'); sea.addColorStop(1, '#010f22'); }
  ctx.fillStyle = sea; ctx.fillRect(0, HY, W, H - HY);

  // 遠近のうねり（手前ほど大きくゆっくり）
  ctx.save();
  const rock = wx.rock;
  for (let i = 0; i < 26; i++) {
    const t = i / 26;
    const y = HY + (H - HY) * Math.pow(t, 1.55);
    const amp = 1.2 + t * 9 * (0.6 + rock);
    const spd = 0.0006 + t * 0.0016;
    ctx.globalAlpha = 0.05 + t * 0.13;
    ctx.strokeStyle = '#8fc4f0';
    ctx.lineWidth = 0.8 + t * 2.2;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 16) {
      const yy = y + Math.sin(x * (0.012 - t * 0.006) + T * spd + i) * amp;
      x === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function psFogAlpha(depth, wx) {
  // 水平線から現れる霧＋天候の霧
  let a = depth < 0.18 ? depth / 0.18 : 1;
  if (wx.fog > 0) {
    const f = 1 - wx.fog * 0.95 * Math.max(0, (0.62 - depth) / 0.62);
    a *= Math.max(0.05, f);
  }
  return a;
}

/* ─── 空 ─── */
function psDrawSky(ctx, W, H, HY, wx) {
  const ps = PS, T = Date.now();
  const starA = wx.name === '嵐' ? 0.15 : 1;

  // 星
  const sT = T * .0004;
  for (let i = 0; i < 42; i++) {
    const sx = (i * 137.5 + 17) % W, sy = (i * 61.8 + 9) % (HY * .86);
    const tw = Math.sin(sT + i * 2.3) * .3 + .7;
    ctx.globalAlpha = (.35 + ((i * 31) % 10) * .055) * tw * starA;
    ctx.fillStyle = '#fffce8';
    ctx.beginPath(); ctx.arc(sx, sy, i % 9 === 0 ? 1.4 : .68, 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 月
  const mX = W * .78, mY = HY * .2, mA = wx.name === '嵐' ? .3 : 1;
  ctx.save(); ctx.globalAlpha = mA;
  const halo = ctx.createRadialGradient(mX,mY,18,mX,mY,75);
  halo.addColorStop(0,'rgba(180,200,245,.18)'); halo.addColorStop(.5,'rgba(160,185,235,.06)'); halo.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(mX,mY,75,0,Math.PI*2); ctx.fill();
  const glow = ctx.createRadialGradient(mX,mY,12,mX,mY,36);
  glow.addColorStop(0,'rgba(200,218,255,.35)'); glow.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(mX,mY,36,0,Math.PI*2); ctx.fill();
  ctx.shadowColor = 'rgba(200,215,255,.5)'; ctx.shadowBlur = 20;
  ctx.fillStyle = '#dce6f8'; ctx.beginPath(); ctx.arc(mX,mY,22,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = '#08101e'; ctx.beginPath(); ctx.arc(mX+8,mY-4,19,0,Math.PI*2); ctx.fill();
  ctx.restore();

  // 雲
  const cT = T * .000028;
  const heavy = wx.name === '嵐';
  const clouds = [
    {ox:-.18,oy:.08,w:.38,h:.09,a:.18,spd:.6},{ox:.28,oy:.14,w:.32,h:.08,a:.14,spd:.4},
    {ox:-.38,oy:.22,w:.55,h:.12,a:.22,spd:.25},{ox:.08,oy:.28,w:.45,h:.1,a:.16,spd:.35},
    {ox:-.55,oy:.05,w:.28,h:.07,a:.12,spd:.5},{ox:.52,oy:.22,w:.36,h:.1,a:.2,spd:.3},
  ];
  for (const c of clouds) {
    const cx = ((c.ox + cT * c.spd * (heavy?2.4:1)) % 1.5 - 0.2) * W;
    const cy = c.oy * HY, cw = c.w * W, ch = c.h * HY * (heavy?1.5:1);
    ctx.save(); ctx.globalAlpha = c.a * (heavy ? 2.1 : 1);
    const g = ctx.createRadialGradient(cx,cy,ch*.1,cx,cy,cw*.52);
    g.addColorStop(0, heavy?'rgba(28,32,46,1)':'rgba(55,75,115,1)');
    g.addColorStop(.55, heavy?'rgba(16,20,32,.8)':'rgba(30,48,85,.75)');
    g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(cx,cy,cw*.5,ch*.5,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx+cw*.22,cy-ch*.1,cw*.32,ch*.4,0,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }

  // 稲妻
  if (heavy) {
    if (Math.random() < 0.006) { PS.lightning = 1; psSnd.hit(); }
    if (PS.lightning > 0) {
      ctx.save();
      ctx.globalAlpha = PS.lightning * .5;
      ctx.fillStyle = '#cfe0ff'; ctx.fillRect(0, 0, W, HY + 30);
      ctx.strokeStyle = 'rgba(230,240,255,.9)'; ctx.lineWidth = 2;
      const lx = W * (0.2 + (PS.lightning * 7 % 1) * 0.6);
      ctx.beginPath(); ctx.moveTo(lx, 0);
      let cy2 = 0, cx2 = lx;
      while (cy2 < HY) { cy2 += psR(14, 30); cx2 += psR(-22, 22); ctx.lineTo(cx2, cy2); }
      ctx.stroke(); ctx.restore();
    }
  }
}

/* ─── 海面オーバーレイ ─── */
function psDrawSeaOverlay(ctx, W, H, HY, CVP, p, wx) {
  // 遠景シルエット
  ctx.save(); ctx.globalAlpha = .45 * (1 - wx.fog * .7);
  [{x:W*.12,h:45,w:55},{x:W*.82,h:38,w:48}].forEach(s => {
    ctx.fillStyle = 'rgba(12,16,30,.88)';
    ctx.fillRect(s.x - s.w/2, HY - s.h, s.w, s.h + 2);
    for (let t = -1; t <= 1; t += 2) {
      ctx.beginPath();
      ctx.moveTo(s.x + t*s.w*.35, HY - s.h);
      ctx.lineTo(s.x + t*s.w*.35, HY - s.h - 18);
      ctx.lineTo(s.x + t*s.w*.35 + t*6, HY - s.h);
      ctx.closePath(); ctx.fill();
    }
  });
  ctx.restore();

  // 月光の帯
  const mv = ctx.createLinearGradient(0, HY, 0, H);
  mv.addColorStop(0,'rgba(200,215,255,0)'); mv.addColorStop(.3,'rgba(200,215,255,.1)'); mv.addColorStop(1,'rgba(200,215,255,.05)');
  ctx.fillStyle = mv; ctx.fillRect(0, HY, W, H - HY);
  const mpX = W * .72;
  const st2 = ctx.createRadialGradient(mpX, HY+2, 2, mpX, HY+2, W*.28);
  st2.addColorStop(0,'rgba(200,218,255,.26)'); st2.addColorStop(.45,'rgba(160,185,235,.09)'); st2.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle = st2; ctx.fillRect(mpX - W*.3, HY, W*.6, H - HY);

  // 航路ライン（自船のworldXを基準に流れる）
  const laneT = (Date.now() * 0.00016) % 1;
  for (let d = 0; d < 12; d++) {
    const t0 = ((d / 12) + laneT) % 1;
    if (t0 < 0.05) continue;
    const y0 = HY + (H - HY) * Math.pow(t0, .82);
    const y1 = HY + (H - HY) * Math.pow(Math.min(1, t0 + 0.045), .82);
    ctx.strokeStyle = `rgba(200,175,80,${.16 * t0})`;
    ctx.lineWidth = Math.max(1, t0 * 3.2);
    ctx.beginPath(); ctx.moveTo(CVP, y0); ctx.lineTo(CVP, y1); ctx.stroke();
  }

  // 水平線の靄
  const mist = ctx.createLinearGradient(0, HY-18, 0, HY+14);
  mist.addColorStop(0,'rgba(80,120,180,0)');
  mist.addColorStop(.5,`rgba(80,120,180,${.18 + wx.fog*.5})`);
  mist.addColorStop(1,'rgba(80,120,180,0)');
  ctx.fillStyle = mist; ctx.fillRect(0, HY-18, W, 32);
}

/* ─── 着弾予告・危険地帯 ─── */
function psDrawTelegraphs(ctx, W, H) {
  const ps = PS, T = Date.now();

  ps.mortars.forEach(m => {
    const q = psScreenPos(m.worldX, 0.97);
    const prog = 1 - m.t / m.max;
    const rw = m.r * 0.97 * PS_CFG.PPW;
    ctx.save();
    ctx.globalAlpha = .35 + Math.sin(T*.02) * .15;
    ctx.strokeStyle = '#ff5030'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(q.sx, H-52, rw, rw*0.28, 0, 0, Math.PI*2); ctx.stroke();
    ctx.globalAlpha = .18;
    ctx.fillStyle = '#ff4020';
    ctx.beginPath(); ctx.ellipse(q.sx, H-52, rw*prog, rw*0.28*prog, 0, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  });

  ps.zones.forEach(z => {
    const q = psScreenPos(z.worldX, 0.95);
    const rw = z.r * 0.95 * PS_CFG.PPW;
    const prog = z.done ? 1 : 1 - z.t / z.max;
    ctx.save();
    if (z.done) {
      // 触手が叩きつける
      ctx.globalAlpha = Math.max(0, z.t / 26);
      psDrawTentacle(ctx, q.sx, H - 70, rw);
    } else {
      ctx.globalAlpha = .30 + Math.sin(T*.018) * .16;
      ctx.strokeStyle = '#c060ff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(q.sx, H-70, rw, rw*0.30, 0, 0, Math.PI*2); ctx.stroke();
      const g = ctx.createRadialGradient(q.sx, H-70, 2, q.sx, H-70, rw);
      g.addColorStop(0, `rgba(180,60,255,${.22*prog})`); g.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(q.sx, H-70, rw, rw*0.30, 0, 0, Math.PI*2); ctx.fill();
      // 触手の影が水中に見える
      ctx.globalAlpha = .5 * prog;
      ctx.fillStyle = 'rgba(30,0,50,.7)';
      ctx.beginPath(); ctx.ellipse(q.sx, H-70, rw*.55, rw*.16, 0, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
  });
}

function psDrawTentacle(ctx, x, y, r) {
  ctx.save();
  const T = Date.now() * 0.004;
  const g = ctx.createLinearGradient(x, y-260, x, y+30);
  g.addColorStop(0, '#2a0838'); g.addColorStop(.6, '#4a1060'); g.addColorStop(1, '#1a0424');
  ctx.strokeStyle = g;
  ctx.lineCap = 'round';
  for (let k = 0; k < 3; k++) {
    ctx.lineWidth = (26 - k*7) * Math.max(.4, r/90);
    ctx.beginPath();
    ctx.moveTo(x + k*10 - 10, y + 24);
    ctx.quadraticCurveTo(x + Math.sin(T+k)*46 - 20, y - 120, x + k*22 - 22 + Math.sin(T*1.3+k)*30, y - 250);
    ctx.stroke();
  }
  // 吸盤
  ctx.fillStyle = 'rgba(230,180,220,.45)';
  for (let i = 0; i < 8; i++) {
    const t = i / 8;
    const px = x + Math.sin(T + t*3) * 30 * t - 12;
    const py = y + 20 - t * 240;
    ctx.beginPath(); ctx.arc(px, py, 3.5 * (1 - t*.5), 0, Math.PI*2); ctx.fill();
  }
  // 水柱
  const sp = ctx.createRadialGradient(x, y+16, 4, x, y+16, r*.9);
  sp.addColorStop(0, 'rgba(210,235,255,.55)'); sp.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sp;
  ctx.beginPath(); ctx.ellipse(x, y+16, r*.9, r*.3, 0, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

/* ─── 照準 ─── */
function psDrawAim(ctx, W, H) {
  const ps = PS, p = ps.player;
  const ff = psFlightFrames();
  let wx = p.x, d = PS_CFG.B_DEPTH0;
  let vx = (ps.aimX - p.x) / ff;
  const acc = psWindAcc();
  const pts = [];
  for (let i = 0; i < 46 && d > 0.03; i++) {
    const q = psScreenPos(wx, d);
    pts.push([q.sx, q.sy, d]);
    vx += acc; wx += vx; d -= PS_CFG.B_SPEED;
  }
  if (pts.length < 2) return;

  ctx.save();
  ctx.setLineDash([7, 9]);
  ctx.lineDashOffset = -(Date.now() * 0.02) % 16;
  ctx.strokeStyle = 'rgba(255,210,110,.34)';
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (const [x, y] of pts) ctx.lineTo(x, y);
  ctx.stroke();
  ctx.setLineDash([]);

  // 照準マーカー（敵がいる深度に吸い付く）
  let markIdx = Math.floor(pts.length * 0.45);
  let best = null;
  ps.enemies.forEach(e => {
    for (let i = 0; i < pts.length; i++) {
      if (Math.abs(pts[i][2] - e.depth) < 0.05) {
        const wxAt = p.x + (pts[i][0] - W/2) / (pts[i][2] * PS_CFG.PPW);
        const off = Math.abs(wxAt - e.worldX);
        if (off < e.hw * 1.6 && (!best || off < best.off)) best = { i, off, e };
      }
    }
  });
  if (best) markIdx = best.i;
  const [mx, my, md] = pts[Math.min(markIdx, pts.length - 1)];
  const r = 8 + md * 12;
  ctx.strokeStyle = best ? 'rgba(255,90,70,.85)' : 'rgba(255,210,110,.6)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(mx, my, r, 0, Math.PI*2); ctx.stroke();
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI/2 + Math.PI/4;
    ctx.beginPath();
    ctx.moveTo(mx + Math.cos(a)*r*0.55, my + Math.sin(a)*r*0.55);
    ctx.lineTo(mx + Math.cos(a)*r*1.35, my + Math.sin(a)*r*1.35);
    ctx.stroke();
  }
  ctx.restore();
}

/* ─── 弾 ─── */
function psDrawBullets(ctx, W, H, wx) {
  const ps = PS;

  ps.pBullets.forEach(b => {
    const q = psScreenPos(b.worldX, b.depth);
    if (q.sx < -30 || q.sx > W + 30) return;
    const r = Math.max(3, (1 - b.depth) * (b.big ? 16 : 12) + 3);
    ctx.save();
    for (let i = 1; i <= 3; i++) {
      const t = psScreenPos(b.worldX - b.vx * i * 2, Math.min(1, b.depth + i * .055));
      ctx.globalAlpha = (1 - i * .3) * .26;
      ctx.fillStyle = '#c8c3bb';
      ctx.beginPath(); ctx.arc(t.sx, t.sy, r * .65 * (1 - i * .22), 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
    const g = ctx.createRadialGradient(q.sx - r*.3, q.sy - r*.3, r*.1, q.sx, q.sy, r);
    if (b.big) { g.addColorStop(0,'#ffd070'); g.addColorStop(.55,'#c04010'); g.addColorStop(1,'#3a1004'); }
    else { g.addColorStop(0,'#5a5850'); g.addColorStop(.6,'#282520'); g.addColorStop(1,'#100e0c'); }
    ctx.save();
    ctx.shadowColor = b.big ? 'rgba(255,140,20,.9)' : 'rgba(255,180,20,.45)';
    ctx.shadowBlur = b.big ? 16 : 6;
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.sx, q.sy, r, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  });

  ps.eShells.forEach(s => {
    const q = psScreenPos(s.worldX, s.depth);
    const r = Math.max(2.5, s.depth * 9);
    const near = Math.abs(s.worldX - PS.player.x) < 92;
    ctx.save();
    const g = ctx.createRadialGradient(q.sx, q.sy, r*.2, q.sx, q.sy, r*3);
    if (s.ink) { g.addColorStop(0,'rgba(150,60,220,.55)'); g.addColorStop(1,'rgba(0,0,0,0)'); }
    else { g.addColorStop(0,`rgba(255,${near?90:160},20,.6)`); g.addColorStop(1,'rgba(0,0,0,0)'); }
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.sx, q.sy, r*3, 0, Math.PI*2); ctx.fill();
    const b2 = ctx.createRadialGradient(q.sx-r*.3, q.sy-r*.3, r*.1, q.sx, q.sy, r);
    if (s.ink) { b2.addColorStop(0,'#c060ff'); b2.addColorStop(1,'#2a0040'); }
    else { b2.addColorStop(0,'#e05020'); b2.addColorStop(.6,'#8a1808'); b2.addColorStop(1,'#3a0802'); }
    ctx.fillStyle = b2; ctx.beginPath(); ctx.arc(q.sx, q.sy, r, 0, Math.PI*2); ctx.fill();
    // 自機に向かってくる弾は警告リング
    if (near && s.depth > 0.55) {
      ctx.globalAlpha = .5 + Math.sin(Date.now()*.02)*.3;
      ctx.strokeStyle = '#ff3040'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(q.sx, q.sy, r*2.2, 0, Math.PI*2); ctx.stroke();
    }
    ctx.restore();
  });
}

/* ─── エフェクト ─── */
function psDrawFx(ctx) {
  const ps = PS;

  ps.splashes.forEach(s => {
    ctx.save(); ctx.globalAlpha = s.life * .55;
    ctx.strokeStyle = 'rgba(200,230,255,.9)'; ctx.lineWidth = 2 * s.s;
    ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r * 2.2 * s.s, s.r * .6 * s.s, 0, 0, Math.PI*2); ctx.stroke();
    ctx.globalAlpha = s.life * .3;
    const g = ctx.createRadialGradient(s.x, s.y, 1, s.x, s.y, 26*s.s);
    g.addColorStop(0,'rgba(220,240,255,.8)'); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(s.x, s.y, 26*s.s, 9*s.s, 0, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  });

  ps.explosions.forEach(ex => {
    ctx.save();
    ctx.globalAlpha = ex.life * .35;
    const sm = ctx.createRadialGradient(ex.x, ex.y, ex.r*.5, ex.x, ex.y, ex.r*1.1);
    sm.addColorStop(0,'rgba(130,118,100,.5)'); sm.addColorStop(1,'rgba(80,72,60,0)');
    ctx.fillStyle = sm; ctx.beginPath(); ctx.arc(ex.x, ex.y, ex.r*1.1, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = ex.life * .7;
    const fr = ctx.createRadialGradient(ex.x, ex.y, ex.r*.18, ex.x, ex.y, ex.r*.85);
    fr.addColorStop(0,'rgba(255,245,50,0)'); fr.addColorStop(.4,'rgba(255,160,20,.9)');
    fr.addColorStop(.75,'rgba(200,60,5,.6)'); fr.addColorStop(1,'rgba(80,20,0,0)');
    ctx.fillStyle = fr; ctx.beginPath(); ctx.arc(ex.x, ex.y, ex.r*.85, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = ex.life * .85;
    const co = ctx.createRadialGradient(ex.x, ex.y, 0, ex.x, ex.y, ex.r*.42);
    co.addColorStop(0,'rgba(255,252,200,.95)'); co.addColorStop(.5,'rgba(255,200,60,.7)'); co.addColorStop(1,'rgba(255,100,10,0)');
    ctx.fillStyle = co; ctx.beginPath(); ctx.arc(ex.x, ex.y, ex.r*.42, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  });

  ps.particles.forEach(pt => {
    ctx.save(); ctx.globalAlpha = Math.pow(pt.life, .6);
    const g = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, pt.r*pt.life+.5);
    g.addColorStop(0, pt.color); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r*pt.life+.5, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  });
}

function psDrawFloaters(ctx) {
  PS.floaters.forEach(f => {
    ctx.save();
    ctx.globalAlpha = Math.min(1, f.life * 1.6);
    ctx.font = `900 ${f.size}px -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(0,0,10,.75)';
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
    ctx.restore();
  });
}

/* ─── 前景オーバーレイ ─── */
function psDrawOverlays(ctx, W, H, HY, wx) {
  const ps = PS, T = Date.now();

  // 天候の霧
  if (wx.fog > 0) {
    ctx.save();
    const g = ctx.createLinearGradient(0, HY - 20, 0, H);
    g.addColorStop(0, `rgba(150,175,205,${.42*wx.fog})`);
    g.addColorStop(.45, `rgba(120,150,185,${.20*wx.fog})`);
    g.addColorStop(1, 'rgba(90,120,160,0)');
    ctx.fillStyle = g; ctx.fillRect(0, HY - 20, W, H - HY + 20);
    ctx.restore();
  }

  // 墨（クラーケン）
  if (ps.ink > 0) {
    ctx.save(); ctx.globalAlpha = Math.min(.72, ps.ink * .72);
    for (let i = 0; i < 7; i++) {
      const x = (i * 149 + 60) % W, y = (i * 97 + 120) % H;
      const g = ctx.createRadialGradient(x, y, 4, x, y, 120);
      g.addColorStop(0, 'rgba(20,0,34,.95)'); g.addColorStop(1, 'rgba(20,0,34,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 120, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }

  // 危険フラッシュ
  const nearest = ps.enemies.reduce((m, e) => Math.max(m, e.isBoss ? 0 : e.depth), 0);
  if (nearest > .74) {
    ctx.save();
    ctx.globalAlpha = ((nearest - .74) / .26) * (.16 + Math.sin(T * .012) * .1);
    ctx.fillStyle = 'rgba(220,0,0,.35)'; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  // 瀕死ビネット
  const hpR = ps.st.hp / ps.st.maxHp;
  if (hpR < 0.34) {
    ctx.save();
    ctx.globalAlpha = (0.34 - hpR) * 1.6 * (.55 + Math.sin(T*.006)*.25);
    const g = ctx.createRadialGradient(W/2, H/2, H*.22, W/2, H/2, H*.78);
    g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(190,0,10,.8)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  // 無敵（ラム酒）
  if (ps.player.inv > 120) {
    ctx.save();
    ctx.globalAlpha = .12 + Math.sin(T*.01)*.06;
    ctx.strokeStyle = '#ff90d0'; ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, W-6, H-6);
    ctx.restore();
  }
  // 追い風
  if (ps.buffs.fullsail > 0) {
    ctx.save(); ctx.globalAlpha = .25;
    ctx.strokeStyle = 'rgba(140,210,255,.7)'; ctx.lineWidth = 1.4;
    for (let i = 0; i < 14; i++) {
      const y = (i * 61 + (T * 0.5 % 61)) % H;
      const len = 40 + (i % 5) * 26;
      const x = (i * 97 + 30) % W;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y + 6); ctx.stroke();
    }
    ctx.restore();
  }

  psDrawBossBar(ctx, W);
  psDrawCombo(ctx, W, H);
  psDrawChargeGauge(ctx, W, H);
  psDrawBanner(ctx, W, H);
}

function psDrawBossBar(ctx, W) {
  const b = PS.boss;
  if (!b) return;
  const bw = W * 0.66, x = (W - bw) / 2, y = 16;
  ctx.save();
  ctx.font = '900 14px -apple-system, sans-serif'; ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,10,.7)';
  ctx.fillRect(x - 6, y - 20, bw + 12, 38);
  ctx.strokeStyle = 'rgba(200,60,80,.6)'; ctx.lineWidth = 1;
  ctx.strokeRect(x - 6, y - 20, bw + 12, 38);
  ctx.fillStyle = '#ffb0b8';
  ctx.fillText(`☠ ${b.name}${b.phase===2?'（激昂）':''}`, W/2, y - 6);
  ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(x, y, bw, 11);
  const r = Math.max(0, b.hp / b.maxHp);
  const g = ctx.createLinearGradient(x, 0, x + bw, 0);
  if (b.phase === 2) { g.addColorStop(0,'#ff2020'); g.addColorStop(1,'#ff8040'); }
  else { g.addColorStop(0,'#a02040'); g.addColorStop(1,'#e04060'); }
  ctx.fillStyle = g; ctx.fillRect(x, y, bw * r, 11);
  ctx.strokeStyle = 'rgba(255,190,120,.55)'; ctx.strokeRect(x, y, bw, 11);
  ctx.restore();
}

function psDrawCombo(ctx, W, H) {
  const ps = PS;
  if (ps.combo < 2) return;
  const t = Math.min(1, ps.comboT / 260);
  ctx.save();
  ctx.textAlign = 'right';
  ctx.globalAlpha = .5 + t * .5;
  const sz = 18 + Math.min(ps.combo, 12);
  ctx.font = `900 ${sz}px -apple-system, sans-serif`;
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,10,.8)';
  const txt = `${ps.combo} COMBO`;
  ctx.strokeText(txt, W - 16, 54);
  const g = ctx.createLinearGradient(W - 200, 0, W - 16, 0);
  g.addColorStop(0, '#ff8020'); g.addColorStop(1, '#ffe060');
  ctx.fillStyle = g; ctx.fillText(txt, W - 16, 54);
  ctx.globalAlpha = .35 + t * .3;
  ctx.font = '900 13px -apple-system, sans-serif';
  ctx.fillStyle = '#ffd070';
  ctx.fillText(`金貨 x${(1 + Math.min(ps.combo,20)*0.05).toFixed(2)}`, W - 16, 72);
  ctx.restore();
}

function psDrawChargeGauge(ctx, W, H) {
  const p = PS.player;
  if (!p.charging || p.charge <= 0.02) return;
  const bw = 168, x = (W - bw)/2, y = H - 26;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,10,.65)'; ctx.fillRect(x-2, y-2, bw+4, 12);
  const g = ctx.createLinearGradient(x, 0, x+bw, 0);
  g.addColorStop(0,'#c07020'); g.addColorStop(.7,'#ffb040'); g.addColorStop(1,'#fff0a0');
  ctx.fillStyle = g; ctx.fillRect(x, y, bw * p.charge, 8);
  if (p.charge >= 1) {
    ctx.globalAlpha = .5 + Math.sin(Date.now()*.02)*.5;
    ctx.strokeStyle = '#fff0a0'; ctx.lineWidth = 2;
    ctx.strokeRect(x-3, y-3, bw+6, 14);
    ctx.globalAlpha = 1;
    ctx.font = '900 11px -apple-system, sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = '#fff0a0'; ctx.fillText('MAX', W/2, y - 8);
  }
  ctx.restore();
}

function psDrawBanner(ctx, W, H) {
  const b = PS.banner;
  if (!b) return;
  const t = b.t;
  const a = Math.min(1, t / 40) * Math.min(1, (200 - t) / 20 + 0.4);
  ctx.save();
  ctx.globalAlpha = Math.min(1, a);
  ctx.textAlign = 'center';
  const y = H * 0.30;
  ctx.fillStyle = b.danger ? 'rgba(60,0,10,.55)' : 'rgba(0,10,25,.5)';
  ctx.fillRect(0, y - 34, W, 74);
  ctx.strokeStyle = b.danger ? 'rgba(255,70,70,.5)' : 'rgba(200,170,90,.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, y-34); ctx.lineTo(W, y-34);
  ctx.moveTo(0, y+40); ctx.lineTo(W, y+40); ctx.stroke();
  ctx.font = '900 30px -apple-system, sans-serif';
  ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,10,.85)';
  ctx.strokeText(b.title, W/2, y);
  ctx.fillStyle = b.danger ? '#ff6a70' : '#ffd870';
  ctx.fillText(b.title, W/2, y);
  ctx.font = '600 15px -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(220,205,175,.85)';
  ctx.fillText(b.sub, W/2, y + 26);
  ctx.restore();
}

/* ══════════════════ 艦船アート ══════════════════ */
function psShade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const c = v => Math.max(0, Math.min(255, v + amt));
  return `rgb(${c((n>>16)&255)},${c((n>>8)&255)},${c(n&255)})`;
}

function psDrawEnemy(ctx, e, sx, sy) {
  const ps = PS;
  if (e.isBoss) {
    if (e.kind === 'kraken') drawPSKraken(ctx, e, sx, sy);
    else drawPSFlagship(ctx, e, sx, sy);
    return;
  }
  const scale = Math.max(.06, e.depth * 1.7 + .06);
  const alive = e.hp / e.maxHp;

  ctx.save();
  if (e.phase) ctx.globalAlpha *= e.visible ? 0.94 : 0.22;
  if (!e._has3D) drawPSEnemyFront(ctx, sx, sy, scale, e.color, e.type, alive, e);
  ctx.restore();

  // HPバー
  if (e.depth > .26) {
    const bw = 62 * scale, bh = Math.max(2.5, 5 * scale), by = sy - 46 * scale;
    ctx.fillStyle = 'rgba(0,0,0,.62)'; ctx.fillRect(sx - bw/2, by, bw, bh);
    ctx.fillStyle = alive > .55 ? '#40d060' : alive > .25 ? '#e0c030' : '#e03020';
    ctx.fillRect(sx - bw/2, by, bw * alive, bh);
    if (e.burnT > 0) {
      ctx.fillStyle = 'rgba(255,120,20,.75)';
      ctx.fillRect(sx - bw/2, by - 3, bw * Math.min(1, e.burnT/240), 2);
    }
  }
  // 名札
  if (e.depth > .22 && e.depth < .62) {
    ctx.font = `${Math.max(9, 11*scale*0.8)}px sans-serif`;
    ctx.fillStyle = 'rgba(210,190,130,.6)'; ctx.textAlign = 'center';
    ctx.fillText(e.name, sx, sy + 16 * scale + 10);
  }
}

function drawPSEnemyFront(ctx, x, y, scale, color, type, hpRatio, e) {
  const T = Date.now();
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  const dmg = 1 - hpRatio;
  const isGhost = type === 'ghost';

  // 影
  const sh = ctx.createRadialGradient(0,30,4,0,30,52);
  sh.addColorStop(0,'rgba(0,0,0,.38)'); sh.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle = sh; ctx.beginPath(); ctx.ellipse(0,30,55,14,0,0,Math.PI*2); ctx.fill();

  // 波しぶき
  ctx.save(); ctx.globalAlpha = .42 + Math.sin(T*.003 + (e?e.ph:0))*.12;
  const sp = ctx.createRadialGradient(0,6,2,0,6,28);
  sp.addColorStop(0,'rgba(220,235,255,.7)'); sp.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle = sp; ctx.beginPath(); ctx.ellipse(0,6,25,8,0,0,Math.PI*2); ctx.fill();
  ctx.restore();

  if (isGhost) {
    ctx.save();
    const gg = ctx.createRadialGradient(0,-40,4,0,-40,90);
    gg.addColorStop(0,'rgba(80,255,220,.28)'); gg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(0,-40,90,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }

  // 船体
  const hb = ctx.createLinearGradient(-52,4,52,28);
  hb.addColorStop(0,'#0e0a04'); hb.addColorStop(.5,'#1a1206'); hb.addColorStop(1,'#0e0a04');
  ctx.fillStyle = hb;
  ctx.beginPath(); ctx.moveTo(-52,5); ctx.lineTo(52,5); ctx.lineTo(46,30); ctx.lineTo(-46,30); ctx.closePath(); ctx.fill();
  const hc = ctx.createLinearGradient(-44,4,44,28);
  hc.addColorStop(0, psShade(color,-30)); hc.addColorStop(.5, color); hc.addColorStop(1, psShade(color,-30));
  ctx.fillStyle = hc; ctx.globalAlpha = .9;
  ctx.beginPath(); ctx.moveTo(-44,5); ctx.lineTo(44,5); ctx.lineTo(39,28); ctx.lineTo(-39,28); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(0,0,0,.22)'; ctx.lineWidth = .8;
  for (let i=-3;i<=3;i++){ const px=i*12; ctx.beginPath(); ctx.moveTo(px,5); ctx.lineTo(px*.84,28); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(180,138,15,.65)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-44,5); ctx.lineTo(44,5); ctx.stroke();

  // 舳先
  const pc = ctx.createLinearGradient(0,-20,0,5);
  pc.addColorStop(0,'#0e0a04'); pc.addColorStop(1, psShade(color,-20));
  ctx.fillStyle = pc;
  ctx.beginPath(); ctx.moveTo(-14,4); ctx.lineTo(14,4); ctx.quadraticCurveTo(0,2,0,-22); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(200,160,20,.55)'; ctx.beginPath(); ctx.arc(0,-21,2.5,0,Math.PI*2); ctx.fill();

  // 砲門
  ctx.fillStyle = 'rgba(0,0,0,.75)';
  for (const side of [-1,1]) {
    const cx = side*48, cy = 12, w = 13, h = 9;
    ctx.fillRect(cx-w/2, cy-h/2, w, h);
    if (type==='navy'||type==='pirate'||type==='bombard') {
      ctx.fillStyle='rgba(30,25,18,.9)'; ctx.fillRect(cx-w/2+1, cy-h/2+1, w-2, h-2);
      ctx.fillStyle='rgba(0,0,0,.75)';
    }
    if (type==='navy') ctx.fillRect(cx-w/2, cy+8, w, h);
  }
  // 砲艦の臼砲
  if (type === 'bombard') {
    ctx.save(); ctx.fillStyle = '#181410';
    ctx.beginPath(); ctx.moveTo(-13,2); ctx.lineTo(13,2); ctx.lineTo(9,-26); ctx.lineTo(-9,-26); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(150,110,40,.6)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  }

  // マスト
  const mast = isGhost ? '#123830' : '#1a0e04';
  ctx.strokeStyle = mast; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(0,4); ctx.lineTo(0,-105); ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-24,4); ctx.lineTo(-20,-72); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(24,4); ctx.lineTo(20,-72); ctx.stroke();
  ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.moveTo(-52,-92); ctx.lineTo(52,-92); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-42,-60); ctx.lineTo(42,-60); ctx.stroke();
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-30,-102); ctx.lineTo(30,-102); ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-35,-70); ctx.lineTo(-12,-70); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(12,-70); ctx.lineTo(35,-70); ctx.stroke();
  ctx.strokeStyle = 'rgba(50,35,12,.45)'; ctx.lineWidth = 1;
  [[0,-105,-55,-2],[0,-105,55,-2],[0,-62,-40,-2],[0,-62,40,-2]].forEach(([x1,y1,x2,y2])=>{
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  });

  // 帆
  const sailColors = {
    merchant:['rgba(210,200,165,.9)','rgba(190,182,148,.85)'],
    pirate:  ['rgba(28,24,18,.92)','rgba(22,18,14,.88)'],
    navy:    ['rgba(228,226,220,.92)','rgba(200,198,190,.85)'],
    ghost:   ['rgba(120,255,225,.30)','rgba(60,200,180,.22)'],
  };
  const key = type==='cutter' ? 'merchant' : type==='bombard' ? 'navy' : type;
  const [c1,c2] = sailColors[key] || sailColors.merchant;
  const bow = Math.sin(T*.0008 + (e?e.ph*0.01:0)) * 3.5;
  ctx.globalAlpha = hpRatio > .5 ? 1 : .72;

  const s1 = ctx.createLinearGradient(-52,-92,52,-60);
  s1.addColorStop(0,c2); s1.addColorStop(.5,c1); s1.addColorStop(1,c2);
  ctx.fillStyle = s1;
  ctx.beginPath();
  ctx.moveTo(-52,-60); ctx.quadraticCurveTo(-55+bow,-76,-50,-92);
  ctx.lineTo(50,-92); ctx.quadraticCurveTo(55-bow,-76,52,-60); ctx.closePath(); ctx.fill();
  ctx.strokeStyle='rgba(80,65,40,.3)'; ctx.lineWidth=.8; ctx.stroke();

  const s2 = ctx.createLinearGradient(-32,-104,32,-92);
  s2.addColorStop(0,c2); s2.addColorStop(.5,c1); s2.addColorStop(1,c2);
  ctx.fillStyle = s2;
  ctx.beginPath();
  ctx.moveTo(-32,-92); ctx.quadraticCurveTo(-35+bow*.6,-98,-30,-104);
  ctx.lineTo(30,-104); ctx.quadraticCurveTo(35-bow*.6,-98,32,-92); ctx.closePath(); ctx.fill(); ctx.stroke();

  ctx.fillStyle = s2;
  ctx.beginPath(); ctx.moveTo(-35,-50); ctx.quadraticCurveTo(-38+bow*.5,-60,-33,-72); ctx.lineTo(-12,-72); ctx.quadraticCurveTo(-14-bow*.3,-60,-12,-50); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(12,-50); ctx.quadraticCurveTo(14-bow*.3,-60,12,-72); ctx.lineTo(33,-72); ctx.quadraticCurveTo(38-bow*.5,-60,35,-50); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.globalAlpha = 1;

  // 紋章
  if (type === 'pirate') {
    ctx.save(); ctx.globalAlpha=.55; ctx.fillStyle='#050505';
    ctx.font='28px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('☠',0,-76); ctx.restore();
  } else if (type === 'navy' || type === 'bombard') {
    ctx.strokeStyle='rgba(190,5,5,.62)'; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.moveTo(0,-92); ctx.lineTo(0,-60); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-30,-76); ctx.lineTo(30,-76); ctx.stroke();
  } else if (type === 'ghost') {
    ctx.save(); ctx.globalAlpha=.5; ctx.fillStyle='#a0fff0';
    ctx.font='26px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('👁',0,-76); ctx.restore();
  } else if (type === 'cutter') {
    ctx.fillStyle='rgba(40,220,150,.5)'; ctx.fillRect(-7,-106,14,8);
  } else {
    ctx.fillStyle='rgba(40,80,180,.45)'; ctx.fillRect(-8,-106,16,9);
  }

  // 損傷の煙
  if (dmg > .25) {
    ctx.save(); ctx.globalAlpha = dmg*.4;
    const sm = ctx.createRadialGradient(0,-52,2,0,-52,22+dmg*18);
    sm.addColorStop(0,'rgba(150,140,125,.7)'); sm.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle = sm; ctx.beginPath(); ctx.arc(0,-52,22+dmg*18,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
  // 炎上
  if (e && e.burnT > 0) {
    ctx.save(); ctx.globalAlpha = .5 + Math.sin(T*.02)*.2;
    const fg = ctx.createRadialGradient(0,-20,2,0,-20,34);
    fg.addColorStop(0,'rgba(255,180,40,.7)'); fg.addColorStop(.6,'rgba(220,70,10,.35)'); fg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(0,-20,34,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/* ─── ボス：亡霊提督の旗艦 ─── */
function drawPSFlagship(ctx, b, x, y) {
  const T = Date.now();
  const scale = Math.max(.2, b.depth * 2.9 + .1);
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);

  // 亡霊オーラ
  const aura = ctx.createRadialGradient(0,-70,10,0,-70,180);
  aura.addColorStop(0, b.phase===2 ? 'rgba(255,60,60,.20)' : 'rgba(120,60,200,.16)');
  aura.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = aura; ctx.beginPath(); ctx.arc(0,-70,180,0,Math.PI*2); ctx.fill();

  // 影
  const sh = ctx.createRadialGradient(0,42,8,0,42,140);
  sh.addColorStop(0,'rgba(0,0,0,.55)'); sh.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle = sh; ctx.beginPath(); ctx.ellipse(0,42,140,26,0,0,Math.PI*2); ctx.fill();

  // 船体（3層）
  const hull = ctx.createLinearGradient(-120,0,120,44);
  hull.addColorStop(0,'#080410'); hull.addColorStop(.5,'#1c1030'); hull.addColorStop(1,'#080410');
  ctx.fillStyle = hull;
  ctx.beginPath(); ctx.moveTo(-124,4); ctx.lineTo(124,4); ctx.lineTo(104,44); ctx.lineTo(-104,44); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(60,20,90,.35)';
  ctx.beginPath(); ctx.moveTo(-116,8); ctx.lineTo(116,8); ctx.lineTo(100,26); ctx.lineTo(-100,26); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(190,150,40,.55)'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-124,4); ctx.lineTo(124,4); ctx.stroke();

  // 舳先の角
  ctx.fillStyle = '#0a0616';
  ctx.beginPath(); ctx.moveTo(-26,3); ctx.lineTo(26,3); ctx.quadraticCurveTo(0,0,0,-46); ctx.closePath(); ctx.fill();
  ctx.fillStyle = b.phase===2 ? 'rgba(255,70,50,.85)' : 'rgba(160,90,240,.7)';
  ctx.beginPath(); ctx.arc(0,-44,5,0,Math.PI*2); ctx.fill();

  // 砲列（2段×左右）
  const fired = b.state === 'broadside' || b.state === 'volley';
  for (const side of [-1,1]) {
    for (let row = 0; row < 2; row++) {
      for (let k = 0; k < 3; k++) {
        const cx = side * (58 + k * 22), cy = 14 + row * 13;
        ctx.fillStyle = 'rgba(0,0,0,.85)'; ctx.fillRect(cx-7, cy-5, 14, 10);
        if (fired && Math.random() < 0.12) {
          const fg = ctx.createRadialGradient(cx,cy,1,cx,cy,18);
          fg.addColorStop(0,'rgba(255,220,120,.9)'); fg.addColorStop(1,'rgba(255,120,0,0)');
          ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(cx,cy,18,0,Math.PI*2); ctx.fill();
        }
      }
    }
  }

  // 船尾楼のランタン
  for (const side of [-1,1]) {
    const lx = side * 112, ly = -6;
    const fl = Math.sin(T*.008 + side*2)*.15+.85;
    const lg = ctx.createRadialGradient(lx,ly,2,lx,ly,42);
    lg.addColorStop(0, b.phase===2?`rgba(255,90,60,${.6*fl})`:`rgba(150,110,255,${.55*fl})`);
    lg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(lx,ly,42,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = b.phase===2?'#ff6040':'#a070ff';
    ctx.beginPath(); ctx.arc(lx,ly,6,0,Math.PI*2); ctx.fill();
  }

  // マスト3本
  ctx.strokeStyle = '#0d0618'; ctx.lineCap = 'round';
  ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(0,4);   ctx.lineTo(0,-210); ctx.stroke();
  ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-58,4); ctx.lineTo(-50,-160); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(58,4); ctx.lineTo(50,-160); ctx.stroke();
  ctx.lineWidth = 5;
  [[-120,-180,120,-180],[-96,-120,96,-120],[-70,-196,70,-196]].forEach(([a,bb,c,d])=>{
    ctx.beginPath(); ctx.moveTo(a,bb); ctx.lineTo(c,d); ctx.stroke();
  });

  // ボロボロの帆
  const wv = Math.sin(T*.0011)*7;
  const mk = a => {
    const g = ctx.createLinearGradient(-120,0,120,0);
    const base = b.phase===2 ? [70,20,24] : [34,26,44];
    g.addColorStop(0,`rgba(${base[0]*.5},${base[1]*.5},${base[2]*.5},${a})`);
    g.addColorStop(.5,`rgba(${base[0]},${base[1]},${base[2]},${a})`);
    g.addColorStop(1,`rgba(${base[0]*.5},${base[1]*.5},${base[2]*.5},${a})`);
    return g;
  };
  ctx.fillStyle = mk(.88);
  ctx.beginPath(); ctx.moveTo(-118,-120); ctx.quadraticCurveTo(-130+wv,-150,-116,-180);
  ctx.lineTo(116,-180); ctx.quadraticCurveTo(130-wv,-150,118,-120);
  // 裂け目
  ctx.lineTo(60,-124); ctx.lineTo(40,-146); ctx.lineTo(14,-122); ctx.lineTo(-30,-140); ctx.lineTo(-64,-120);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = mk(.82);
  ctx.beginPath(); ctx.moveTo(-68,-184); ctx.quadraticCurveTo(-76+wv*.6,-192,-66,-206);
  ctx.lineTo(66,-206); ctx.quadraticCurveTo(76-wv*.6,-192,68,-184); ctx.closePath(); ctx.fill();

  // 髑髏紋
  ctx.save(); ctx.globalAlpha = b.phase===2?.72:.5;
  ctx.fillStyle = b.phase===2?'#ff7060':'#d8d0f0';
  ctx.font = '72px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('☠', 0, -152);
  ctx.restore();

  // 突進予告
  if (b.warn) {
    ctx.save();
    ctx.globalAlpha = .35 + Math.sin(T*.03)*.3;
    ctx.strokeStyle = '#ff2030'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(-100, 60); ctx.lineTo(0, 130); ctx.lineTo(100, 60); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

/* ─── ボス：深淵のクラーケン ─── */
function drawPSKraken(ctx, b, x, y) {
  const T = Date.now(), t = T * 0.001;
  const scale = Math.max(.2, b.depth * 2.6 + .1);
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);

  // 水中の巨影
  ctx.save(); ctx.globalAlpha = .5;
  const sh = ctx.createRadialGradient(0,50,20,0,50,220);
  sh.addColorStop(0,'rgba(20,0,40,.9)'); sh.addColorStop(1,'rgba(20,0,40,0)');
  ctx.fillStyle = sh; ctx.beginPath(); ctx.ellipse(0,50,220,50,0,0,Math.PI*2); ctx.fill();
  ctx.restore();

  // 背後の触手（8本）
  for (let i = 0; i < 8; i++) {
    const side = i < 4 ? -1 : 1;
    const k = i % 4;
    const sway = Math.sin(t * (1.1 + k*0.2) + i) * 40;
    ctx.save();
    ctx.strokeStyle = `rgba(${58+k*8},${14+k*4},${76+k*10},${.8 - k*0.12})`;
    ctx.lineWidth = 22 - k * 3.5; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(side * (40 + k*24), 20);
    ctx.quadraticCurveTo(side * (140 + k*40) + sway, -60 - k*20, side * (110 + k*56) + sway*1.6, -170 - k*32);
    ctx.stroke();
    ctx.restore();
  }

  // 頭部
  const hd = ctx.createRadialGradient(-30,-60,10,0,-30,150);
  hd.addColorStop(0,'#6a2088'); hd.addColorStop(.55,'#3c0e56'); hd.addColorStop(1,'#180428');
  ctx.fillStyle = hd;
  ctx.beginPath();
  ctx.moveTo(-92, 26);
  ctx.quadraticCurveTo(-104, -60, -46, -128);
  ctx.quadraticCurveTo(0, -168, 46, -128);
  ctx.quadraticCurveTo(104, -60, 92, 26);
  ctx.quadraticCurveTo(0, 56, -92, 26);
  ctx.closePath(); ctx.fill();
  // 質感の斑点
  ctx.save(); ctx.globalAlpha = .25; ctx.fillStyle = '#b060d0';
  for (let i = 0; i < 16; i++) {
    const a = i * 2.4, rr = 30 + (i % 5) * 14;
    ctx.beginPath(); ctx.arc(Math.cos(a)*rr, -46 + Math.sin(a)*rr*0.7, 5 + (i%3)*2, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();

  // 目
  const blink = (Math.sin(t * 0.7) > 0.94) ? 0.15 : 1;
  for (const side of [-1, 1]) {
    const ex = side * 40, ey = -66;
    const g = ctx.createRadialGradient(ex, ey, 2, ex, ey, 40);
    g.addColorStop(0, b.phase===2 ? 'rgba(255,70,40,.9)' : 'rgba(255,210,60,.85)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ex, ey, 40, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = b.phase===2 ? '#ffdd60' : '#fff0a0';
    ctx.beginPath(); ctx.ellipse(ex, ey, 17, 17*blink, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#100018';
    ctx.beginPath(); ctx.ellipse(ex + Math.sin(t*0.9)*4, ey, 5, 15*blink, 0, 0, Math.PI*2); ctx.fill();
  }

  // 嘴
  ctx.fillStyle = '#1a0d06';
  ctx.beginPath(); ctx.moveTo(-24, 6); ctx.lineTo(24, 6); ctx.lineTo(0, 40); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(220,200,180,.35)'; ctx.lineWidth = 2; ctx.stroke();

  // 前方の触手（画面手前）
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? -1 : 1;
    const sway = Math.sin(t * 1.5 + i * 2) * 34;
    ctx.save();
    ctx.strokeStyle = 'rgba(84,26,110,.92)';
    ctx.lineWidth = 26; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(side * 62, 30);
    ctx.quadraticCurveTo(side * 150 + sway, 40, side * 190 + sway, -30 + Math.sin(t*1.2+i)*22);
    ctx.stroke();
    ctx.fillStyle = 'rgba(230,180,220,.35)';
    for (let k = 1; k <= 5; k++) {
      const tt = k / 6;
      const px = side * 62 + (side * 128 + sway) * tt;
      const py = 30 - 40 * tt * tt;
      ctx.beginPath(); ctx.arc(px, py, 5 - k*0.5, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }

  // 水面の泡
  ctx.save(); ctx.globalAlpha = .4;
  for (let i = 0; i < 12; i++) {
    const a = (t * 0.6 + i) % 1;
    ctx.fillStyle = 'rgba(200,230,255,.5)';
    ctx.beginPath(); ctx.arc(psR(-110,110), 40 - a * 26, 2 + (i%3), 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();
  ctx.restore();
}

/* ─── 漂流物 ─── */
function psDrawPickup(ctx, c, x, y) {
  const s = Math.max(.28, c.depth * 1.7 + .06);
  const T = Date.now();
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.translate(0, Math.sin(T*.0032 + c.ph) * 2.5);

  const near = Math.abs(c.worldX - PS.player.x) < (95 + PS.st.magnet);
  const tint = { chest:'#f0c320', repair:'#40e080', powder:'#ff8020', rum:'#ff70c0' }[c.kind];

  // 光
  const g = ctx.createRadialGradient(0,-2,2,0,-2,30);
  g.addColorStop(0, tint + '99');
  g.addColorStop(1, tint + '00');
  ctx.save(); ctx.globalAlpha = near ? .9 : .45;
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0,-2,30,0,Math.PI*2); ctx.fill();
  ctx.restore();

  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath(); ctx.ellipse(0,10,16,5,0,0,Math.PI*2); ctx.fill();

  if (c.kind === 'chest') {
    const bg = ctx.createLinearGradient(-14,0,14,16);
    bg.addColorStop(0,'#7a3e08'); bg.addColorStop(.5,'#5c2e06'); bg.addColorStop(1,'#3a1c04');
    ctx.fillStyle = bg; ctx.fillRect(-14,0,28,16);
    ctx.fillStyle = 'rgba(140,100,15,.7)';
    ctx.fillRect(-14,6,28,2); ctx.fillRect(-14,2,2,14); ctx.fillRect(12,2,2,14);
    const lg = ctx.createLinearGradient(-14,-12,14,0);
    lg.addColorStop(0,'#9a5010'); lg.addColorStop(.5,'#c86818'); lg.addColorStop(1,'#7a3e08');
    ctx.fillStyle = lg;
    ctx.beginPath(); ctx.moveTo(-14,0); ctx.lineTo(14,0); ctx.lineTo(13,-12); ctx.arcTo(0,-18,-13,-12,8); ctx.lineTo(-13,-12); ctx.closePath(); ctx.fill();
    const lk = ctx.createRadialGradient(-1,-3,1,-1,-3,5);
    lk.addColorStop(0,'#f0d040'); lk.addColorStop(.5,'#c8a020'); lk.addColorStop(1,'#8a6810');
    ctx.fillStyle = lk; ctx.beginPath(); ctx.arc(0,-2,5,0,Math.PI*2); ctx.fill();
  } else {
    // 樽（種類で色分け）
    const col = { repair:['#2a6a3a','#48b060'], powder:['#5a2a0a','#c06020'], rum:['#5a1040','#d060a0'] }[c.kind];
    const bg = ctx.createLinearGradient(-13,-12,13,14);
    bg.addColorStop(0, col[0]); bg.addColorStop(.5, col[1]); bg.addColorStop(1, col[0]);
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(-11,-12); ctx.quadraticCurveTo(-16,0,-11,12);
    ctx.lineTo(11,12); ctx.quadraticCurveTo(16,0,11,-12); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(190,160,90,.75)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-14,-5); ctx.lineTo(14,-5); ctx.moveTo(-14,5); ctx.lineTo(14,5); ctx.stroke();
    ctx.font = '11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.fillText({ repair:'🩹', powder:'🔥', rum:'🍺' }[c.kind], 0, 0);
  }

  // 回収圏内マーク
  if (near && c.depth > 0.6) {
    ctx.strokeStyle = 'rgba(120,255,160,.6)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(0, 12, 22, 7, 0, 0, Math.PI*2); ctx.stroke();
  }
  ctx.restore();
}

/* ─── 自船（船尾視点） ─── */
function drawPSPlayerRear(ctx, W, H, player) {
  const ps = PS, T = Date.now();
  const rock = ps.weather ? ps.weather.rock : 0.5;
  const drift = (player.x - 400) * 0.10;
  const roll  = Math.sin(T * 0.0011) * 0.016 * rock;
  const cx = W/2 + drift, cy = H - 82 + Math.sin(T * 0.0016) * 3.2 * rock;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(roll);
  if (player.inv > 0 && player.inv < 120 && Math.floor(T / 70) % 2 === 0) ctx.globalAlpha = 0.45;

  const sw = 158, hullH = 74;
  const galY = -hullH*.5, deckY = galY - 4, mastBase = deckY - 3;

  // 航跡
  const wk = ctx.createRadialGradient(0,22,6,0,58,135);
  wk.addColorStop(0,'rgba(160,210,245,.68)'); wk.addColorStop(.45,'rgba(75,145,210,.22)'); wk.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle = wk;
  ctx.beginPath(); ctx.moveTo(-7,3); ctx.lineTo(-140,112);
  ctx.quadraticCurveTo(-38,72,0,55); ctx.quadraticCurveTo(38,72,140,112);
  ctx.lineTo(7,3); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.globalAlpha = .42;
  const wsp = ps.buffs.fullsail > 0 ? 0.0022 : 0.0009;
  for (let i = 0; i < 5; i++) {
    const fw = (i-2)*22, fp = ((T*wsp + i*.32) % 1);
    ctx.strokeStyle = `rgba(200,235,255,${(1-fp)*.56})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(fw,4); ctx.lineTo(fw*2.5+Math.sin(fp*9)*5, 22+fp*80); ctx.stroke();
  }
  ctx.restore();

  // 船体
  ctx.fillStyle = 'rgba(0,0,0,.4)';
  ctx.beginPath(); ctx.ellipse(0, hullH*.52+18, sw*.72, 19, 0, 0, Math.PI*2); ctx.fill();
  const hG = ctx.createLinearGradient(0,galY,0,hullH*.52);
  hG.addColorStop(0,'#140b04'); hG.addColorStop(.45,'#0d0704'); hG.addColorStop(1,'#070402');
  ctx.fillStyle = hG;
  ctx.beginPath(); ctx.moveTo(-sw/2-24,hullH*.52); ctx.lineTo(sw/2+24,hullH*.52);
  ctx.lineTo(sw/2+2,galY); ctx.lineTo(-sw/2-2,galY); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.globalAlpha = .06;
  for (let i=-4;i<=4;i++){ ctx.fillStyle='rgba(80,45,10,1)'; ctx.fillRect(i*(sw/8)-1,galY,2,hullH); }
  ctx.restore();

  // 船尾楼の窓
  const galW = sw*.9, galH = 64;
  const gB = ctx.createLinearGradient(0,galY,0,galY+galH);
  gB.addColorStop(0,'#100808'); gB.addColorStop(.5,'#181008'); gB.addColorStop(1,'#100808');
  ctx.fillStyle = gB; ctx.fillRect(-galW/2,galY,galW,galH);
  ctx.strokeStyle = 'rgba(172,126,16,.82)'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-galW/2,galY+1); ctx.lineTo(galW/2,galY+1); ctx.stroke();
  for (let i = 0; i <= 6; i++) {
    const px = -galW/2 + i*(galW/6);
    const pg = ctx.createLinearGradient(px-3,0,px+3,0);
    pg.addColorStop(0,'rgba(0,0,0,0)'); pg.addColorStop(.5,'rgba(155,112,15,.28)'); pg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle = pg; ctx.fillRect(px-3,galY,6,galH);
  }
  for (let i = -1; i <= 1; i++) {
    const wx2 = i*(galW*.31), wy = galY+5, ww = 30, wh = 22;
    const fl = Math.sin(T*.007+i*1.4)*.06+.44;
    const wg = ctx.createRadialGradient(wx2,wy+wh*.55,0,wx2,wy+wh*.55,32);
    wg.addColorStop(0,`rgba(255,185,55,${fl*.55})`); wg.addColorStop(.65,'rgba(220,130,20,.12)'); wg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle = wg; ctx.beginPath(); ctx.arc(wx2,wy+wh*.55,32,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#030202';
    ctx.beginPath(); ctx.rect(wx2-ww/2,wy+wh*.32,ww,wh*.68); ctx.arc(wx2,wy+wh*.32,ww/2,Math.PI,0); ctx.fill();
    ctx.fillStyle = `rgba(255,185,50,${fl})`;
    ctx.beginPath(); ctx.rect(wx2-ww/2+2,wy+wh*.32+1,ww-4,wh*.68-2); ctx.arc(wx2,wy+wh*.32,ww/2-2,Math.PI,0); ctx.fill();
    ctx.strokeStyle = 'rgba(162,116,14,.84)'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.rect(wx2-ww/2,wy+wh*.32,ww,wh*.68); ctx.stroke();
    ctx.beginPath(); ctx.arc(wx2,wy+wh*.32,ww/2,Math.PI,0); ctx.stroke();
  }
  const mwy = galY+33;
  for (let i = -2; i <= 2; i++) {
    const wx2 = i*(galW*.185), ww = 18, wh = 13;
    const fl = Math.sin(T*.008+i*.9)*.05+.36;
    ctx.fillStyle = `rgba(255,175,45,${fl*.4})`; ctx.fillRect(wx2-ww/2-4,mwy-3,ww+8,wh+6);
    ctx.fillStyle = '#040202'; ctx.fillRect(wx2-ww/2,mwy,ww,wh);
    ctx.fillStyle = `rgba(255,175,45,${fl})`; ctx.fillRect(wx2-ww/2+2,mwy+1,ww-4,wh-2);
    ctx.strokeStyle = 'rgba(152,108,12,.75)'; ctx.lineWidth = 1.5; ctx.strokeRect(wx2-ww/2,mwy,ww,wh);
  }
  ctx.strokeStyle = 'rgba(168,122,14,.78)'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-galW/2,galY+galH); ctx.lineTo(galW/2,galY+galH); ctx.stroke();

  // ランタン
  for (const side of [-1,1]) {
    const lx = side*(galW/2+11), ly = galY+16;
    const fl = Math.sin(T*.008+side*2.1)*.12+.88;
    const lg = ctx.createRadialGradient(lx,ly,3,lx,ly,48);
    lg.addColorStop(0,`rgba(255,205,60,${.55*fl})`); lg.addColorStop(.4,`rgba(220,130,20,${.24*fl})`); lg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(lx,ly,48,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = 'rgba(85,55,10,.92)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(lx,ly-28); ctx.lineTo(lx,ly-14); ctx.stroke();
    ctx.fillStyle = 'rgba(42,26,4,.94)';
    ctx.beginPath();
    for (let k=0;k<6;k++){ const a=(k/6)*Math.PI*2-Math.PI/2; const fx=lx+Math.cos(a)*9.5, fy=ly-14+Math.sin(a)*9.5; k===0?ctx.moveTo(fx,fy):ctx.lineTo(fx,fy); }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = `rgba(255,218,60,${.92*fl})`;
    ctx.beginPath();
    for (let k=0;k<6;k++){ const a=(k/6)*Math.PI*2-Math.PI/2; const fx=lx+Math.cos(a)*6.5, fy=ly-14+Math.sin(a)*6.5; k===0?ctx.moveTo(fx,fy):ctx.lineTo(fx,fy); }
    ctx.closePath(); ctx.fill();
  }

  // 甲板
  const dk = ctx.createLinearGradient(0,deckY,0,deckY-18);
  dk.addColorStop(0,'#180c05'); dk.addColorStop(1,'#0c0804');
  ctx.fillStyle = dk;
  ctx.beginPath(); ctx.moveTo(-sw/2-2,deckY); ctx.lineTo(sw/2+2,deckY);
  ctx.lineTo(sw/2+10,deckY-18); ctx.lineTo(-sw/2-10,deckY-18); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(42,26,5,.6)'; ctx.lineWidth = 1.5;
  for (let i=-6;i<=6;i++){ const rx=i*(sw/12); ctx.beginPath(); ctx.moveTo(rx,deckY); ctx.lineTo(rx*1.06,deckY-18); ctx.stroke(); }

  // 舷側砲（門数が見た目に反映される）
  const guns = Math.min(4, ps.st.guns);
  for (const side of [-1, 1]) {
    for (let k = 0; k < guns; k++) {
      const gx = side * (66 + k * 17), gy = deckY - 6;
      ctx.fillStyle = '#141210';
      ctx.fillRect(gx - 4, gy - 4, 8, 12);
      ctx.fillStyle = 'rgba(190,150,60,.35)';
      ctx.fillRect(gx - 4, gy - 5, 8, 2);
    }
  }

  // 索具・マスト・帆
  ctx.strokeStyle = 'rgba(48,30,8,.52)'; ctx.lineWidth = 1;
  [[0,mastBase-240,-105,mastBase-58],[0,mastBase-240,105,mastBase-58],
   [0,mastBase-168,-86,mastBase-30],[0,mastBase-168,86,mastBase-30],
   [-48,mastBase-162,-90,mastBase-74],[48,mastBase-162,90,mastBase-74]].forEach(([x1,y1,x2,y2])=>{
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  });
  ctx.strokeStyle = '#0c0804'; ctx.lineWidth = 10;
  ctx.beginPath(); ctx.moveTo(0,mastBase); ctx.lineTo(0,mastBase-240); ctx.stroke();
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(-48,mastBase); ctx.lineTo(-42,mastBase-162); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(48,mastBase);  ctx.lineTo(42,mastBase-162);  ctx.stroke();
  ctx.lineWidth = 5;
  [[-62,-82,62,-82],[-50,-134,50,-134],[-32,-182,32,-182]].forEach(([a,b2,c,d])=>{
    ctx.beginPath(); ctx.moveTo(a,mastBase+b2); ctx.lineTo(c,mastBase+d); ctx.stroke();
  });

  const wv = Math.sin(T*.0009)*4.2 + (ps.buffs.fullsail > 0 ? 5 : 0);
  const mkSail = a => {
    const g = ctx.createLinearGradient(-65,0,65,0);
    g.addColorStop(0,`rgba(18,16,14,${a})`); g.addColorStop(.35,`rgba(36,32,26,${a*.86})`);
    g.addColorStop(.65,`rgba(40,36,28,${a*.9})`); g.addColorStop(1,`rgba(18,16,14,${a})`);
    return g;
  };
  ctx.fillStyle = mkSail(.93);
  ctx.beginPath(); ctx.moveTo(-62,mastBase-32); ctx.quadraticCurveTo(-69+wv,mastBase-57,-58,mastBase-82);
  ctx.lineTo(58,mastBase-82); ctx.quadraticCurveTo(69-wv,mastBase-57,62,mastBase-32); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(55,48,35,.28)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = mkSail(.9);
  ctx.beginPath(); ctx.moveTo(-50,mastBase-86); ctx.quadraticCurveTo(-58+wv*.82,mastBase-110,-48,mastBase-134);
  ctx.lineTo(48,mastBase-134); ctx.quadraticCurveTo(58-wv*.82,mastBase-110,50,mastBase-86); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = mkSail(.87);
  ctx.beginPath(); ctx.moveTo(-32,mastBase-138); ctx.quadraticCurveTo(-38+wv*.55,mastBase-160,-30,mastBase-182);
  ctx.lineTo(30,mastBase-182); ctx.quadraticCurveTo(38-wv*.55,mastBase-160,32,mastBase-138); ctx.closePath(); ctx.fill(); ctx.stroke();

  // 海賊旗
  const fw = Math.sin(T*.005)*8, fY = mastBase-242;
  ctx.fillStyle = '#050505';
  ctx.beginPath(); ctx.moveTo(0,fY); ctx.lineTo(36+fw,fY+9); ctx.lineTo(34+fw,fY+22); ctx.lineTo(0,fY+24); ctx.closePath(); ctx.fill();
  ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = 'rgba(242,240,236,.94)'; ctx.textAlign = 'center';
  ctx.fillText('☠', 18+fw*.5, fY+18);

  ctx.restore();
}

/* ══════════════════ リザルト ══════════════════ */
function endPirateSim(sunk) {
  const ps = PS;
  ps.phase = 'over';
  psClosePort();

  const rank = PS_RANKS.find(r => ps.gold >= r.g) || PS_RANKS[PS_RANKS.length-1];
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.innerHTML = v; };

  set('psResultIcon',  sunk ? '💀' : '🏴‍☠️');
  const t = document.getElementById('psResultTitle');
  if (t) { t.textContent = sunk ? '撃沈された…' : '航海終了'; t.style.color = sunk ? '#ff4060' : '#d4a830'; }
  set('psResultGold',  ps.gold + 'G');
  const m = Math.floor(ps.elapsed/60), s = Math.floor(ps.elapsed%60);
  set('psResultDetail',
    `<span>🧭 到達 <b>第${ps.leg}海域</b></span>
     <span>☠ 撃沈 <b>${ps.totalSunk}隻</b></span>
     <span>⏱ ${m}:${String(s).padStart(2,'0')}</span>`);
  set('psResultRank', rank.t);

  const ups = Object.keys(ps.upLv).map(id => {
    const u = PS_UPGRADES.find(x => x.id === id);
    return u ? `<span class="ps-res-up">${u.icon}${u.name}<b>${ps.upLv[id]}</b></span>` : '';
  }).join('');
  set('psResultBuild', ups || '<span class="ps-res-up">強化なし</span>');

  const res = document.getElementById('psResult');
  if (res) res.style.display = 'flex';

  sunk ? psSnd.fail() : psSnd.levelup();

  try {
    saveHSList('pirate', { score: ps.gold, sunk: ps.totalSunk, leg: ps.leg,
                           date: new Date().toLocaleDateString('ja-JP') });
    const best = parseInt(localStorage.getItem('psGoldBest') || '0');
    if (ps.gold > best) {
      localStorage.setItem('psGoldBest', ps.gold);
      localStorage.setItem('psGoldBestLeg', ps.leg);   // 同じランの到達海域を対で残す
      const el = document.getElementById('pirateBest');
      if (el) el.textContent = '記録: ' + ps.gold + 'G（第' + ps.leg + '海域）';
    }
    const bl = parseInt(localStorage.getItem('psLegBest') || '0');
    if (ps.leg > bl) localStorage.setItem('psLegBest', ps.leg);
  } catch (e) {}
}

/* ══════════════════════════════════════════════════
   THREE.JS OCEAN
══════════════════════════════════════════════════ */
let _psThree = null;

function psApplyWeather3D() {
  if (!_psThree || !PS.weather) return;
  const w = PS.weather;
  const u = _psThree.mat.uniforms;
  const storm = w.name === '嵐';
  u.uWaveAmp.value = storm ? 2.0 : (w.rock < 0.4 ? 0.55 : 1.0);
  if (_psThree.scene.fog) _psThree.scene.fog.density = 0.022 + w.fog * 0.026;
  if (storm) { u.uDeep.value.setHex(0x000a16); u.uMid.value.setHex(0x00162c); u.uShallow.value.setHex(0x002340); }
  else if (w.fog > 0.5) { u.uDeep.value.setHex(0x081826); u.uMid.value.setHex(0x0c2438); u.uShallow.value.setHex(0x123650); }
  else { u.uDeep.value.setHex(0x001228); u.uMid.value.setHex(0x001e42); u.uShallow.value.setHex(0x00315c); }
}

function _makeEnemy3D() {
  const g = new THREE.Group();
  const hullM  = new THREE.MeshPhongMaterial({ color: 0x110c06 });
  const colorM = new THREE.MeshPhongMaterial({ color: 0x4a6a9a, side: THREE.DoubleSide });
  const mastM  = new THREE.MeshPhongMaterial({ color: 0x1a0e04 });
  const sailM  = new THREE.MeshPhongMaterial({ color: 0xb8aa78, side: THREE.DoubleSide });
  const flagM  = new THREE.MeshPhongMaterial({ color: 0x880010, side: THREE.DoubleSide });

  const hull = new THREE.Mesh(new THREE.BoxGeometry(4.8, 1.6, 8.0), hullM);
  hull.position.y = 0.8; g.add(hull);
  const cHull = new THREE.Mesh(new THREE.BoxGeometry(4.3, 1.3, 7.5), colorM);
  cHull.position.y = 0.82; g.add(cHull);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(0.85, 3.0, 5), hullM);
  bow.rotation.x = -Math.PI/2; bow.position.set(0, 0.85, 5.0); g.add(bow);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 11.0, 6), mastM);
  mast.position.set(0, 7.3, -0.4); g.add(mast);
  const ya = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.22, 0.22), mastM);
  ya.position.set(0, 11.8, -0.4); g.add(ya);
  const sail = new THREE.Mesh(new THREE.PlaneGeometry(10.0, 7.0), sailM);
  sail.position.set(0, 8.4, -0.4); g.add(sail);
  const topSail = new THREE.Mesh(new THREE.PlaneGeometry(7.0, 3.5), sailM);
  topSail.position.set(0, 11.0, -0.4); g.add(topSail);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.85), flagM);
  flag.position.set(0.65, 12.8, -0.4); g.add(flag);

  g._colorMat = colorM; g._sailMat = sailM; g._flagMat = flagM;
  return g;
}

function _makePlayerHull() {
  const g = new THREE.Group();
  const hM = new THREE.MeshPhongMaterial({ color: 0x1a0e06, shininess: 110, specular: new THREE.Color(0x1a2233) });
  const sM = new THREE.MeshPhongMaterial({ color: 0x361a0a, shininess: 35 });
  const dM = new THREE.MeshPhongMaterial({ color: 0x2a1608 });
  const rM = new THREE.MeshPhongMaterial({ color: 0x0f0804 });
  const lM = new THREE.MeshPhongMaterial({ color: 0xffbb40, emissive: 0xaa5500 });
  const cM = new THREE.MeshPhongMaterial({ color: 0x1c1c1c, shininess: 100 });

  const hull = new THREE.Mesh(new THREE.BoxGeometry(9.0, 2.4, 7.0), hM);
  hull.position.y = 1.2; g.add(hull);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(8.5, 1.9, 6.6), sM);
  stripe.position.y = 1.25; g.add(stripe);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.2, 6.5), dM);
  deck.position.y = 2.5; g.add(deck);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(8.0, 1.6, 1.8), hM);
  cabin.position.set(0, 3.5, -2.6); g.add(cabin);
  const wM = new THREE.MeshPhongMaterial({ color: 0xffcc66, emissive: 0xaa7700 });
  [-2.2, 0, 2.2].forEach(wx => {
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.55, 0.1), wM);
    win.position.set(wx, 3.55, -3.55); g.add(win);
  });
  for (let z = -2.5; z <= 2.5; z += 1.25) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 1.1, 5), rM);
    p.position.set(4.6, 2.95, z); g.add(p);
    const p2 = p.clone(); p2.position.x = -4.6; g.add(p2);
  }
  const rb = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 6.2), rM);
  rb.position.set(4.6, 3.42, 0); g.add(rb);
  const rb2 = rb.clone(); rb2.position.x = -4.6; g.add(rb2);
  [-1.2, 1.2].forEach(lx => {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), lM);
    l.position.set(lx, 4.4, -3.5); g.add(l);
  });
  [-1.8, 1.8].forEach(cz => {
    const cr = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.14, 1.4, 8), cM);
    cr.rotation.z = Math.PI/2; cr.position.set(4.8, 2.55, cz); g.add(cr);
    const cl = cr.clone(); cl.position.x = -4.8; g.add(cl);
  });
  const mastM = new THREE.MeshPhongMaterial({ color: 0x1c0c04, shininess: 30 });
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 6.0, 8), mastM);
  mast.position.set(0, 5.5, 0.5); g.add(mast);
  const ya = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.2, 0.2), mastM);
  ya.position.set(0, 8.4, 0.5); g.add(ya);
  const sailM = new THREE.MeshPhongMaterial({ color: 0xccc09a, side: THREE.DoubleSide, shininess: 8 });
  const sail = new THREE.Mesh(new THREE.PlaneGeometry(8.8, 4.5), sailM);
  sail.position.set(0, 6.2, 0.5); g.add(sail);
  const flagM = new THREE.MeshPhongMaterial({ color: 0x0d0d0d, side: THREE.DoubleSide });
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.9), flagM);
  flag.position.set(0.7, 9.5, 0.5); g.add(flag);
  return g;
}

function initPSOcean(cssW, cssH) {
  if (typeof THREE === 'undefined') return;
  const tc = document.getElementById('psThreeCanvas');
  if (!tc) return;
  if (_psThree) { _psThree.renderer.dispose(); _psThree = null; }

  tc.style.width = cssW + 'px'; tc.style.height = cssH + 'px'; tc.style.display = 'block';
  const psC = document.getElementById('psCanvas');
  if (psC && psC.parentElement) {
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
  const camera = new THREE.PerspectiveCamera(60, W/H, 0.1, 250);
  camera.position.set(0, 3.5, 25);
  camera.lookAt(0, 0, 0);

  const geo = new THREE.PlaneGeometry(200, 140, 100, 75);
  geo.rotateX(-Math.PI/2);

  const uniforms = {
    uTime:    { value: 0.0 },
    uWaveAmp: { value: 1.0 },
    uDeep:    { value: new THREE.Color(0x001228) },
    uMid:     { value: new THREE.Color(0x001e42) },
    uShallow: { value: new THREE.Color(0x00315c) },
    uMoonDir: { value: new THREE.Vector3(-0.55, 0.60, -0.58).normalize() },
    uMoonCol: { value: new THREE.Color(0xaabfde) },
    uCamPos:  { value: camera.position },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      uniform float uTime; uniform float uWaveAmp;
      varying float vHeight; varying vec3 vWorldPos; varying vec3 vNorm;
      float wave(float x,float z,float f,float a,float s,float p){
        return sin(x*f + z*f*0.6 + uTime*s + p)*a;
      }
      float hAt(float x,float z){
        return (wave(x,z,2.2,1.10,0.80,0.0)+wave(x,z,1.7,0.75,0.65,1.57)
              + wave(x,z,3.5,0.45,1.20,0.9)+wave(x,z,5.1,0.25,1.50,2.1)
              + wave(x,z,7.8,0.14,1.80,3.4)) * uWaveAmp;
      }
      void main(){
        vec3 pos = position;
        float x = pos.x*0.06, z = pos.z*0.06;
        float h = hAt(x,z);
        pos.y = h; vHeight = h; vWorldPos = pos;
        float e = 0.048;
        vNorm = normalize(vec3(-(hAt(x+e,z)-h)/0.8, 1.0, -(hAt(x,z+e)-h)/0.8));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos,1.0);
      }`,
    fragmentShader: `
      uniform vec3 uDeep; uniform vec3 uMid; uniform vec3 uShallow;
      uniform vec3 uMoonDir; uniform vec3 uMoonCol; uniform vec3 uCamPos;
      varying float vHeight; varying vec3 vWorldPos; varying vec3 vNorm;
      void main(){
        float dist = length(vWorldPos - uCamPos);
        float d = clamp(dist/80.0, 0.0, 1.0);
        vec3 base = mix(uShallow, mix(uMid, uDeep, d*0.8), d);
        vec3 V = normalize(uCamPos - vWorldPos);
        vec3 Hv = normalize(uMoonDir + V);
        float sp  = pow(max(dot(vNorm,Hv),0.0), 80.0);
        float sp2 = pow(max(dot(vNorm,Hv),0.0),  6.0);
        base += uMoonCol*(sp*0.9 + sp2*0.12);
        float foam = smoothstep(1.4, 2.6, vHeight);
        base = mix(base, vec3(0.50,0.68,0.92), foam*0.40);
        float sx = abs(vWorldPos.x - 7.0)/28.0;
        base += uMoonCol * exp(-sx*sx*1.8) * 0.10;
        gl_FragColor = vec4(base, 1.0);
      }`,
  });

  const ocean = new THREE.Mesh(geo, mat);
  ocean.position.set(0, 0, -25);
  scene.add(ocean);

  const skyGeo = new THREE.SphereGeometry(200, 16, 8);
  skyGeo.scale(-1, 1, -1);
  scene.add(new THREE.Mesh(skyGeo, new THREE.ShaderMaterial({
    side: THREE.BackSide, uniforms: {},
    vertexShader: `varying float vY; void main(){ vY=position.y; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying float vY;
      void main(){ float t=clamp(vY/200.0,0.0,1.0);
        gl_FragColor=vec4(mix(vec3(0.005,0.055,0.135), vec3(0.002,0.024,0.055), t),1.0); }`,
  })));

  scene.add(new THREE.AmbientLight(0x0c1c30, 1.0));
  const moon = new THREE.DirectionalLight(0x8aaacf, 1.4);
  moon.position.set(-6, 10, -8);
  scene.add(moon);

  // 泡
  const fCnt = 1100;
  const fPos = new Float32Array(fCnt*3), fPh = new Float32Array(fCnt);
  for (let i = 0; i < fCnt; i++) {
    fPos[i*3] = (Math.random()-0.5)*190;
    fPos[i*3+1] = Math.random()*0.7;
    fPos[i*3+2] = (Math.random()-0.5)*140 - 25;
    fPh[i] = Math.random()*Math.PI*2;
  }
  const foamGeo = new THREE.BufferGeometry();
  foamGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3));
  foamGeo.setAttribute('aPhase',   new THREE.BufferAttribute(fPh, 1));
  const foamMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `attribute float aPhase; uniform float uTime; varying float vA;
      void main(){ vA=0.5+0.5*sin(uTime*1.3+aPhase);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
        gl_PointSize=2.0+vA*2.0; }`,
    fragmentShader: `varying float vA;
      void main(){ float d=length(gl_PointCoord-vec2(0.5)); if(d>0.5)discard;
        gl_FragColor=vec4(0.55,0.72,0.92,vA*0.30); }`,
    transparent: true, depthWrite: false,
  });
  scene.add(new THREE.Points(foamGeo, foamMat));

  // 航跡
  const wakeGeo = new THREE.PlaneGeometry(14, 30, 6, 20);
  wakeGeo.rotateX(-Math.PI/2);
  const wakeMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false,
    vertexShader: `varying vec2 vUv; uniform float uTime;
      void main(){ vUv=uv; vec3 p=position;
        p.y+=sin(p.z*0.65+uTime*2.2)*0.14*(1.0-uv.y);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0); }`,
    fragmentShader: `varying vec2 vUv;
      void main(){ float cx=abs(vUv.x-0.5)*2.0;
        float sp=mix(0.08,0.98,vUv.y);
        float v=smoothstep(sp,sp*0.55,cx);
        gl_FragColor=vec4(0.58,0.74,0.94,v*pow(vUv.y,0.55)*0.24); }`,
  });
  const wake = new THREE.Mesh(wakeGeo, wakeMat);
  wake.position.set(0, 0.22, 4);
  scene.add(wake);

  // 水平線の遠景船
  function makeShip3D() {
    const g = new THREE.Group();
    const hullM = new THREE.MeshPhongMaterial({ color: 0x100a06 });
    const sailM = new THREE.MeshPhongMaterial({ color: 0x6e7882, side: THREE.DoubleSide });
    const mastM = new THREE.MeshPhongMaterial({ color: 0x221408 });
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.65, 5.0), hullM);
    hull.position.y = 0.32; g.add(hull);
    const bow = new THREE.Mesh(new THREE.ConeGeometry(0.6, 2.0, 5, 1), hullM);
    bow.rotation.z = Math.PI/2; bow.position.set(2.8, 0.32, 0); g.add(bow);
    [[-0.4,3.8,-0.3],[0.9,3.1,-0.3]].forEach(([mx,mh,mz]) => {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.09,mh,6), mastM);
      mast.position.set(mx, mh/2+0.65, mz); g.add(mast);
      const sail = new THREE.Mesh(new THREE.PlaneGeometry(1.4, mh*0.7), sailM);
      sail.position.set(mx, mh*0.55+0.65, mz); g.add(sail);
    });
    return g;
  }
  const hShips = [];
  for (let i = 0; i < 4; i++) {
    const ship = makeShip3D();
    const baseX = (Math.random()-0.5)*160;
    ship.position.set(baseX, 0, -38 - Math.random()*18);
    ship.rotation.y = Math.PI/2 + (Math.random()-0.5)*0.4;
    ship.userData = { baseX, speed: 0.8+Math.random()*0.6, dir: Math.random()>0.5?1:-1 };
    scene.add(ship); hShips.push(ship);
  }

  const ENEMY_POOL = 10, enemyPool = [];
  for (let i = 0; i < ENEMY_POOL; i++) {
    const g = _makeEnemy3D(); g.visible = false; scene.add(g); enemyPool.push(g);
  }
  const psRaycaster = new THREE.Raycaster();
  const psOceanPlane = new THREE.Plane(new THREE.Vector3(0,1,0), 0);

  const playerHullMesh = _makePlayerHull();
  playerHullMesh.rotation.y = Math.PI;
  playerHullMesh.position.set(0, 0, 19);
  scene.add(playerHullMesh);

  _psThree = { renderer, scene, camera, mat, foamMat, wakeMat, hShips,
               enemyPool, psRaycaster, psOceanPlane, playerHullMesh };
  psApplyWeather3D();
}

function renderPSOcean() {
  if (!_psThree) return;
  const t = Date.now() * 0.001;
  const rock = PS.weather ? PS.weather.rock : 0.5;
  _psThree.mat.uniforms.uTime.value = t;
  if (_psThree.foamMat) _psThree.foamMat.uniforms.uTime.value = t;
  if (_psThree.wakeMat) _psThree.wakeMat.uniforms.uTime.value = t;

  if (_psThree.playerHullMesh) {
    const ph = _psThree.playerHullMesh;
    ph.position.y = Math.sin(t*0.85) * 0.18 * (0.6 + rock);
    ph.rotation.z = Math.sin(t*0.65+0.8) * 0.022 * (0.6 + rock);
    ph.rotation.x = Math.sin(t*1.05+1.5) * 0.010 * (0.6 + rock);
  }
  for (const ship of _psThree.hShips || []) {
    const travel = (t * ship.userData.speed * ship.userData.dir) % 220;
    ship.position.x = ship.userData.baseX + travel;
    if (ship.position.x >  110) ship.position.x -= 220;
    if (ship.position.x < -110) ship.position.x += 220;
  }

  try {
    if (_psThree.enemyPool && PS.enemies && PS.player) {
      PS.enemies.forEach(e => { e._has3D = false; });
      const pool = _psThree.enemyPool, enemies = PS.enemies;
      const rc = _psThree.psRaycaster, plane = _psThree.psOceanPlane, cam = _psThree.camera;
      const LW = PS.LW, LH = PS.LH, HY = Math.round(LH * PS.HY_RATIO);
      const focalPx = 416, hullPx = 104, hullW = 4.5;

      for (let i = 0; i < pool.length; i++) {
        const mesh = pool[i];
        if (i >= enemies.length) { mesh.visible = false; continue; }
        const ent = enemies[i];
        // ボス・幽霊船は2Dで描く
        if (ent.isBoss || ent.type === 'ghost') { mesh.visible = false; continue; }
        const sx = LW/2 + (ent.worldX - PS.player.x) * ent.depth * PS_CFG.PPW;
        const sy = HY + (LH - HY) * ent.depth * 0.88;
        if (sx < -300 || sx > LW + 300) { mesh.visible = false; continue; }

        const ndcX = (sx/LW)*2 - 1, ndcY = -(sy/LH)*2 + 1;
        rc.setFromCamera(new THREE.Vector2(ndcX, ndcY), cam);
        const wp = new THREE.Vector3();
        if (!rc.ray.intersectPlane(plane, wp)) { mesh.visible = false; continue; }

        const s2D = Math.max(.06, ent.depth*1.7 + .06);
        const dist = cam.position.distanceTo(wp);
        mesh.scale.setScalar(s2D * hullPx * dist / (focalPx * hullW));
        mesh.position.set(wp.x, Math.sin(t*1.1 + i*1.8)*0.12, wp.z);
        mesh.rotation.y = Math.atan2(cam.position.x - wp.x, cam.position.z - wp.z);

        const C = { pirate:0x3a1a1a, navy:0x1a3060, merchant:0x4a6a9a, cutter:0x1a5a44, bombard:0x4a3010 };
        const S = { pirate:0x141010, navy:0xd0cdb8, merchant:0xb8aa78, cutter:0xc8d8c0, bombard:0xc0b898 };
        const F = { pirate:0x080808, navy:0x102060, merchant:0x880010, cutter:0x10a060, bombard:0x604010 };
        if (mesh._colorMat) mesh._colorMat.color.setHex(C[ent.type] ?? C.merchant);
        if (mesh._sailMat)  mesh._sailMat.color.setHex(S[ent.type]  ?? S.merchant);
        if (mesh._flagMat)  mesh._flagMat.color.setHex(F[ent.type]  ?? F.merchant);

        mesh.visible = true;
        ent._has3D = true;
      }
    }
  } catch (e) { /* 3D同期に失敗しても2Dで描画される */ }

  _psThree.renderer.render(_psThree.scene, _psThree.camera);
}

/* three.js が遅れて読み込まれた場合、プレイ中なら3D海面を組み立て直す */
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('three-ready', () => {
    if (PS.running && !_psThree) psFitCanvas(true);
  });
}

function disposePSOcean() {
  if (!_psThree) return;
  _psThree.renderer.dispose();
  const tc = document.getElementById('psThreeCanvas');
  if (tc) tc.style.display = 'none';
  _psThree = null;
}
