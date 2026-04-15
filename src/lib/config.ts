import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type {
  AppConfig,
  ExternalGroupTaskChannelConfig,
  InternalAppMessageChannelConfig,
  InternalWebhookChannelConfig,
  JobConfig,
  WecomChannelConfig,
} from "../types.js";

export type ResolvedInternalWebhookChannel = {
  type: "internal-webhook";
  webhook: string;
  maxMarkdownBytes: number;
  maxTextBytes: number;
};

export type ResolvedInternalAppMessageChannel = {
  type: "internal-app-message";
  corpId: string;
  corpSecret: string;
  agentId: number;
  touser?: string;
  toparty?: string;
  totag?: string;
  enableDuplicateCheck: boolean;
  duplicateCheckInterval: number;
  maxMarkdownBytes: number;
  maxTextBytes: number;
};

export type ResolvedExternalGroupTaskChannel = {
  type: "external-group-task";
  corpId: string;
  corpSecret: string;
  sender: string;
  chatType: "single" | "group";
  externalUserIds: string[];
  allowSelect: boolean;
  textPrefix?: string;
  maxTextLength: number;
};

export type ResolvedWecomChannel =
  | ResolvedInternalWebhookChannel
  | ResolvedInternalAppMessageChannel
  | ResolvedExternalGroupTaskChannel;

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

export function resolveChannel(job: JobConfig): ResolvedWecomChannel {
  const channel = job.channel ?? buildLegacyWebhookChannel(job);

  if (channel.type === "internal-webhook") {
    return resolveInternalWebhookChannel(channel);
  }

  if (channel.type === "internal-app-message") {
    return resolveInternalAppMessageChannel(channel);
  }

  return resolveExternalGroupTaskChannel(channel);
}

function buildLegacyWebhookChannel(job: JobConfig): InternalWebhookChannelConfig {
  return {
    type: "internal-webhook",
    webhook: job.webhook,
    webhookEnv: job.webhookEnv ?? "WECOM_WEBHOOK",
  };
}

function resolveInternalWebhookChannel(
  channel: InternalWebhookChannelConfig,
): ResolvedInternalWebhookChannel {
  const webhook = channel.webhook ?? readEnv(channel.webhookEnv ?? "WECOM_WEBHOOK");

  return {
    type: channel.type,
    webhook,
    maxMarkdownBytes: channel.maxMarkdownBytes ?? 2048,
    maxTextBytes: channel.maxTextBytes ?? 2048,
  };
}

function resolveInternalAppMessageChannel(
  channel: InternalAppMessageChannelConfig,
): ResolvedInternalAppMessageChannel {
  const agentIdRaw = channel.agentId ?? Number(readEnv(channel.agentIdEnv ?? "WECOM_AGENT_ID"));
  if (!Number.isFinite(agentIdRaw)) {
    throw new Error("internal-app-message 缺少有效的 agentId");
  }

  return {
    type: channel.type,
    corpId: channel.corpId ?? readEnv(channel.corpIdEnv ?? "WECOM_CORP_ID"),
    corpSecret:
      channel.corpSecret ?? readEnv(channel.corpSecretEnv ?? "WECOM_CORP_SECRET"),
    agentId: agentIdRaw,
    touser: channel.touser,
    toparty: channel.toparty,
    totag: channel.totag,
    enableDuplicateCheck: channel.enableDuplicateCheck ?? true,
    duplicateCheckInterval: channel.duplicateCheckInterval ?? 1800,
    maxMarkdownBytes: channel.maxMarkdownBytes ?? 2048,
    maxTextBytes: channel.maxTextBytes ?? 2048,
  };
}

function resolveExternalGroupTaskChannel(
  channel: ExternalGroupTaskChannelConfig,
): ResolvedExternalGroupTaskChannel {
  if (channel.chatType === "single" && (channel.externalUserIds?.length ?? 0) === 0) {
    throw new Error("external-group-task 在 single 模式下必须配置 externalUserIds");
  }

  return {
    type: channel.type,
    corpId: channel.corpId ?? readEnv(channel.corpIdEnv ?? "WECOM_CORP_ID"),
    corpSecret:
      channel.corpSecret ?? readEnv(channel.corpSecretEnv ?? "WECOM_CORP_SECRET"),
    sender: channel.sender,
    chatType: channel.chatType ?? "group",
    externalUserIds: channel.externalUserIds ?? [],
    allowSelect: channel.allowSelect ?? false,
    textPrefix: channel.textPrefix,
    maxTextLength: channel.maxTextLength ?? 1200,
  };
}

function readEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`缺少环境变量 ${name}`);
  }

  return value;
}
