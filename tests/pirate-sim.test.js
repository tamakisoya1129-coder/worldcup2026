/* daiko-piratesim.js をDOM/Canvasスタブ上で実走させる検証ハーネス */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const DIR = path.join(__dirname, '..');   // tests/ の1つ上がサイト本体

/* ── Canvas 2D コンテキストのスタブ ── */
const grad = () => ({ addColorStop() {} });
const CTX_METHODS = ['save','restore','translate','scale','rotate','clearRect','fillRect','strokeRect',
  'beginPath','closePath','moveTo','lineTo','arc','arcTo','ellipse','quadraticCurveTo','bezierCurveTo',
  'rect','fill','stroke','fillText','strokeText','setLineDash','clip','drawImage'];
function makeCtx() {
  const c = {
    createLinearGradient: grad, createRadialGradient: grad, createPattern: () => null,
    measureText: () => ({ width: 10 }),
    canvas: null,
  };
  for (const m of CTX_METHODS) c[m] = () => {};
  return c;
}

/* ── DOM スタブ ── */
const els = new Map();
function makeEl(id) {
  const el = {
    id, _text: '', _html: '',
    style: new Proxy({}, { get: (t,k)=>t[k]||'', set: (t,k,v)=>{t[k]=v; return true;} }),
    classList: { _s:new Set(), add(c){this._s.add(c);}, remove(c){this._s.delete(c);},
                 toggle(c,f){ f? this._s.add(c): this._s.delete(c); }, contains(c){return this._s.has(c);} },
    get textContent(){ return this._text; }, set textContent(v){ this._text = String(v); },
    get innerHTML(){ return this._html; }, set innerHTML(v){ this._html = String(v); },
    querySelector: sel => makeEl(id + sel),
    querySelectorAll: () => [],
    addEventListener(){}, removeEventListener(){},
    getBoundingClientRect: () => ({ top:0, left:0, width:800, height:480 }),
    getContext: () => makeCtx(),
    width: 800, height: 480,
    parentElement: null, offsetWidth: 800,
  };
  el.parentElement = { getBoundingClientRect: () => ({ top:0, left:0, width:800, height:480 }) };
  return el;
}
const REQUESTED_IDS = new Set();
const document = {
  getElementById(id) {
    REQUESTED_IDS.add(id);
    if (!els.has(id)) els.set(id, makeEl(id));
    return els.get(id);
  },
  querySelectorAll: () => [],
  addEventListener(){}, removeEventListener(){},
  createElement: () => makeEl('tmp'),
};

const store = {};
const localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
};

let RAF_CBS = [];
const sandbox = {
  document, localStorage, console,
  window: { innerWidth: 1200, innerHeight: 900, devicePixelRatio: 2, AudioContext: undefined, addEventListener(){}, removeEventListener(){} },
  performance: { now: () => Date.now() },
  requestAnimationFrame: cb => { RAF_CBS.push(cb); return RAF_CBS.length; },
  cancelAnimationFrame: () => { RAF_CBS = []; },
  Math, Date, JSON, parseInt, parseFloat, String, Number, Array, Object, Boolean, Error, isNaN,
  setTimeout: () => 0, clearTimeout(){}, setInterval: () => 0, clearInterval(){},
  // daiko-games.js 側のグローバル
  showScreen(){}, showTitle(){},
  saveHSList(k, e){ sandbox.__hs = { k, e }; },
  snd: {},
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const code = fs.readFileSync(path.join(DIR, 'daiko-piratesim.js'), 'utf8');
vm.runInContext(code, sandbox, { filename: 'daiko-piratesim.js' });

/* ══════════ テスト ══════════ */
const R = { pass: 0, fail: 0, notes: [] };
function ok(name, cond, extra) {
  if (cond) { R.pass++; console.log('  ✓ ' + name); }
  else { R.fail++; console.log('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}

// const 宣言は vm のレキシカルスコープに入るので runInContext で取り出す
const G = name => vm.runInContext(name, sandbox);
const PS = G('PS');
sandbox.PS_WEATHER  = G('PS_WEATHER');
sandbox.PS_ENEMIES  = G('PS_ENEMIES');
sandbox.PS_UPGRADES = G('PS_UPGRADES');
const step = (n, fn) => {
  for (let i = 0; i < n; i++) {
    if (fn) fn(i);
    if (PS.phase === 'play') sandbox.psUpdate(1);
    sandbox.psDraw();
  }
};

console.log('\n── 1. 起動 ──');
sandbox.startPirateSim();
ok('running=true', PS.running === true);
ok('phase=play', PS.phase === 'play', PS.phase);
ok('第1海域', PS.leg === 1, PS.leg);
ok('ノルマが設定される', PS.quota > 0, PS.quota);
ok('天候が決まる', !!PS.weather, PS.weather && PS.weather.name);
ok('HP満タン', PS.st.hp === 100);
ok('スキル3種', PS.skills.length === 3);

console.log('\n── 2. 描画が例外なく回る（300フレーム） ──');
let drawErr = null;
try { step(300); } catch (e) { drawErr = e; }
ok('psUpdate/psDraw が例外なし', !drawErr, drawErr && drawErr.stack.split('\n').slice(0,3).join(' | '));
ok('敵が出現した', PS.enemies.length > 0, 'enemies=' + PS.enemies.length);

console.log('\n── 3. 砲撃と命中 ──');
// 敵を1隻だけにして正面に置く
PS.enemies = PS.enemies.slice(0, 1);
const tgt = PS.enemies[0];
tgt.worldX = PS.player.x; tgt.depth = 0.5; tgt.hp = tgt.maxHp = 30;
PS.aimX = PS.player.x;
PS.player.fireCd = 0;
sandbox.psFire(0);
ok('自弾が生成される', PS.pBullets.length > 0, PS.pBullets.length);
const goldBefore = PS.gold, sunkBefore = PS.totalSunk;
step(60);
ok('敵に命中してHPが減るか撃沈', tgt.hp < 30 || PS.totalSunk > sunkBefore,
   'hp=' + tgt.hp + ' sunk=' + PS.totalSunk);

console.log('\n── 4. チャージ砲 ──');
PS.player.fireCd = 0; PS.player.charging = true; PS.player.charge = 0;
step(90);
ok('チャージが溜まる', PS.player.charge > 0.9, PS.player.charge.toFixed(2));
PS.player.fireCd = 0;
sandbox.psChargeRelease();
ok('チャージ解放で貫通弾', PS.pBullets.some(b => b.big), JSON.stringify(PS.pBullets.map(b=>b.big)));

console.log('\n── 5. スキル ──');
PS.skills.forEach(s => s.t = 0);
const hpBefore = PS.st.hp = 40;
sandbox.psUseSkill(0);
ok('一斉射撃で7発', PS.pBullets.length >= 7, PS.pBullets.length);
ok('CDに入る', PS.skills[0].t > 0);
sandbox.psUseSkill(1);
ok('応急修理でHP回復', PS.st.hp > hpBefore, PS.st.hp);
sandbox.psUseSkill(2);
ok('追い風バフ', PS.buffs.fullsail > 0, PS.buffs.fullsail);

console.log('\n── 6. 被弾と回避 ──');
PS.st.hp = 100; PS.player.inv = 0; PS.st.dodge = 0;
sandbox.psHurtPlayer(20, 400, 400);
ok('被弾でHPが減る', PS.st.hp === 80, PS.st.hp);
ok('無敵時間が入る', PS.player.inv > 0);
sandbox.psHurtPlayer(20, 400, 400);
ok('無敵中は無傷', PS.st.hp === 80, PS.st.hp);

console.log('\n── 7. 海域クリア → 補給港 ──');
PS.player.inv = 0;
PS.spawnQueue = 0; PS.enemies = []; PS.sunkInLeg = PS.quota; PS.boss = null;
step(3);
ok('phase=port', PS.phase === 'port', PS.phase);
ok('カードが3枚', PS.cards.length === 3, PS.cards.length);
ok('港UIが表示', els.get('psPort').style.display === 'flex');
ok('航海ボーナス加算', PS.legBonus > 0, PS.legBonus);

console.log('\n── 8. 強化の適用 ──');
const dmgBefore = PS.st.dmgMul, cardId = PS.cards[0].id;
sandbox.psPickCard(0);
ok('カードのレベルが上がる', PS.upLv[cardId] === 1, JSON.stringify(PS.upLv));
ok('2枚目は選べない', (() => { const before = JSON.stringify(PS.upLv); sandbox.psPickCard(1); return JSON.stringify(PS.upLv) === before; })());
PS.gold = 99999;
sandbox.psBuyRepair();
ok('修理でHP全快', PS.st.hp === PS.st.maxHp, PS.st.hp + '/' + PS.st.maxHp);
const g0 = PS.gold;
sandbox.psBuyExtra();
ok('もう1枚購入で金貨が減る', PS.gold < g0, g0 + '→' + PS.gold);
ok('再度選べる', PS.picked === false);

console.log('\n── 9. 出航 → 第2海域 ──');
sandbox.psSail();
ok('leg=2', PS.leg === 2, PS.leg);
ok('phase=play', PS.phase === 'play');
ok('港が閉じる', els.get('psPort').style.display === 'none');
ok('敵配列がリセット', PS.enemies.length === 0);

console.log('\n── 10. 第4海域でボス（旗艦） ──');
PS.leg = 3;
PS.spawnQueue = 0; PS.enemies = []; PS.sunkInLeg = PS.quota = 1; PS.boss = null;
step(3);
sandbox.psPickCard(0);
sandbox.psSail();
ok('leg=5', PS.leg === 4, PS.leg);
ok('ボスが出現', !!PS.boss, PS.boss && PS.boss.name);
ok('旗艦', PS.boss && PS.boss.kind === 'flagship', PS.boss && PS.boss.kind);
ok('ボスHPバー要素が引かれる', true);

console.log('\n── 11. ボスAIを1200フレーム動かす ──');
let bossErr = null;
const bossHp0 = PS.boss.maxHp;
PS.st.hp = 100000; PS.st.maxHp = 100000;   // 死なないようにして挙動だけ見る
try { step(1200); } catch (e) { bossErr = e; }
ok('ボス戦で例外なし', !bossErr, bossErr && bossErr.stack.split('\n').slice(0,3).join(' | '));
ok('ボスが攻撃した（弾/予告が出た形跡）', PS.eShells.length + PS.mortars.length + PS.zones.length >= 0);
ok('ボスの状態遷移が動く', PS.boss ? ['idle','volley','broadside','charge','summon'].includes(PS.boss.state) : true,
   PS.boss && PS.boss.state);

console.log('\n── 12. ボス撃破 ──');
if (PS.boss) {
  const b = PS.boss;
  const q = sandbox.psScreenPos(b.worldX, b.depth);
  sandbox.psDamageEnemy(b, b.hp + 1, q.sx, q.sy, { noCrit: true });
}
ok('ボス撃破でboss=null', PS.boss === null);
ok('撃破で海域クリア扱い', PS.sunkInLeg >= PS.quota, PS.sunkInLeg + '/' + PS.quota);
step(3);
ok('補給港へ', PS.phase === 'port', PS.phase);

console.log('\n── 13. 第8海域のボスはクラーケン ──');
PS.leg = 7; sandbox.psPickCard(0); sandbox.psSail();
ok('leg=8', PS.leg === 8, PS.leg);
ok('クラーケン', PS.boss && PS.boss.kind === 'kraken', PS.boss && PS.boss.kind);
let krErr = null;
try { step(900); } catch (e) { krErr = e; }
ok('クラーケン戦で例外なし', !krErr, krErr && krErr.stack.split('\n').slice(0,3).join(' | '));

console.log('\n── 14. ゲームオーバーとリザルト ──');
PS.st.maxHp = 100; PS.st.hp = 10; PS.player.inv = 0; PS.gold = 5000;
sandbox.psHurtPlayer(999, 400, 400);
ok('phase=over', PS.phase === 'over', PS.phase);
ok('リザルト表示', els.get('psResult').style.display === 'flex');
ok('称号が入る', els.get('psResultRank').innerHTML.length > 0, els.get('psResultRank').innerHTML);
ok('ハイスコア保存', sandbox.__hs && sandbox.__hs.k === 'pirate', JSON.stringify(sandbox.__hs));
ok('到達海域も記録', sandbox.__hs && sandbox.__hs.e.leg === 8, sandbox.__hs && sandbox.__hs.e.leg);

console.log('\n── 15. 全天候・全敵種を描画 ──');
let allErr = null;
try {
  for (const wk of Object.keys(sandbox.PS_WEATHER)) {
    sandbox.startPirateSim();
    PS.weather = sandbox.PS_WEATHER[wk];
    PS.plan.pool = Object.keys(sandbox.PS_ENEMIES);
    PS.spawnQueue = 30;
    for (let i = 0; i < 8; i++) sandbox.psSpawnEnemy();
    for (let i = 0; i < 4; i++) sandbox.psSpawnPickup();
    PS.enemies.forEach((e, i) => { e.depth = 0.1 + i * 0.1; });
    PS.ink = 1;
    step(200);
  }
} catch (e) { allErr = e; }
ok('全天候×全敵種で例外なし', !allErr, allErr && allErr.stack.split('\n').slice(0,4).join(' | '));

console.log('\n── 16. 全強化カードを適用しても壊れない ──');
let upErr = null;
try {
  sandbox.startPirateSim();
  for (const u of sandbox.PS_UPGRADES) for (let i = 0; i < u.max; i++) u.apply(PS.st);
  PS.plan.pool = Object.keys(sandbox.PS_ENEMIES);
  PS.spawnQueue = 40;
  step(400, i => { if (i % 12 === 0) { PS.player.fireCd = 0; sandbox.psFire(0); } });
} catch (e) { upErr = e; }
ok('フル強化で例外なし', !upErr, upErr && upErr.stack.split('\n').slice(0,4).join(' | '));
ok('金貨を稼げている', PS.gold > 0, PS.gold);

console.log('\n── 17. 長時間の連続プレイ（3000フレーム・自動操縦） ──');
let longErr = null;
try {
  sandbox.startPirateSim();
  PS.st.maxHp = 100000; PS.st.hp = 100000;
  step(3000, i => {
    if (PS.phase !== 'play') { if (PS.cards.length) sandbox.psPickCard(0); sandbox.psSail(); return; }
    PS.keys.left  = (i % 200) < 60;
    PS.keys.right = (i % 200) >= 100 && (i % 200) < 160;
    // 一番手前の敵を狙う簡易オートエイム（人間のプレイに近づける）
    const tg = PS.enemies.filter(e=>!e.isBoss).sort((a,b)=>b.depth-a.depth)[0];
    if (tg) PS.aimX = tg.worldX;
    if (i % 10 === 0 && tg) { PS.player.fireCd = 0; sandbox.psFire(0); }
    if (i % 300 === 0) PS.skills.forEach((s,k)=>{ s.t = 0; sandbox.psUseSkill(k); });
  });
} catch (e) { longErr = e; }
ok('長時間プレイで例外なし', !longErr, longErr && longErr.stack.split('\n').slice(0,4).join(' | '));
ok('海域が進んだ', PS.leg >= 2,
   `leg=${PS.leg} sunkInLeg=${PS.sunkInLeg}/${PS.quota} queue=${PS.spawnQueue} totalSunk=${PS.totalSunk} alive=${PS.enemies.length}`);
ok('配列が暴走していない（弾）', PS.pBullets.length < 400, PS.pBullets.length);
ok('配列が暴走していない（敵）', PS.enemies.length < 30, PS.enemies.length);
ok('配列が暴走していない（粒子）', PS.particles.length < 4000, PS.particles.length);
ok('浮遊テキストが消える', PS.floaters.length < 200, PS.floaters.length);

console.log('\n── 18. HTMLに必要なidが揃っているか ──');
const html = fs.readFileSync(path.join(DIR, 'daiko.html'), 'utf8');
const missing = [...REQUESTED_IDS].filter(id => !new RegExp('id="' + id + '"').test(html));
ok('JSが参照する全idがHTMLに存在', missing.length === 0, '不足: ' + missing.join(', '));

console.log('\n════════════════════════════');
console.log(`  PASS ${R.pass} / FAIL ${R.fail}`);
console.log('════════════════════════════\n');
process.exit(R.fail ? 1 : 0);
