#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR/src-tauri"
export CI="${CI:-true}"

required_targets=(
  "aarch64-apple-darwin"
  "x86_64-apple-darwin"
)

for target in "${required_targets[@]}"; do
  if ! rustup target list --installed | grep -qx "$target"; then
    echo "Installing Rust target: $target"
    rustup target add "$target"
  fi
done

echo "Building universal macOS bundle..."
cargo tauri build --target universal-apple-darwin --no-sign "$@"

echo
echo "macOS artifacts:"
find "$ROOT_DIR/src-tauri/target/universal-apple-darwin/release/bundle" \
  -maxdepth 2 \
  \( -name "*.app" -o \( -name "*.dmg" ! -name "rw.*" \) \) \
  -print
