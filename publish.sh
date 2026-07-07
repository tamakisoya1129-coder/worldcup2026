#!/bin/bash
cd "$(dirname "$0")"
git add index.html daiko.html daiko.css daiko-games.js daiko-piratesim.js "ワールドカップサイト.html"
git commit -m "Update site"
git push
echo "公開完了: https://tamakisoya1129-coder.github.io/worldcup2026/"
