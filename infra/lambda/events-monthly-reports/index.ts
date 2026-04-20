// Stage 9 Monthly Reports Lambda Purpose
import { createStage3Services } from "../shared/database";
import { sendAutomationEmail } from "../shared/automation-notifications";

const recipientEmail = process.env.STUDIO_OS_SES_FROM_EMAIL?.trim();

export const handler = async () => {
  const now = new Date();
  const {
    activitiesService,
    reportsService,
    tasksService,
  } = createStage3Services();

  const revenue = await reportsService.getRevenueReport(now.getUTCFullYear());
  const profit = await reportsService.getProfitReport(now.getUTCFullYear());
  const lastMonthIndex = (now.getUTCMonth() + 11) % 12;
  const revenueMonth = revenue.months[lastMonthIndex];
  const profitMonth = profit.months[lastMonthIndex];

  const emailResult = await sendAutomationEmail({
    services: { activitiesService, tasksService },
    externalMessageId: `reports:monthly:${now.getUTCFullYear()}-${now.getUTCMonth() + 1}`,
    actor: "system",
    occurredAt: now,
    scopeType: "admin",
    scopeId: null,
    activityType: "reports.monthly_snapshot",
    recipientEmail,
    subject: `Monthly P&L snapshot for ${now.getUTCFullYear()}`,
    body: [
      "Kevin,",
      "",
      `Last completed month: ${profitMonth.month}`,
      `Revenue: $${(profitMonth.revenueCents / 100).toFixed(2)}`,
      `Expenses: $${(profitMonth.expenseCents / 100).toFixed(2)}`,
      `Profit: $${(profitMonth.profitCents / 100).toFixed(2)}`,
      `Outstanding invoices in ${revenueMonth.month}: $${(revenueMonth.outstandingCents / 100).toFixed(2)}`,
      "",
      "Retainer invoice generation is still a manual follow-up until recurring invoice modeling is added.",
    ].join("\n"),
  });

  return {
    deliveryStatus: emailResult.deliveryStatus,
    deliveryError: emailResult.deliveryError,
  };
};
