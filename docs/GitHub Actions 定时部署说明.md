# GitHub Actions 定时部署说明

## 适用场景

如果不希望依赖本地电脑或 Windows 任务计划程序，可以直接使用 GitHub Actions 定时执行周报推送。

当前项目已经内置工作流：

[`das-weekly-report.yml`](/Users/michael/Documents/AI%20Codex/Wechat%20group%20chat%20robot/.github/workflows/das-weekly-report.yml)

## 当前工作流能力

- 支持避开整点的双触发
- 当前为了测试，先按“每天触发一次主任务 + 一次补偿任务”运行
- 支持在 GitHub 页面手动点击执行
- 支持手动 dry-run 预览
- 支持手动强制重发当前统计周期
- 同一统计周期默认只会成功发送一次
- 执行完成后自动把 [data/report-state.json](/Users/michael/Documents/AI%20Codex/Wechat%20group%20chat%20robot/data/report-state.json) 回写到仓库

之所以要回写状态文件，是因为：

- GitHub Actions Runner 是无状态的
- 周报中的“机器人变化数量”依赖上一次执行结果
- 当前项目通过本地状态文件保存该值

## 定时表达式与时区

工作流里的定时表达式是：

```yaml
schedule:
  - cron: "23 0 * * *"
  - cron: "47 0 * * *"
```

GitHub Actions 的 `schedule` 使用 UTC。

因此当前测试阶段会在每天北京时间这两个时间点触发：

- `08:23`
- `08:47`

说明：

- 两次都避开整点附近高负载时段
- 第二次触发是补偿触发
- 如果第一次已经成功发送，当天第二次会因“当前统计周期已发送”被自动跳过
- 如果第一次运行失败，第二次仍有机会补发

测试稳定后，可以再把 schedule 改回每周频率。

## 需要配置的 Secrets

进入 GitHub 仓库：

`Settings -> Secrets and variables -> Actions -> New repository secret`

依次新增：

- `DAS_USERNAME`
- `DAS_PASSWORD`
- `WECOM_WEBHOOK`

说明：

- `DAS_BASE_URL` 在当前工作流中固定使用 `http://das.i-pv.cn`
- 如果后续 DAS 域名变化，再修改工作流即可

## 需要确认的仓库设置

### 1. 启用 GitHub Actions

进入：

`Repository -> Actions`

如果仓库尚未启用 Actions，先启用。

### 2. 允许工作流写回仓库

进入：

`Settings -> Actions -> General -> Workflow permissions`

选择：

- `Read and write permissions`

原因：

- 工作流需要把 `data/report-state.json` 提交回仓库
- 如果只有只读权限，周报能发送，但“机器人变化数量”无法持续累积

### 3. 检查 main 分支保护

如果 `main` 开启了 branch protection，并且不允许 GitHub Actions 直接推送，那么这一步会失败：

```text
git push
```

这时有两种处理方式：

- 允许 GitHub Actions 推送 `main`
- 或者后续把状态持久化改为 GitHub Issue / Gist / 外部存储

当前实现采用的是最简单的“回写仓库状态文件”方案。

## 如何手动运行

进入：

`Repository -> Actions -> DAS Weekly Report -> Run workflow`

可选项：

- `job_name`：默认 `DAS周报`
- `dry_run`：如果勾选，只预览不发送
- `force_send`：如果勾选，会忽略当前周期去重，强制再发一次

建议第一次先手动执行一次正式任务，确认：

- DAS 登录正常
- 企业微信群机器人发送正常
- `data/report-state.json` 可以成功回写

## 官方限制与风险

GitHub 官方文档明确说明了几条限制：

- `schedule` 任务在高负载时可能延迟
- 整点附近更容易延迟
- 如果负载很高，排队任务可能被丢弃
- 计划任务只会在默认分支上运行
- 如果仓库是公开仓库且 60 天没有活动，计划任务会被自动禁用

官方文档：

- [GitHub Actions scheduled workflows](https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows)
- [GITHUB_TOKEN](https://docs.github.com/actions/concepts/security/github_token)

因此我对这个方案的判断是：

- 对“每周一次、允许有几分钟延迟”的周报，通常可接受
- 对“必须精确到分钟、不能错过”的强 SLA 任务，不如服务器 `cron` 稳

## 推荐验收顺序

1. 先把代码推到 GitHub 默认分支 `main`
2. 配置 3 个 Secrets
3. 打开 `Actions` 手动执行一次正式任务
4. 确认企业微信群收到周报
5. 确认 `data/report-state.json` 被自动提交回仓库
6. 观察接下来每天 `08:23 / 08:47` 的自动触发情况
7. 测试稳定后，再把频率收回到每周
