import type { DasClient } from "../lib/das-client.js";
import {
  formatDays,
  formatNumber,
  formatPercent,
} from "../lib/format.js";
import { resolveLastCompletedWeekRange, resolveYearToDateRange } from "../lib/time.js";
import type { RenderedReport, ReportContext } from "../types.js";
import { ReportStateStore } from "../lib/state.js";

const KPI_TARGETS = {
  companyRobotCount: 1000,
  yearlyComplaintCount: 12,
  outgoingYieldRate: 0.99,
  shippingAccuracyRate: 0.995,
  takeoverPerGw: 3,
  onsiteMaintenancePerGw: 7,
  brushReplacementPerGw: 12,
  levelThreeFaultCount: 1,
  abnormalModuleClearRate: 0.9,
  belowExpectedBoostRate: 0.1,
  installSuccessRate: 0.99,
  opsSuccessRate: 0.98,
  brushBacklogDays: 14,
  pendingFaultDays: 7,
} as const;

export async function renderWeeklyOperationsReport(
  client: DasClient,
  context: ReportContext,
  _stateStore: ReportStateStore,
  _detailLimit = 5,
): Promise<RenderedReport> {
  const weekRange = resolveLastCompletedWeekRange(context.timezone);
  const yearRange = resolveYearToDateRange(context.timezone);

  const [
    business,
    project,
    operations,
    fieldTodos,
  ] = await Promise.all([
    client.fetchBusinessStats(),
    client.fetchProjectStats(),
    client.fetchOperationsReport(weekRange),
    client.fetchFieldTodos(),
  ]);

  const [complaints, inspection, powerBoost] = await Promise.all([
    fetchOptional("年度累计投诉数量", () => client.fetchCustomerComplaints(yearRange)),
    fetchOptional("异常组件解决率", () => client.fetchInspectionStats(weekRange)),
    fetchOptional("发电量未达预期率", () => client.fetchPowerBoost(weekRange)),
  ]);

  const currentPlatformRobotCount =
    business.summary.trialRun + business.summary.formalOperation;
  const levelThreeCount = sumFaultLevel(operations.faultCategoryByLevel, "3");
  const cleaningInspectionBacklog = fieldTodos.summary.todoCount;
  const brushBacklogDays = fieldTodos.summary.todoAvgDurationHours / 24;
  const pendingFaultDays = fieldTodos.summary.faultAvgDurationHours / 24;

  const projectQuality = project.quality;
  if (!projectQuality) {
    throw new Error("项目质量统计缺失，无法生成 KPI 周报");
  }

  const lines = [
    `<font color="info">[${context.jobName}] 经营周报</font>`,
    `统计周期：${weekRange.label}`,
    `发送时间：${context.executedAt}`,
    `统计说明：周报指标按自然周统计，投诉按年度累计统计`,
    "",
    section("公司整体"),
    formatCountKpi(
      "机器人累计上线",
      currentPlatformRobotCount,
      KPI_TARGETS.companyRobotCount,
      "台",
    ),
    `口径：试运行 ${formatNumber(business.summary.trialRun)} + 正式运营 ${formatNumber(business.summary.formalOperation)}`,
    "",
    section("客户满意度"),
    formatThresholdCountKpi(
      "年度累计投诉数量",
      complaints?.summary.complaintCount ?? null,
      KPI_TARGETS.yearlyComplaintCount,
      "次",
      "<",
    ),
    "",
    section("市场销售部"),
    formatCountKpi(
      "机器人累计上线",
      currentPlatformRobotCount,
      KPI_TARGETS.companyRobotCount,
      "台",
    ),
    "",
    section("生产部"),
    formatThresholdPercentKpi(
      "出厂良品率",
      projectQuality.productionOutgoingYield.yearToDate.yieldRate,
      KPI_TARGETS.outgoingYieldRate,
      ">=",
    ),
    formatThresholdPercentKpi(
      "发货正确率",
      projectQuality.productionShippingAccuracy.yearToDate.accuracyRate,
      KPI_TARGETS.shippingAccuracyRate,
      ">=",
    ),
    "",
    section("研发部"),
    formatThresholdNumberKpi(
      "每GW远程接管次数",
      operations.summary.takeoverCountPerGW,
      KPI_TARGETS.takeoverPerGw,
      "<=",
    ),
    formatThresholdNumberKpi(
      "每GW现场维护次数",
      operations.summary.onsiteMaintenanceCountPerGW,
      KPI_TARGETS.onsiteMaintenancePerGw,
      "<=",
    ),
    formatThresholdNumberKpi(
      "每GW毛刷更换次数",
      operations.summary.consumableReplacementCountPerGW,
      KPI_TARGETS.brushReplacementPerGw,
      "<=",
    ),
    "",
    section("运营部"),
    formatThresholdCountKpi(
      "新增3级故障数",
      levelThreeCount,
      KPI_TARGETS.levelThreeFaultCount,
      "次",
      "<=",
    ),
    formatThresholdPercentKpi(
      "异常组件解决率",
      inspection?.summary.abnormalModuleClearRate ?? null,
      KPI_TARGETS.abnormalModuleClearRate,
      ">=",
    ),
    formatThresholdPercentKpi(
      "发电量未达预期率",
      powerBoost?.summary.belowExpectedRatio ?? null,
      KPI_TARGETS.belowExpectedBoostRate,
      "<=",
    ),
    "",
    section("项目部-质量目标"),
    formatThresholdPercentKpi(
      "安装一次成功率",
      projectQuality.installOnceSuccess.actualRate,
      KPI_TARGETS.installSuccessRate,
      ">=",
    ),
    formatThresholdPercentKpi(
      "运维成功率",
      projectQuality.opsSuccess.actualRate,
      KPI_TARGETS.opsSuccessRate,
      ">=",
    ),
    "",
    section("项目部-时效目标"),
    `清扫质量巡检待办（涉及机器人）：${formatNumber(cleaningInspectionBacklog)}`,
    `清扫质量平均持续时间：${formatDays(brushBacklogDays)} 天（目标 <= ${formatNumber(KPI_TARGETS.brushBacklogDays)}天）`,
    `待处理2级故障（条）：${formatNumber(fieldTodos.summary.faultCount)}`,
    `待处理2级故障平均持续时间（天）：${formatDays(pendingFaultDays)} 天（目标 <= ${formatNumber(KPI_TARGETS.pendingFaultDays)}天）`,
  ];

  return {
    title: `经营周报（${weekRange.label}）`,
    markdown: lines.join("\n"),
    stateUpdate: {
      lastPlatformRobotCount: currentPlatformRobotCount,
      lastPeriodLabel: weekRange.label,
    },
  };
}

function section(title: string): string {
  return `<font color="info">${title}</font>`;
}

function sumFaultLevel(
  items: Array<{ level: string; data: Array<{ name: string; value: number }> }>,
  targetLevel: string,
): number {
  const level = items.find((item) => item.level === targetLevel);
  return (level?.data ?? []).reduce((sum, item) => sum + item.value, 0);
}

function formatCountKpi(
  label: string,
  actual: number,
  target: number,
  unit: string,
): string {
  const progress = target > 0 ? `${formatPercent(actual / target, 1)}` : "--";
  return `${label}：${formatNumber(actual)} ${unit} / ${formatNumber(target)} ${unit}（达成 ${progress}）`;
}

function formatThresholdCountKpi(
  label: string,
  actual: number | null,
  target: number,
  unit: string,
  operator: "<" | "<=" | ">=",
): string {
  const actualText = actual === null ? "--" : `${formatNumber(actual)} ${unit}`;
  return `${label}：${actualText}（目标 ${operator} ${formatNumber(target)} ${unit}）`;
}

function formatThresholdNumberKpi(
  label: string,
  actual: number,
  target: number,
  operator: "<=" | ">=",
): string {
  return `${label}：${formatNumber(actual, 2)}（目标 ${operator} ${formatNumber(target, 2)}）`;
}

function formatThresholdPercentKpi(
  label: string,
  actual: number | null,
  target: number,
  operator: "<=" | ">=",
): string {
  const actualText = actual === null ? "--" : formatPercent(actual, 2);
  return `${label}：${actualText}（目标 ${operator} ${formatPercent(target, 2)}）`;
}

async function fetchOptional<T>(
  label: string,
  loader: () => Promise<T>,
): Promise<T | null> {
  try {
    return await loader();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[weekly-operations] 可选指标降级为 -- : ${label} | ${message}`);
    return null;
  }
}
