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
    await sendInternalWebhookReport(
      channel.webhook,
      report,
      channel.maxMarkdownBytes,
      channel.maxTextBytes,
    );
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
  maxTextBytes: number,
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

  const chunks = splitInternalTextMessages(report.markdown, maxTextBytes);
  for (const chunk of chunks) {
    await postWebhookMessage(webhook, {
      msgtype: "text",
      text: {
        content: chunk,
      },
    });
  }
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

  const chunks = splitInternalTextMessages(report.markdown, channel.maxTextBytes);
  for (const chunk of chunks) {
    await postJson(buildApiUrl("/cgi-bin/message/send", accessToken), {
      touser: channel.touser,
      toparty: channel.toparty,
      totag: channel.totag,
      msgtype: "text",
      agentid: channel.agentId,
      text: {
        content: chunk,
      },
      enable_duplicate_check: channel.enableDuplicateCheck ? 1 : 0,
      duplicate_check_interval: channel.duplicateCheckInterval,
    });
  }
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

function toExternalSummary(
  markdown: string,
  maxTextLength: number,
  textPrefix?: string,
): string {
  const plainText = toPlainText(markdown);
  const withPrefix = textPrefix ? `${textPrefix}\n\n${plainText}` : plainText;

  if (withPrefix.length <= maxTextLength) {
    return withPrefix;
  }

  return `${withPrefix.slice(0, Math.max(0, maxTextLength - 1))}…`;
}

function toInternalPlainText(markdown: string): string {
  return toPlainText(markdown);
}

function splitInternalTextMessages(markdown: string, maxBytes: number): string[] {
  const plainText = toInternalPlainText(markdown);
  if (utf8ByteLength(plainText) <= maxBytes) {
    return [plainText];
  }

  const chunks: string[] = [];
  let current = "";

  for (const line of plainText.split("\n")) {
    const candidate = current ? `${current}\n${line}` : line;
    if (utf8ByteLength(candidate) <= maxBytes) {
      current = candidate;
      continue;
    }

    if (current) {
      chunks.push(current);
      current = "";
    }

    if (utf8ByteLength(line) <= maxBytes) {
      current = line;
      continue;
    }

    chunks.push(...splitOversizedText(line, maxBytes));
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

function splitOversizedText(value: string, maxBytes: number): string[] {
  const chunks: string[] = [];
  let current = "";

  for (const char of value) {
    const candidate = `${current}${char}`;
    if (utf8ByteLength(candidate) <= maxBytes) {
      current = candidate;
      continue;
    }

    if (current) {
      chunks.push(current);
    }
    current = char;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

function toPlainText(markdown: string): string {
  return markdown
    .replace(/<font[^>]*>/g, "")
    .replace(/<\/font>/g, "")
    .replace(/[`*_]/g, "")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
