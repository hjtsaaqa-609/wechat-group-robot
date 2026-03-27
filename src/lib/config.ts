import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { AppConfig, JobConfig } from "../types.js";

export function loadConfig(configPath: string): AppConfig {
  const absolutePath = resolve(configPath);
  const raw = readFileSync(absolutePath, "utf8");
  const parsed = JSON.parse(raw) as Partial<AppConfig>;

  if (!parsed || !Array.isArray(parsed.jobs)) {
    throw new Error(`配置文件无效：${absolutePath}`);
  }

  for (const job of parsed.jobs) {
    validateJob(job);
  }

  return {
    timezone: parsed.timezone,
    jobs: parsed.jobs as JobConfig[],
  };
}

function validateJob(job: unknown): asserts job is JobConfig {
  if (!job || typeof job !== "object") {
    throw new Error("任务配置必须是对象");
  }

  const candidate = job as Partial<JobConfig>;
  if (!candidate.name) {
    throw new Error("任务缺少 name");
  }
  if (!candidate.cron) {
    throw new Error(`任务 ${candidate.name} 缺少 cron`);
  }
  if (!Array.isArray(candidate.reports) || candidate.reports.length === 0) {
    throw new Error(`任务 ${candidate.name} 至少要配置一个 report`);
  }
}

export function resolveWebhook(job: JobConfig): string | undefined {
  if (job.webhook) {
    return job.webhook;
  }

  const envKey = job.webhookEnv ?? "WECOM_WEBHOOK";
  return process.env[envKey];
}
