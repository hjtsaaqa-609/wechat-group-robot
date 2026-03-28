# Windows 10 利旧部署说明

## 适用场景

如果有一台可以长期通电联网的 Windows 10 笔记本，例如 ThinkPad T480s，可以直接作为本项目的定时执行主机使用。

对于 Windows 环境，推荐方案不是常驻 `npm run start`，而是使用“任务计划程序”按周触发单次执行：

- 稳定性更高
- 重启后容易恢复
- 不依赖有人登录后手动打开终端
- 更适合每周只执行一次的周报任务

## 推荐运行方式

每周一由 Windows 任务计划程序调用：

[`scripts/run-job.ps1`](/Users/michael/Documents/AI%20Codex/Wechat%20group%20chat%20robot/scripts/run-job.ps1)

该脚本会自动切换到项目根目录并执行：

```powershell
npm run once -- --job "DAS周报"
```

## 环境准备

1. 安装 Node.js LTS，并确保 `node`、`npm` 已加入系统 `PATH`
2. 将项目放到固定目录，例如：

```text
C:\wechat-group-chat-robot
```

3. 在项目根目录执行：

```powershell
npm install
```

4. 创建 `.env`，填入 DAS 账号和企业微信群机器人 `Webhook`

## 手动测试

在 PowerShell 中执行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\wechat-group-chat-robot\scripts\run-job.ps1" -JobName "DAS周报"
```

如果群里能收到消息，说明 Windows 环境可用。

## 任务计划程序配置

### 触发器

- 类型：每周
- 时间：周一 `08:05`
- 间隔：每 `1` 周

说明：

- 当前周报统计的是“最近一个已结束的完整自然周”
- 因此周一早上发送，统计周期正好是上一周周一到周日

### 操作

- 程序或脚本：

```text
powershell.exe
```

- 添加参数：

```text
-NoProfile -ExecutionPolicy Bypass -File "C:\wechat-group-chat-robot\scripts\run-job.ps1" -JobName "DAS周报"
```

- 起始于：

```text
C:\wechat-group-chat-robot
```

### 建议勾选项

- 无论用户是否登录都要运行
- 使用最高权限运行
- 错过计划启动时间后尽快运行
- 唤醒计算机以运行此任务
- 任务失败时，每 `5` 分钟重试一次，最多 `3` 次

## 任务计划程序逐步配置

1. 打开 `任务计划程序`
2. 右侧点击 `创建任务`，不要用“创建基本任务”
3. 在 `常规` 页签中填写：
   - 名称：`DAS周报`
   - 说明：`每周一 08:05 推送 DAS 运营周报到企业微信群`
   - 勾选 `无论用户是否登录都要运行`
   - 勾选 `使用最高权限运行`
   - “配置为”选择当前 Windows 10
4. 切到 `触发器` 页签，点击 `新建`
   - 开始任务：`按计划`
   - 设置：`每周`
   - 开始时间：`08:05:00`
   - 勾选：`星期一`
   - 每隔 `1` 周发生一次
   - 勾选 `已启用`
5. 切到 `操作` 页签，点击 `新建`
   - 操作：`启动程序`
   - 程序或脚本：`powershell.exe`
   - 添加参数：

```text
-NoProfile -ExecutionPolicy Bypass -File "C:\wechat-group-chat-robot\scripts\run-job.ps1" -JobName "DAS周报"
```

   - 起始于：

```text
C:\wechat-group-chat-robot
```

6. 切到 `条件` 页签
   - 建议取消 `只有在计算机使用交流电源时才启动此任务`，仅当你确认机器始终插电时再保留
   - 勾选 `唤醒计算机以运行此任务`
   - 网络条件不要设得过严，避免因网络判定导致不触发
7. 切到 `设置` 页签
   - 勾选 `允许按需运行任务`
   - 勾选 `错过计划启动时间后尽快运行任务`
   - 勾选 `如果任务失败，重新启动间隔`
   - 重试间隔设为 `5 分钟`
   - 重试次数设为 `3`
   - 勾选 `如果运行中的任务没有按请求结束，则强制停止`
8. 点击 `确定`
9. 如果系统提示输入 Windows 登录密码，输入一次，让任务能在无人登录时运行
10. 在任务列表中找到 `DAS周报`，右键点击 `运行`，先做一次人工验证

## 建议的首次验收

建议按下面顺序验收一次：

1. 先在 PowerShell 里手动执行脚本，确认群里能收到消息
2. 再在任务计划程序里右键 `运行`
3. 查看 `上次运行结果` 是否为 `0x0`
4. 到企业微信群确认消息是否到达
5. 人工把系统时间调到临近触发时段做模拟，这一步可选

## 笔记本电源设置

为了保证周一早上能准时发送，至少要调整这些设置：

- 接通电源时“睡眠”设为“从不”
- 合上盖子时的操作设为“无操作（接通电源时）”
- 允许唤醒定时器
- 尽量保持接通电源
- 尽量使用稳定网络，优先有线或固定 Wi-Fi

如果机器会因断电自动关机，还需要确保：

- 通电后能自动恢复网络
- Windows 登录凭据不会频繁过期
- 系统更新不会长期卡在重启等待状态

## 与项目内置调度的关系

Windows 任务计划程序调用的是单次执行模式：

```powershell
npm run once -- --job "DAS周报"
```

因此：

- 可以继续保留 [`config/jobs.json`](/Users/michael/Documents/AI%20Codex/Wechat%20group%20chat%20robot/config/jobs.json) 中的 `cron` 作为项目默认配置
- 但在 Windows 任务计划程序模式下，真正生效的触发时间以 Windows 任务计划程序为准
- 不要同时再手动运行 `npm run start`，否则可能重复发送

## 适合与不适合

适合：

- 内部固定群周报
- 每周一到两次的定时推送
- 可接受将机器长期插电放置在办公室

不太适合：

- 对可用性要求极高的 7x24 生产任务
- 依赖公司网络策略且笔记本经常被带离办公室
- 后续要扩展成多群、多报表、多时段发送

如果未来任务增多，建议再迁移到 Linux 服务器或云函数。
