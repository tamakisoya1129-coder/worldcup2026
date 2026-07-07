/* ══════════════════════════════════════════════════
   WEB AUDIO — synthesized sound effects (no files)
══════════════════════════════════════════════════ */
const snd = (() => {
  let _ctx = null;
  const ctx = () => {
    if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (_ctx.state === 'suspended') _ctx.resume();
    return _ctx;
  };
  const osc = (freq, type, gainVal, dur, freqEnd) => {
    const ac = ctx(), t = ac.currentTime;
    const o = ac.createOscillator(), g = ac.createGain();
    o.connect(g); g.connect(ac.destination);
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    g.gain.setValueAtTime(gainVal, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur);
  };
  const noise = (gainVal, dur, cutoff = 2200) => {
    const ac = ctx(), t = ac.currentTime;
    const bufLen = Math.ceil(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, bufLen, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    const flt = ac.createBiquadFilter();
    const g   = ac.createGain();
    flt.type = 'lowpass'; flt.frequency.value = cutoff;
    src.buffer = buf; src.connect(flt); flt.connect(g); g.connect(ac.destination);
    g.gain.setValueAtTime(gainVal, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.start(t); src.stop(t + dur);
  };
  return {
    cannon()  { osc(75, 'sine', 0.5, 0.38, 18); noise(0.6, 0.18, 600); },
    explode() { osc(55, 'sine', 0.6, 0.55, 12); noise(0.9, 0.30, 450); osc(110,'sawtooth',0.2,0.2,30); },
    hit()     { osc(380,'square',0.18,0.10,200); noise(0.25,0.08,3000); },
    coin()    { osc(880,'sine',0.22,0.16); osc(1108,'sine',0.14,0.12); },
    correct() { [523,659,784].forEach((f,i) => setTimeout(()=>osc(f,'sine',0.20,0.14), i*90)); },
    wrong()   { osc(220,'sawtooth',0.25,0.22,130); },
    click()   { osc(1200,'sine',0.08,0.07); },
  };
})();

/* ══════════════════════════════════════════════════
   COUNTRY POOL  (24 — 15 randomly selected per run)
══════════════════════════════════════════════════ */
const GOLD_TABLE = [50, 30, 20];

const ALL_COUNTRIES = [
  { name:'ブラジル', flag:'🇧🇷',
    hints:['この島の民は「蹴球」に並外れた情熱を持ち、世界最強の称号を5度手にした。',
           '地球の「肺」と呼ばれる世界最大の熱帯雨林を持ち、世界最長級の川が流れる。',
           '世界最大のカーニバルが毎年開かれ、コーヒーの生産量は世界トップを誇る。'],
    choices:['ブラジル','アルゼンチン','コロンビア','チリ'] },

  { name:'エジプト', flag:'🇪🇬',
    hints:['この島には4500年前に建てられた巨大な石造建造物が今も砂漠に立ち続けている。',
           '世界最長の川が南から北へと流れ、古代文明の揺りかごとなった国だ。',
           'ファラオと呼ばれる神聖な王が支配した、人類史上最も偉大な帝国の地。'],
    choices:['エジプト','モロッコ','エチオピア','リビア'] },

  { name:'日本', flag:'🇯🇵',
    hints:['この島国には「武士」と呼ばれる刀を持つ戦士の文化が長く栄えた。',
           '春になると淡いピンクの花が島全体を覆い、人々は宴を開いて祝う。',
           '4000を超える島からなる弧状の列島で、世界一長生きの民が暮らす。'],
    choices:['日本','韓国','フィリピン','台湾'] },

  { name:'フランス', flag:'🇫🇷',
    hints:['この島の首都には鉄でできた巨大な塔がそびえ、世界中の旅人が集まる。',
           'ワインと芸術の国として名高く、世界で最も多くの旅人を受け入れている。',
           '「自由・平等・博愛」を掲げた大革命が、近代民主主義の礎となった。'],
    choices:['フランス','イタリア','スペイン','ベルギー'] },

  { name:'オーストラリア', flag:'🇦🇺',
    hints:['この大陸島には、お腹の袋で子を育てる不思議な生き物が棲んでいる。',
           '世界最大のサンゴ礁が海岸線に広がり、数千種の海の生き物が暮らす。',
           '南半球最大の国で、かつてイギリスの流刑植民地として開拓された地。'],
    choices:['オーストラリア','ニュージーランド','南アフリカ','パプアニューギニア'] },

  { name:'メキシコ', flag:'🇲🇽',
    hints:['この島の先住民族が、チョコレートを世界で初めて飲み物として用いた。',
           'マヤ・アステカという古代文明が栄えた地で、巨大な段々のピラミッドが残る。',
           'テキーラの原産地で、色鮮やかな大きな帽子「ソンブレロ」でも知られる国。'],
    choices:['メキシコ','ペルー','グアテマラ','コロンビア'] },

  { name:'ノルウェー', flag:'🇳🇴',
    hints:['この島では冬の夜空が突然、緑や紫の光の幕に包まれる神秘的な現象が起きる。',
           '鋭く切り込んだ海岸地形「フィヨルド」で有名で、バイキングの末裔が暮らす地。',
           '石油産出大国でありながら、世界幸福度ランキングで常に最上位に入る国。'],
    choices:['ノルウェー','スウェーデン','アイスランド','フィンランド'] },

  { name:'インド', flag:'🇮🇳',
    hints:['この島は14億以上の民が暮らし、ついに世界一の人口を持つ大国となった。',
           '亡き妻への愛を永遠に刻むために、皇帝が22年かけて建てた白い廟がある。',
           'カレーの本場であり、「ゼロ」という数字の概念を人類に伝えた文明の地。'],
    choices:['インド','パキスタン','バングラデシュ','スリランカ'] },

  { name:'アイスランド', flag:'🇮🇸',
    hints:['この島は「火」と「氷」が同居する矛盾の地で、活火山と巨大氷河が共存する。',
           '人口34万人の小国でありながら、サッカーの欧州大会でベスト8に進出し世界を驚かせた。',
           '地熱エネルギーで電力のほぼ全てをまかなう環境先進国で、北欧の孤島にある。'],
    choices:['アイスランド','ノルウェー','フィンランド','グリーンランド'] },

  { name:'ペルー', flag:'🇵🇪',
    hints:['この島の山中には雲に覆われた幻の都市が眠り、インカ帝国最大の遺産とされる。',
           'ジャガイモの原産地であり、3000種以上の品種が今も山の農地で育てられている。',
           'アンデス山脈・アマゾン熱帯雨林・太平洋沿岸という三つの地形を持つ国。'],
    choices:['ペルー','ボリビア','エクアドル','コロンビア'] },

  { name:'ケニア', flag:'🇰🇪',
    hints:['この島の草原ではライオン・象・キリンが群れをなし、毎年大規模な移動が見られる。',
           'マラソンで圧倒的な強さを誇り、オリンピックで繰り返し金メダルを獲得し続けている。',
           'マサイ族という伝統的な戦士の民が今も赤いマントをまとい大地に暮らしている。'],
    choices:['ケニア','タンザニア','エチオピア','ウガンダ'] },

  { name:'スイス', flag:'🇨🇭',
    hints:['この島は何百年もの間、あらゆる戦争に参加せず「永遠の中立」を保ち続けている。',
           '世界一精巧な時計を生み出す職人の国で、チョコレートも最高品質として名高い。',
           'アルプス山脈に囲まれ、4カ国語が公用語として使われる多言語の小国だ。'],
    choices:['スイス','オーストリア','ルクセンブルク','リヒテンシュタイン'] },

  { name:'タイ', flag:'🇹🇭',
    hints:['この島では象が神聖な生き物として崇められ、かつては王の乗り物として使われた。',
           '黄金に輝く仏塔が各地にそびえ、「微笑みの国」という異名を持つ仏教王国だ。',
           'ムエタイという独自の格闘技を生み出し、その蹴り技は世界中の武道家が習いに来る。'],
    choices:['タイ','ミャンマー','カンボジア','ラオス'] },

  { name:'アルゼンチン', flag:'🇦🇷',
    hints:['この島はタンゴという情熱的な踊りを世界に広めた、音楽と舞の国だ。',
           '世界最広の草原「パンパ」が広がり、牛肉の産地として世界に名をとどろかせる。',
           '史上最偉大なサッカー選手の一人がこの地に生まれ、サッカー王国の象徴となった。'],
    choices:['アルゼンチン','ウルグアイ','チリ','ブラジル'] },

  { name:'ジャマイカ', flag:'🇯🇲',
    hints:['この島から「レゲエ」という音楽が生まれ、平和と愛のメッセージが世界に広まった。',
           '短距離走で世界最速の走者を何人も輩出し、100m走の世界記録を長年保持した国だ。',
           'コーヒーの最高峰「ブルーマウンテン」の産地であり、カリブ海の楽園として名高い。'],
    choices:['ジャマイカ','キューバ','ハイチ','トリニダード・トバゴ'] },

  { name:'ポルトガル', flag:'🇵🇹',
    hints:['この島から15世紀、勇敢な船乗りたちが世界の果てへと航海し、大航海時代を切り開いた。',
           'バカリャウという干し鱈を365通りの方法で調理するほど、海との結びつきが深い国だ。',
           'ファドという哀愁帯びた音楽と、世界中に広まったワイン「ポート」の故郷だ。'],
    choices:['ポルトガル','スペイン','イタリア','ギリシャ'] },

  { name:'ニュージーランド', flag:'🇳🇿',
    hints:['この島の先住民族はラグビーの試合前に、恐ろしい表情で舌を出し体を叩く古来の踊りを披露する。',
           '翼を持たない飛べない小鳥が生息し、その名が国の通称にもなっている島国だ。',
           '映画「ロード・オブ・ザ・リング」の撮影地として有名で、南太平洋に浮かぶ楽園。'],
    choices:['ニュージーランド','オーストラリア','パプアニューギニア','フィジー'] },

  { name:'モロッコ', flag:'🇲🇦',
    hints:['この島はアフリカとヨーロッパを隔てる海峡のほとりにあり、サハラ砂漠とアトラス山脈を持つ。',
           'ミントティーを3杯飲む慣習があり、青く塗られた幻想的な山岳都市が有名だ。',
           '2022年のサッカー大会で、アフリカの国として初めて4強に進出し世界を驚かせた。'],
    choices:['モロッコ','チュニジア','アルジェリア','エジプト'] },

  { name:'フィンランド', flag:'🇫🇮',
    hints:['この島の北部には、世界中の子供が夢見るヒゲの老人の故郷があると言われている。',
           '人口当たりのサウナの数が世界最多で、数千年の歴史を持つ蒸気浴文化が根付いている。',
           '教育水準が世界最高レベルで、宿題がほとんどなくとも学力が高い「教育の奇跡」の国。'],
    choices:['フィンランド','スウェーデン','ノルウェー','エストニア'] },

  { name:'ギリシャ', flag:'🇬🇷',
    hints:['この島で2500年前に「オリンピック」という競技会が誕生し、その伝統が今日まで続いている。',
           '白い壁と青い丸天井が美しい島々を持ち、西洋文明の揺りかごとして名高い。',
           'ソクラテス・プラトン・アリストテレスという哲学者を生んだ「知の父」の国だ。'],
    choices:['ギリシャ','イタリア','キプロス','トルコ'] },

  { name:'エチオピア', flag:'🇪🇹',
    hints:['この島は植民地支配を受けなかったアフリカで数少ない国のひとつで、独立の象徴とされる。',
           'コーヒーの原産地とされ、「コーヒーセレモニー」という儀式が今も日常生活に根付いている。',
           '3000年以上の歴史を持つ文明国で、アフリカ最古の王朝が栄えた地。長距離走でも世界を制する。'],
    choices:['エチオピア','ケニア','ソマリア','エリトリア'] },

  { name:'トルコ', flag:'🇹🇷',
    hints:['この島はヨーロッパとアジアにまたがる唯一の国で、二つの大陸を橋でつないでいる。',
           '世界中で人気のアイスクリームが「伸びる」という不思議な食感で有名な国だ。',
           '世界最古の都市のひとつが存在し、かつてオスマン帝国として大陸を支配した偉大な国。'],
    choices:['トルコ','ギリシャ','イラン','シリア'] },

  { name:'コロンビア', flag:'🇨🇴',
    hints:['この島はコーヒーの産地として名高く、山の農夫が収穫する「マイルドコーヒー」は世界最高とされる。',
           '南米で唯一、太平洋と大西洋の両方の沿岸を持つ国だ。',
           'エメラルドの産出量が世界の大半を占め、「緑の黄金」を持つ国として宝石商人に知られる。'],
    choices:['コロンビア','ペルー','エクアドル','ベネズエラ'] },

  { name:'クロアチア', flag:'🇭🇷',
    hints:['この島の沿岸は1000以上の小島が点在し、「アドリア海の真珠」と呼ばれる美しい古都がある。',
           '「ネクタイ」の起源とされる国で、17世紀の兵士が着用したスカーフが世界に広まった。',
           'ドラマ「ゲーム・オブ・スローンズ」のロケ地として世界的に有名になった石畳の国。'],
    choices:['クロアチア','スロベニア','モンテネグロ','ボスニア'] },
];

const SAIL_LINES = [
  ['嵐の海を切り裂いて——', '次の謎の島が見えてきた'],
  ['星ひとつない暗黒の海——', '羅針盤だけを頼りに進む'],
  ['謎の霧が船を包む——', '霧の向こうに影が浮かんだ'],
  ['荒波を乗り越え——', '新たな大地の輪郭が現れた'],
  ['月明かりだけを灯台に——', '島の灯りが近づいてくる'],
  ['海底の唸りが響く——', '未知の島が姿を現した'],
  ['南十字星を背に——', '地図にない島へと舵を切る'],
];

const ACHIEVEMENTS = [
  { id:'perfect',    icon:'🎯', name:'完璧な航海',    desc:'15島すべて正解した！',          check: G => G.correct === 15 },
  { id:'nodamage',   icon:'🛡️', name:'不沈の海賊',    desc:'一度もハートを失わなかった！',  check: G => G.hp === 5 },
  { id:'rich',       icon:'💰', name:'黄金の航路',    desc:'600G以上を獲得した！',          check: G => G.gold >= 600 },
  { id:'combo5',     icon:'🔥', name:'無双の解読者',  desc:'5連続正解を達成した！',         check: G => G.maxCombo >= 5 },
  { id:'speed',      icon:'⚡', name:'超速の頭脳',    desc:'ヒント1だけで10島を正解した！', check: G => G.firstHint >= 10 },
  { id:'nopowerup',  icon:'🏆', name:'道具無用',      desc:'パワーアップを一切使わなかった！', check: G => G.powerupsUsed === 0 },
];

/* ═══ ANTHROPIC API ═══ */
function getApiKey() { return localStorage.getItem('claude_api_key') || ''; }

function closeQuizApiPrompt() {
  document.getElementById('quizApiPrompt').style.display = 'none';
}

function confirmApiKeyAndStart() {
  const val = document.getElementById('apiKeyInput').value.trim();
  const status = document.getElementById('apiStatus');
  if (!val) { status.textContent = 'キーを入力してください'; status.className = 'api-status error'; return; }
  if (!val.startsWith('sk-ant')) {
    status.textContent = '⚠️ キーは sk-ant で始まる形式です';
    status.className = 'api-status error'; return;
  }
  localStorage.setItem('claude_api_key', val);
  closeQuizApiPrompt();
  _doStartGame();
}

async function generateAIQuestion(usedNames) {
  const key = getApiKey();
  if (!key || key.startsWith('(')) return null;
  try {
    const excluded = usedNames.length ? `除外済み: ${usedNames.join('、')}` : '';
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-allow-browser': 'true',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 550,
        messages: [{ role: 'user', content:
`ワールドカップ2026の参加候補国・注目国から1か国を選び、地理クイズ問題を作ってください。${excluded}

以下のJSON形式のみを返してください（他のテキスト不要）:
{
  "name": "国名（日本語）",
  "flag": "国旗絵文字",
  "hints": [
    "ヒント1（難しい：地名・歴史・文化の細かい事実）",
    "ヒント2（中程度：有名な地理・食文化・経済）",
    "ヒント3（簡単：誰でも知る有名なもの）"
  ],
  "choices": ["正解の国名", "間違い1", "間違い2", "間違い3"]
}

条件：ヒントは海賊風に「この島は〜」で始める。choicesの最初が正解。間違いは同じ地域の国にする。`
        }]
      })
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const text = data.content?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const q = JSON.parse(match[0]);
    if (!q.name || !q.hints || q.hints.length < 3 || !q.choices || q.choices.length < 4) return null;
    return q;
  } catch (e) {
    return null;
  }
}

/* ═══ STATE ═══ */
let G = {};

function newState() {
  return {
    deck: [], cur: 0, hp: 5, gold: 0,
    hints: 1, answered: false,
    correct: 0, combo: 0, maxCombo: 0,
    firstHint: 0, powerupsUsed: 0,
    powerups: { gem: 1, bolt: 1, heart: 1 },
    aiQuestions: [],
    aiUsedNames: [],
    aiPending: null,
  };
}

/* ═══ UTILS ═══ */
function shuffle(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
  const g = document.getElementById('glitchOverlay');
  g.classList.remove('glit');
  void g.offsetWidth;
  g.classList.add('glit');
  setTimeout(() => g.classList.remove('glit'), 320);
}

/* ═══ HIGH SCORES ═══ */
function getHS() { return JSON.parse(localStorage.getItem('daikoHS2') || '[]'); }
function saveHS(score, correct) {
  const hs = getHS();
  hs.push({ score, correct, date: new Date().toLocaleDateString('ja-JP') });
  hs.sort((a, b) => b.score - a.score);
  localStorage.setItem('daikoHS2', JSON.stringify(hs.slice(0, 3)));
}
function renderHS() {
  const hs = getHS();
  const el = document.getElementById('hsList');
  if (!hs.length) { el.innerHTML = '<p class="hs-empty" style="text-align:center;padding:6px 0">まだ記録なし</p>'; return; }
  el.innerHTML = hs.map((s, i) => `
    <div class="hs-row">
      <span class="hs-rank">${['🥇','🥈','🥉'][i]}</span>
      <span class="hs-score">${s.score}G</span>
      <span class="hs-meta">${s.correct}/15島 &nbsp; ${s.date}</span>
    </div>`).join('');
}


function getHSList(key) {
  return JSON.parse(localStorage.getItem('daiko_' + key + '_hs') || '[]');
}
function saveHSList(key, entry) {
  const list = getHSList(key);
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  localStorage.setItem('daiko_' + key + '_hs', JSON.stringify(list.slice(0, 3)));
}
function renderHSList(key, containerId, metaFn) {
  const list = getHSList(key);
  const el = document.getElementById(containerId);
  if (\!el) return;
  if (\!list.length) { el.innerHTML = '<p class="hs-empty" style="text-align:center;padding:6px 0">まだ記録なし</p>'; return; }
  el.innerHTML = list.map((s, i) => `
    <div class="hs-row">
      <span class="hs-rank">${['🥇','🥈','🥉'][i]}</span>
      <span class="hs-score">${s.score}G</span>
      <span class="hs-meta">${metaFn(s)}</span>
    </div>`).join('');
}

/* ═══ COMBO ═══ */
function getMultiplier() {
  if (G.combo >= 5) return 2.0;
  if (G.combo >= 3) return 1.5;
  return 1.0;
}
function updateComboDisplay() {
  const el = document.getElementById('hudCombo');
  if (G.combo >= 5) {
    el.textContent = '🔥 x' + G.combo + ' COMBO!!'; el.className = 'hud-combo x2'; el.style.display = 'inline-flex';
  } else if (G.combo >= 3) {
    el.textContent = '🔥 x' + G.combo + ' COMBO!'; el.className = 'hud-combo x15'; el.style.display = 'inline-flex';
  } else {
    el.style.display = 'none';
  }
}

/* ═══ HUD ═══ */
function updateHUD() {
  document.getElementById('hudHearts').textContent = '❤️'.repeat(G.hp) + '🖤'.repeat(5 - G.hp);
  document.getElementById('hudGold').textContent = '💰 ' + G.gold + 'G';
  updateComboDisplay();
}

/* ═══ EFFECTS ═══ */
let typeTimers = [];
async function typeWrite(el, text, speed = 20) {
  typeTimers.forEach(clearTimeout); typeTimers = [];
  const cur = document.createElement('span'); cur.className = 'cursor';
  el.innerHTML = ''; el.appendChild(cur);
  let i = 0;
  return new Promise(res => {
    function step() {
      if (i >= text.length) { cur.remove(); res(); return; }
      cur.before(text[i++]);
      typeTimers.push(setTimeout(step, speed));
    }
    step();
  });
}

function flash(type) {
  const el = document.getElementById('flashOverlay');
  el.className = ''; void el.offsetWidth; el.className = type;
  setTimeout(() => el.className = '', 900);
}
function bigText(text, cls) {
  const el = document.getElementById('bigText');
  el.textContent = text; el.className = ''; void el.offsetWidth; el.className = cls;
  setTimeout(() => el.className = '', 1600);
}
function goldPop(amount) {
  const el = document.createElement('div');
  el.className = 'gold-pop'; el.textContent = '+' + amount + 'G';
  el.style.top = '58px'; el.style.right = '36px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1600);
}
function shakeIsland() {
  const s = document.getElementById('screen-island');
  s.classList.add('shaking');
  setTimeout(() => s.classList.remove('shaking'), 550);
}
function animHeartsLose() {
  const el = document.getElementById('hudHearts');
  el.classList.add('anim-lose');
  setTimeout(() => el.classList.remove('anim-lose'), 600);
}
function animHeartsGain() {
  const el = document.getElementById('hudHearts');
  el.classList.add('anim-gain');
  setTimeout(() => el.classList.remove('anim-gain'), 500);
}
function animGold() {
  const el = document.getElementById('hudGold');
  el.classList.add('anim');
  setTimeout(() => el.classList.remove('anim'), 600);
}

/* ═══ POWER-UPS ═══ */
function updatePupUI() {
  ['gem','bolt','heart'].forEach(t => {
    const btn = document.getElementById('pup-' + t);
    const hasIt = G.powerups[t] > 0 && !G.answered;
    btn.disabled = !hasIt;
    btn.querySelector('.pup-count').textContent = G.powerups[t];
  });
}
function usePowerup(type) {
  if (!G.powerups[type] || G.answered) return;
  G.powerups[type] = 0;
  G.powerupsUsed++;
  updatePupUI();
  const c = G.currentQ || ALL_COUNTRIES[G.deck[G.cur]];

  if (type === 'gem') {
    const btns = [...document.querySelectorAll('.choice-btn:not([disabled])')];
    const wrongs = btns.filter(b => b.textContent.trim() !== c.name);
    shuffle(wrongs).slice(0, 2).forEach(b => { b.classList.add('hidden'); b.disabled = true; });
  } else if (type === 'bolt') {
    G.answered = true;
    document.querySelectorAll('.choice-btn').forEach(b => b.disabled = true);
    document.getElementById('btnReveal').disabled = true;
    document.getElementById('rewardTag').style.display = 'none';
    const fb = document.getElementById('answerFb');
    fb.className = 'answer-fb fb-skip';
    fb.innerHTML = '⚡ この島をスキップした — 次の島へ進め！';
    setTimeout(() => { document.getElementById('btnNext').className = 'btn-next visible'; }, 700);
  } else if (type === 'heart') {
    if (G.hp < 5) { G.hp++; updateHUD(); animHeartsGain(); }
    else {
      const btn = document.getElementById('pup-heart');
      btn.disabled = true;
    }
  }
}

/* ═══ TITLE / MENU ═══ */
function showTitle() {
  document.getElementById('hud').style.display = 'none';
  // Quiz best
  const qhs = getHS();
  document.getElementById('quizBest').textContent = qhs[0] ? `記録: ${qhs[0].score}G` : '記録: -';
  // Cannon best
  const cBest = localStorage.getItem('cannonBest');
  document.getElementById('cannonBest').textContent = cBest ? `記録: ${cBest}G` : '記録: -';
  // Treasure best
  const tBest = localStorage.getItem('treasureBest');
  document.getElementById('treasureBest').textContent = tBest ? `記録: ${tBest}G` : '記録: -';
  // Voyage best
  const vBest = localStorage.getItem('voyageBest');
  document.getElementById('voyageBest').textContent = vBest ? `記録: ${vBest}` : '記録: -';
  // API key status
  renderHS();
  renderHSList('cannon',   'hsListCannon',   s => `コンボ ${s.combo} | ${s.date}`);
  renderHSList('treasure', 'hsListTreasure', s => `WAVE ${s.wave} | ${s.diff} | ${s.date}`);
  renderHSList('voyage',   'hsListVoyage',   s => `第${s.round}海域 | ${s.date}`);
  renderHSList('pirate',   'hsListPirate',   s => `撃沈 ${s.sunk}隻 | ${s.date}`);
  showScreen('title');
}

/* ═══ START ═══ */
function startGame() {
  if (!getApiKey()) {
    const prompt = document.getElementById('quizApiPrompt');
    const input  = document.getElementById('apiKeyInput');
    const status = document.getElementById('apiStatus');
    input.value = '';
    status.textContent = '';
    status.className = 'api-status';
    prompt.style.display = 'flex';
    return;
  }
  _doStartGame();
}

function _doStartGame() {
  G = newState();
  G.deck = shuffle(ALL_COUNTRIES.map((_, i) => i)).slice(0, 15);
  document.getElementById('hud').style.display = 'flex';
  updateHUD();
  G.aiPending = generateAIQuestion([]);
  sailTo(0);
}

/* ═══ SAIL ═══ */
function sailTo(idx) {
  G.cur = idx;
  const l = SAIL_LINES[Math.floor(Math.random() * SAIL_LINES.length)];
  document.getElementById('sailText').textContent = l[0];
  document.getElementById('sailSub').textContent  = l[1];
  showScreen('sail');
  setTimeout(loadIsland, 2300);
  if (idx <= 14 && !G.aiPending) {
    G.aiPending = generateAIQuestion(G.aiUsedNames);
  }
}

/* ═══ ISLAND ═══ */
function renderMap() {
  const map = document.getElementById('islandMap');
  map.innerHTML = '';
  for (let i = 0; i < 15; i++) {
    const d = document.createElement('div');
    d.className = 'map-dot' + (i < G.cur ? ' done' : i === G.cur ? ' current' : '');
    map.appendChild(d);
  }
}

async function loadIsland() {
  let c;
  let alreadyShowing = false;
  if (G.aiPending) {
    const islandScr = document.getElementById('screen-island');
    let loadDiv = document.getElementById('loadingQuiz');
    if (!loadDiv) {
      loadDiv = document.createElement('div');
      loadDiv.id = 'loadingQuiz';
      loadDiv.innerHTML = '<span class="lq-icon">🤖</span><span class="lq-text">AI問題を生成中...</span>';
      islandScr.style.position = 'relative';
      islandScr.appendChild(loadDiv);
    }
    loadDiv.style.display = 'flex';
    showScreen('island');
    alreadyShowing = true;
    const aiQ = await G.aiPending;
    G.aiPending = null;
    loadDiv.style.display = 'none';
    if (aiQ) {
      c = aiQ;
      G.aiUsedNames.push(aiQ.name);
      G.aiQuestions[G.cur] = aiQ;
    } else {
      c = G.currentQ || ALL_COUNTRIES[G.deck[G.cur]];
    }
  } else {
    c = G.currentQ || ALL_COUNTRIES[G.deck[G.cur]];
  }
  G.currentQ = c;
  G.hints = 1; G.answered = false;

  document.getElementById('islandNum').textContent = '#' + (G.cur + 1);
  document.getElementById('answerFb').className = 'answer-fb';
  document.getElementById('answerFb').innerHTML = '';
  const nextBtn = document.getElementById('btnNext');
  nextBtn.className = 'btn-next'; nextBtn.onclick = nextIsland; nextBtn.textContent = '⚓ 次の島へ →';
  renderMap();
  updateReveal(c);
  updateReward();
  updatePupUI();
  renderChoices(c);

  const container = document.getElementById('hintsContainer');
  container.innerHTML = '';
  const entry = document.createElement('div'); entry.className = 'hint-entry';
  const num = document.createElement('span'); num.className = 'hint-num'; num.textContent = 'ヒント1.';
  const txt = document.createElement('span'); txt.className = 'hint-text';
  entry.append(num, txt); container.appendChild(entry);

  if (!alreadyShowing) showScreen('island');
  await typeWrite(txt, c.hints[0], 22);
}

function renderChoices(c) {
  const grid = document.getElementById('choicesGrid'); grid.innerHTML = '';
  shuffle(c.choices).forEach(ch => {
    const btn = document.createElement('button'); btn.className = 'choice-btn';
    btn.textContent = ch;
    btn.onclick = () => checkAnswer(ch, c, btn);
    grid.appendChild(btn);
  });
}
function updateReveal(c) {
  const btn = document.getElementById('btnReveal');
  const can = G.hints < 3 && !G.answered;
  btn.disabled = !can;
  btn.textContent = G.hints < 3 ? `🔍 ヒント${G.hints + 1}を解読する` : '（すべてのヒントを解読した）';
}
function updateReward() {
  const tag = document.getElementById('rewardTag');
  const mult = getMultiplier();
  const base = GOLD_TABLE[G.hints - 1];
  const earn = Math.round(base * mult);
  tag.style.display = G.answered ? 'none' : '';
  tag.textContent = mult > 1 ? `正解で +${earn}G（×${mult}）` : `正解で +${earn}G`;
  tag.style.color = mult >= 2 ? '#ff8030' : mult >= 1.5 ? '#ffa030' : '#c8960f';
}

async function revealNextHint() {
  if (G.hints >= 3 || G.answered) return;
  G.hints++;
  const c = G.currentQ || ALL_COUNTRIES[G.deck[G.cur]];
  const entry = document.createElement('div'); entry.className = 'hint-entry';
  const num = document.createElement('span'); num.className = 'hint-num'; num.textContent = `ヒント${G.hints}.`;
  const txt = document.createElement('span'); txt.className = 'hint-text';
  entry.append(num, txt);
  document.getElementById('hintsContainer').appendChild(entry);
  entry.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  updateReveal(c); updateReward();
  await typeWrite(txt, c.hints[G.hints - 1], 22);
}

/* ═══ ANSWER ═══ */
function checkAnswer(choice, c, btn) {
  if (G.answered) return;
  G.answered = true;
  document.querySelectorAll('.choice-btn').forEach(b => {
    b.disabled = true;
    if (b.textContent.trim() === c.name) b.classList.add('correct');
  });
  document.getElementById('btnReveal').disabled = true;
  document.getElementById('rewardTag').style.display = 'none';
  updatePupUI();
  const fb = document.getElementById('answerFb');

  if (choice === c.name) {
    const base = GOLD_TABLE[G.hints - 1];
    const mult = getMultiplier();
    const earned = Math.round(base * mult);
    G.gold += earned; G.correct++; G.combo++;
    if (G.hints === 1) G.firstHint++;
    G.maxCombo = Math.max(G.maxCombo, G.combo);

    btn.classList.add('correct');
    snd.correct();
    flash('fc'); bigText('正解！', 'bc'); goldPop(earned);
    setTimeout(animGold, 350);
    updateHUD();
    fb.className = 'answer-fb fb-correct';
    fb.innerHTML = `${c.flag} <strong>${c.name}</strong> — 正解！<br>
      <span style="font-size:22px;font-weight:400;color:#80e898">
        ヒント${G.hints}で正解 → +${earned}G${mult > 1 ? ' (コンボ×' + mult + ')' : ''}
        ${G.combo >= 3 ? ' &nbsp; 🔥 ' + G.combo + '連続！' : ''}
      </span>`;
  } else {
    G.hp--; G.combo = 0;
    btn.classList.add('wrong');
    snd.wrong();
    flash('fw'); bigText('外れ…', 'bw');
    setTimeout(animHeartsLose, 350); shakeIsland();
    updateHUD();
    fb.className = 'answer-fb fb-wrong';
    fb.innerHTML = `✗ 外れ…  正解は ${c.flag} <strong>${c.name}</strong><br>
      <span style="font-size:22px;font-weight:400;color:#e06070">
        ❤️ が1つ消えた${G.hp === 0 ? ' — 最後の一撃だ…' : ''}
      </span>`;
  }

  setTimeout(() => {
    const nextBtn = document.getElementById('btnNext');
    if (G.hp <= 0) {
      nextBtn.textContent = '結果を見る'; nextBtn.onclick = showGameOver;
    } else if (G.cur >= 14) {
      nextBtn.textContent = '🏆 全島制覇！結果へ'; nextBtn.onclick = showClear;
    }
    nextBtn.className = 'btn-next visible';
  }, 900);
}

/* ═══ NEXT ═══ */
function nextIsland() {
  if (G.hp <= 0) { showGameOver(); return; }
  if (G.cur >= 14) { showClear(); return; }
  sailTo(G.cur + 1);
}

/* ═══ ACHIEVEMENTS RENDER ═══ */
function renderAchievements(containerId) {
  const el = document.getElementById(containerId);
  const earned = ACHIEVEMENTS.filter(a => a.check(G));
  if (!earned.length) { el.innerHTML = ''; return; }
  el.innerHTML = '<p style="font-size:20px;font-weight:800;color:#5a4020;letter-spacing:.2em;text-transform:uppercase;margin-bottom:6px">【獲得実績】</p>' +
    earned.map(a => `
      <div class="achieve-item">
        <span class="achieve-icon">${a.icon}</span>
        <div><div class="achieve-name">${a.name}</div><div class="achieve-desc">${a.desc}</div></div>
      </div>`).join('');
}

/* ═══ GAMEOVER ═══ */
function showGameOver() {
  saveHS(G.gold, G.correct);
  document.getElementById('goScore').textContent = '獲得ゴールド: ' + G.gold + 'G';
  document.getElementById('goIslands').textContent = G.correct;
  document.getElementById('goCombo').textContent = G.maxCombo;
  renderAchievements('goAchieve');
  document.getElementById('hud').style.display = 'none';
  showScreen('gameover');
}

/* ═══ CLEAR ═══ */
function showClear() {
  saveHS(G.gold, G.correct);
  document.getElementById('clearVal').textContent = G.gold + 'G';
  document.getElementById('clearNote').textContent =
    G.gold >= 700 ? '🏆 伝説。これ以上ない完璧な制覇だ' :
    G.gold >= 550 ? '⚓ 凄腕の船長！見事な航海だった' :
                   '🌊 全海域を踏破した。まだ上を目指せる';
  renderAchievements('clearAchieve');
  document.getElementById('hud').style.display = 'none';
  showScreen('clear');
}

/* ══════════════════════════════════════════════════
   CANNON GAME
══════════════════════════════════════════════════ */
const BALL_SPD = 14;
const BALL_G   = 0.32;

const CG = {
  running: false, animId: null, timerInterval: null,
  canvas: null, ctx: null,
  W: 0, H: 0, oceanY: 0,
  cannonX: 110, cannonY: 0,
  stars: [], ships: [], ball: null,
  explosions: [], splashes: [],
  gold: 0, combo: 0, maxCombo: 0, timer: 60,
  aimX: -1, aimY: -1,
  lastSpawn: 0, spawnMs: 2600,
};

/* ── ship types ── */
const SHIP_TYPES = [
  { w: 72,  h: 44,  baseSpeed: 1.1, gold: 20 },
  { w: 106, h: 58,  baseSpeed: 0.85, gold: 35 },
  { w: 146, h: 76,  baseSpeed: 0.65, gold: 60 },
];

function spawnShip() {
  const t = SHIP_TYPES[Math.floor(Math.random() * SHIP_TYPES.length)];
  CG.ships.push({
    w: t.w, h: t.h, gold: t.gold,
    x: CG.W + t.w + 10,
    y: CG.oceanY,
    speed: t.baseSpeed + Math.random() * 0.6,
    sinking: false, sinkAngle: 0, sinkAlpha: 1,
  });
}

function cannonGetCoords(e) {
  const rect = CG.canvas.getBoundingClientRect();
  const sx = CG.canvas.width / rect.width;
  const sy = CG.canvas.height / rect.height;
  return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
}
function cannonGetTouchCoords(touch) {
  const rect = CG.canvas.getBoundingClientRect();
  const sx = CG.canvas.width / rect.width;
  const sy = CG.canvas.height / rect.height;
  return { x: (touch.clientX - rect.left) * sx, y: (touch.clientY - rect.top) * sy };
}

function fireAt(x, y) {
  if (CG.ball || !CG.running) return;
  const dx = x - CG.cannonX, dy = y - CG.cannonY;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;
  CG.ball = { x: CG.cannonX, y: CG.cannonY, vx: dx / d * BALL_SPD, vy: dy / d * BALL_SPD, trail: [] };
  snd.cannon();
}

function startCannon() {
  // reset state
  Object.assign(CG, {
    running: true, gold: 0, combo: 0, maxCombo: 0, timer: 60, lives: 3,
    ships: [], ball: null, explosions: [], splashes: [],
    aimX: -1, aimY: -1, lastSpawn: 0, spawnMs: 2600,
  });
  CG.stars = [];

  const canvas = document.getElementById('cannonCanvas');
  CG.canvas = canvas;
  CG.ctx    = canvas.getContext('2d');

  // Size canvas to screen minus header (~46px)
  canvas.width  = window.innerWidth;
  canvas.height = Math.max(320, window.innerHeight - 46);
  CG.W = canvas.width;
  CG.H = canvas.height;
  CG.oceanY  = Math.round(CG.H * 0.70);
  CG.cannonY = CG.oceanY;

  // Stars
  for (let i = 0; i < 58; i++) {
    CG.stars.push({
      x: Math.random() * CG.W,
      y: Math.random() * CG.oceanY * 0.9,
      r: Math.random() * 1.4 + 0.3,
      a: Math.random() * 0.55 + 0.35,
    });
  }

  // Remove old listeners and add fresh ones
  const newCanvas = canvas.cloneNode(false);
  canvas.parentNode.replaceChild(newCanvas, canvas);
  CG.canvas = newCanvas;
  CG.ctx    = newCanvas.getContext('2d');
  newCanvas.width  = CG.W;
  newCanvas.height = CG.H;

  newCanvas.addEventListener('mousemove', e => {
    const c = cannonGetCoords(e); CG.aimX = c.x; CG.aimY = c.y;
  });
  newCanvas.addEventListener('click', e => {
    const c = cannonGetCoords(e); fireAt(c.x, c.y);
  });
  newCanvas.addEventListener('touchstart', e => {
    e.preventDefault();
    const c = cannonGetTouchCoords(e.touches[0]); fireAt(c.x, c.y);
  }, { passive: false });
  newCanvas.addEventListener('touchmove', e => {
    e.preventDefault();
    const c = cannonGetTouchCoords(e.touches[0]); CG.aimX = c.x; CG.aimY = c.y;
  }, { passive: false });

  // HUD reset
  document.getElementById('cannonGold').textContent  = '💰 0G';
  document.getElementById('cannonCombo').textContent = '';
  document.getElementById('cannonTimer').textContent  = '60';
  document.getElementById('cannonResult').classList.remove('visible');
  const lv = document.getElementById('cannonLives');
  if (lv) lv.textContent = '🚢🚢🚢';

  // First ship
  spawnShip();

  // Timer
  clearInterval(CG.timerInterval);
  CG.timerInterval = setInterval(() => {
    if (!CG.running) return;
    CG.timer--;
    document.getElementById('cannonTimer').textContent = CG.timer;
    if (CG.timer <= 0) endCannon();
  }, 1000);

  showScreen('cannon');
  initCannonOcean(CG.W, CG.H);
  cancelAnimationFrame(CG.animId);
  CG.animId = requestAnimationFrame(cannonLoop);
}

function exitCannon() {
  CG.running = false;
  clearInterval(CG.timerInterval);
  cancelAnimationFrame(CG.animId);
  disposeCannonOcean();
  showTitle();
}

function cannonLoop() {
  if (!CG.running) return;
  CG.animId = requestAnimationFrame(cannonLoop);

  const { ctx, W, H, oceanY } = CG;
  const now = performance.now();

  /* ── update ball ── */
  if (CG.ball) {
    const b = CG.ball;
    b.vy += BALL_G;
    b.x += b.vx; b.y += b.vy;
    b.trail.push({ x: b.x, y: b.y });
    if (b.trail.length > 14) b.trail.shift();

    // hit detection
    let hit = false;
    for (const ship of CG.ships) {
      if (ship.sinking) continue;
      const hx = ship.w * 0.55, hy1 = ship.h * 1.05, hy2 = ship.h * 0.3;
      if (b.x > ship.x - hx && b.x < ship.x + hx &&
          b.y > ship.y - hy1 && b.y < ship.y + hy2) {
        hitShip(ship); hit = true; break;
      }
    }
    if (hit || b.y > H + 30 || b.x < -20 || b.x > W + 20) {
      if (!hit && b.y >= oceanY - 10) addSplash(b.x, oceanY);
      CG.ball = null;
    }
  }

  /* ── update ships ── */
  for (let i = CG.ships.length - 1; i >= 0; i--) {
    const s = CG.ships[i];
    if (!s.sinking) {
      s.x -= s.speed;
      if (s.x < -s.w - 20) {
        CG.ships.splice(i, 1); CG.combo = 0;
        CG.lives = Math.max(0, CG.lives - 1);
        updateCannonHUD();
        snd.wrong();
        if (CG.lives <= 0) { endCannon(); return; }
      }
    } else {
      s.sinkAngle += 0.035;
      s.sinkAlpha -= 0.022;
      if (s.sinkAlpha <= 0) CG.ships.splice(i, 1);
    }
  }

  /* spawn */
  const activeShips = CG.ships.filter(s => !s.sinking).length;
  if (activeShips < 3 && now - CG.lastSpawn > CG.spawnMs) {
    spawnShip();
    CG.lastSpawn = now;
    CG.spawnMs = Math.max(1100, CG.spawnMs - 25);
  }

  /* ── update fx ── */
  CG.explosions = CG.explosions.filter(e => { e.life -= 2; return e.life > 0; });
  for (const sp of CG.splashes) { sp.vy += 0.28; sp.x += sp.vx; sp.y += sp.vy; sp.life -= 3; }
  CG.splashes = CG.splashes.filter(s => s.life > 0);

  /* ── DRAW ── */
  drawCannonScene(ctx, W, H, oceanY);
}

function hitShip(ship) {
  ship.sinking = true;
  CG.combo++;
  CG.maxCombo = Math.max(CG.maxCombo, CG.combo);
  const mult   = CG.combo >= 5 ? 2.0 : CG.combo >= 3 ? 1.5 : 1.0;
  const earned = Math.round(ship.gold * mult);
  CG.gold += earned;
  CG.explosions.push({ x: ship.x, y: ship.y - ship.h * 0.5, life: 100, maxLife: 100, gold: earned });
  updateCannonHUD();
  snd.explode();
}

function updateCannonHUD() {
  document.getElementById('cannonGold').textContent = '💰 ' + CG.gold + 'G';
  const combo = CG.combo;
  document.getElementById('cannonCombo').textContent =
    combo >= 5 ? '🔥 x' + combo + ' !!!' :
    combo >= 3 ? '🔥 x' + combo : '';
  const lv = document.getElementById('cannonLives');
  if (lv) lv.textContent = '🚢'.repeat(CG.lives) + '💀'.repeat(Math.max(0, 3 - CG.lives));
}

function addSplash(x, y) {
  for (let i = 0; i < 9; i++) {
    CG.splashes.push({
      x, y,
      vx: (Math.random() - 0.5) * 4.5,
      vy: -(Math.random() * 4.5 + 0.5),
      life: 38 + Math.random() * 22,
    });
  }
}

function endCannon() {
  CG.running = false;
  clearInterval(CG.timerInterval);
  saveHSList('cannon', { score: CG.gold, combo: CG.maxCombo, date: new Date().toLocaleDateString('ja-JP') });
  const prev = parseInt(localStorage.getItem('cannonBest') || '0');
  const isHS = CG.gold > prev;
  if (isHS) localStorage.setItem('cannonBest', CG.gold);
  document.getElementById('cannonResultScore').textContent = CG.gold + 'G';
  document.getElementById('cannonResultHS').textContent =
    isHS ? '🏆 ベスト更新！' : '歴代記録: ' + Math.max(prev, CG.gold) + 'G  |  最大コンボ: ' + CG.maxCombo;
  document.getElementById('cannonResult').classList.add('visible');
}

/* ── Drawing ── */
function drawCannonScene(ctx, W, H, oceanY) {
  renderCannonOcean();
  ctx.clearRect(0, 0, W, H);

  // Sky (covers Three.js sky area)
  const skyG = ctx.createLinearGradient(0, 0, 0, oceanY);
  skyG.addColorStop(0, '#00060e'); skyG.addColorStop(.6, '#000f22'); skyG.addColorStop(1, '#001838');
  ctx.fillStyle = skyG; ctx.fillRect(0, 0, W, oceanY);

  // Stars (twinkling)
  const cStT = Date.now() * .0004;
  for (let si = 0; si < CG.stars.length; si++) {
    const s = CG.stars[si];
    const twk = Math.sin(cStT + si * 2.3) * .28 + .72;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,252,224,${s.a * twk})`; ctx.fill();
  }

  // Moon with halo + animated clouds
  const cmX = W * .82, cmY = 52;
  ctx.save();
  const cmH1 = ctx.createRadialGradient(cmX, cmY, 16, cmX, cmY, 72);
  cmH1.addColorStop(0, 'rgba(180,200,245,.18)'); cmH1.addColorStop(.5, 'rgba(160,185,235,.06)'); cmH1.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = cmH1; ctx.beginPath(); ctx.arc(cmX, cmY, 72, 0, Math.PI * 2); ctx.fill();
  const cmH2 = ctx.createRadialGradient(cmX, cmY, 12, cmX, cmY, 35);
  cmH2.addColorStop(0, 'rgba(200,215,255,.35)'); cmH2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = cmH2; ctx.beginPath(); ctx.arc(cmX, cmY, 35, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 18; ctx.shadowColor = 'rgba(200,215,255,.5)';
  ctx.fillStyle = '#dce6f8'; ctx.beginPath(); ctx.arc(cmX, cmY, 22, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0; ctx.fillStyle = '#07101e'; ctx.beginPath(); ctx.arc(cmX + 7, cmY - 4, 18, 0, Math.PI * 2); ctx.fill();
  const ccT = Date.now() * .000022;
  const cClouds = [{ox:.08,oy:.14,w:.34,a:.16,sp:.5},{ox:.5,oy:.2,w:.42,a:.13,sp:.35},{ox:.78,oy:.12,w:.3,a:.18,sp:.6}];
  ctx.shadowBlur = 0;
  for (const c of cClouds) {
    const cx2 = ((c.ox + ccT * c.sp) % 1.25 - .1) * W, cy2 = c.oy * oceanY;
    const cw2 = c.w * W, ch2 = cw2 * .22;
    const clG2 = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, cw2 * .5);
    clG2.addColorStop(0, 'rgba(52,68,108,.9)'); clG2.addColorStop(.55, 'rgba(28,44,80,.65)'); clG2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = c.a; ctx.fillStyle = clG2;
    ctx.beginPath(); ctx.ellipse(cx2, cy2, cw2 * .5, ch2 * .5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx2 + cw2 * .2, cy2 - ch2 * .1, cw2 * .3, ch2 * .42, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // Trajectory preview
  if (!CG.ball && CG.aimX > 0) {
    const dx = CG.aimX - CG.cannonX, dy = CG.aimY - CG.cannonY;
    const d  = Math.sqrt(dx * dx + dy * dy) || 1;
    let px = CG.cannonX, py = CG.cannonY, pvx = dx / d * BALL_SPD, pvy = dy / d * BALL_SPD;
    ctx.save(); ctx.strokeStyle = 'rgba(255,200,80,.32)';
    ctx.setLineDash([5, 9]); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(px, py);
    for (let i = 0; i < 85; i++) {
      pvy += BALL_G; px += pvx; py += pvy;
      ctx.lineTo(px, py);
      if (px < 0 || px > W || py > H) break;
    }
    ctx.stroke(); ctx.restore();
  }

  // Enemy ships (draw before ocean fill)
  for (const ship of CG.ships) {
    ctx.save();
    ctx.translate(ship.x, ship.y);
    if (ship.sinking) {
      ctx.rotate(ship.sinkAngle);
      ctx.globalAlpha = ship.sinkAlpha;
    }
    drawEnemyShip(ctx, ship.w, ship.h, ship.gold);
    ctx.restore();
  }

  // Player ship + cannon
  ctx.save();
  ctx.translate(CG.cannonX - 10, oceanY);
  drawPlayerShip(ctx);
  // Cannon barrel
  const ang = CG.ball
    ? Math.atan2(CG.ball.vy, CG.ball.vx)
    : Math.atan2(CG.aimY - CG.cannonY, CG.aimX - CG.cannonX);
  ctx.translate(0, -14);
  ctx.rotate(ang);
  const cbrlG = ctx.createLinearGradient(0, -7, 0, 7);
  cbrlG.addColorStop(0, '#5a5850'); cbrlG.addColorStop(.4, '#282520'); cbrlG.addColorStop(1, '#181512');
  ctx.fillStyle = cbrlG; ctx.beginPath(); ctx.rect(-4, -6, 48, 12); ctx.fill();
  ctx.fillStyle = '#6a6560'; ctx.fillRect(40, -7.5, 6, 15);
  ctx.fillStyle = '#3a3530'; ctx.fillRect(-5, -7, 7, 14);
  const ctrnG = ctx.createRadialGradient(-2, -2, 2, 0, 0, 10);
  ctrnG.addColorStop(0, '#6a6560'); ctrnG.addColorStop(1, '#282520');
  ctx.fillStyle = ctrnG; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // Ocean fill — semi-transparent so Three.js 3D waves show through
  const oceanG = ctx.createLinearGradient(0, oceanY, 0, H);
  oceanG.addColorStop(0, 'rgba(8,32,62,0.55)'); oceanG.addColorStop(.45, 'rgba(2,12,28,0.65)'); oceanG.addColorStop(1, 'rgba(0,5,10,0.78)');
  ctx.fillStyle = oceanG; ctx.fillRect(0, oceanY, W, H - oceanY);
  // Moonlight stripe overlay
  const mlG = ctx.createRadialGradient(W * .82, oceanY + 2, 2, W * .82, oceanY + 2, W * .26);
  mlG.addColorStop(0, 'rgba(200,218,255,.14)'); mlG.addColorStop(.5, 'rgba(160,185,235,.05)'); mlG.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = mlG; ctx.fillRect(W * .56, oceanY, W * .52, H - oceanY);
  // Surface shimmer lines
  const wT = Date.now() * .001;
  ctx.setLineDash([]);
  for (let wLy = 0; wLy < 2; wLy++) {
    const wAlpha = .06 + wLy * .03, wAmp = 2.5 + wLy, wPer = 88 + wLy * 28;
    const wSpd = .7 - wLy * .2, wY = oceanY + wLy * 5;
    ctx.strokeStyle = `rgba(100,170,255,${wAlpha})`; ctx.lineWidth = 1.0 - wLy * .2;
    ctx.beginPath();
    for (let wx = 0; wx < W + wPer; wx += 2) {
      const wy = wY + Math.sin((wx / wPer + wT * wSpd) * Math.PI * 2) * wAmp;
      if (wx === 0) ctx.moveTo(wx, wy); else ctx.lineTo(wx, wy);
    }
    ctx.stroke();
  }

  // Splashes
  for (const sp of CG.splashes) {
    ctx.beginPath(); ctx.arc(sp.x, sp.y, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(140,200,255,${Math.max(0, sp.life / 60)})`; ctx.fill();
  }

  // Ball + trail (iron cannonball)
  if (CG.ball) {
    const b = CG.ball;
    for (let i = 0; i < b.trail.length; i++) {
      const t = b.trail[i], frac = i / b.trail.length;
      ctx.globalAlpha = frac * .22;
      ctx.fillStyle = 'rgba(190,182,168,1)';
      ctx.beginPath(); ctx.arc(t.x, t.y, 5.5 * frac, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    const ballGrd = ctx.createRadialGradient(b.x - 1.8, b.y - 1.8, .5, b.x, b.y, 6);
    ballGrd.addColorStop(0, '#5a5850'); ballGrd.addColorStop(.6, '#282520'); ballGrd.addColorStop(1, '#100e0c');
    ctx.save(); ctx.shadowColor = 'rgba(255,160,20,.32)'; ctx.shadowBlur = 5;
    ctx.fillStyle = ballGrd; ctx.beginPath(); ctx.arc(b.x, b.y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = .32; ctx.fillStyle = '#8a8680';
    ctx.beginPath(); ctx.arc(b.x - 1.7, b.y - 1.8, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // Explosions (3-layer fire)
  for (const exp of CG.explosions) {
    const p = exp.life / exp.maxLife;
    ctx.save();
    const smR = (1 - p) * 62;
    ctx.globalAlpha = p * .35;
    const smGrd = ctx.createRadialGradient(exp.x, exp.y, smR * .4, exp.x, exp.y, smR);
    smGrd.addColorStop(0, 'rgba(130,118,100,.5)'); smGrd.addColorStop(1, 'rgba(80,72,60,0)');
    ctx.fillStyle = smGrd; ctx.beginPath(); ctx.arc(exp.x, exp.y, smR, 0, Math.PI * 2); ctx.fill();
    const fR = (1 - p) * 48;
    ctx.globalAlpha = p * .72;
    const fGrd = ctx.createRadialGradient(exp.x, exp.y, fR * .12, exp.x, exp.y, fR);
    fGrd.addColorStop(0, 'rgba(255,240,50,0)'); fGrd.addColorStop(.35, 'rgba(255,150,18,.9)'); fGrd.addColorStop(.75, 'rgba(200,55,5,.6)'); fGrd.addColorStop(1, 'rgba(80,20,0,0)');
    ctx.fillStyle = fGrd; ctx.beginPath(); ctx.arc(exp.x, exp.y, fR, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = p * .88 * p;
    const cGrd = ctx.createRadialGradient(exp.x, exp.y, 0, exp.x, exp.y, 24 * p);
    cGrd.addColorStop(0, 'rgba(255,252,200,.95)'); cGrd.addColorStop(.5, 'rgba(255,200,60,.7)'); cGrd.addColorStop(1, 'rgba(255,100,10,0)');
    ctx.fillStyle = cGrd; ctx.beginPath(); ctx.arc(exp.x, exp.y, 24 * p, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = p;
    ctx.font = 'bold 16px sans-serif'; ctx.fillStyle = '#ffd040';
    ctx.textAlign = 'center';
    ctx.fillText('+' + exp.gold + 'G', exp.x, exp.y - (1 - p) * 50 - 5);
    ctx.restore();
  }

  // Timer bar
  const frac = CG.timer / 60;
  const bw = W * 0.46, bx = (W - bw) / 2, by = 8;
  ctx.fillStyle = 'rgba(0,0,0,.38)'; ctx.fillRect(bx, by, bw, 7);
  ctx.fillStyle = frac > .5 ? '#40d060' : frac > .25 ? '#d4a030' : '#e03030';
  ctx.fillRect(bx, by, bw * frac, 7);
}

function drawEnemyShip(ctx, w, h, gold) {
  const hw = w / 2;
  const deckY = -h * .22, keel = h * .28;
  const T = Date.now();
  const isLg = w > 116, isMd = w > 80;
  ctx.save();

  // Water shadow
  ctx.globalAlpha = .26; ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(hw * .05, 3, hw * .86, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;

  // Hull
  const hullG = ctx.createLinearGradient(-hw, deckY, hw, keel);
  hullG.addColorStop(0, '#0e0904'); hullG.addColorStop(.5, '#1a1208'); hullG.addColorStop(1, '#080604');
  ctx.fillStyle = hullG;
  ctx.beginPath();
  ctx.moveTo(-hw + 4, deckY);
  ctx.quadraticCurveTo(-hw - 5, 0, -hw + 2, keel);
  ctx.lineTo(hw + 10, keel); ctx.lineTo(hw + 14, deckY);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(180,138,15,.6)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-hw + 4, deckY); ctx.lineTo(hw + 14, deckY); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = .6;
  for (let p = -3; p <= 3; p++) {
    const px = (p / 4) * hw;
    ctx.beginPath(); ctx.moveTo(px, deckY); ctx.lineTo(px * .85, keel); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(0,0,0,.7)';
  const portCt = isLg ? 3 : isMd ? 2 : 1;
  const portY = (deckY + keel * .15) * .5;
  for (let p = 0; p < portCt; p++) {
    const px = -hw * .35 + p * (hw * .45);
    ctx.fillRect(px - 5, portY - 3.5, 10, 7);
  }

  // Masts
  const mx1 = isLg ? -hw * .15 : 0, mx2 = hw * .42;
  const mt1 = deckY - h * (isLg ? 1.08 : .94), mt2 = deckY - h * .78;
  ctx.strokeStyle = '#1a0e04'; ctx.lineCap = 'round';
  ctx.lineWidth = isLg ? 4.5 : isMd ? 4 : 3.5;
  ctx.beginPath(); ctx.moveTo(mx1, deckY); ctx.lineTo(mx1, mt1); ctx.stroke();
  if (isMd || isLg) {
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(mx2, deckY); ctx.lineTo(mx2, mt2); ctx.stroke();
  }

  // Yardarms
  const ya1W = w * (isLg ? .46 : .4), ya2W = ya1W * .62, ya3W = w * .26;
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(mx1 - ya1W / 2, mt1 + h * .28); ctx.lineTo(mx1 + ya1W / 2, mt1 + h * .28); ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(mx1 - ya2W / 2, mt1 + h * .07); ctx.lineTo(mx1 + ya2W / 2, mt1 + h * .07); ctx.stroke();
  if (isMd || isLg) {
    ctx.beginPath(); ctx.moveTo(mx2 - ya3W / 2, mt2 + h * .22); ctx.lineTo(mx2 + ya3W / 2, mt2 + h * .22); ctx.stroke();
  }

  // Sails
  const bw = Math.sin(T * .0007) * 3.5;
  const sc = gold >= 60 ? 'rgba(22,18,14,.92)' : gold >= 35 ? 'rgba(198,190,165,.9)' : 'rgba(214,207,183,.9)';
  const scFade = gold >= 60 ? 'rgba(18,14,10,.72)' : 'rgba(175,168,148,.72)';
  ctx.strokeStyle = 'rgba(80,65,40,.3)'; ctx.lineWidth = .8;

  function drawSail(x0, y0, x1, y1, cx) {
    const msGrd = ctx.createLinearGradient(x0, y0, x1, y1);
    msGrd.addColorStop(0, sc); msGrd.addColorStop(.5, scFade); msGrd.addColorStop(1, sc);
    ctx.fillStyle = msGrd;
    ctx.beginPath();
    ctx.moveTo(x0, y0); ctx.quadraticCurveTo(cx - bw, (y0 + y1) * .5, x0, y1);
    ctx.lineTo(x1, y1); ctx.quadraticCurveTo(cx + bw * .8, (y0 + y1) * .5, x1, y0);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }

  drawSail(mx1 - ya1W / 2, mt1 + h * .06, mx1 + ya1W / 2, mt1 + h * .52, mx1);
  drawSail(mx1 - ya2W / 2, mt1 + h * .02, mx1 + ya2W / 2, mt1 + h * .26, mx1);
  if (isMd || isLg) drawSail(mx2 - ya3W / 2, mt2 + h * .02, mx2 + ya3W / 2, mt2 + h * .44, mx2);

  // Rigging
  ctx.strokeStyle = 'rgba(50,38,16,.38)'; ctx.lineWidth = .75;
  ctx.beginPath(); ctx.moveTo(mx1, mt1); ctx.lineTo(-hw + 4, deckY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(mx1, mt1); ctx.lineTo(hw + 10, deckY); ctx.stroke();
  if (isMd || isLg) {
    ctx.beginPath(); ctx.moveTo(mx2, mt2); ctx.lineTo(hw + 10, deckY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mx1, mt1); ctx.lineTo(mx2, mt2); ctx.stroke();
  }

  // Flag
  const flg = Math.sin(T * .005) * 5;
  ctx.fillStyle = gold >= 60 ? '#280010' : '#081438';
  ctx.beginPath(); ctx.moveTo(mx1, mt1);
  ctx.lineTo(mx1 + w * .18 + flg, mt1 + h * .05); ctx.lineTo(mx1, mt1 + h * .1); ctx.closePath(); ctx.fill();

  // Gold label
  ctx.fillStyle = 'rgba(255,210,60,.92)';
  ctx.font = `bold ${Math.round(w * .15)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(gold + 'G', mx1, mt1 - 5);
  ctx.restore();
}

function drawPlayerShip(ctx) {
  ctx.save();
  const phG = ctx.createLinearGradient(-70, -22, 70, 8);
  phG.addColorStop(0, '#0e0904'); phG.addColorStop(.45, '#3a1c08'); phG.addColorStop(1, '#0e0904');
  ctx.fillStyle = phG;
  ctx.beginPath();
  ctx.moveTo(-72, -18); ctx.lineTo(60, -18);
  ctx.quadraticCurveTo(70, -10, 72, 6); ctx.lineTo(-74, 6);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(180,138,15,.75)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-72, -18); ctx.lineTo(60, -18); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,.2)'; ctx.lineWidth = .7;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath(); ctx.moveTo(i * 18, -18); ctx.lineTo(i * 17, 6); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(0,0,0,.75)';
  for (let i = 0; i < 3; i++) ctx.fillRect(16 + i * 14, -12, 10, 7);
  ctx.fillStyle = 'rgba(180,138,15,.5)';
  ctx.beginPath(); ctx.arc(-64, -10, 4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/* ══════════════════════════════════════════════════
   TREASURE GAME
══════════════════════════════════════════════════ */
const DIFF_CONFIG = {
  easy: {
    cols: 5, rows: 5, maxHp: 5, timeLimit: 120, waves: 1,
    pool: () => [
      ...Array(5).fill('treasure'),
      ...Array(1).fill('mermaid'),
      ...Array(2).fill('shark'),
      ...Array(1).fill('bomb'),
      ...Array(1).fill('medkit'),
      ...Array(1).fill('map'),
    ],
    target: () => 5,
  },
  normal: {
    cols: 6, rows: 6, maxHp: 3, timeLimit: 90, waves: 2,
    pool: (wIdx) => [
      ...Array(6).fill('treasure'),
      ...Array(1 + wIdx).fill('mermaid'),
      ...Array(4 + wIdx).fill('shark'),
      ...Array(2).fill('bomb'),
      ...Array(1).fill('medkit'),
      ...Array(1).fill('map'),
      ...Array(1).fill('diamond'),
      ...Array(1).fill('trident'),
    ],
    target: () => 6,
  },
  hard: {
    cols: 7, rows: 7, maxHp: 2, timeLimit: 60, waves: 3,
    pool: (wIdx) => [
      ...Array(8).fill('treasure'),
      ...Array(2).fill('mermaid'),
      ...Array(5 + wIdx).fill('shark'),
      ...Array(2 + wIdx).fill('bomb'),
      ...Array(1).fill('medkit'),
      ...Array(1).fill('map'),
      ...Array(2).fill('diamond'),
      ...Array(1).fill('trident'),
      ...Array(1).fill('kraken'),
    ],
    target: () => 8,
  },
};

const TG = {
  cells: [], hp: 3, maxHp: 3, gold: 0, found: 0,
  flagMode: false, done: false, combo: 0, maxCombo: 0,
  diff: 'normal', wave: 1, target: 6,
  cols: 6, rows: 6,
  sonarUsed: false, timerLeft: 90, timerInterval: null,
};

const TC_DATA = {
  treasure: { icon: '💰', gold: 30,  dmg: 0, cls: 'cell-treasure', label: '宝箱！',        danger: false },
  mermaid:  { icon: '🧜', gold: 60,  dmg: 0, cls: 'cell-mermaid',  label: '人魚！',        danger: false },
  shark:    { icon: '🦈', gold:  0,  dmg: 1, cls: 'cell-shark',    label: 'サメ！',        danger: true  },
  bomb:     { icon: '💣', gold:  0,  dmg: 2, cls: 'cell-bomb',     label: '爆弾！',        danger: true  },
  medkit:   { icon: '💊', gold: 10,  dmg:-1, cls: 'cell-medkit',   label: '回復薬！',      danger: false },
  map:      { icon: '🗺️', gold: 15,  dmg: 0, cls: 'cell-map',     label: '宝の地図！',    danger: false },
  diamond:  { icon: '💎', gold: 100, dmg: 0, cls: 'cell-diamond',  label: '宝石発見！',    danger: false },
  trident:  { icon: '🔱', gold: 20,  dmg: 0, cls: 'cell-trident',  label: 'トライデント！', danger: false },
  kraken:   { icon: '🦑', gold:  0,  dmg: 9, cls: 'cell-kraken',   label: 'クラーケン！',  danger: true  },
  empty:    { icon: '🌊', gold:  0,  dmg: 0, cls: 'cell-empty',    label: '',              danger: false },
};

function showDiffPicker() {
  if (TG.timerInterval) clearInterval(TG.timerInterval);
  document.getElementById('diffOverlay').classList.remove('hidden');
  document.getElementById('treasureResult').classList.remove('visible');
  showScreen('treasure');
}

function startTreasure(diff) {
  if (TG.timerInterval) clearInterval(TG.timerInterval);
  const cfg = DIFF_CONFIG[diff];
  TG.diff      = diff;
  TG.wave      = 1;
  TG.hp        = cfg.maxHp;
  TG.maxHp     = cfg.maxHp;
  TG.cols      = cfg.cols;
  TG.rows      = cfg.rows;
  TG.gold      = 0;
  TG.found     = 0;
  TG.combo     = 0;
  TG.maxCombo  = 0;
  TG.flagMode  = false;
  TG.done      = false;
  TG.sonarUsed = false;
  TG.target    = cfg.target();
  TG.timerLeft = cfg.timeLimit;

  document.getElementById('diffOverlay').classList.add('hidden');
  document.getElementById('treasureResult').classList.remove('visible');
  document.getElementById('treasureFlagBtn').classList.remove('flag-active');
  document.getElementById('sonarBtn').disabled = false;

  buildTreasureBoard(diff, 0);
  renderTreasureGrid();
  updateTreasureHUD();
  startTreasureTimer();
  showScreen('treasure');
}

function buildTreasureBoard(diff, wIdx) {
  const cfg   = DIFF_CONFIG[diff];
  const total = cfg.cols * cfg.rows;
  const items = cfg.pool(wIdx);
  const empty = Math.max(0, total - items.length);
  const pool  = shuffle([...items, ...Array(empty).fill('empty')]);
  TG.cells    = pool.map((type, i) => ({ i, type, revealed: false, flagged: false }));
}

function startTreasureTimer() {
  if (TG.timerInterval) clearInterval(TG.timerInterval);
  updateTimerDisplay();
  TG.timerInterval = setInterval(() => {
    if (TG.done) { clearInterval(TG.timerInterval); return; }
    TG.timerLeft--;
    updateTimerDisplay();
    if (TG.timerLeft <= 0) {
      clearInterval(TG.timerInterval);
      TG.done = true;
      endTreasure(false, true);
    }
  }, 1000);
}

function updateTimerDisplay() {
  const el = document.getElementById('treasureTimer');
  if (!el) return;
  const m = Math.floor(TG.timerLeft / 60);
  const s = TG.timerLeft % 60;
  el.textContent = `⏱ ${m}:${s.toString().padStart(2, '0')}`;
  el.classList.toggle('danger', TG.timerLeft > 0 && TG.timerLeft <= 15);
}

function exitTreasure() {
  if (TG.timerInterval) clearInterval(TG.timerInterval);
  document.getElementById('diffOverlay').classList.remove('hidden');
  showTitle();
}

function toggleFlagMode() {
  TG.flagMode = !TG.flagMode;
  const btn = document.getElementById('treasureFlagBtn');
  btn.classList.toggle('flag-active', TG.flagMode);
  btn.textContent = TG.flagMode ? '🚩 フラグ ON' : '🚩 フラグ';
}

function useSonar() {
  if (TG.sonarUsed || TG.done) return;
  TG.sonarUsed = true;
  document.getElementById('sonarBtn').disabled = true;
  TG.gold = Math.max(0, TG.gold - 20);
  updateTreasureHUD();

  const safe = TG.cells.filter(c => !c.revealed && !TC_DATA[c.type].danger);
  const pref = safe.filter(c => c.type === 'treasure' || c.type === 'mermaid' || c.type === 'diamond');
  const pool = pref.length ? pref : safe;
  const btns = document.getElementById('treasureGrid').querySelectorAll('.tcell');
  shuffle([...pool]).slice(0, 3).forEach(c => {
    const btn = btns[c.i];
    if (btn && !c.revealed) {
      btn.classList.add('sonar-hint');
      setTimeout(() => btn.classList.remove('sonar-hint'), 1200);
    }
  });
}

function renderTreasureGrid() {
  const grid = document.getElementById('treasureGrid');
  grid.style.gridTemplateColumns = `repeat(${TG.cols}, 1fr)`;
  grid.style.maxWidth = TG.cols <= 5 ? '360px' : TG.cols === 6 ? '420px' : '476px';
  const iconSz = TG.cols <= 5 ? 24 : TG.cols === 6 ? 20 : 17;
  grid.innerHTML = '';
  TG.cells.forEach(cell => {
    const btn = document.createElement('button');
    btn.className = 'tcell';
    if (cell.revealed) {
      const tc = TC_DATA[cell.type];
      btn.classList.add(tc.cls);
      btn.innerHTML = `<span style="font-size:${iconSz}px">${tc.icon}</span>`;
      if (cell.type === 'empty') {
        const dc = getDangerCount(cell.i);
        if (dc > 0) btn.innerHTML += `<span class="danger-num dn-${Math.min(dc,5)}">${dc}</span>`;
      }
      btn.disabled = true;
    } else if (cell.flagged) {
      btn.classList.add('flagged');
      btn.innerHTML = `<span style="font-size:${iconSz - 2}px">🚩</span>`;
    }
    if (!cell.revealed) {
      btn.addEventListener('click',       ()  => onTreasureClick(cell.i));
      btn.addEventListener('contextmenu', (e) => { e.preventDefault(); onTreasureFlag(cell.i); });
    }
    grid.appendChild(btn);
  });
}

function getDangerCount(idx) {
  const r = Math.floor(idx / TG.cols), c = idx % TG.cols;
  let n = 0;
  for (let dr = -1; dr <= 1; dr++) for (let dc2 = -1; dc2 <= 1; dc2++) {
    if (dr === 0 && dc2 === 0) continue;
    const nr = r + dr, nc = c + dc2;
    if (nr >= 0 && nr < TG.rows && nc >= 0 && nc < TG.cols) {
      if (TC_DATA[TG.cells[nr * TG.cols + nc].type].danger) n++;
    }
  }
  return n;
}

function cascadeReveal(idx) {
  if (getDangerCount(idx) > 0) return;
  const r = Math.floor(idx / TG.cols), c = idx % TG.cols;
  for (let dr = -1; dr <= 1; dr++) for (let dc2 = -1; dc2 <= 1; dc2++) {
    if (dr === 0 && dc2 === 0) continue;
    const nr = r + dr, nc = c + dc2;
    if (nr >= 0 && nr < TG.rows && nc >= 0 && nc < TG.cols) {
      const ni = nr * TG.cols + nc, nb = TG.cells[ni];
      if (!nb.revealed && !nb.flagged && nb.type === 'empty') {
        nb.revealed = true;
        cascadeReveal(ni);
      }
    }
  }
}

function updateTreasureHUD() {
  document.getElementById('treasureHP').textContent =
    '❤️'.repeat(TG.hp) + '🖤'.repeat(Math.max(0, TG.maxHp - TG.hp));
  document.getElementById('treasureGoldHud').textContent  = '💰 ' + TG.gold + 'G';
  document.getElementById('treasureFoundHud').textContent = `宝 ${TG.found}/${TG.target}`;
  const mulStr = TG.combo >= 6 ? 'x3.0🔥🔥' : TG.combo >= 4 ? 'x2.0🔥' : TG.combo >= 2 ? 'x1.5✨' : '';
  const ce = document.getElementById('treasureCombo');
  if (ce) ce.textContent = mulStr ? `COMBO ${TG.combo} ${mulStr}` : '';

  const diffLabel = { easy: '🌊 イージー', normal: '⚓ ノーマル', hard: '💀 ハード' };
  document.getElementById('treasureTitleTxt').textContent = diffLabel[TG.diff] || '🗺️';
  document.getElementById('treasureSubTxt').textContent   = `WAVE ${TG.wave} — 宝を${TG.target}個発見せよ！`;
}

function onTreasureClick(i) {
  if (TG.done) return;
  const cell = TG.cells[i];
  if (cell.revealed) return;
  if (TG.flagMode) { onTreasureFlag(i); return; }

  cell.revealed = true;
  const tc = TC_DATA[cell.type];

  if (tc.danger) {
    TG.combo = 0;
    const krakenDmg = cell.type === 'kraken'
      ? ({ easy: 1, normal: 2, hard: 3 }[TG.diff] || tc.dmg)
      : tc.dmg;
    TG.hp = Math.max(0, TG.hp - krakenDmg);
    const scr = document.getElementById('screen-treasure');
    scr.classList.add('shaking');
    setTimeout(() => scr.classList.remove('shaking'), 550);
    if (TG.hp <= 0) {
      TG.done = true;
      setTimeout(() => endTreasure(false, false), 800);
    }
  } else if (cell.type === 'treasure' || cell.type === 'mermaid' || cell.type === 'diamond') {
    TG.combo++;
    TG.maxCombo = Math.max(TG.maxCombo, TG.combo);
    const mul = TG.combo >= 6 ? 3.0 : TG.combo >= 4 ? 2.0 : TG.combo >= 2 ? 1.5 : 1.0;
    TG.gold += Math.floor(tc.gold * mul);
    if (cell.type === 'treasure' || cell.type === 'mermaid' || cell.type === 'diamond') TG.found++;
    if (TG.found >= TG.target) {
      TG.done = true;
      const maxWave = DIFF_CONFIG[TG.diff].waves;
      if (TG.wave < maxWave) {
        setTimeout(() => advanceWave(), 700);
      } else {
        setTimeout(() => endTreasure(true, false), 600);
      }
    }
  } else if (cell.type === 'medkit') {
    TG.combo = 0;
    TG.hp    = Math.min(TG.maxHp, TG.hp + 1);
    TG.gold += tc.gold;
  } else if (cell.type === 'map') {
    TG.combo = 0;
    TG.gold += tc.gold;
    const safe = TG.cells.filter(c => !c.revealed && !TC_DATA[c.type].danger);
    shuffle([...safe]).slice(0, Math.ceil(TG.cols / 2) + 1).forEach(c => { c.revealed = true; });
  } else if (cell.type === 'trident') {
    TG.combo = 0;
    TG.gold += tc.gold;
    const row = Math.floor(i / TG.cols), col = i % TG.cols;
    TG.cells.forEach((cl, idx) => {
      const cr = Math.floor(idx / TG.cols), cc = idx % TG.cols;
      if ((cr === row || cc === col) && !cl.revealed && !TC_DATA[cl.type].danger) {
        cl.revealed = true;
      }
    });
  } else if (cell.type === 'empty') {
    TG.combo = 0;
    cascadeReveal(i);
  }

  updateTreasureHUD();
  renderTreasureGrid();
}

function advanceWave() {
  TG.wave++;
  TG.found    = 0;
  TG.done     = false;
  TG.combo    = 0;
  TG.flagMode = false;
  TG.target   = DIFF_CONFIG[TG.diff].target();
  TG.timerLeft += Math.floor(DIFF_CONFIG[TG.diff].timeLimit * 0.4);

  const wb = document.getElementById('waveBanner');
  wb.textContent = `WAVE ${TG.wave}!`;
  wb.classList.remove('show');
  void wb.offsetWidth;
  wb.classList.add('show');

  buildTreasureBoard(TG.diff, TG.wave - 1);
  document.getElementById('treasureFlagBtn').classList.remove('flag-active');
  document.getElementById('sonarBtn').disabled = TG.sonarUsed;

  setTimeout(() => {
    TG.done = false;
    renderTreasureGrid();
    updateTreasureHUD();
  }, 420);
}

function onTreasureFlag(i) {
  if (TG.done) return;
  const cell = TG.cells[i];
  if (cell.revealed) return;
  cell.flagged = !cell.flagged;
  renderTreasureGrid();
}

function endTreasure(survived, timeout) {
  if (TG.timerInterval) clearInterval(TG.timerInterval);
  const speedBonus = survived ? TG.timerLeft * 2 : 0;
  TG.gold += speedBonus;

  saveHSList('treasure', { score: TG.gold, wave: TG.wave, diff: TG.diff === 'hard' ? '難' : '普通', date: new Date().toLocaleDateString('ja-JP') });
  const prev = parseInt(localStorage.getItem('treasureBest') || '0');
  const isHS = TG.gold > prev;
  if (isHS) localStorage.setItem('treasureBest', TG.gold);

  const icon  = survived ? '🏆' : timeout ? '⌛' : '🦈';
  const title = survived ? (TG.diff === 'hard' ? '伝説の航海師！' : '全宝発見！') : timeout ? '時間切れ…' : '遭難…';
  document.getElementById('tResultIcon').textContent  = icon;
  document.getElementById('tResultTitle').textContent = title;
  document.getElementById('tResultGold').textContent  = TG.gold + 'G';
  document.getElementById('tResultNote').textContent  =
    isHS ? '🏆 ベスト更新！' :
    survived ? '見事な航海！さらに高スコアを目指せ' :
    timeout  ? 'もっと速く掘れ！' : 'サメに敗れた…また挑め！';

  const statsEl = document.getElementById('tResultStats');
  const waveTotal = DIFF_CONFIG[TG.diff].waves;
  statsEl.innerHTML =
    `WAVE ${TG.wave} / ${waveTotal}` +
    (TG.maxCombo > 0 ? `　最大COMBO ${TG.maxCombo}` : '') +
    (survived && speedBonus > 0 ? `　⚡速度ボーナス +${speedBonus}G` : '');

  document.getElementById('treasureResult').classList.add('visible');
}


/* ══════════════════════════════════════════════════
   VOYAGE GAME — 海賊王への航海
══════════════════════════════════════════════════ */
/* ── Pollinations.ai image prompts per enemy ── */
const ENEMY_IMG_PROMPTS = {
  '小型海賊船':  'small wooden pirate sloop sailing on tropical blue sea, sunny weather, anime watercolor style',
  'スループ船':  'sleek pirate sloop with black torn sails, choppy ocean waves, dramatic clouds, anime art',
  'フリゲート':  'tall sailing warship frigate firing broadside cannons, sea battle smoke and fire, cinematic anime',
  '蒸気砲艦':    'steampunk iron pirate warship with steam-powered cannons, dark foggy sea, anime style',
  '黒ひげ船長':  'fearsome pirate captain blackbeard standing on ship bow, stormy sea at dusk, epic anime portrait',
  '海賊旗艦':    'colossal pirate flagship with giant skull jolly roger flag, fleet battle, dramatic stormy sky, anime',
  '深海要塞艦':  'dark armored fortress battleship emerging from deep ocean abyss, bioluminescent glow, anime',
  '嵐の艦隊長':  'massive warship sailing through hurricane storm, lightning bolts, giant crushing waves, epic anime',
  '死神の船':    'ghost ship with skeletal crew, tattered sails, eerie green phosphorescent sea, anime horror art',
  '大海の魔神':  'colossal sea dragon deity rising from dark ocean depths with lightning and tentacles, epic anime fantasy',
};

function strHash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33 ^ s.charCodeAt(i)) & 0x7fffffff;
  return h % 90000 + 10000;
}

function loadEnemyScene(enemy) {
  const img     = document.getElementById('voySceneImg');
  const loading = document.getElementById('voySceneLoading');
  const label   = document.getElementById('voySceneLabel');

  img.classList.remove('loaded');
  img.src = '';
  loading.style.display = 'flex';
  label.textContent = '';

  const prompt = ENEMY_IMG_PROMPTS[enemy.name] || 'epic sea battle pirate ship ocean storm anime art';
  const seed   = strHash(enemy.name);
  const url    = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=640&height=360&seed=${seed}`;

  console.log('[Scene] loading:', url);

  img.onload = () => {
    console.log('[Scene] loaded OK');
    loading.style.display = 'none';
    img.classList.add('loaded');
    label.textContent = `第${VG.round}海域 — ${enemy.name}`;
  };
  img.onerror = (e) => {
    console.error('[Scene] load failed:', e);
    loading.style.display = 'none';
    label.textContent = `第${VG.round}海域 — ${enemy.name}`;
  };
  img.src = url;
}

const VOYAGE_ENEMIES = [
  { name: '小型海賊船',   icon: '🚤', hp: 65,  atk: 10, gold: 45,  spec: null },
  { name: 'スループ船',   icon: '⛵', hp: 82,  atk: 13, gold: 60,  spec: null,        canGuard: true },
  { name: 'フリゲート',   icon: '🛥️', hp: 115, atk: 17, gold: 80,  spec: 'charge',    canGuard: true },
  { name: '蒸気砲艦',     icon: '🚢', hp: 145, atk: 22, gold: 100, spec: 'charge',    canBerserk: true },
  { name: '黒ひげ船長',   icon: '🏴‍☠️', hp: 220, atk: 27, gold: 150, spec: 'broadside', canBerserk: true, isBoss: true },
  { name: '海賊旗艦',     icon: '⚓', hp: 175, atk: 25, gold: 115, spec: 'charge',    canGuard: true, canBerserk: true },
  { name: '深海要塞艦',   icon: '🗡️', hp: 215, atk: 29, gold: 140, spec: 'broadside', canGuard: true, canBerserk: true },
  { name: '嵐の艦隊長',   icon: '🌊', hp: 260, atk: 33, gold: 165, spec: 'broadside', canTaunt: true },
  { name: '死神の船',     icon: '💀', hp: 300, atk: 38, gold: 200, spec: 'broadside', canTaunt: true, canBerserk: true },
  { name: '大海の魔神',   icon: '🐉', hp: 440, atk: 45, gold: 380, spec: 'kraken',    canBerserk: true, canTaunt: true, isBoss: true, isFinal: true },
];

const VOYAGE_EVENTS = [
  { id: 'storm',       icon: '🌊', title: '嵐遭遇！',       desc: '激しい嵐に飲み込まれた… HPが15%減少した。',                    effect: 'hp_minus' },
  { id: 'loot',        icon: '🏴‍☠️', title: '略奪成功！',    desc: '近くの商船から財宝を奪取した！ +65G',                          effect: 'gold_65' },
  { id: 'treasure',    icon: '🗺️', title: '秘宝発見！',    desc: '無人島で古い宝箱を発見した！ +100G',                           effect: 'gold_100' },
  { id: 'medic',       icon: '🩺', title: '軍医に遭遇',     desc: '腕利きの軍医に出会い、完全回復した！',                          effect: 'hp_full' },
  { id: 'wreck',       icon: '⚓', title: '廃船を発見',     desc: '廃船から部品を回収した。ランダムアップグレード！',               effect: 'free_up' },
  { id: 'fog',         icon: '🌫️', title: '濃霧の奇襲！',   desc: '視界不良で海賊に奇襲された…！ HPが20%減少した。',             effect: 'hp_20' },
  { id: 'shrine',      icon: '🏛️', title: '海神の祠を発見！', desc: '海神の加護を授かった。次の戦闘で最初の攻撃が2倍ダメージになる！', effect: 'first_strike' },
  { id: 'cargo',       icon: '📦', title: '漂流した積み荷！', desc: '漂流していた貨物船の積み荷を全て回収した！ +150G',             effect: 'gold_150' },
];

const VOYAGE_UPGRADES = [
  { id: 'hull',   icon: '🏗️', name: '船体強化',   costs: [50, 100, 165, 250], maxHp: 30, def: 1,  atk: 0, spd: 0 },
  { id: 'cannon', icon: '💥', name: '砲撃強化',   costs: [60, 120, 195, 290], maxHp: 0,  def: 0,  atk: 9, spd: 0 },
  { id: 'sail',   icon: '⛵', name: '帆の強化',   costs: [50, 105, 175, 255], maxHp: 0,  def: 0,  atk: 0, spd: 4 },
  { id: 'crew',   icon: '👥', name: 'クルー雇用', costs: [60, 125, 200, 310], maxHp: 0,  def: 0,  atk: 3, spd: 0 },
];

const VG = {
  phase: 'intro',
  ship: { hp: 100, maxHp: 100, atk: 15, def: 2, spd: 10, crew: 2 },
  upgrades: { hull: 0, cannon: 0, sail: 0, crew: 0 },
  gold: 0, score: 0, round: 1,
  enemy: null, enemyCharging: false,
  broadsideCd: 0, dodgeCd: 0, repairCd: 0,
  defending: false, dodging: false,
  animating: false, _pendingEvent: null,
  rage: 0, firstStrike: false, fireAmmo: false,
};

function startVoyage() {
  VG.phase    = 'intro';
  VG.ship     = { hp: 100, maxHp: 100, atk: 15, def: 2, spd: 10, crew: 2 };
  VG.upgrades = { hull: 0, cannon: 0, sail: 0, crew: 0 };
  VG.gold = 0; VG.score = 0; VG.round = 1;
  VG.rage = 0; VG.firstStrike = false; VG.fireAmmo = false;
  resetVGBattle();
  showScreen('voyage');
  voySetPhase('intro');
  renderVoyIntro();
}

function resetVGBattle() {
  VG.enemy = null; VG.enemyCharging = false;
  VG.broadsideCd = 0; VG.dodgeCd = 0; VG.repairCd = 0;
  VG.defending = false; VG.dodging = false; VG.animating = false;
}

function exitVoyage() { showTitle(); }

function voySetPhase(id) {
  ['intro','battle','shop','event','result','help'].forEach(p => {
    const el = document.getElementById('voy-' + p);
    if (el) el.classList.toggle('active', p === id);
  });
  VG.phase = id;
}

/* ── Intro ── */
function renderVoyIntro() {
  voySetPhase('intro');
  const s = VG.ship;
  const hpPct = (s.hp / s.maxHp * 100).toFixed(0);
  document.getElementById('voyShipStatus').innerHTML = `
    <div class="voy-status-card">
      <div class="voy-stat">
        <span class="voy-stat-icon">❤️</span><span class="voy-stat-lbl">HP</span>
        <div class="voy-stat-bar"><div class="voy-stat-fill" style="width:${hpPct}%;background:linear-gradient(90deg,#c04030,#ff6848)"></div></div>
        <span class="voy-stat-val">${s.hp}/${s.maxHp}</span>
      </div>
      <div class="voy-stat"><span class="voy-stat-icon">💥</span><span class="voy-stat-lbl">攻撃</span><span class="voy-stat-val">${s.atk}</span></div>
      <div class="voy-stat"><span class="voy-stat-icon">🛡️</span><span class="voy-stat-lbl">防御</span><span class="voy-stat-val">${s.def}</span></div>
      <div class="voy-stat"><span class="voy-stat-icon">💨</span><span class="voy-stat-lbl">速度</span><span class="voy-stat-val">${s.spd}</span></div>
      <div class="voy-stat"><span class="voy-stat-icon">👥</span><span class="voy-stat-lbl">クルー</span><span class="voy-stat-val">${s.crew}人</span></div>
      <div class="voy-stat"><span class="voy-stat-icon">💰</span><span class="voy-stat-lbl">所持金</span><span class="voy-stat-val">${VG.gold}G</span></div>
    </div>`;

  document.getElementById('voyRouteMap').innerHTML = VOYAGE_ENEMIES.map((e, i) => {
    const rn = i + 1;
    let cls = 'voy-route-dot' + (e.isBoss ? ' boss-dot' : '');
    if (rn < VG.round)      cls += ' done';
    else if (rn === VG.round) cls += ' current';
    const label = rn < VG.round ? '✓' : e.isFinal ? '🐉' : e.isBoss ? '☠️' : String(rn);
    return `<div class="${cls}">${label}</div>`;
  }).join('<span style="font-size:8px;color:#3a2810">›</span>');

  document.getElementById('voyStartBtn').textContent =
    VG.round === 1 ? '⚓ 出航！' : `⚓ 第${VG.round}海域へ`;
}

/* ── Battle ── */
function voyStartBattle() {
  resetVGBattle();
  const ei  = Math.min(VG.round - 1, VOYAGE_ENEMIES.length - 1);
  const def = VOYAGE_ENEMIES[ei];
  VG.enemy  = { ...def, curHp: def.hp, guarding: false, berserk: false, taunting: false };
  voySetPhase('battle');
  document.getElementById('voyLog').innerHTML = '';
  updateRageBar();
  updateBattleArena();
  loadEnemyScene(VG.enemy);
  addVoyLog(`— 第${VG.round}海域 — ${VG.enemy.name}が現れた！`, 'log-evt');
  renderVoyActions();
}

function updateBattleArena() {
  const e = VG.enemy, s = VG.ship;
  document.getElementById('voyEnemyIcon').textContent = e.icon;
  document.getElementById('voyEnemyName').textContent = e.name;
  const rb = document.getElementById('voyRoundBadge');
  rb.textContent = e.isBoss ? `⚠️ BOSS — ROUND ${VG.round}` : `ROUND ${VG.round} / 10`;
  rb.classList.toggle('boss-badge', !!e.isBoss);
  updateVoyHP();
  document.getElementById('voyGoldHud').textContent = '💰 ' + VG.gold + 'G';
}

function updateRageBar() {
  const bar   = document.getElementById('voyRageBar');
  const label = document.getElementById('voyRageLabel');
  if (!bar || !label) return;
  bar.style.width = VG.rage + '%';
  label.textContent = VG.rage >= 100 ? '💢 怒り MAX！' : `怒り ${VG.rage}%`;
  label.style.color = VG.rage >= 100 ? '#ff2040' : '#6a2030';
}

function updateVoyHP() {
  const e = VG.enemy, s = VG.ship;
  const ePct = Math.max(0, e.curHp / e.hp * 100);
  const pPct = Math.max(0, s.hp / s.maxHp * 100);
  const eb   = document.getElementById('voyEnemyHpBar');
  const pb   = document.getElementById('voyPlayerHpBar');
  eb.style.width = ePct + '%';
  pb.style.width = pPct + '%';
  pb.classList.toggle('voy-hp-bar-low', pPct < 25);
  document.getElementById('voyEnemyHpNum').textContent  = `${Math.max(0,e.curHp)}/${e.hp}`;
  document.getElementById('voyPlayerHpNum').textContent = `${s.hp}/${s.maxHp}`;
}

function addVoyLog(msg, cls) {
  const log = document.getElementById('voyLog');
  const div = document.createElement('div');
  div.className = 'voy-log-entry' + (cls ? ' ' + cls : '');
  div.textContent = msg;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
  if (log.children.length > 45) log.removeChild(log.firstChild);
}

function renderVoyActions() {
  updateEnemyAlert();
  const canBroadside = VG.upgrades.cannon >= 1;
  const canRepair    = VG.upgrades.crew   >= 1;
  const canDodge     = VG.upgrades.sail   >= 1;
  const dis          = VG.animating;

  const fireLabel = VG.fireAmmo ? '🔥 火炎弾 装填中！' : '砲撃';
  const firstLabel = VG.firstStrike ? '⚔️ 砲撃✨加護' : '⚔️ ' + fireLabel;
  const defs = [
    { id:'attack',    icon:'',    label: firstLabel,  cd:0,              lock:false,         full:false, hi:true,  extra: VG.fireAmmo ? 'act-fire' : '' },
    { id:'defend',    icon:'🛡️', label:'防御陣形',   cd:0,              lock:false,         full:false, hi:false, extra:'' },
    { id:'broadside', icon:'💣', label:'一斉砲撃',   cd:VG.broadsideCd, lock:!canBroadside, full:false, hi:false, extra:'' },
    { id:'repair',    icon:'🩹', label:'応急修理',   cd:VG.repairCd,    lock:!canRepair,    full:false, hi:false, extra:'' },
    { id:'dodge',     icon:'⚡', label:'高速機動',   cd:VG.dodgeCd,     lock:!canDodge,     full:true,  hi:false, extra:'' },
  ];
  if (VG.rage >= 100) {
    defs.push({ id:'rageBlast', icon:'💢', label:'怒涛の砲撃！！', cd:0, lock:false, full:true, hi:false, extra:'act-rage' });
  }

  const hint = document.getElementById('voyActionHint');
  if (hint) hint.style.opacity = dis ? '0' : '1';

  const cont = document.getElementById('voyActions');
  cont.innerHTML = '';
  defs.forEach(d => {
    const btn = document.createElement('button');
    btn.className = 'voy-act' + (d.full ? ' act-full' : '') + (d.hi ? ' act-hi' : '') + (d.extra ? ' ' + d.extra : '');
    btn.disabled  = dis || d.lock || d.cd > 0;
    const note = d.lock ? '<span class="act-cd">🔒 要強化</span>'
               : d.cd > 0 ? `<span class="act-cd">冷却 ${d.cd}T</span>` : '';
    btn.innerHTML = `${d.icon} ${d.label}${note}`;
    btn.addEventListener('click', () => playerVoyAction(d.id));
    cont.appendChild(btn);
  });

  const cds = [];
  if (VG.broadsideCd > 0) cds.push(`💣${VG.broadsideCd}T`);
  if (VG.repairCd    > 0) cds.push(`🩹${VG.repairCd}T`);
  if (VG.dodgeCd     > 0) cds.push(`⚡${VG.dodgeCd}T`);
  document.getElementById('voyCdRow').textContent = cds.join('  ');
}

function pDmg(mult, forceCrit) {
  const lowHpBonus = VG.ship.hp < VG.ship.maxHp * 0.25 ? 1.3 : 1.0;
  const base = Math.max(1, Math.floor(VG.ship.atk * mult * lowHpBonus * (0.85 + Math.random() * 0.3)));
  const isCrit = forceCrit || Math.random() < 0.15;
  return { dmg: isCrit ? Math.floor(base * 1.6) : base, isCrit };
}

/* ── Player turn ── */
function playerVoyAction(id) {
  if (VG.animating) return;
  VG.animating = true;
  VG.defending = false;
  VG.dodging   = false;
  if (VG.broadsideCd > 0) VG.broadsideCd--;
  if (VG.repairCd    > 0) VG.repairCd--;
  if (VG.dodgeCd     > 0) VG.dodgeCd--;
  renderVoyActions();

  let msg, cls = 'log-atk';
  switch (id) {
    case 'attack': {
      const useFire = VG.fireAmmo;
      const useFirst = VG.firstStrike;
      VG.fireAmmo = false;
      VG.firstStrike = false;
      const { dmg: rawD, isCrit } = pDmg(useFirst ? 2.0 : 1.0, useFire);
      let d = rawD;
      if (VG.enemy.guarding) {
        d = Math.max(1, Math.floor(d * 0.5));
        VG.enemy.curHp -= d;
        msg = `⚔️ 砲撃！ 🛡️敵が防御中！ ${VG.enemy.name}に ${d} ダメージ（半減）`;
        cls = isCrit ? 'log-crit' : 'log-atk';
      } else {
        VG.enemy.curHp -= d;
        const prefix = useFire ? '🔥 火炎弾！ ' : useFirst ? '✨ 海神の加護！ ' : '⚔️ 砲撃！ ';
        msg = `${prefix}${VG.enemy.name}に ${d} ダメージ${isCrit ? ' 🎯CRITICAL！！' : ''}`;
        cls = isCrit ? 'log-crit' : 'log-atk';
      }
      VG.rage = Math.min(100, VG.rage + 5);
      updateRageBar();
      break;
    }
    case 'defend': {
      VG.defending = true;
      const tauntWarn = VG.enemy.taunting ? ' ⚠️挑発中！効果半減' : '';
      msg = `🛡️ 防御陣形！ 次の攻撃ダメージを大幅軽減${tauntWarn}`;
      cls = 'log-evade';
      break;
    }
    case 'broadside': {
      VG.firstStrike = false;
      if (VG.enemy.guarding) {
        VG.enemy.guarding = false;
        const { dmg: d, isCrit } = pDmg(2.5);
        VG.enemy.curHp -= d;
        msg = `💣 一斉砲撃！！ 🛡️防御を貫通！ ${VG.enemy.name}に 💥${d} 大ダメージ${isCrit ? ' 🎯CRITICAL！！' : ''}！`;
      } else {
        const { dmg: d, isCrit } = pDmg(2.5);
        VG.enemy.curHp -= d;
        msg = `💣 一斉砲撃！！ ${VG.enemy.name}に 💥${d} 大ダメージ${isCrit ? ' 🎯CRITICAL！！' : ''}！`;
      }
      VG.broadsideCd = 3;
      cls = 'log-spec';
      VG.rage = Math.min(100, VG.rage + 8);
      updateRageBar();
      break;
    }
    case 'repair': {
      const h = Math.floor(VG.ship.maxHp * (0.22 + VG.upgrades.crew * 0.05));
      VG.ship.hp  = Math.min(VG.ship.maxHp, VG.ship.hp + h);
      VG.repairCd = 4;
      msg = `🩹 応急修理！ HP +${h} 回復！`;
      cls = 'log-heal';
      break;
    }
    case 'dodge': {
      VG.dodging = true;
      VG.dodgeCd = Math.max(1, 4 - Math.floor((VG.ship.spd - 10) / 4));
      msg = `⚡ 高速機動！ 次の攻撃を回避する！（冷却 ${VG.dodgeCd}T）`;
      cls = 'log-evade';
      break;
    }
    case 'rageBlast': {
      VG.rage = 0;
      updateRageBar();
      const { dmg: d, isCrit } = pDmg(4.0, true);
      VG.enemy.curHp -= d;
      msg = `🔥💢 怒涛の砲撃！！ ${VG.enemy.name}に 💥${d} 超大ダメージ${isCrit ? ' 🎯CRITICAL！！' : ''}！！`;
      cls = 'log-crit';
      break;
    }
  }
  addVoyLog(msg, cls);
  updateVoyHP();

  // Shake enemy icon on hit
  if (id === 'attack' || id === 'broadside') {
    const ei = document.getElementById('voyEnemyIcon');
    ei.classList.add('shake-it');
    setTimeout(() => ei.classList.remove('shake-it'), 400);
  }

  if (VG.enemy.curHp <= 0) {
    VG.enemy.curHp = 0; updateVoyHP();
    setTimeout(onVoyEnemyDefeated, 600);
    return;
  }
  setTimeout(enemyVoyTurn, 720);
}

/* ── Enemy alert helper ── */
function updateEnemyAlert() {
  const e = VG.enemy;
  const el = document.getElementById('voyEnemyAlert');
  if (!e || !el) return;
  if (VG.enemyCharging) { el.textContent = '⚠️ 次ターン特攻！'; return; }
  if (e.berserk)        { el.textContent = '💢 激昂中！'; return; }
  if (e.guarding)       { el.textContent = '🛡️ 防御中 — 砲撃半減・一斉砲撃で貫通'; return; }
  if (e.taunting)       { el.textContent = '😤 挑発中！ — 防御すると反撃を受ける'; return; }
  el.textContent = '';
}

/* ── Enemy turn ── */
function enemyVoyTurn() {
  const e = VG.enemy;
  const wasCharging = VG.enemyCharging;
  const wasTaunting = e.taunting;
  VG.enemyCharging = false;
  e.taunting  = false;
  e.guarding  = false;  // guard expires each enemy turn

  const roll = Math.random();
  let dmgMult = 1.0, msg = '', cls = 'log-dmg';

  // ── Berserk trigger (once, takes the turn as announcement) ──
  if (e.canBerserk && !e.berserk && e.curHp < e.hp * 0.4) {
    e.berserk = true;
    e.atk = Math.floor(e.atk * 1.3);
    addVoyLog(`💢 ${e.name}が激昂した！！ 攻撃力が上昇！`, 'log-spec');
    updateEnemyAlert();
    VG.animating = false; renderVoyActions(); return;
  }

  // ── Charge wind-up ──
  if (e.spec === 'charge' && !wasCharging && roll < 0.25) {
    VG.enemyCharging = true;
    addVoyLog(`${e.icon} ${e.name}が砲門を構えた…！`, 'log-evt');
    updateEnemyAlert();
    VG.animating = false; renderVoyActions(); return;
  }

  // ── Kraken heal ──
  if (e.spec === 'kraken' && VG.ship.hp < VG.ship.maxHp * 0.4 && roll < 0.28) {
    const h = Math.floor(e.hp * 0.1);
    e.curHp = Math.min(e.hp, e.curHp + h);
    addVoyLog(`🦑 ${e.name}が呪いの波動で体力回復！ +${h}`, 'log-spec');
    updateVoyHP(); updateEnemyAlert();
    VG.animating = false; renderVoyActions(); return;
  }

  // ── Guard stance ──
  if (e.canGuard && roll < 0.20 && e.curHp > e.hp * 0.25) {
    e.guarding = true;
    addVoyLog(`🛡️ ${e.name}が防御陣形！ 砲撃は半減 — 一斉砲撃で貫通せよ！`, 'log-evt');
    updateEnemyAlert();
    VG.animating = false; renderVoyActions(); return;
  }

  // ── Taunt ──
  if (e.canTaunt && roll < 0.18) {
    e.taunting = true;
    addVoyLog(`😤 ${e.name}が挑発した！ 防御すると反撃を受ける！`, 'log-evt');
    updateEnemyAlert();
    VG.animating = false; renderVoyActions(); return;
  }

  // ── Determine attack power ──
  if (wasCharging || (e.spec === 'broadside' && roll < 0.2)) {
    dmgMult = 2.0;
    msg = wasCharging ? `💥 ${e.name}の特攻！！` : `💥 ${e.name}が一斉砲撃！！`;
    cls = 'log-spec';
  } else {
    msg = `${e.icon} ${e.name}の砲撃！`;
  }

  if (VG.dodging) {
    addVoyLog(`⚡ 回避成功！ ${e.name}の攻撃をかわした！`, 'log-evade');
    updateEnemyAlert();
    VG.animating = false; renderVoyActions(); return;
  }

  const raw = Math.floor(e.atk * dmgMult * (0.85 + Math.random() * 0.3));
  let red;
  if (VG.defending && wasTaunting) {
    // Taunt counter: defense nearly nullified
    red = Math.floor(raw * 0.15);
    msg += ' 😤カウンター！防御を崩された！';
    cls = 'log-spec';
  } else if (VG.defending) {
    red = Math.floor(raw * 0.62);
  } else {
    red = Math.min(Math.floor(raw * 0.35), Math.floor(raw * VG.ship.def / (VG.ship.def + 18)));
  }
  const dmg = Math.max(1, raw - red);
  VG.ship.hp = Math.max(0, VG.ship.hp - dmg);
  // Fill rage on damage received
  VG.rage = Math.min(100, VG.rage + Math.max(8, Math.floor(dmg * 0.55)));
  updateRageBar();
  addVoyLog(`${msg} ${dmg} ダメージ！` + (VG.defending && !wasTaunting ? ` (防御-${red})` : ''), cls);
  updateVoyHP();

  const scr = document.getElementById('screen-voyage');
  scr.classList.add('shaking');
  const pi = document.getElementById('voyPlayerIcon');
  pi.classList.add('shake-it');
  setTimeout(() => { scr.classList.remove('shaking'); pi.classList.remove('shake-it'); }, 450);

  if (VG.ship.hp <= 0) { setTimeout(onVoyPlayerDead, 700); return; }
  updateEnemyAlert();
  VG.animating = false;
  renderVoyActions();
}

/* ── Battle outcomes ── */
function onVoyEnemyDefeated() {
  VG.gold += VG.enemy.gold;
  addVoyLog(`🏆 ${VG.enemy.name}を撃沈！ +${VG.enemy.gold}G`, 'log-spec');
  document.getElementById('voyGoldHud').textContent = '💰 ' + VG.gold + 'G';
  if (VG.enemy.isFinal) { setTimeout(voyVictory, 800); return; }
  const doEvent = !VG.enemy.isBoss && Math.random() < 0.32;
  setTimeout(doEvent ? triggerVoyEvent : voyShowShop, 650);
}

function onVoyPlayerDead() {
  addVoyLog(`💀 鉄嵐丸が沈没…`, 'log-spec');
  setTimeout(voyGameOver, 800);
}

/* ── Shop ── */
function voyShowShop() {
  voySetPhase('shop');
  const s = VG.ship;
  const statusEl = document.getElementById('voyShopStatus');
  if (statusEl) {
    statusEl.innerHTML =
      `<span class="voy-shop-stat gold">💰 ${VG.gold}G</span>` +
      `<span class="voy-shop-stat">❤️ ${s.hp}/${s.maxHp}</span>` +
      `<span class="voy-shop-stat">⚔️ ${s.atk}</span>` +
      `<span class="voy-shop-stat">🛡️ ${s.def}</span>` +
      `<span class="voy-shop-stat">⚡ ${s.spd}</span>` +
      `<span class="voy-shop-stat">👥 ${s.crew}</span>`;
  }
  const cont = document.getElementById('voyShopGrid');
  cont.innerHTML = '';

  // Heal
  const hcost = 35;
  const hcard = makeVoyShopCard('💊', '応急補給', `HP全回復 (現在${VG.ship.hp}/${VG.ship.maxHp})`, hcost + 'G', VG.gold < hcost, false, 0);
  hcard.addEventListener('click', () => {
    if (VG.gold < hcost) return;
    VG.gold -= hcost; VG.ship.hp = VG.ship.maxHp;
    addVoyLog('💊 HP全回復！', 'log-heal'); voyShowShop();
  });
  cont.appendChild(hcard);

  // Fire ammo
  const fcost = 60;
  const fAlready = VG.fireAmmo;
  const fcard = makeVoyShopCard('🔥', '火炎弾' + (fAlready ? ' 装填済' : ''), '次の砲撃を必ずクリティカル＆2.5倍ダメージにする！', fAlready ? '— 装填済 —' : fcost + 'G', VG.gold < fcost || fAlready, fAlready, 0);
  if (!fAlready) {
    fcard.addEventListener('click', () => {
      if (VG.gold < fcost || VG.fireAmmo) return;
      VG.gold -= fcost; VG.fireAmmo = true;
      addVoyLog('🔥 火炎弾装填！ 次の砲撃が炎上クリティカルになる！', 'log-spec'); voyShowShop();
    });
  }
  cont.appendChild(fcard);

  VOYAGE_UPGRADES.forEach(u => {
    const lv   = VG.upgrades[u.id];
    const maxLv = u.costs.length;
    const isMax = lv >= maxLv;
    const cost  = isMax ? 0 : u.costs[lv];
    const descLine = u.atk   ? `攻撃力+${u.atk} (合計+${(lv+1)*u.atk})` + (lv === 0 ? '　🔓一斉砲撃解放' : '')
                   : u.spd   ? `速度+${u.spd} (合計+${(lv+1)*u.spd})` + (lv === 0 ? '　🔓高速機動解放' : '')
                   : u.id === 'hull' ? `最大HP+${u.maxHp}, 防御+${u.def}` + (lv === 0 ? '' : ` (合計+${(lv+1)*u.maxHp}HP)`)
                   : `ATK+3, クルー+1 (合計${lv+3}人)` + (lv === 0 ? '　🔓応急修理解放' : '');
    const card = makeVoyShopCard(u.icon, u.name + (isMax ? ' MAX' : ` Lv${lv+1}`), descLine, isMax ? '— MAX —' : cost + 'G', VG.gold < cost || isMax, isMax, lv);
    if (!isMax) {
      card.addEventListener('click', () => {
        if (VG.gold < cost) return;
        VG.gold -= cost; VG.upgrades[u.id]++;
        applyVoyUpgrade(u); voyShowShop();
      });
    }
    cont.appendChild(card);
  });
}

function makeVoyShopCard(icon, title, desc, costStr, disabled, maxed, lv) {
  const card = document.createElement('button');
  card.className = 'voy-shop-card' + (maxed ? ' voy-maxed' : '');
  card.disabled  = disabled;
  const dots = Array.from({length:4}, (_,i) =>
    `<div class="voy-tier-dot${i < lv ? ' voy-td-on' : ''}"></div>`).join('');
  card.innerHTML = `<div class="voy-tier-row">${dots}</div>
    <span class="voy-shop-icon">${icon}</span>
    <div class="voy-shop-title">${title}</div>
    <div class="voy-shop-desc">${desc}</div>
    <div class="voy-shop-cost">${costStr}</div>`;
  return card;
}

function applyVoyUpgrade(u) {
  const s = VG.ship;
  if (u.maxHp) { s.maxHp += u.maxHp; s.hp = Math.min(s.maxHp, s.hp + Math.floor(u.maxHp / 2)); }
  if (u.def)   s.def += u.def;
  if (u.atk)   s.atk += u.atk;
  if (u.spd)   s.spd += u.spd;
  if (u.id === 'crew') s.crew++;
}

function voyNextRound() {
  VG.round++;
  renderVoyIntro();
}

/* ── Events ── */
function triggerVoyEvent() {
  const ev = VOYAGE_EVENTS[Math.floor(Math.random() * VOYAGE_EVENTS.length)];
  document.getElementById('voyEventIcon').textContent  = ev.icon;
  document.getElementById('voyEventTitle').textContent = ev.title;
  document.getElementById('voyEventDesc').textContent  = ev.desc;
  VG._pendingEvent = ev;
  voySetPhase('event');
}

function voyAfterEvent() {
  const ev = VG._pendingEvent;
  if (ev) {
    switch (ev.effect) {
      case 'hp_minus':     VG.ship.hp = Math.max(1, Math.floor(VG.ship.hp * 0.85)); break;
      case 'gold_65':      VG.gold += 65;  break;
      case 'gold_100':     VG.gold += 100; break;
      case 'hp_full':      VG.ship.hp = VG.ship.maxHp; break;
      case 'hp_20':        VG.ship.hp = Math.max(1, Math.floor(VG.ship.hp * 0.80)); break;
      case 'first_strike': VG.firstStrike = true; break;
      case 'gold_150':     VG.gold += 150; break;
      case 'free_up': {
        const eligible = VOYAGE_UPGRADES.filter(u => VG.upgrades[u.id] < u.costs.length);
        if (eligible.length) {
          const u = eligible[Math.floor(Math.random() * eligible.length)];
          VG.upgrades[u.id]++;
          applyVoyUpgrade(u);
        } else { VG.gold += 90; }
        break;
      }
    }
  }
  VG._pendingEvent = null;
  voyShowShop();
}

/* ── End states ── */
function voyVictory() {
  const hpBonus = VG.ship.hp * 3, rBonus = VG.round * 15;
  VG.score = VG.gold + hpBonus + rBonus;
  saveHSList('voyage', { score: VG.score, round: VG.round, date: new Date().toLocaleDateString('ja-JP') });
  const prev = parseInt(localStorage.getItem('voyageBest') || '0');
  const isHS = VG.score > prev;
  if (isHS) localStorage.setItem('voyageBest', VG.score);
  document.getElementById('voyResultIcon').textContent  = '🏆';
  document.getElementById('voyResultTitle').textContent = '大海の覇者！';
  document.getElementById('voyResultScore').textContent = VG.score;
  document.getElementById('voyResultNote').textContent  = isHS ? '🏆 ベスト更新！' : '見事な航海！';
  document.getElementById('voyResultStats').innerHTML =
    `所持金 ${VG.gold}G　HP残量ボーナス +${hpBonus}　全制覇ボーナス +${rBonus}<br>` +
    `船体Lv${VG.upgrades.hull} / 砲台Lv${VG.upgrades.cannon} / 帆Lv${VG.upgrades.sail} / クルーLv${VG.upgrades.crew}`;
  voySetPhase('result');
}

function voyGameOver() {
  VG.score = VG.gold + (VG.round - 1) * 12;
  saveHSList('voyage', { score: VG.score, round: VG.round, date: new Date().toLocaleDateString('ja-JP') });
  const prev = parseInt(localStorage.getItem('voyageBest') || '0');
  const isHS = VG.score > prev;
  if (isHS) localStorage.setItem('voyageBest', VG.score);
  document.getElementById('voyResultIcon').textContent  = '💀';
  document.getElementById('voyResultTitle').textContent = '沈没…';
  document.getElementById('voyResultScore').textContent = VG.score;
  document.getElementById('voyResultNote').textContent  = isHS ? '🏆 ベスト更新！' : `第${VG.round}海域で力尽きた…`;
  document.getElementById('voyResultStats').innerHTML =
    `所持金 ${VG.gold}G　突破ラウンド ${VG.round}/10<br>` +
    `船体Lv${VG.upgrades.hull} / 砲台Lv${VG.upgrades.cannon} / 帆Lv${VG.upgrades.sail} / クルーLv${VG.upgrades.crew}`;
  voySetPhase('result');
}

/* ══════════════════════════════════════════
   CANNON GAME — Three.js ocean background
══════════════════════════════════════════ */
let _canThree = null;

function initCannonOcean(W, H) {
  if (typeof THREE === 'undefined') return;
  const tc = document.getElementById('cannonThreeCanvas');
  if (!tc) return;
  if (_canThree) { _canThree.renderer.dispose(); _canThree = null; }

  // Position below the cannon header (header height = innerHeight - canvas H)
  const headerH = Math.max(0, window.innerHeight - H);
  tc.style.top    = headerH + 'px';
  tc.style.left   = '0';
  tc.style.width  = W + 'px';
  tc.style.height = H + 'px';
  tc.style.display = 'block';

  const renderer = new THREE.WebGLRenderer({ canvas: tc, antialias: false });
  renderer.setSize(W, H, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x00060e);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000a1c, 0.016);

  // Low-angle side view across open sea
  const camera = new THREE.PerspectiveCamera(52, W / H, 0.1, 300);
  camera.position.set(0, 6, 34);
  camera.lookAt(0, -3, -22);

  // ── Ocean geometry & shader ──
  const geo = new THREE.PlaneGeometry(300, 220, 90, 60);
  geo.rotateX(-Math.PI / 2);

  const uniforms = {
    uTime:    { value: 0.0 },
    uDeep:    { value: new THREE.Color(0x000e1e) },
    uMid:     { value: new THREE.Color(0x001534) },
    uShallow: { value: new THREE.Color(0x002248) },
    uMoonDir: { value: new THREE.Vector3(-0.45, 0.72, -0.53).normalize() },
    uMoonCol: { value: new THREE.Color(0x7a9fc0) },
    uCamPos:  { value: camera.position },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */`
      uniform float uTime;
      varying float vHeight;
      varying vec3  vWorldPos;
      varying vec3  vNorm;
      float wave(float x,float z,float fr,float am,float sp,float ph){
        return sin(x*fr+z*fr*0.55+uTime*sp+ph)*am;
      }
      void main(){
        vec3 pos=position;
        float x=pos.x*0.048,z=pos.z*0.048;
        float h=wave(x,z,2.1,1.15,0.78,0.0)
               +wave(x,z,1.6,0.82,0.62,1.57)
               +wave(x,z,3.3,0.46,1.15,0.88)
               +wave(x,z,5.0,0.26,1.45,2.12)
               +wave(x,z,7.5,0.14,1.75,3.40);
        pos.y=h; vHeight=h; vWorldPos=pos;
        float eps=0.8;
        float hx=wave(x+eps*0.048,z,2.1,1.15,0.78,0.0)+wave(x+eps*0.048,z,1.6,0.82,0.62,1.57)
                +wave(x+eps*0.048,z,3.3,0.46,1.15,0.88)+wave(x+eps*0.048,z,5.0,0.26,1.45,2.12)
                +wave(x+eps*0.048,z,7.5,0.14,1.75,3.40);
        float hz=wave(x,z+eps*0.048,2.1,1.15,0.78,0.0)+wave(x,z+eps*0.048,1.6,0.82,0.62,1.57)
                +wave(x,z+eps*0.048,3.3,0.46,1.15,0.88)+wave(x,z+eps*0.048,5.0,0.26,1.45,2.12)
                +wave(x,z+eps*0.048,7.5,0.14,1.75,3.40);
        vNorm=normalize(vec3(-(hx-h)/eps,1.0,-(hz-h)/eps));
        gl_Position=projectionMatrix*modelViewMatrix*vec4(pos,1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 uDeep,uMid,uShallow,uMoonDir,uMoonCol,uCamPos;
      varying float vHeight;
      varying vec3 vWorldPos,vNorm;
      void main(){
        float dist=length(vWorldPos-uCamPos);
        float d=clamp(dist/95.0,0.0,1.0);
        vec3 base=mix(uShallow,mix(uMid,uDeep,d*0.78),d);
        vec3 V=normalize(uCamPos-vWorldPos);
        vec3 H=normalize(uMoonDir+V);
        float spec=pow(max(dot(vNorm,H),0.0),82.0);
        float spec2=pow(max(dot(vNorm,H),0.0),5.5);
        base+=uMoonCol*(spec*0.88+spec2*0.11);
        float foam=smoothstep(1.5,2.8,vHeight);
        base=mix(base,vec3(0.42,0.60,0.86),foam*0.36);
        float sx=abs(vWorldPos.x-12.0)/30.0;
        base+=uMoonCol*exp(-sx*sx*1.6)*0.09;
        gl_FragColor=vec4(base,1.0);
      }
    `,
  });

  const ocean = new THREE.Mesh(geo, mat);
  ocean.position.set(0, 0, -28);
  scene.add(ocean);

  // Sky dome
  const skyGeo = new THREE.SphereGeometry(260, 16, 8);
  skyGeo.scale(-1, 1, -1);
  scene.add(new THREE.Mesh(skyGeo, new THREE.ShaderMaterial({
    side: THREE.BackSide, uniforms: {},
    vertexShader: `varying float vY; void main(){vY=position.y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `varying float vY; void main(){float t=clamp(vY/260.0,0.0,1.0);gl_FragColor=vec4(mix(vec3(0.004,0.050,0.122),vec3(0.002,0.022,0.050),t),1.0);}`,
  })));

  // Foam particles
  const fCnt = 700;
  const fPos = new Float32Array(fCnt * 3), fPh = new Float32Array(fCnt);
  for (let i = 0; i < fCnt; i++) {
    fPos[i*3]   = (Math.random() - 0.5) * 280;
    fPos[i*3+1] = Math.random() * 0.8;
    fPos[i*3+2] = (Math.random() - 0.5) * 200 - 28;
    fPh[i] = Math.random() * Math.PI * 2;
  }
  const foamGeo = new THREE.BufferGeometry();
  foamGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3));
  foamGeo.setAttribute('aPhase',   new THREE.BufferAttribute(fPh,  1));
  const foamMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `attribute float aPhase;uniform float uTime;varying float vA;
      void main(){vA=0.5+0.5*sin(uTime*1.4+aPhase);
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_PointSize=1.8+vA*1.6;}`,
    fragmentShader: `varying float vA;
      void main(){float d=length(gl_PointCoord-vec2(0.5));if(d>0.5)discard;gl_FragColor=vec4(0.5,0.7,0.9,vA*0.22);}`,
    transparent: true, depthWrite: false,
  });
  scene.add(new THREE.Points(foamGeo, foamMat));

  _canThree = { renderer, scene, camera, mat, foamMat };
}

function renderCannonOcean() {
  if (!_canThree) return;
  const t = Date.now() * 0.001;
  _canThree.mat.uniforms.uTime.value = t;
  _canThree.foamMat.uniforms.uTime.value = t;
  _canThree.renderer.render(_canThree.scene, _canThree.camera);
}

function disposeCannonOcean() {
  if (!_canThree) return;
  _canThree.renderer.dispose();
  const tc = document.getElementById('cannonThreeCanvas');
  if (tc) tc.style.display = 'none';
  _canThree = null;
}

/* ── init ── */
showTitle();
