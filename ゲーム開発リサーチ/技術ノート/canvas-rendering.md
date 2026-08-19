# Canvas 2D レンダリング技術ノート

daiko.html で実際に使っているテクニックと発見をまとめる。

## 描画順序（Z-order）

奥→手前の順に描くことで擬似3D感が出る。

```javascript
// 海賊船シミュレーターの例
// 1. 空（背景）
// 2. 星・月
// 3. 雲
// 4. 水平線
// 5. 遠くの敵（depth小）→ 近くの敵（depth大）
// 6. 波・海面
// 7. 自機（常に最前面）
// 8. エフェクト（爆発・パーティクル）
// 9. HUD
```

## グラデーションのパフォーマンス

`createLinearGradient` / `createRadialGradient` は毎フレーム生成すると重い。
→ フレーム内で1回作って使い回す（変数に入れる）のが基本。

```javascript
// 悪い例（毎フレーム生成）
function draw() {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);  // 毎回
}

// 良い例（位置が変わる場合は仕方ないが、静的なものはキャッシュ）
let skyGrad = null;
function draw() {
  if (!skyGrad) {
    skyGrad = ctx.createLinearGradient(0, 0, 0, H);
    skyGrad.addColorStop(0, '#00060e');
    skyGrad.addColorStop(1, '#001838');
  }
}
```

## 擬似3Dパースペクティブ（psScreenPos）

```javascript
// 水平線 HY、視点 CVP
// depth 0=水平線, 1=手前
function psScreenPos(worldX, depth) {
  const scale = Math.pow(depth, 0.72);  // 指数で奥行き感を強調
  const y = HY + (H - HY) * scale;
  const sx = CVP + (worldX - CVP) * scale;
  return { sx, sy: y, scale };
}
```

## ctx.save() / ctx.restore() の使い方

1つの描画関数内では必ず save/restore をペアにする。
`globalAlpha` 設定忘れは全体を透明にする典型的バグ。

```javascript
function drawShip(ctx) {
  ctx.save();
  // ... 描画処理
  ctx.restore();  // globalAlpha, transform, shadow等がリセットされる
}
```

## よく使うアニメーションパターン

```javascript
// 明滅（ランタン・星）
const flicker = Math.sin(Date.now() * 0.008 + phase) * 0.12 + 0.88;

// ゆっくり漂う（雲・浮遊アイコン）
const drift = Math.sin(Date.now() * 0.0008) * 5;

// 帆のはらみ
const billow = Math.sin(Date.now() * 0.0007) * 3.5;
quadraticCurveTo(cx + billow, midY, ...);
```

## dt正規化ゲームループ

```javascript
function loop(ts) {
  requestAnimationFrame(loop);
  const dt = Math.min((ts - lastTs) / 16.67, 3);  // 60fps基準、最大3倍速
  lastTs = ts;
  update(dt);
  draw();
}
```
