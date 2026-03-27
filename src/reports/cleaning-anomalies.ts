import type { CleaningAnomalyReport } from "../lib/das-client.js";
import { formatNumber, truncate } from "../lib/format.js";
import { formatDateTime } from "../lib/time.js";
import type { DateRange, RenderedReport, ReportContext } from "../types.js";

export function renderCleaningAnomaliesReport(
  data: CleaningAnomalyReport,
  context: ReportContext,
  range: DateRange,
  limit = 5,
  skipWhenEmpty = true,
): RenderedReport | null {
  const rows = data.rows.slice(0, limit);
  if (skipWhenEmpty && data.summary.anomalyCount === 0) {
    return null;
  }

  const lines = [
    `<font color="warning">[${context.jobName}] 清扫面积异常审计（${range.label}）</font>`,
    `统计区间：${formatDateTime(range.startAt, context.timezone)} ~ ${formatDateTime(range.endAt, context.timezone)}`,
    `发送时间：${context.executedAt}`,
    "",
    `任务总数：${formatNumber(data.summary.totalTaskCount)}`,
    `有效任务：${formatNumber(data.summary.validDurationTaskCount)}`,
    `异常任务：${formatNumber(data.summary.anomalyCount)}`,
    `P50 面积效率：${formatNumber(data.summary.areaPerHourP50, 2)} m²/h`,
    `P95 面积效率：${formatNumber(data.summary.areaPerHourP95, 2)} m²/h`,
    `异常阈值：${formatNumber(data.summary.thresholdAreaPerHour, 2)} m²/h`,
  ];

  if (rows.length === 0) {
    lines.push("", "本期未发现异常任务。");
  } else {
    lines.push("", `异常明细 Top${rows.length}：`);
    lines.push(
      ...rows.map((row, index) => {
        const start = formatDateTime(row.startAt, context.timezone);
        const end = formatDateTime(row.endAt, context.timezone);
        return [
          `${index + 1}. ${truncate(row.siteName, 18)} / ${truncate(row.robotName, 16)}`,
          `任务 ${row.taskId} | ${start} ~ ${end}`,
          `效率 ${formatNumber(row.areaPerHour ?? 0, 2)} m²/h | 折算 ${formatNumber(row.equivalentMw, 4)} MW | 原因 ${row.reason}`,
        ].join(" | ");
      }),
    );
  }

  return {
    title: `清扫面积异常审计（${range.label}）`,
    markdown: lines.join("\n"),
  };
}
