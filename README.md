# 企业微信群机器人

基于 Node.js 的定时推送程序，负责从 `http://das.i-pv.cn` 拉取 DAS 报表数据，并通过企业微信群机器人 `webhook` 发送到群里。

当前默认内置周报报表：

- `weekly-operations`：按自然周汇总的运营周报

## 1. 安装依赖

```bash
npm install
```

## 2. 配置环境变量

在项目根目录创建 `.env`，内容参考 [`.env.example`](/Users/michael/Documents/AI Codex/Wechat group chat robot/.env.example)：

```bash
DAS_BASE_URL=http://das.i-pv.cn
DAS_USERNAME=你的DAS用户名
DAS_PASSWORD=你的DAS密码
WECOM_WEBHOOK=你的企业微信群机器人Webhook
```

## 3. 配置推送任务

编辑 [`config/jobs.json`](/Users/michael/Documents/AI Codex/Wechat group chat robot/config/jobs.json)：

- `cron`：定时表达式
- `webhookEnv`：Webhook 从哪个环境变量读取
- `reports`：要发送的报表列表

默认示例是每周一 `09:00` 推送上一个完整自然周的 `运营周报`。

## 4. 本地预览

只预览消息内容，不真正发送：

```bash
npm run once -- --dry-run
```

## 5. 单次发送

```bash
npm run once
```

## 6. 常驻定时运行

```bash
npm run start
```

如果你希望启动时立即跑一次：

```bash
npm run start -- --run-on-start
```

## 7. 只执行某一个任务

```bash
npm run once -- --dry-run --job "DAS周报"
```

## 8. 推荐的定时触发方式

如果你只有这一份周报，推荐直接用系统 `cron` 定时触发单次执行，而不是常驻一个 Node 进程。

先确认下面脚本可执行：

```bash
chmod +x scripts/run-job.sh
```

手动测试：

```bash
./scripts/run-job.sh "DAS周报"
```

Linux `crontab` 示例：

```bash
0 9 * * 1 /bin/bash /Users/michael/Documents/AI\ Codex/Wechat\ group\ chat\ robot/scripts/run-job.sh "DAS周报" >> /Users/michael/Documents/AI\ Codex/Wechat\ group\ chat\ robot/logs/weekly-report.log 2>&1
```

如果你更希望程序自己常驻调度，也可以继续使用：

```bash
npm run start
```

## 说明

- 程序会先调用 `/api/auth/login` 校验 DAS 账号密码，再抓取报表数据。
- 周报中的“平台机器人数量”使用 `试运行 + 正式运营` 口径。
- 周报中的“机器人变化数量”来自本地状态文件 [data/report-state.json](/Users/michael/Documents/AI Codex/Wechat group chat robot/data/report-state.json)，首次已按你提供的周会表最新一行做了初始化。
- 周报后续按 DAS 当前实时接口自动生成，不再保留早期已停更的历史字段。
- 客户投诉/表扬口径当前在 DAS 源码里未发现明确接口，默认先输出 `-`。
