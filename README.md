# 商超利润计算器

一个基于 Tauri 2、原生 HTML/CSS/JavaScript 和 Rust 的桌面利润计算工具。

前端静态资源位于 `frontend/`，Tauri 会直接读取该目录进行打包。

## 开发运行

直接运行：

```bash
cd src-tauri
cargo tauri dev
```

说明：

- Tauri 会通过 `node ./scripts/dev-frontend.mjs` 自动启动本地静态服务。
- 开发地址固定为 `http://127.0.0.1:1420`。

## 打包命令

### macOS 通用包

在 Apple Silicon Mac 上同时产出兼容 Apple Silicon 和 Intel Mac 的通用包：

```bash
./scripts/build-macos-universal.sh
```

产物位置：

- `src-tauri/target/universal-apple-darwin/release/bundle/app/`
- `src-tauri/target/universal-apple-darwin/release/bundle/dmg/`

说明：

- 脚本会自动补齐 `aarch64-apple-darwin` 和 `x86_64-apple-darwin` Rust targets。
- 脚本默认设置 `CI=true`，避免 DMG 构建时卡在 Finder 美化步骤。
- 当前默认使用 `--no-sign`，适合本地测试和内部流转；如果要面对外部分发，建议后续补签名和 notarization。

## 图标维护

如果替换了 `src-tauri/icons/128x128@2x.png`，可以重新生成 `.ico` 和 `.icns`：

```bash
./scripts/generate-icons.py
```

### Windows 10/11 x64 安装包

在 macOS 上使用 `cargo-xwin` 交叉编译 Windows x64 NSIS 安装包：

```bash
./scripts/build-windows-x64.sh
```

产物位置：

- `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/`

说明：

- Windows 专用配置位于 `src-tauri/tauri.windows.conf.json`。
- 当前仅生成 `nsis` 安装包，避免在非 Windows 环境误触发 `msi` 构建。
- 安装器使用 `embedBootstrapper` 方式携带 WebView2 bootstrapper，并采用 `currentUser` 安装模式，不要求管理员权限。
- 如果你有 Windows 构建机或 CI，官方仍更推荐直接在 Windows 上运行 `cargo tauri build --target x86_64-pc-windows-msvc`。
