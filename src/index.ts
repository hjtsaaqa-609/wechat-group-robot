import { parseArgs } from "node:util";

import cron from "node-cron";
import dotenv from "dotenv";

import { loadConfig, resolveChannel } from "./lib/config.js";
import { DasClient } from "./lib/das-client.js";
import { ReportStateStore } from "./lib/state.js";
import { nowLabel, resolveLastCompletedWeekRange } from "./lib/time.js";
import { sendRenderedReport } from "./lib/wecom.js";
import { buildReport } from "./reports/index.js";
import type { JobConfig, ReportContext } from "./types.js";

dotenv.config();

const runningJobs = new Set<string>();

type CliOptions = {
  mode: string;
  config: string;
  dryRun: boolean;
  force: boolean;
  job?: string;
  runOnStart: boolean;
};

async function main(): Promise<void> {
  const options = parseCliArgs();
  const config = loadConfig(options.config);
  const defaultTimezone = config.timezone ?? "Asia/Shanghai";

  const baseUrl = requiredEnv("DAS_BASE_URL");
  const username = requiredEnv("DAS_USERNAME");
  const password = requiredEnv("DAS_PASSWORD");

  const client = new DasClient(baseUrl, username, password);
  const stateStore = new ReportStateStore("data/report-state.json");
  const jobs = config.jobs.filter((job) => job.enabled !== false);
  const selectedJobs = options.job
    ? jobs.filter((job) => job.name === options.job)
    : jobs;

  if (selectedJobs.length === 0) {
    throw new Error("没有匹配到可执行的任务");
  }

  if (options.mode === "once") {
    await runJobs(selectedJobs, {
      client,
      stateStore,
      defaultTimezone,
      dryRun: options.dryRun,
      force: options.force,
      baseUrl,
    });
    return;
  }

  for (const job of selectedJobs) {
    if (!cron.validate(job.cron)) {
      throw new Error(`任务 ${job.name} 的 cron 表达式无效: ${job.cron}`);
    }

    cron.schedule(
      job.cron,
      async () => {
        const delayMs = pickJitterDelayMs(job.jitterSeconds ?? 0);
        if (delayMs > 0) {
          console.log(`[schedule] 任务 ${job.name} 启用抖动，延迟 ${Math.round(delayMs / 1000)} 秒执行`);
        }

        await sleep(delayMs);

        if (runningJobs.has(job.name)) {
          console.warn(`[schedule] 任务已在运行中，跳过本次触发: ${job.name}`);
          return;
        }

        runningJobs.add(job.name);
        try {
          await runSingleJob(job, {
            client,
            stateStore,
            defaultTimezone,
            dryRun: options.dryRun,
            force: options.force,
            baseUrl,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "未知错误";
          console.error(`[job] 执行失败: ${job.name} | ${message}`);
        } finally {
          runningJobs.delete(job.name);
        }
      },
      {
        timezone: job.timezone ?? defaultTimezone,
      },
    );

    console.log(
      `[schedule] 已注册任务: ${job.name} | cron=${job.cron} | timezone=${job.timezone ?? defaultTimezone}`,
    );
  }

  if (options.runOnStart) {
    await runJobs(selectedJobs, {
      client,
      stateStore,
      defaultTimezone,
      dryRun: options.dryRun,
      force: options.force,
      baseUrl,
    });
  }

  console.log("[schedule] 定时任务运行中，按 Ctrl+C 退出");
}

function parseCliArgs(): CliOptions {
  const parsed = parseArgs({
    options: {
      mode: {
        type: "string",
        default: "once",
      },
      config: {
        type: "string",
        default: "config/jobs.json",
      },
      "dry-run": {
        type: "boolean",
        default: false,
      },
      force: {
        type: "boolean",
        default: false,
      },
      job: {
        type: "string",
      },
      "run-on-start": {
        type: "boolean",
        default: false,
      },
    },
  });

  return {
    mode: parsed.values.mode,
    config: parsed.values.config,
    dryRun: parsed.values["dry-run"],
    force: parsed.values.force,
    job: parsed.values.job,
    runOnStart: parsed.values["run-on-start"],
  };
}

async function runJobs(
  jobs: JobConfig[],
  options: {
    client: DasClient;
    stateStore: ReportStateStore;
    defaultTimezone: string;
    dryRun: boolean;
    force: boolean;
    baseUrl: string;
  },
): Promise<void> {
  for (const job of jobs) {
    await runSingleJob(job, options);
  }
}

async function runSingleJob(
  job: JobConfig,
  options: {
    client: DasClient;
    stateStore: ReportStateStore;
    defaultTimezone: string;
    dryRun: boolean;
    force: boolean;
    baseUrl: string;
  },
): Promise<void> {
  const timezone = job.timezone ?? options.defaultTimezone;
  const executedAt = nowLabel(timezone);
  const channel = options.dryRun ? null : resolveChannel(job);

  const context: ReportContext = {
    jobName: job.name,
    timezone,
    baseUrl: options.baseUrl,
    executedAt,
  };

  console.log(`[job] 开始执行: ${job.name} | ${executedAt}`);
  await options.client.authenticate();

  let failureCount = 0;
  for (const report of job.reports) {
    try {
      if (
        report.type === "weekly-operations" &&
        !options.dryRun &&
        !options.force &&
        hasAlreadySentCurrentWeek(job.name, timezone, options.stateStore)
      ) {
        const currentPeriod = resolveLastCompletedWeekRange(timezone);
        console.log(`[job] 当前统计周期已发送，跳过重复触发: ${job.name} | ${currentPeriod.label}`);
        continue;
      }

      const rendered = await buildReport(
        options.client,
        report,
        context,
        options.stateStore,
      );
      if (!rendered) {
        console.log(`[job] 跳过空报表: ${job.name} | ${report.type}`);
        continue;
      }

      if (options.dryRun) {
        printPreview(job.name, rendered);
        continue;
      }

      await sendRenderedReport(channel!, rendered);

      if (report.type === "weekly-operations" && rendered.stateUpdate) {
        options.stateStore.updateJobState(job.name, {
          ...rendered.stateUpdate,
          updatedAt: executedAt,
        });
      }

      console.log(`[job] 已发送: ${job.name} | ${rendered.title}`);
    } catch (error) {
      failureCount += 1;
      const message = error instanceof Error ? error.message : "未知错误";
      console.error(`[job] 报表失败: ${job.name} | ${report.type} | ${message}`);
    }
  }

  if (failureCount > 0) {
    throw new Error(`任务 ${job.name} 有 ${failureCount} 个报表执行失败`);
  }
}

function printPreview(jobName: string, report: { title: string; markdown: string }): void {
  console.log("");
  console.log("=".repeat(80));
  console.log(`[dry-run] ${jobName} | ${report.title}`);
  console.log("-".repeat(80));
  console.log(report.markdown);
  console.log("=".repeat(80));
  console.log("");
}

function hasAlreadySentCurrentWeek(
  jobName: string,
  timezone: string,
  stateStore: ReportStateStore,
): boolean {
  const currentPeriod = resolveLastCompletedWeekRange(timezone);
  const state = stateStore.getJobState(jobName);
  return state.lastPeriodLabel === currentPeriod.label;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`缺少环境变量 ${name}`);
  }
  return value;
}

function pickJitterDelayMs(jitterSeconds: number): number {
  if (jitterSeconds <= 0) {
    return 0;
  }

  return Math.floor(Math.random() * jitterSeconds * 1000);
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

await main();
