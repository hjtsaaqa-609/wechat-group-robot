import type { DashboardData } from "../lib/das-client.js";
import { formatNumber, formatPercent } from "../lib/format.js";
import type { RenderedReport, ReportContext } from "../types.js";

export function renderDashboardSummaryReport(
  data: DashboardData,
  context: ReportContext,
): RenderedReport {
  const installedRobotSiteCount = data.site.sites.filter(
    (site) => Number(site.robots) > 0,
  ).length;
  const onlineRate =
    data.robot.summary.robotCount > 0
      ? data.robot.summary.onlineCount / data.robot.summary.robotCount
      : 0;

  const markdown = [
    `<font color="info">[${context.jobName}] DAS 数据总览</font>`,
    `发送时间：${context.executedAt}`,
    "",
    `电站：${formatNumber(data.site.summary.siteCount)} 个`,
    `装机容量：${formatNumber(data.site.summary.installedCapacity, 1)} MWp`,
    `已装机器人电站：${formatNumber(installedRobotSiteCount)} 个`,
    `告警数：${formatNumber(data.site.summary.alarmCount)} 个`,
    "",
    `机器人：${formatNumber(data.robot.summary.robotCount)} 台`,
    `在线：${formatNumber(data.robot.summary.onlineCount)} 台`,
    `离线：${formatNumber(data.robot.summary.offlineCount)} 台`,
    `异常：${formatNumber(data.robot.summary.abnormalCount)} 台`,
    `在线率：${formatPercent(onlineRate)}`,
    "",
    `客户：${formatNumber(data.customer.summary.customerCount)} 家`,
    `已装机客户：${formatNumber(data.customer.summary.installedCustomerCount)} 家`,
    `已装机电站：${formatNumber(data.customer.summary.installedSiteCount)} 座`,
    `机器人覆盖容量：${formatNumber(data.customer.summary.installedRobotCapacity, 2)} MWp`,
    "",
    `项目日志：${formatNumber(data.project.summary.logCount)} 条`,
    `问题数：${formatNumber(data.project.summary.issueCount)} 个`,
    `问题率：${formatPercent(data.project.summary.issueRate)}`,
  ].join("\n");

  return {
    title: "DAS 数据总览",
    markdown,
  };
}
