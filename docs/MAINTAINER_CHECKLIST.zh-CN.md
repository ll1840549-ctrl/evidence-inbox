# 维护者与公开发布检查表

## 公开前

- [x] 使用全新 Git 历史，不从含密钥的私有仓库复制 `.git`。
- [x] 搜索 API key、token、cookie、邮箱、手机号、内部域名和绝对路径。
- [x] 所有示例均为合成数据。
- [x] 确认代码、图片、文档和依赖允许按 MIT 许可证发布。
- [x] `npm run verify` 通过。
- [x] `README.md` 中的仓库 URL 与实际地址一致。
- [ ] GitHub 仓库启用 Issues、Discussions 和私密安全报告。
- [x] 默认分支启用 CI 保护，合并前要求测试通过。

## 发布 v0.1.0

- [x] 创建 GitHub Release，说明功能、限制和升级方式。
- [x] 将 `CHANGELOG.md` 与 tag 保持一致。
- [x] 验证 Windows 和 Ubuntu CI。
- [x] 在干净目录执行 README 的快速开始。
- [x] 创建至少三个真实的路线图 Issue，不制造虚假活动。

## 持续维护证据

- [ ] 每个有效 Issue 有分类和回应。
- [ ] PR 有测试、评审和变更说明。
- [x] Release 与修复记录可追溯。
- [x] README 记录真实用户场景和限制。
- [x] 只报告真实 Star、Fork、下载量和用户反馈。
