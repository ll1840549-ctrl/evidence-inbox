# Evidence Inbox / 证据收件箱

[![CI](https://github.com/ll1840549-ctrl/evidence-inbox/actions/workflows/ci.yml/badge.svg)](https://github.com/ll1840549-ctrl/evidence-inbox/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

一个零第三方运行时依赖、本地优先的文件收件箱。把文件拖进 `inbox`，它会按**内容**而不是文件名进行分类，计算 SHA256 去重，并生成可审计的证据记录。

> v0.1 支持 UTF-8 文本、Markdown、CSV、JSON、HTML、日志和常见源代码文件。PDF、Office 与 OCR 仍在路线图中，暂时会安全地进入人工复核区。

[English README](README.en.md)

## 为什么做这个项目

研究、审计和知识管理工作经常从一个混乱的下载目录开始：文件名不可靠、同一材料被重复保存、来源和处理状态难以追踪。Evidence Inbox 提供一个小而透明的本地管道：

- 内容优先分类，文件名只作为弱提示；
- SHA256 内容指纹和重复文件关联；
- `processed`、`needs_review`、`duplicate`、`failed` 分区；
- `index.json` 结构化索引与 `audit.jsonl` 追加式审计日志；
- `verify` 命令检测归档文件缺失或被修改；
- 默认不联网、无遥测、不需要 API 密钥。

## 快速开始

需要 Node.js 20 或更高版本。

```powershell
git clone https://github.com/ll1840549-ctrl/evidence-inbox.git
Set-Location evidence-inbox
npm install
node .\src\cli.js init --root .\my-inbox
```

把文件复制到 `my-inbox\inbox` 后执行：

```powershell
node .\src\cli.js scan --root .\my-inbox
node .\src\cli.js list --root .\my-inbox
node .\src\cli.js verify --root .\my-inbox
```

持续监控拖入的文件：

```powershell
node .\src\cli.js watch --root .\my-inbox
```

安装为本机命令后可使用 `evidence-inbox`：

```powershell
npm link
evidence-inbox doctor --root .\my-inbox
```

## 工作目录

```text
my-inbox/
├── inbox/          # 用户拖入文件的位置
├── processed/      # 已成功分类
├── needs_review/   # 不支持或低置信度，需要人工处理
├── duplicate/      # SHA256 已存在
├── failed/         # 处理异常
├── processing/     # 为后续崩溃恢复流程预留
├── index.json      # 当前证据索引
└── audit.jsonl     # 追加式处理事件
```

每条记录包括原始文件名、收件箱相对路径、归档路径、SHA256、字节数、分类、置信度、匹配关键词、处理状态和导入时间。

## 命令

| 命令 | 用途 |
| --- | --- |
| `init` | 初始化目录和索引 |
| `scan` | 扫描一次收件箱 |
| `watch` | 持续扫描稳定超过 1.5 秒的文件 |
| `list` | 查看记录，可用 `--status` 筛选 |
| `show` | 按记录 ID 或完整 SHA256 查看证据 |
| `verify` | 重新计算 SHA256，检测缺失或篡改 |
| `doctor` | 检查工作区结构和索引 |

所有命令均支持 `--root PATH`。`scan`、`list`、`verify` 支持 `--json`。

## 分类原则

v0.1 使用可审查的关键词评分器，支持财务报告、研究报告、会议纪要、合同、源代码和数据集。内容命中权重大于文件名；线索不足的文件不会被强行分类，而是进入 `needs_review`。

这种实现不是机器学习模型，但优点是离线、可解释、可测试。未来的可选 AI 分类器必须保持明确的用户授权和本地默认行为。

## 安全与隐私

- 默认不上传文件，不收集遥测；
- 不要把真实工作区、`index.json`、`audit.jsonl` 或敏感样本提交到 Git；
- 当前审计日志用于可追溯性，不是防篡改账本；
- 安全问题请参阅 [SECURITY.md](SECURITY.md)；
- 已知限制和计划参阅 [路线图](docs/ROADMAP.zh-CN.md)。

## 开发

```powershell
npm run check
npm test
npm run verify
```

项目不需要生产依赖，测试使用 Node.js 内置的 `node:test`。欢迎阅读 [贡献指南](CONTRIBUTING.md) 后提交 Issue 或 PR。

## 许可证

[MIT License](LICENSE)
