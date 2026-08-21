// サイトの導線が壊れていないかを静的に検証する。
//
// 2026-08-21、方針転換（W杯情報サイト → 大航海ゲーム集）に合わせて入口を
// index.html → daiko.html へ切り替えた。このとき daiko.html の戻るボタンが
// index.html を指したままだと index → daiko → index のリダイレクト無限ループになる。
// ブラウザ検証がサンドボックスで使えないぶん、この種の事故はここで止める。

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

let fail = 0;
const ok = (msg) => console.log(`  ✓ ${msg}`);
const ng = (msg) => { console.log(`  ★ ${msg}`); fail = 1; };
const check = (cond, good, bad) => (cond ? ok(good) : ng(bad));

const index = read('index.html');
const daiko = read('daiko.html');

// 1. 入口はゲーム集本体を指しているか
check(/url=daiko\.html/.test(index) && /location\.replace\(['"]daiko\.html['"]\)/.test(index),
  'index.html は daiko.html を指している',
  'index.html の転送先が daiko.html でない（meta refresh と location.replace の両方が必要）');

// 2. 戻るボタンが index.html を指していないか（無限ループ防止）
const backBtn = daiko.match(/<a[^>]*class="back-btn"[^>]*>/);
if (!backBtn) {
  ng('daiko.html に back-btn が見つからない');
} else {
  const href = (backBtn[0].match(/href="([^"]+)"/) || [])[1];
  check(href && href !== 'index.html',
    `daiko.html の戻る先は ${href}（index.html ではない）`,
    'daiko.html の戻るボタンが index.html を指している＝リダイレクト無限ループになる');
}

// 3. ローカルリンクの先が実在するか
const links = new Set();
for (const src of [index, daiko]) {
  for (const m of src.matchAll(/(?:href=|url=)"?([^"'\s>]+\.html)/g)) {
    const target = decodeURIComponent(m[1]);
    if (!/^https?:/.test(target)) links.add(target);
  }
}
for (const target of links) {
  check(fs.existsSync(path.join(root, target)),
    `リンク先が実在: ${target}`,
    `リンク先が存在しない: ${target}`);
}

// 4. アーカイブ（W杯サイト）からゲーム集へ戻れるか
const wc = read('ワールドカップサイト.html');
check(/daiko\.html/.test(wc),
  'ワールドカップサイト.html からゲーム集へ戻れる',
  'ワールドカップサイト.html にゲーム集への導線がない＝アーカイブから抜け出せない');

process.exit(fail);
