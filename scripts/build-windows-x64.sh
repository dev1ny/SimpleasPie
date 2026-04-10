#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR/src-tauri"

if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew is required on macOS to install NSIS and LLVM." >&2
  exit 1
fi

for formula in nsis llvm lld; do
  if ! brew list --versions "$formula" >/dev/null 2>&1; then
    echo "Installing Homebrew formula: $formula"
    brew install "$formula"
  fi
done

export PATH="/opt/homebrew/opt/llvm/bin:/usr/local/opt/llvm/bin:/opt/homebrew/opt/lld/bin:/usr/local/opt/lld/bin:$PATH"

if ! command -v llvm-rc >/dev/null 2>&1; then
  echo "llvm-rc was not found after installing llvm." >&2
  exit 1
fi

if ! command -v lld-link >/dev/null 2>&1; then
  echo "lld-link was not found after installing lld." >&2
  exit 1
fi

if ! rustup target list --installed | grep -qx "x86_64-pc-windows-msvc"; then
  echo "Installing Rust target: x86_64-pc-windows-msvc"
  rustup target add x86_64-pc-windows-msvc
fi

if ! command -v cargo-xwin >/dev/null 2>&1; then
  echo "Installing cargo-xwin"
  cargo install --locked cargo-xwin
fi

echo "Building Windows x64 NSIS installer..."
cargo tauri build --runner cargo-xwin --target x86_64-pc-windows-msvc "$@"

echo
echo "Windows artifacts:"
find "$ROOT_DIR/src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis" \
  -maxdepth 1 \
  \( -name "*.exe" -o -name "*.msi" \) \
  -print
