/* 難易度カーブの試算：オートエイムのボットを何度も走らせて到達海域を見る */
const fs = require('fs'), vm = require('vm'), path = require('path');
const DIR = path.join(__dirname, '..');   // tests/ の1つ上がサイト本体

const grad = () => ({ addColorStop() {} });
const M = ['save','restore','translate','scale','rotate','clearRect','fillRect','strokeRect','beginPath',
  'closePath','moveTo','lineTo','arc','arcTo','ellipse','quadraticCurveTo','bezierCurveTo','rect','fill',
  'stroke','fillText','strokeText','setLineDash','clip','drawImage'];
const mkCtx = () => { const c={createLinearGradient:grad,createRadialGradient:grad,measureText:()=>({width:10})};
  M.forEach(m=>c[m]=()=>{}); return c; };
const mkEl = () => { const e={ style:{}, classList:{add(){},remove(){},toggle(){},contains(){return false}},
  textContent:'', innerHTML:'', querySelector:()=>mkEl(), querySelectorAll:()=>[],
  addEventListener(){}, removeEventListener(){}, getContext:()=>mkCtx(),
  getBoundingClientRect:()=>({top:0,left:0,width:800,height:480}), width:800, height:480 };
  e.parentElement={getBoundingClientRect:()=>({top:0,left:0,width:800,height:480})}; return e; };

function newGame() {
  const store = {};
  const sb = {
    document:{ getElementById:()=>mkEl(), querySelectorAll:()=>[], addEventListener(){}, removeEventListener(){} },
    localStorage:{ getItem:k=>store[k]??null, setItem:(k,v)=>{store[k]=String(v);} },
    console, window:{innerWidth:1200,devicePixelRatio:2},
    performance:{now:()=>Date.now()},
    requestAnimationFrame:()=>1, cancelAnimationFrame(){},
    Math,Date,JSON,parseInt,parseFloat,String,Number,Array,Object,Boolean,Error,isNaN,
    setTimeout:()=>0, clearTimeout(){}, setInterval:()=>0, clearInterval(){},
    showScreen(){}, showTitle(){}, saveHSList(){}, snd:{},
  };
  sb.globalThis = sb;
  vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(DIR,'daiko-piratesim.js'),'utf8'), sb);
  return sb;
}

/* ボットの腕前 skill: 0(下手)〜1(上手) */
function run(skill) {
  const sb = newGame();
  const PS = vm.runInContext('PS', sb);
  const UP = vm.runInContext('PS_UPGRADES', sb);
  sb.startPirateSim();

  const MAXF = 60 * 60 * 25;   // 25分ぶん
  for (let f = 0; f < MAXF; f++) {
    if (PS.phase === 'over') break;
    if (PS.phase === 'port') {
      // それっぽいビルド優先度で1枚選ぶ
      const pri = ['dmg','guns','rate','crit','hull','pierce','armor','burn','gold','sail'];
      let idx = PS.cards.findIndex(c => pri.includes(c.id));
      sb.psPickCard(idx < 0 ? 0 : idx);
      if (PS.gold >= PS.repairCost && PS.st.hp < PS.st.maxHp * 0.8) sb.psBuyRepair();
      sb.psSail();
      continue;
    }
    const p = PS.player, st = PS.st;
    const threats = [...PS.eShells, ...PS.mortars.map(m=>({worldX:m.worldX,depth:.95})),
                     ...PS.zones.filter(z=>!z.done).map(z=>({worldX:z.worldX,depth:.95}))];
    // 迫っている脅威から逃げる
    const near = threats.filter(t => t.depth > 0.5 && Math.abs(t.worldX - p.x) < 130)
                        .sort((a,b)=>b.depth-a.depth)[0];
    const inc = PS.enemies.filter(e=>!e.isBoss && e.depth>0.8 && Math.abs(e.worldX-p.x)<130)
                          .sort((a,b)=>b.depth-a.depth)[0];
    const flee = near || inc;
    PS.keys.left = PS.keys.right = false;
    if (flee && Math.random() < 0.55 + skill*0.45) {
      if (flee.worldX > p.x) PS.keys.left = true; else PS.keys.right = true;
    } else {
      // 漂流物を拾いに行く
      const pick = PS.pickups.filter(c=>c.depth>0.55).sort((a,b)=>b.depth-a.depth)[0];
      if (pick) { if (pick.worldX > p.x) PS.keys.right = true; else PS.keys.left = true; }
    }
    // 照準（腕前に応じてブレる）
    const tg = PS.enemies.sort((a,b)=>b.depth-a.depth)[0];
    if (tg) {
      const err = (1 - skill) * 46;
      PS.aimX = tg.worldX + (Math.random()*2-1) * err;
      if (p.fireCd <= 0) sb.psFire(0);
    }
    PS.skills.forEach((s,k)=>{
      if (s.t > 0) return;
      if (k===1 && st.hp > st.maxHp*0.55) return;
      if (k===0 && PS.enemies.length < 2) return;
      sb.psUseSkill(k);
    });
    sb.psUpdate(1);
  }
  return { leg: PS.leg, gold: PS.gold, sunk: PS.totalSunk, alive: PS.phase !== 'over',
           mins: (PS.elapsed/60).toFixed(1) };
}

for (const [label, skill] of [['初心者', 0.25], ['そこそこ', 0.6], ['上手い', 0.9]]) {
  const rs = [];
  for (let i = 0; i < 7; i++) rs.push(run(skill));
  const avg = k => (rs.reduce((s,r)=>s+ +r[k],0)/rs.length).toFixed(1);
  console.log(`${label.padEnd(5)}  到達海域 平均${avg('leg')}  (${rs.map(r=>r.leg).join(',')})  ` +
              `金貨平均${avg('gold')}  撃沈平均${avg('sunk')}  プレイ時間平均${avg('mins')}分` +
              `  時間切れ生存:${rs.filter(r=>r.alive).length}/7`);
}
