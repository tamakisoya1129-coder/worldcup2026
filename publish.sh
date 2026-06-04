#!/bin/bash
cd "$(dirname "$0")"
cp stats_card.html index.html
git add index.html
git commit -m "Update site"
git push
echo "公開完了: https://tamakisoya1129-coder.github.io/worldcup2026/"
