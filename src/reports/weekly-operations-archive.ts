import type {
  DasClient,
  PowerBoostResponse,
  TodoListItem,
  TodoStatsResponse,
} from "../lib/das-client.js";
import {
  formatDays,
  formatNumber,
  parseRobotCountFromText,
  truncate,
} from "../lib/format.js";
import { resolveLastCompletedWeekRange } from "../lib/time.js";
import type { RenderedReport, ReportContext } from "../types.js";
import { ReportStateStore } from "../lib/state.js";

export async function renderWeeklyOperationsArchiveReport(
  client: DasClient,
  context: ReportContext,
  stateStore: ReportStateStore,
  detailLimit = 5,
): Promise<RenderedReport> {
  const range = resolveLastCompletedWeekRange(context.timezone);
  const [
    dashboard,
    operations,
    fieldTodos,
    todoStats,
    todoList,
    powerBoost,
    cleaningQuality,
  ] = await Promise.all([
    client.fetchDashboardData(),
    client.fetchOperationsReport(range),
    client.fetchFieldTodos(),
    client.fetchTodoStats(range),
    client.fetchTodoList(range),
    client.fetchPowerBoost(range),
    client.fetchCleaningQuality(range),
  ]);

  const currentPlatformRobotCount = (dashboard.robot.lifeCycleDistribution ?? [])
    .filter((item) => item.label === "trialRun" || item.label === "formalOperation")
    .reduce((sum, item) => sum + item.value, 0);
  const previousState = stateStore.getJobState(context.jobName);
  const robotDelta =
    typeof previousState.lastPlatformRobotCount === "number"
      ? currentPlatformRobotCount - previousState.lastPlatformRobotCount
      : null;

  const levelOneCount = sumFaultLevel(operations.faultCategoryByLevel, "1");
  const levelTwoCount = sumFaultLevel(operations.faultCategoryByLevel, "2");
  const levelTwoDetail = summarizeFaultDetails(
    operations.faultCategoryByLevel.find((item) => item.level === "2")?.data ?? [],
  );

  const weeklyBrushBacklog = summarizeWeeklyBrushBacklog(todoList.items);
  const pendingFaultDays = fieldTodos.summary.faultAvgDurationHours / 24;
  const backlogBrushDays = fieldTodos.summary.todoAvgDurationHours / 24;

  const lines = [
    `<font color="info">[${context.jobName}] 运营周报</font>`,
    `统计周期：${range.label}`,
    `发送时间：${context.executedAt}`,
    "",
    `平台机器人数量（台）：${formatNumber(currentPlatformRobotCount)}`,
    `机器人变化数量（台）：${formatSignedNumber(robotDelta)}`,
    `毛刷老化待更换（台）：${formatNumber(weeklyBrushBacklog)}`,
    `毛刷老化平均持续时间：${formatDays(backlogBrushDays)} 天`,
    `新增 1 级故障（条）：${formatNumber(levelOneCount)}`,
    `新增 2 级故障（条）：${formatNumber(levelTwoCount)}`,
    `新增 2 级故障详情：${levelTwoDetail || "-"}`,
    `待处理 2 级故障（条）：${formatNumber(fieldTodos.summary.faultCount)}`,
    `待处理 2 级故障平均持续时间（天）：${formatDays(pendingFaultDays)} 天`,
    `发电量提升低于预期：${formatNumber(powerBoost.summary.belowExpectedSiteCount)}`,
    `发电量提升低于预期详情：${summarizeSiteNames(powerBoost, detailLimit)}`,
    `客户投诉（台）：-`,
    `投诉详情：-`,
    `投诉响应时间：-`,
    `客户表扬（台）：-`,
    `表扬详情：-`,
    "",
    `补充口径：`,
    `当前参与清扫质量统计电站 ${formatNumber(cleaningQuality.summary.participatingSiteCount)} 座，未达预期 ${formatNumber(cleaningQuality.summary.belowExpectedSiteCount)} 座`,
    `周内清扫质量巡查待办 ${formatNumber(extractTodoTypeCount(todoStats, "cleaningQualityInspection"))} 条`,
  ];

  return {
    title: `运营周报（${range.label}）`,
    markdown: lines.join("\n"),
    stateUpdate: {
      lastPlatformRobotCount: currentPlatformRobotCount,
      lastPeriodLabel: range.label,
    },
  };
}

function sumFaultLevel(
  items: Array<{ level: string; data: Array<{ name: string; value: number }> }>,
  targetLevel: string,
): number {
  const level = items.find((item) => item.level === targetLevel);
  return (level?.data ?? []).reduce((sum, item) => sum + item.value, 0);
}

function summarizeFaultDetails(
  items: Array<{ name: string; value: number }>,
): string {
  if (items.length === 0) {
    return "";
  }

  return items
    .map((item) => {
      const label = item.name.includes("-")
        ? item.name.split("-").at(-1) ?? item.name
        : item.name;
      return `${formatNumber(item.value)}台${label}`;
    })
    .join("、");
}

function summarizeWeeklyBrushBacklog(items: TodoListItem[]): number {
  return items
    .filter(
      (item) =>
        item.type === "cleaningQualityInspection" && String(item.name).includes("毛刷"),
    )
    .reduce((sum, item) => sum + parseRobotCountFromText(item.name), 0);
}

function summarizeSiteNames(
  powerBoost: PowerBoostResponse,
  limit: number,
): string {
  const names = powerBoost.belowExpectedSites
    .slice(0, limit)
    .map((item) => truncate(item.siteName, 18));

  return names.length > 0 ? names.join("、") : "-";
}

function extractTodoTypeCount(data: TodoStatsResponse, type: string): number {
  return data.typeDistribution.find((item) => item.label === type)?.value ?? 0;
}

function formatSignedNumber(value: number | null): string {
  if (value === null) {
    return "-";
  }

  if (value > 0) {
    return `+${formatNumber(value)}`;
  }

  return formatNumber(value);
}
