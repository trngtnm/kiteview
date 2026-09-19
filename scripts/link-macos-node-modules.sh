#!/usr/bin/env bash
# Ensure CocoaPods / Xcode scripts find RN packages under apps/macos/node_modules
# when npm workspaces hoist dependencies to the repo root.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/apps/macos"
mkdir -p "$APP/node_modules" "$APP/node_modules/@react-native"

link_pkg() {
  local name="$1"
  local from="$ROOT/node_modules/$name"
  local to="$APP/node_modules/$name"
  if [[ -e "$from" ]]; then
    mkdir -p "$(dirname "$to")"
    ln -sfn "$from" "$to"
  fi
}

for pkg in react-native react-native-macos react react-native-webview react-native-safe-area-context; do
  link_pkg "$pkg"
done

if [[ -d "$ROOT/node_modules/@react-native" ]]; then
  for pkg in "$ROOT/node_modules/@react-native"/*; do
    [[ -e "$pkg" ]] || continue
    name="$(basename "$pkg")"
    ln -sfn "$pkg" "$APP/node_modules/@react-native/$name"
  done
fi

echo "Linked RN packages into apps/macos/node_modules"
