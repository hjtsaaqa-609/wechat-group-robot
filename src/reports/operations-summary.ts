import type { OperationsReport } from "../lib/das-client.js";
import {
  formatNumber,
  formatPercent,
  toCleaningMw,
  truncate,
} from "../lib/format.js";
import { formatDateTime } from "../lib/time.js";
import type { DateRange, RenderedReport, ReportContext } from "../types.js";

export function renderOperationsSummaryReport(
  data: OperationsReport,
  context: ReportContext,
  range: DateRange,
  topN = 3,
): RenderedReport {
  const summary = data.summary;
  const cleaningTop = data.cleaningRobotRanking.top.slice(0, topN);
  const cleanlinessBottom = data.cleanlinessRobotRanking.bottom.slice(0, topN);
  const levelTwoRobots = data.levelTwoRankings.robots.slice(0, topN);

  const lines = [
    `<font color="info">[${context.jobName}] DAS 运营报表（${range.label}）</font>`,
    `统计区间：${formatDateTime(range.startAt, context.timezone)} ~ ${formatDateTime(range.endAt, context.timezone)}`,
    `发送时间：${context.executedAt}`,
    "",
    `覆盖客户：${formatNumber(summary.customerCount)} 家`,
    `覆盖电站：${formatNumber(summary.siteCount)} 座`,
    `覆盖机器人：${formatNumber(summary.robotCount)} 台`,
    `故障数：${formatNumber(summary.faultCount)} 个`,
    `故障率：${formatPercent(summary.faultRate)}`,
    `2级故障机器人占比：${formatPercent(summary.levelTwoRobotRate)}`,
    `2级故障年化次数：${formatNumber(summary.annualizedLevelTwoFaultCount, 2)}`,
    "",
    `接管/GW：${formatNumber(summary.takeoverCountPerGW, 2)}`,
    `现场维护/GW：${formatNumber(summary.onsiteMaintenanceCountPerGW, 2)}`,
    `耗材更换/GW：${formatNumber(summary.consumableReplacementCountPerGW, 2)}`,
    `清扫容量：${formatNumber(toCleaningMw(summary.monthlyCleaningArea), 2)} MW`,
    `平均清洁度：${formatNumber(summary.averageCleanliness, 1)}%`,
    `电池健康：${formatNumber(summary.batteryHealth, 1)}%`,
    `电池状态：${summary.batteryHealthStatus} / ${summary.batteryAttention}`,
  ];

  if (cleaningTop.length > 0) {
    lines.push("", `清扫 Top${cleaningTop.length}：`);
    lines.push(
      ...cleaningTop.map(
        (item, index) =>
          `${index + 1}. ${truncate(item.name, 20)} | ${formatNumber(toCleaningMw(item.cleaningArea ?? 0), 2)} MW`,
      ),
    );
  }

  if (cleanlinessBottom.length > 0) {
    lines.push("", `低清洁度 Top${cleanlinessBottom.length}：`);
    lines.push(
      ...cleanlinessBottom.map(
        (item, index) =>
          `${index + 1}. ${truncate(item.name, 20)} | ${formatNumber(item.cleanliness ?? 0, 1)}%`,
      ),
    );
  }

  if (levelTwoRobots.length > 0) {
    lines.push("", `2级故障机器人：`);
    lines.push(
      ...levelTwoRobots.map(
        (item, index) =>
          `${index + 1}. ${truncate(item.name, 20)} | ${formatNumber(item.count ?? 0)} 次`,
      ),
    );
  }

  return {
    title: `DAS 运营报表（${range.label}）`,
    markdown: lines.join("\n"),
  };
}
