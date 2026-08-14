# Codex for Open Source 申请材料

> 状态：**尚不建议提交。** 项目需要先公开、完成首个 Release，并积累真实的维护和使用证据。本文案不得用于夸大 Star、下载量或用户规模。

## 当前资料状态

| 项目 | 当前值 | 提交前要求 |
| --- | --- | --- |
| GitHub 用户名 | `ll1840549-ctrl` | 保持公开 |
| GitHub 显示姓名 | 未填写 | 填写真实姓名或稳定公开身份 |
| 仓库 URL | 待公开 | `https://github.com/ll1840549-ctrl/evidence-inbox` |
| 维护角色 | 主要维护者 | 通过仓库所有权、提交、Issue 和 Release 证明 |
| ChatGPT 账号邮箱 | 由申请人填写 | 必须与 ChatGPT 账号关联邮箱一致 |
| OpenAI 组织 ID | 由申请人填写 | 从 API 平台组织设置复制，不要公开在仓库 |
| Star / 下载量 | 发布后更新 | 只填写可验证数据 |

## GitHub 资料建议

仓库描述：

> Local-first evidence inbox with content-first classification, SHA256 de-duplication, and auditable file records. 中文文档友好。

Topics：

`local-first`、`document-management`、`sha256`、`audit-trail`、`nodejs`、`chinese`

个人简介建议：

> Building local-first tools for traceable research and document workflows. Maintainer of Evidence Inbox.

不要写无法验证的公司、职位、用户数或影响力。

## 表单草稿

### 角色

选择：**主要维护者**

说明：

> I created and maintain Evidence Inbox. I own the repository, review contributions, triage issues, maintain tests and security policy, and publish releases.

### 为什么这个仓库符合要求（500 字以内）

> Evidence Inbox 是面向中文及 Windows 常见工作流的本地优先开源文件收件箱。它通过内容优先分类、SHA256 去重、人工复核分区和可审计记录，帮助研究者与小团队解决文件名不可靠、重复资料和证据链缺失的问题。核心功能无需云服务或 API key，默认无遥测。项目由我创建并持续维护；当前真实指标为：{{STAR_COUNT}} Stars、{{FORK_COUNT}} Forks、{{RELEASE_COUNT}} 个 Release、{{USAGE_EVIDENCE}}。这些指标可在公开仓库验证。

提交前必须替换所有 `{{...}}`；没有数据就诚实写“项目处于早期阶段”，不要删除语境后冒充成熟项目。

### 感兴趣的支持

- API 额度：建议勾选。
- Codex Security：只有在已启用安全报告、存在真实安全审查计划时勾选。

### 如何使用 API 额度（500 字以内）

> API 额度将用于 Evidence Inbox 的开源维护工作：分类和汇总公开 Issue、为解析器边界条件生成合成测试、辅助 PR 评审、依赖与安全变更分析、发布说明和迁移文档。后续可研究一个明确选择加入的模糊文档分类适配器；本地规则引擎仍保持无 API key 可用。未经用户明确授权，不上传收件箱文件、索引或审计日志，并为所有联网功能提供数据边界说明和测试。

### 其他说明（500 字以内）

> 项目服务于对本地处理、中文文档和 Windows 兼容性有需求的维护者与研究工作流。我们优先保证可解释分类、失败可见、人工复核和证据可追溯，不以静默上传换取便利。仓库只使用合成测试数据，并接受围绕解析器、安全边界和跨平台兼容性的贡献。我愿意配合验证仓库控制权、维护者身份和项目指标。

## 提交门槛

满足以下条件后再最终润色和提交：

- 仓库公开且 README 快速开始在干净机器可复现；
- v0.1.0 Release 与 tag 已发布；
- Windows、Ubuntu CI 均通过；
- GitHub 资料公开且身份信息一致；
- 有真实 Issue/反馈/使用记录，或能够具体说明生态重要性；
- 表单中的全部数字、角色和用途可验证；
- 申请内容不含机密信息。
