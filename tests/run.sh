#!/bin/bash
# 大航海ゲームの検証スクリプト
#   使い方:  bash tests/run.sh
# ブラウザを使わず、DOM/Canvas をスタブして Node 上でゲーム本体を実走させる。
# サンドボックス環境ではポート待受ができずブラウザ検証が使えないため、これが主な安全網。

cd "$(dirname "$0")/.." || exit 1
fail=0

echo "── 1. 全JSの構文チェック ──"
for f in *.js; do
  printf "  %-24s " "$f"
  if node --check "$f" 2>/dev/null; then
    echo "OK"
  else
    echo "★構文エラー"
    node --check "$f"
    fail=1
  fi
done

echo
echo "── 2. 不正なシェルエスケープの検出 ──"
# 過去に daiko-games.js の `if (\!el)` でファイル全体が死んだ事故がある。
# ここで引っかかったら ! $ ` の前の余分なバックスラッシュを消す。
if grep -n '\\!\|\\\$\|\\`' ./*.js ./*.html 2>/dev/null; then
  echo "  ★上記に不正なエスケープがあります"
  fail=1
else
  echo "  なし OK"
fi

echo
echo "── 3. タイトル画面（読み込み経路） ──"
node tests/title-screen.test.js || fail=1

echo
echo "── 4. 海賊シム本体 ──"
node tests/pirate-sim.test.js || fail=1

echo
echo "── 5. サイトの導線（入口・戻る・リンク切れ） ──"
node tests/site-links.test.js || fail=1

echo
if [ "$fail" -eq 0 ]; then
  echo "════ すべて通りました ════"
else
  echo "════ 失敗あり ════"
fi
echo
echo "難易度バランスの試算は  node tests/balance.js  （2〜3分かかります）"
exit $fail
