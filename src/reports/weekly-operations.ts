import type { DasClient } from "../lib/das-client.js";
import {
  formatDays,
  formatNumber,
  formatPercent,
  toCleaningMw,
} from "../lib/format.js";
import { resolveLastCompletedWeekRange, resolveYearToDateRange } from "../lib/time.js";
import type { DateRange, RenderedReport, ReportContext } from "../types.js";
import { ReportStateStore } from "../lib/state.js";

const KPI_TARGETS = {
  companyRobotCount: 1000,
  companyConfirmedRevenueWan: 2000,
  yearlyComplaintCount: 12,
  customerSatisfactionRate: 0.95,
  outgoingYieldRate: 0.99,
  shippingAccuracyRate: 0.995,
  quarterlyInventoryAccuracyRate: 0.99,
  manufacturingCostPerRobot: 2500,
  preliminaryDesignCost: 400,
  detailedDesignCost: 1200,
  installationDebugCost: 2400,
  annualConsumableCost: 3600,
  annualFaultHandlingCost: 1850,
  takeoverPerGw: 3,
  onsiteMaintenancePerGw: 7,
  brushReplacementPerGw: 12,
  cleanlinessBelowExpectedRate: 0.03,
  levelThreeFaultCount: 1,
  abnormalModuleClearRate: 0.9,
  belowExpectedBoostRate: 0.1,
  roofFaultCommunicationRate: 1,
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
    faultOperations,
    yearFaultOperations,
    fieldTodos,
    todoList,
  ] = await Promise.all([
    client.fetchBusinessStats(),
    client.fetchProjectStats(),
    client.fetchOperationsReport(weekRange),
    client.fetchFaultOperationsReport(weekRange),
    client.fetchFaultOperationsReport(yearRange),
    client.fetchFieldTodos(),
    client.fetchTodoList(weekRange),
  ]);

  const [complaints, yearlyInspectionKpi, powerBoost] = await Promise.all([
    fetchOptional("年度累计投诉数量", () => client.fetchCustomerComplaints(yearRange)),
    fetchYearlyInspectionKpi(client, yearRange),
    fetchOptional("发电量未达预期率", () => client.fetchPowerBoost(weekRange)),
  ]);
  const cleaningQuality = await fetchOptional("清洁度未达预期率", () =>
    client.fetchCleaningQuality(weekRange),
  );

  const currentPlatformRobotCount =
    business.summary.trialRun + business.summary.formalOperation;
  const levelThreeCount = sumFaultLevel(faultOperations.faultCategoryByLevel, "3");
  const cleaningInspectionBacklog = fieldTodos.summary.todoCount;
  const brushBacklogDays = fieldTodos.summary.todoAvgDurationHours / 24;
  const pendingFaultDays = fieldTodos.summary.faultAvgDurationHours / 24;
  const derivedKpis = deriveWeeklyPerGwKpis(operations.summary.monthlyCleaningArea, {
    fieldFaults: fieldTodos.faults,
    todoItems: todoList.items,
    range: weekRange,
  });
  const takeoverCountPerGw =
    faultOperations.summary.takeoverCountPerGW > 0
      ? faultOperations.summary.takeoverCountPerGW
      : derivedKpis.takeoverCountPerGw;
  const onsiteMaintenanceCountPerGw =
    faultOperations.summary.onsiteMaintenanceCountPerGW > 0
      ? faultOperations.summary.onsiteMaintenanceCountPerGW
      : derivedKpis.onsiteMaintenanceCountPerGw;
  const consumableReplacementCountPerGw =
    yearFaultOperations.summary.consumableReplacementCountPerGW > 0
      ? yearFaultOperations.summary.consumableReplacementCountPerGW
      : faultOperations.summary.consumableReplacementCountPerGW > 0
        ? faultOperations.summary.consumableReplacementCountPerGW
        : derivedKpis.consumableReplacementCountPerGw;

  const projectQuality = project.quality;
  if (!projectQuality) {
    throw new Error("项目质量统计缺失，无法生成 KPI 周报");
  }

  const abnormalModuleLine = yearlyInspectionKpi.available
    ? formatThresholdPercentKpi(
        "年度累计异常组件解决率",
        yearlyInspectionKpi.actual,
        KPI_TARGETS.abnormalModuleClearRate,
        ">=",
      )
    : formatUnavailableKpi(
        "年度累计异常组件解决率",
        `目标 >= ${formatPercent(KPI_TARGETS.abnormalModuleClearRate, 2)}`,
        yearlyInspectionKpi.note,
      );

  const lines = [
    `<font color="info">[${context.jobName}] 经营周报</font>`,
    `统计周期：${weekRange.label}`,
    `发送时间：${context.executedAt}`,
    `统计说明：周报默认按自然周统计；投诉、异常组件解决率、每GW毛刷更换次数按年度累计统计`,
    `标记说明：尚未入系统 = 目标已在 2026 经营目标中明确，但 DAS 当前缺少稳定字段或统计口径仍待确认`,
    "",
    section("公司整体"),
    formatCountKpi(
      "机器人累计上线",
      currentPlatformRobotCount,
      KPI_TARGETS.companyRobotCount,
      "台",
    ),
    `口径：试运行 ${formatNumber(business.summary.trialRun)} + 正式运营 ${formatNumber(business.summary.formalOperation)}`,
    formatUnavailableKpi(
      "确认收入",
      `目标 ${formatNumber(KPI_TARGETS.companyConfirmedRevenueWan)} 万`,
    ),
    formatUnavailableKpi("公司整体盈利", "目标 2026 年底实现整体盈利"),
    "",
    section("客户满意度"),
    formatThresholdCountKpi(
      "年度累计投诉数量",
      complaints?.summary.complaintCount ?? null,
      KPI_TARGETS.yearlyComplaintCount,
      "次",
      "<",
    ),
    formatUnavailableKpi(
      "客户满意度",
      `目标 >= ${formatPercent(KPI_TARGETS.customerSatisfactionRate, 2)}`,
    ),
    "",
    section("市场销售部"),
    formatCountKpi(
      "机器人累计上线",
      currentPlatformRobotCount,
      KPI_TARGETS.companyRobotCount,
      "台",
    ),
    `目标拆分：存量 250 台 + 新增 750 台`,
    formatUnavailableKpi("确认收入", "目标 2,000 万（存量 300 万 + 新增 1,700 万）"),
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
    formatUnavailableKpi(
      "季度库存盘点准确率",
      `目标 >= ${formatPercent(KPI_TARGETS.quarterlyInventoryAccuracyRate, 2)}`,
    ),
    formatUnavailableKpi(
      "单台机器人制造成本",
      `目标 <= ${formatNumber(KPI_TARGETS.manufacturingCostPerRobot)} 元`,
    ),
    "",
    section("研发部"),
    formatUnavailableKpi(
      "PCR-300 新产品批量生产",
      "目标 2026-06-30 完成产品化闭环（硬件版本冻结、BOM/图纸/工艺发布）",
    ),
    formatUnavailableKpi(
      "PCR-300 量产成本控制",
      "目标 2026-12-31 前单套机器人 + 基准机库 BOM 成本 <= 1.8 万",
    ),
    formatUnavailableKpi(
      "CTR 工程样机交付",
      "目标 2026-05-31 前完成 2 台样机交付并完成关键问题闭环",
    ),
    formatThresholdNumberKpi(
      "每GW远程接管次数",
      takeoverCountPerGw,
      KPI_TARGETS.takeoverPerGw,
      "<=",
    ),
    formatThresholdNumberKpi(
      "每GW现场维护次数",
      onsiteMaintenanceCountPerGw,
      KPI_TARGETS.onsiteMaintenancePerGw,
      "<=",
    ),
    formatThresholdNumberKpi(
      "年度累计每GW毛刷更换次数",
      consumableReplacementCountPerGw,
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
      "清洁度未达预期率",
      cleaningQuality?.summary.belowExpectedRatio ?? null,
      KPI_TARGETS.cleanlinessBelowExpectedRate,
      "<=",
    ),
    abnormalModuleLine,
    formatThresholdPercentKpi(
      "发电量未达预期率",
      powerBoost?.summary.belowExpectedRatio ?? null,
      KPI_TARGETS.belowExpectedBoostRate,
      "<=",
    ),
    formatUnavailableKpi(
      "屋顶形变故障沟通率",
      `目标 >= ${formatPercent(KPI_TARGETS.roofFaultCommunicationRate, 2)}`,
    ),
    "",
    section("项目部-费用控制目标"),
    formatUnavailableKpi(
      "初步方案设计费",
      `目标 <= ${formatNumber(KPI_TARGETS.preliminaryDesignCost)} 元`,
    ),
    formatUnavailableKpi(
      "详细方案设计费",
      `目标 <= ${formatNumber(KPI_TARGETS.detailedDesignCost)} 元`,
    ),
    formatUnavailableKpi(
      "安装调试费",
      `目标 <= ${formatNumber(KPI_TARGETS.installationDebugCost)} 元`,
    ),
    formatUnavailableKpi(
      "年化耗材更换费用",
      `目标 <= ${formatNumber(KPI_TARGETS.annualConsumableCost)} 元`,
    ),
    formatUnavailableKpi(
      "年化故障处理费用",
      `目标 <= ${formatNumber(KPI_TARGETS.annualFaultHandlingCost)} 元`,
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

function formatUnavailableKpi(
  label: string,
  targetText: string,
  note?: string,
): string {
  const suffix = note ? `；${note}` : "";
  return `${label}：尚未入系统（${targetText}${suffix}）`;
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

async function fetchYearlyInspectionKpi(
  client: DasClient,
  range: DateRange,
): Promise<
  | { available: true; actual: number | null }
  | { available: false; note: string }
> {
  try {
    const inspection = await client.fetchInspectionStats(range);
    return {
      available: true,
      actual: inspection.summary.abnormalModuleClearRate,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[weekly-operations] 年度累计异常组件解决率降级为尚未入系统 | ${message}`);
    return {
      available: false,
      note: "DAS inspection-stats 只要查询区间包含 2026-01 即会返回 502",
    };
  }
}

function deriveWeeklyPerGwKpis(
  cleaningArea: number,
  inputs: {
    fieldFaults: Array<{ level: string; startAt: string }>;
    todoItems: Array<{
      type: string;
      status: string;
      name: string;
      createdAt: string;
      processedAt: string | null;
    }>;
    range: { startAt: string; endAt: string };
  },
): {
  takeoverCountPerGw: number;
  onsiteMaintenanceCountPerGw: number;
  consumableReplacementCountPerGw: number;
} {
  const cleanedGw = toCleaningMw(cleaningArea) / 1000;
  if (!Number.isFinite(cleanedGw) || cleanedGw <= 0) {
    return {
      takeoverCountPerGw: 0,
      onsiteMaintenanceCountPerGw: 0,
      consumableReplacementCountPerGw: 0,
    };
  }

  const takeoverCount = inputs.todoItems.filter(
    (item) =>
      item.type === "faultHandling" && isWithinRange(item.createdAt, inputs.range),
  ).length;
  const onsiteMaintenanceCount = inputs.fieldFaults.filter(
    (item) => item.level === "2" && isWithinRange(item.startAt, inputs.range),
  ).length;
  const consumableReplacementCount = inputs.todoItems
    .filter(
      (item) =>
        item.type === "cleaningQualityInspection" &&
        item.status === "processed" &&
        item.processedAt !== null &&
        isWithinRange(item.processedAt, inputs.range),
    )
    .reduce((sum, item) => sum + parseBrushReplacementCount(item.name), 0);

  return {
    takeoverCountPerGw: takeoverCount / cleanedGw,
    onsiteMaintenanceCountPerGw: onsiteMaintenanceCount / cleanedGw,
    consumableReplacementCountPerGw: consumableReplacementCount / cleanedGw,
  };
}

function isWithinRange(
  value: string,
  range: { startAt: string; endAt: string },
): boolean {
  const target = Date.parse(value);
  const start = Date.parse(range.startAt);
  const end = Date.parse(range.endAt);

  return Number.isFinite(target) && target >= start && target <= end;
}

function parseBrushReplacementCount(text: string): number {
  const explicitCount = text.match(/(?:共)?\s*(\d+)\s*(?:台|条)/);
  if (explicitCount) {
    return Number(explicitCount[1]);
  }

  const robotMentions = new Set<string>();
  for (const match of text.matchAll(/(\d+-\d+|\d+号(?:机|机器人))/g)) {
    robotMentions.add(match[1]);
  }
  if (robotMentions.size > 0) {
    return robotMentions.size;
  }

  return text.includes("毛刷") ? 1 : 0;
}
