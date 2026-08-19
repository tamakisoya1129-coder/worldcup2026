# 3Dグラフィック導入案リサーチ（2026-06-12）

現プロジェクト条件：GitHub Pages（静的ホスティング）、単一HTMLファイル構成、pirate海戦ゲーム

---

## 無料オプション

### 1. Three.js ⭐ 最推奨（入門）
- **ライセンス**: MIT（完全無料・商用可）
- **導入方法**: CDN1行 `<script src="https://cdn.jsdelivr.net/npm/three@latest/build/three.min.js">` または npm
- **バンドルサイズ**: 168KB（軽量）
- **週間DL数**: 500万以上（BabylonJSの300倍）→ チュートリアル・解決済み問題が圧倒的に多い
- **向いてるもの**: 3Dビジュアル・インタラクティブ表現。ゲームエンジン機能は自分で組み立てる
- **物理エンジン**: 別途 Cannon.js / Rapier.js を追加する必要あり
- **現プロジェクトへの適合**: ◎ 既存Canvasコードと共存可能、海・船・爆発エフェクトを3D化しやすい

### 2. Babylon.js ⭐ 最推奨（ゲーム寄り）
- **ライセンス**: Apache 2.0（完全無料・商用可）、Microsoftがバックアップ
- **導入方法**: CDN1行 or npm
- **バンドルサイズ**: 1.4MB（重めだが機能が豊富）
- **特徴**: 物理エンジン・コリジョン・アニメーション・パーティクルが標準搭載。ゲームエンジンとして使える
- **WebGPUサポート**: 先行対応済み（WebGL2 → WebGPU の移行が容易）
- **Babylonplayground**: ブラウザ上で即実験できるサンドボックスあり
- **現プロジェクトへの適合**: ◎ 砲撃戦・海戦の物理演算、水面シェーダーが作りやすい

### 3. PlayCanvas Engine
- **ライセンス**: MIT（エンジン本体は完全無料）
- **特徴**: ゲーム向けに特化したWebGLエンジン。WebGPU対応。gltf/glb モデル読み込みが容易
- **ランタイムサイズ**: 1〜2MB
- **注意**: クラウドエディタ（visual editor）は有料。エンジンをコードで直接使うなら無料
- **現プロジェクトへの適合**: ○ Three.jsやBabylon.jsより情報量は少ないが性能は高い

### 4. Godot 4 → Web Export
- **ライセンス**: MIT（完全無料）
- **特徴**: 完全3Dゲームエンジン。WebAssembly + WebGL2でブラウザに書き出し
- **WebGPU**: Godot 4.6でサポート済み（ただしWeb向けはまだCompatibilityレンダラーのみ推奨）
- **出力ファイルサイズ**: 最小化しても30〜80MB程度（重い）
- **注意**: GitHub Pagesで動かす場合、SharedArrayBufferのヘッダー制限がありCloudflare Pagesなどが必要な場合も
- **現プロジェクトへの適合**: △ 既存HTMLゲームとの統合は難しい。新規ゲームを別途作る場合に向く

### 5. WebGPU（ブラウザネイティブAPI）
- **ライセンス**: ブラウザ標準API、完全無料
- **2026年ブラウザ対応状況**: Chrome/Edge/Safari 18/Firefox 130+で対応、世界シェア約82%
- **特徴**: WebGLの15倍程度の描画性能。コンソール品質のグラフィックがブラウザで動く
- **学習コスト**: ⚠️ 非常に高い（シェーダーをWGSL言語で書く必要あり、Metal/Vulkanレベルの知識が必要）
- **現実的な使い方**: Three.jsやBabylon.jsのバックエンドとして自動的に利用される形が現実的
- **現プロジェクトへの適合**: △ 直接書くのは上級者向け。ライブラリ経由で恩恵を受けるのが現実的

---

## 有料・一部有料オプション

### 6. Unity → WebGL Build
- **料金**: Personalプランは年収$200K未満なら**無料**。Pro: $2,040〜$2,400/年（2026年値）
- **WebGPU**: Unity 7 LTSでデフォルトWebGPU、WebGL2フォールバック
- **ビルドサイズ**: 最小でも8MB（他のウェブ特化エンジンより重い）
- **モバイル**: メモリオーバーヘッドで不安定なケースあり
- **向いてるもの**: すでにUnityを使っている、またはネイティブアプリ兼用で作りたい場合
- **現プロジェクトへの適合**: △ 既存HTMLとの統合が難しい。全面リメイクになる

### 7. PlayCanvas Editor（クラウドエディタ）
- **料金**: 無料プラン（公開プロジェクトのみ）、有料プランで非公開・チーム機能
- **特徴**: ビジュアルエディタでシーンを組み立て → PlayCanvas Engineで動く
- **現プロジェクトへの適合**: ○ ゲームをゼロから作り直すなら有力

### 8. Unreal Engine → WebGPU（非公式ポート）
- **料金**: 収益$1M超で5%ロイヤルティ。それ以下は無料
- **2026年状況**: Epic公式のWeb対応なし。サードパーティポートでUE5がブラウザ動作デモあり
- **現プロジェクトへの適合**: ✗ 個人開発に現実的ではない

---

## 現プロジェクトへの推奨ロードマップ

```
フェーズ1（今すぐ）: Three.js を CDN で試す
  → 海賊船シミュレーターの背景を3D水面に置き換え
  → 学習コストが最も低く、既存コードと共存できる

フェーズ2（慣れたら）: Babylon.js に乗り換え検討
  → 物理エンジン・パーティクル・当たり判定が内蔵
  → 砲撃戦に本物の弾道物理を追加
  → WebGPUバックエンドに自動対応するので将来も安心

フェーズ3（本格化）: Three.js/Babylon.js のままでWebGPUの恩恵を受ける
  → ライブラリ側が自動でWebGPUを使ってくれる
  → 手動でWebGPUコードを書く必要はない
```

---

## Three.js 最小導入例（daiko.htmlに追加する場合）

```html
<script type="importmap">{ "imports": { "three": "https://cdn.skypack.dev/three" } }</script>
<script type="module">
import * as THREE from 'three';

const scene    = new THREE.Scene();
const camera   = new THREE.PerspectiveCamera(75, W/H, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('myCanvas'), alpha: true });

// 海面（PlaneGeometry + ShaderMaterial で波表現）
const geo = new THREE.PlaneGeometry(20, 20, 64, 64);
const mat = new THREE.MeshPhongMaterial({ color: 0x006994, wireframe: false });
const sea = new THREE.Mesh(geo, mat);
scene.add(sea);
</script>
```

---

## コスト比較表

| ライブラリ | 料金 | バンドル | 学習コスト | ゲーム向き | GitHub Pages対応 |
|-----------|------|---------|-----------|-----------|-----------------|
| Three.js | 完全無料 | 168KB | ★★☆ | △（要追加） | ◎ |
| Babylon.js | 完全無料 | 1.4MB | ★★★ | ◎ | ◎ |
| PlayCanvas Engine | 完全無料 | 1〜2MB | ★★★ | ◎ | ◎ |
| Godot Web Export | 完全無料 | 30〜80MB | ★★★★ | ◎ | △ |
| WebGPU直書き | 完全無料 | 0 | ★★★★★ | ◎ | ◎ |
| Unity Personal | 無料（条件あり） | 8MB〜 | ★★★ | ◎ | △ |
