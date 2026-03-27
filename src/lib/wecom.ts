export async function sendMarkdown(webhook: string, content: string): Promise<void> {
  const response = await fetch(webhook, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      msgtype: "markdown",
      markdown: {
        content,
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.errcode !== 0) {
    throw new Error(
      `企业微信推送失败: ${payload?.errmsg ?? response.statusText ?? "未知错误"}`,
    );
  }
}
