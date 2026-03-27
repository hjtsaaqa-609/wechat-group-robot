import { ReportStateStore } from "../lib/state.js";
import type { DasClient } from "../lib/das-client.js";
import { resolveDateRange } from "../lib/time.js";
import type { RenderedReport, ReportConfig, ReportContext } from "../types.js";
import { renderCleaningAnomaliesReport } from "./cleaning-anomalies.js";
import { renderDashboardSummaryReport } from "./dashboard-summary.js";
import { renderOperationsSummaryReport } from "./operations-summary.js";
import {
  persistWeeklyOperationsState,
  renderWeeklyOperationsReport,
} from "./weekly-operations.js";

export async function buildReport(
  client: DasClient,
  report: ReportConfig,
  context: ReportContext,
  stateStore?: ReportStateStore,
  options?: {
    persistState?: boolean;
  },
): Promise<RenderedReport | null> {
  if (report.type === "dashboard-summary") {
    const dashboard = await client.fetchDashboardData();
    return renderDashboardSummaryReport(dashboard, context);
  }

  if (report.type === "operations-summary") {
    const range = resolveDateRange(report.range ?? "today", context.timezone);
    const operations = await client.fetchOperationsReport(range);
    return renderOperationsSummaryReport(
      operations,
      context,
      range,
      report.topN ?? 3,
    );
  }

  if (report.type === "weekly-operations") {
    if (!stateStore) {
      throw new Error("weekly-operations 报表缺少状态存储");
    }

    const rendered = await renderWeeklyOperationsReport(
      client,
      context,
      stateStore,
      report.detailLimit ?? 5,
    );

    if (options?.persistState) {
      const dashboard = await client.fetchDashboardData();
      const activePlatformRobotCount = dashboard.site.summary.robotCount;
      const { resolveLastCompletedWeekRange } = await import("../lib/time.js");
      const range = resolveLastCompletedWeekRange(context.timezone);
      persistWeeklyOperationsState(
        context.jobName,
        activePlatformRobotCount,
        range.label,
        context.executedAt,
        stateStore,
      );
    }

    return rendered;
  }

  const range = resolveDateRange(report.range ?? "today", context.timezone);
  const anomalies = await client.fetchCleaningAnomalies(range);
  return renderCleaningAnomaliesReport(
    anomalies,
    context,
    range,
    report.limit ?? 5,
    report.skipWhenEmpty ?? true,
  );
}
