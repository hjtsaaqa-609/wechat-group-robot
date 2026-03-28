import { Buffer } from "node:buffer";

import type { ResolvedWecomChannel } from "./config.js";
import type { RenderedReport } from "../types.js";

type TokenCacheEntry = {
  token: string;
  expiresAt: number;
};

const tokenCache = new Map<string, TokenCacheEntry>();

export async function sendRenderedReport(
  channel: ResolvedWecomChannel,
  report: RenderedReport,
): Promise<void> {
  if (channel.type === "internal-webhook") {
    await sendInternalWebhookReport(channel.webhook, report, channel.maxMarkdownBytes);
    return;
  }

  if (channel.type === "internal-app-message") {
    await sendInternalAppMessageReport(channel, report);
    return;
  }

  await createExternalGroupTask(channel, report);
}

async function sendInternalWebhookReport(
  webhook: string,
  report: RenderedReport,
  maxMarkdownBytes: number,
): Promise<void> {
  if (utf8ByteLength(report.markdown) <= maxMarkdownBytes) {
    await postWebhookMessage(webhook, {
      msgtype: "markdown",
      markdown: {
        content: report.markdown,
      },
    });
    return;
  }

  const mediaId = await uploadWebhookFile(webhook, report);
  await postWebhookMessage(webhook, {
    msgtype: "file",
    file: {
      media_id: mediaId,
    },
  });
}

async function sendInternalAppMessageReport(
  channel: Extract<ResolvedWecomChannel, { type: "internal-app-message" }>,
  report: RenderedReport,
): Promise<void> {
  const accessToken = await getAccessToken(channel.corpId, channel.corpSecret);

  if (utf8ByteLength(report.markdown) <= channel.maxMarkdownBytes) {
    await postJson(buildApiUrl("/cgi-bin/message/send", accessToken), {
      touser: channel.touser,
      toparty: channel.toparty,
      totag: channel.totag,
      msgtype: "markdown",
      agentid: channel.agentId,
      markdown: {
        content: report.markdown,
      },
      enable_duplicate_check: channel.enableDuplicateCheck ? 1 : 0,
      duplicate_check_interval: channel.duplicateCheckInterval,
    });
    return;
  }

  const mediaId = await uploadAppFile(accessToken, report);
  await postJson(buildApiUrl("/cgi-bin/message/send", accessToken), {
    touser: channel.touser,
    toparty: channel.toparty,
    totag: channel.totag,
    msgtype: "file",
    agentid: channel.agentId,
    file: {
      media_id: mediaId,
    },
    enable_duplicate_check: channel.enableDuplicateCheck ? 1 : 0,
    duplicate_check_interval: channel.duplicateCheckInterval,
  });
}

async function createExternalGroupTask(
  channel: Extract<ResolvedWecomChannel, { type: "external-group-task" }>,
  report: RenderedReport,
): Promise<void> {
  const accessToken = await getAccessToken(channel.corpId, channel.corpSecret);
  const content = toExternalSummary(report.markdown, channel.maxTextLength, channel.textPrefix);
  const body: Record<string, unknown> = {
    chat_type: channel.chatType,
    sender: channel.sender,
    allow_select: channel.allowSelect,
    text: {
      content,
    },
  };

  if (channel.chatType === "single" && channel.externalUserIds.length > 0) {
    body.external_userid = channel.externalUserIds;
  }

  await postJson(buildApiUrl("/cgi-bin/externalcontact/add_msg_template", accessToken), body);
}

async function uploadWebhookFile(webhook: string, report: RenderedReport): Promise<string> {
  const webhookUrl = new URL(webhook);
  const key = webhookUrl.searchParams.get("key");
  if (!key) {
    throw new Error("Webhook 缺少 key，无法上传文件");
  }

  const uploadUrl = `${webhookUrl.origin}/cgi-bin/webhook/upload_media?key=${key}&type=file`;
  return uploadFile(uploadUrl, report);
}

async function uploadAppFile(accessToken: string, report: RenderedReport): Promise<string> {
  const uploadUrl = buildApiUrl("/cgi-bin/media/upload", accessToken, { type: "file" });
  return uploadFile(uploadUrl, report);
}

async function uploadFile(url: string, report: RenderedReport): Promise<string> {
  const form = new FormData();
  form.append("media", new Blob([report.markdown], { type: "text/markdown;charset=utf-8" }), `${sanitizeFileName(report.title)}.md`);

  const response = await fetch(url, {
    method: "POST",
    body: form,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.errcode !== 0 || !payload?.media_id) {
    throw new Error(
      `企业微信文件上传失败: ${payload?.errmsg ?? response.statusText ?? "未知错误"}`,
    );
  }

  return String(payload.media_id);
}

async function postWebhookMessage(
  webhook: string,
  body: Record<string, unknown>,
): Promise<void> {
  await postJson(webhook, body);
}

async function postJson(url: string, body: Record<string, unknown>): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.errcode !== 0) {
    throw new Error(
      `企业微信推送失败: ${payload?.errmsg ?? response.statusText ?? "未知错误"}`,
    );
  }
}

async function getAccessToken(corpId: string, corpSecret: string): Promise<string> {
  const cacheKey = `${corpId}:${corpSecret}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 120_000) {
    return cached.token;
  }

  const query = new URLSearchParams({
    corpid: corpId,
    corpsecret: corpSecret,
  });
  const response = await fetch(`https://qyapi.weixin.qq.com/cgi-bin/gettoken?${query.toString()}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.errcode !== 0 || !payload?.access_token) {
    throw new Error(
      `获取企业微信 access_token 失败: ${payload?.errmsg ?? response.statusText ?? "未知错误"}`,
    );
  }

  const expiresIn = Number(payload.expires_in ?? 7200);
  tokenCache.set(cacheKey, {
    token: String(payload.access_token),
    expiresAt: Date.now() + expiresIn * 1000,
  });

  return String(payload.access_token);
}

function buildApiUrl(
  pathname: string,
  accessToken: string,
  extraQuery?: Record<string, string>,
): string {
  const url = new URL(`https://qyapi.weixin.qq.com${pathname}`);
  url.searchParams.set("access_token", accessToken);
  for (const [key, value] of Object.entries(extraQuery ?? {})) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

function utf8ByteLength(content: string): number {
  return Buffer.byteLength(content, "utf8");
}

function sanitizeFileName(input: string): string {
  return input.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "_");
}

function toExternalSummary(
  markdown: string,
  maxTextLength: number,
  textPrefix?: string,
): string {
  const plainText = markdown
    .replace(/<font[^>]*>/g, "")
    .replace(/<\/font>/g, "")
    .replace(/[`*_>#-]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const withPrefix = textPrefix ? `${textPrefix}\n\n${plainText}` : plainText;

  if (withPrefix.length <= maxTextLength) {
    return withPrefix;
  }

  return `${withPrefix.slice(0, Math.max(0, maxTextLength - 1))}…`;
}
