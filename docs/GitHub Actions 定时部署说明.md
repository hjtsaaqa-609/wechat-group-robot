# GitHub Actions 外部定时触发说明

## 适用场景

本项目的 GitHub Actions 不再使用 GitHub 内置 `schedule` 定时器，避免仓库内部自动触发周报。

当前设计是：

- 外部定时任务在每周一北京时间 `08:38` 触发一次 GitHub Action
- GitHub Actions 只负责单次执行周报任务
- GitHub 页面仍保留手动执行入口，便于测试和补发
- 项目内的 `node-cron` 只在手动运行 `npm run start` 时生效，Actions 默认不会使用它

工作流文件：

[`../.github/workflows/das-weekly-report.yml`](../.github/workflows/das-weekly-report.yml)

## 当前触发方式

工作流当前只保留两类触发方式：

```yaml
on:
  workflow_dispatch:
  repository_dispatch:
    types:
      - das-weekly-report
```

说明：

- `workflow_dispatch`：用于 GitHub 页面手动执行，也可被外部定时器通过 API 调用
- `repository_dispatch`：推荐给外部定时器调用，事件类型固定为 `das-weekly-report`
- 不再配置 `schedule`，因此 GitHub Actions 自身不会按时间自动运行

## 外部定时器推荐调用方式

推荐外部定时器调用 GitHub `repository_dispatch` API。

请求地址：

```text
POST https://api.github.com/repos/hjtsaaqa-609/wechat-group-robot/dispatches
```

请求头：

```text
Accept: application/vnd.github+json
Authorization: Bearer <GitHub Token>
X-GitHub-Api-Version: 2022-11-28
Content-Type: application/json
```

请求体：

```json
{
  "event_type": "das-weekly-report",
  "client_payload": {
    "job_name": "DAS周报",
    "force_send": "false"
  }
}
```

如果需要强制重发当前统计周期，可把 `force_send` 改为 `"true"`。

## 兼容 workflow_dispatch 调用

如果外部定时器已经使用 `workflow_dispatch` API，也可以继续使用。

请求地址：

```text
POST https://api.github.com/repos/hjtsaaqa-609/wechat-group-robot/actions/workflows/das-weekly-report.yml/dispatches
```

请求体：

```json
{
  "ref": "main",
  "inputs": {
    "job_name": "DAS周报",
    "dry_run": "false",
    "force_send": "false"
  }
}
```

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

## 内部触发机制排查结论

- `.github/workflows/das-weekly-report.yml` 已移除 `schedule`，GitHub 不会再自行按时间触发。
- `src/index.ts` 使用 `node-cron` 注册内部定时任务，但只有执行 `npm run start` 时才会进入定时模式。
- GitHub Actions 当前执行命令是 `npm run once`，不会读取 `config/jobs.json` 的 `cron` 作为定时器。
- 如果有服务器或本地电脑长期运行 `npm run start`，仍可能按 `config/jobs.json` 自动发送；只依赖外部定时器时，不要常驻运行该命令。

## 推荐验收顺序

1. 推送最新 workflow 到 GitHub 默认分支 `main`
2. 确认外部定时器触发时间为每周一北京时间 `08:38`
3. 外部定时器调用 `repository_dispatch` 或 `workflow_dispatch`
4. 在 GitHub Actions 页面确认触发来源不是 `schedule`
5. 确认企业微信群收到周报
6. 确认 `data/report-state.json` 被自动提交回仓库
