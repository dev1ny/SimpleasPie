# 商超利润计算器

一款面向供货商和商超合作场景的桌面利润测算工具，用来快速判断一款商品在不同供价、费用、税率和零售价条件下是否赚钱，以及双方各自的利润空间。

项目基于 Tauri 2、原生 HTML/CSS/JavaScript 和 Rust 构建，可打包为 macOS 和 Windows 桌面应用。

## 适用场景

- 给商超报价前，先测一遍供价是否还能保住利润
- 同时考虑上架费、促销费、返利等后台费用后的真实收益
- 对照商超零售价，判断前台毛利、后台毛利和综合毛利是否合理
- 多个商品一起谈判时，统一看整体利润和整体毛利率

## 核心功能

### 1. 单商品利润测算

每个商品卡片支持录入：

- 商品名称
- 进价/成本价
- 供价/我方售价
- 数量
- 零售价

系统会自动计算：

- 税额
- 我方单件利润
- 我方利润率
- 商超前台毛利
- 商超后台毛利
- 商超综合毛利
- 商超综合利润率

### 2. 支持三种费用类型

每个商品可添加多条费用项，并可自由命名。支持：

- `按件`：例如单件促销费、物流补贴
- `按总额`：例如上架费、坑位费、年度合同费
- `按百分比`：例如返利点、扣点、渠道费率

程序会自动把总额费用按数量分摊到单件，并把百分比费用按供价折算。

### 3. 双计税模式

支持两种常见计税口径：

- `不含税`
- `含税`

同时支持自定义税率，默认值为 `13%`。

### 4. 反向倒推价格

除了正向计算，程序也支持从目标结果反推价格：

- 直接输入目标`利润金额`，反推供价
- 直接输入目标`利润率`，反推供价
- 直接输入目标`前台毛利`，反推零售价
- 直接输入目标`综合毛利`，反推零售价
- 直接输入目标`综合利润率`，反推零售价

这对谈判报价、反算零售价区间、快速试错特别有用。

### 5. 多商品汇总分析

支持同时分析多款商品，当前最多可添加 `10` 个商品。

汇总面板会自动统计：

- 总成本
- 总供价
- 总费用
- 总税额
- 总利润
- 总利润率
- 总前台毛利
- 总后台毛利
- 总综合毛利
- 综合利润率

汇总区同样支持反向调整：

- 输入总利润，可按当前利润占比分配后回推各商品供价
- 输入总利润率，可统一回推各商品供价
- 输入总综合毛利，可按当前综合毛利占比分配后回推各商品零售价
- 输入综合利润率，可统一回推各商品零售价

## 使用方式

### 下载安装

可直接从 GitHub Release 页面下载打包好的桌面版：

[Releases](https://github.com/dev1ny/SimpleasPie/releases)

当前发布产物包含：

- macOS 通用版 `DMG`
- macOS 应用 `ZIP`
- Windows 10/11 x64 安装包 `EXE`
- `SHA256SUMS.txt` 校验文件

说明：

- macOS 通用版同时兼容 Apple Silicon 和 Intel Mac
- Windows 安装包面向 64 位 Windows 10/11
- 当前安装包尚未签名，首次打开时系统可能出现安全提示

### 使用流程

1. 先选择计税模式和税率
2. 录入商品成本、供价、数量和零售价
3. 根据合作方案添加费用项
4. 查看我方利润与商超综合毛利是否达标
5. 如需倒推报价，直接改利润或利润率目标即可

## 开发运行

前端静态资源位于 `frontend/`，Tauri 会直接读取该目录进行打包。

运行开发环境：

```bash
cd src-tauri
cargo tauri dev
```

说明：

- Tauri 会通过 `node ./scripts/dev-frontend.mjs` 自动启动本地静态服务
- 开发地址固定为 `http://127.0.0.1:1420`

## 打包

### macOS 通用包

在 Apple Silicon Mac 上同时产出兼容 Apple Silicon 和 Intel Mac 的通用包：

```bash
./scripts/build-macos-universal.sh
```

产物位置：

- `src-tauri/target/universal-apple-darwin/release/bundle/app/`
- `src-tauri/target/universal-apple-darwin/release/bundle/dmg/`

说明：

- 脚本会自动补齐 `aarch64-apple-darwin` 和 `x86_64-apple-darwin` Rust targets
- 脚本默认设置 `CI=true`，避免 DMG 构建时卡在 Finder 美化步骤
- 当前默认使用 `--no-sign`，适合本地测试和内部流转；如果要公开分发，建议补签名和 notarization

### Windows 10/11 x64 安装包

在 macOS 上使用 `cargo-xwin` 交叉编译 Windows x64 NSIS 安装包：

```bash
./scripts/build-windows-x64.sh
```

产物位置：

- `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/`

说明：

- Windows 专用配置位于 `src-tauri/tauri.windows.conf.json`
- 当前仅生成 `nsis` 安装包，避免在非 Windows 环境误触发 `msi` 构建
- 安装器使用 `embedBootstrapper` 方式携带 WebView2 bootstrapper，并采用 `currentUser` 安装模式，不要求管理员权限
- 如果你有 Windows 构建机或 CI，官方仍更推荐直接在 Windows 上运行 `cargo tauri build --target x86_64-pc-windows-msvc`

## 图标维护

如果替换了 `src-tauri/icons/128x128@2x.png`，可以重新生成 `.ico` 和 `.icns`：

```bash
./scripts/generate-icons.py
```
