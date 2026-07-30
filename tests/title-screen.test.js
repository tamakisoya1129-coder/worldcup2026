/* daiko-games.js を読み込み、ページ読み込み時と同じ showTitle() が通るか確かめる */
const fs = require('fs'), vm = require('vm'), path = require('path');
const DIR = path.join(__dirname, '..');   // tests/ の1つ上がサイト本体
const html = fs.readFileSync(path.join(DIR, 'daiko.html'), 'utf8');

const grad = () => ({ addColorStop() {} });
const M = ['save','restore','translate','scale','rotate','clearRect','fillRect','strokeRect','beginPath',
  'closePath','moveTo','lineTo','arc','arcTo','ellipse','quadraticCurveTo','bezierCurveTo','rect','fill',
  'stroke','fillText','strokeText','setLineDash','clip','drawImage'];
const mkCtx = () => { const c={createLinearGradient:grad,createRadialGradient:grad,measureText:()=>({width:10})};
  M.forEach(m=>c[m]=()=>{}); return c; };

const els = new Map();
const mkEl = id => {
  const e = { id, textContent:'', innerHTML:'', value:'', className:'',
    style:{}, classList:{add(){},remove(){},toggle(){},contains:()=>false},
    querySelector:()=>mkEl('q'), querySelectorAll:()=>[],
    addEventListener(){}, removeEventListener(){}, appendChild(){}, remove(){},
    getContext:()=>mkCtx(), getBoundingClientRect:()=>({top:0,left:0,width:800,height:480}),
    width:800, height:480, offsetWidth:800 };
  e.parentElement = { getBoundingClientRect:()=>({top:0,left:0,width:800,height:480}), appendChild(){} };
  return e;
};

// HTML に実在する id だけ返し、無い id は null（＝本番と同じ挙動）にする
const realIds = new Set([...html.matchAll(/id="([\w-]+)"/g)].map(m => m[1]));
const missingRefs = new Set();

const document = {
  getElementById(id) {
    if (!realIds.has(id)) { missingRefs.add(id); return null; }
    if (!els.has(id)) els.set(id, mkEl(id));
    return els.get(id);
  },
  querySelectorAll(sel) {
    if (sel.includes('game-card')) return new Array(
      (html.match(/<div class="game-card"/g) || []).length).fill(0).map(()=>mkEl('card'));
    return [];
  },
  querySelector: () => mkEl('q'),
  createElement: () => mkEl('new'),
  addEventListener(){}, removeEventListener(){},
  body: { appendChild(){} },
};

const store = {};
const sb = {
  document, console,
  localStorage:{ getItem:k=>k in store?store[k]:null, setItem:(k,v)=>{store[k]=String(v);},
                 removeItem:k=>{delete store[k];} },
  window:{ innerWidth:1200, devicePixelRatio:2, addEventListener(){}, removeEventListener(){},
           AudioContext:undefined },
  performance:{now:()=>Date.now()},
  requestAnimationFrame:()=>1, cancelAnimationFrame(){},
  setTimeout:()=>0, clearTimeout(){}, setInterval:()=>0, clearInterval(){},
  Math,Date,JSON,parseInt,parseFloat,String,Number,Array,Object,Boolean,Error,isNaN,fetch:()=>Promise.resolve(),
};
sb.globalThis = sb;
vm.createContext(sb);

let err = null;
try {
  vm.runInContext(fs.readFileSync(path.join(DIR,'daiko-games.js'),'utf8'), sb, {filename:'daiko-games.js'});
  vm.runInContext(fs.readFileSync(path.join(DIR,'daiko-piratesim.js'),'utf8'), sb, {filename:'daiko-piratesim.js'});
} catch (e) { err = e; }

let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? (pass++, console.log('  ✓ '+n)) : (fail++, console.log('  ✗ '+n+(x?'  → '+x:''))); };

console.log('\n── ページ読み込み相当（daiko-games.js → daiko-piratesim.js） ──');
ok('読み込み時に例外が出ない', !err, err && (err.message + ' @ ' + (err.stack||'').split('\n')[1]));
ok('存在しないidを参照していない', missingRefs.size === 0, [...missingRefs].join(', '));

console.log('\n── タイトル画面のカード用ハンドラ ──');
for (const fn of ['startGame','startCannon','showDiffPicker','startVoyage','startPirateSim','showTitle']) {
  ok(`${fn} が定義されている`, typeof sb[fn] === 'function', typeof sb[fn]);
}

console.log('\n── showTitle() の実行 ──');
let terr = null;
try { sb.showTitle(); } catch (e) { terr = e; }
ok('showTitle() が例外なく通る', !terr, terr && terr.message);
const sub = els.get('titleSub');
ok('サブタイトルがカード枚数を反映', sub && sub.textContent === '5 GAMES AVAILABLE — SELECT YOUR QUEST',
   sub && JSON.stringify(sub.textContent));
const pb = els.get('pirateBest');
ok('記録なしのときは「記録: -」', pb && pb.textContent === '記録: -', pb && pb.textContent);

console.log('\n── 記録がある状態で再表示 ──');
store.psGoldBest = '15400'; store.psGoldBestLeg = '9';
store.daiko_pirate_hs = JSON.stringify([{score:15400,sunk:73,leg:9,date:'2026/7/30'}]);
let t2 = null;
try { sb.showTitle(); } catch (e) { t2 = e; }
ok('記録ありでも例外なし', !t2, t2 && t2.message);
ok('金貨と到達海域が対で出る', els.get('pirateBest').textContent === '記録: 15400G（第9海域）',
   els.get('pirateBest').textContent);
ok('ハイスコア欄に第N海域が入る', /第9海域/.test(els.get('hsListPirate').innerHTML),
   els.get('hsListPirate').innerHTML.slice(0,120));

console.log(`\n  PASS ${pass} / FAIL ${fail}\n`);
process.exit(fail ? 1 : 0);
