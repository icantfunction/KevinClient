// Stage 9 Invoice Overdue Lambda Purpose
import { createStage3Services } from "../shared/database";
import { sendAutomationEmail, sendAutomationSms } from "../shared/automation-notifications";

const millisecondsPerDay = 24 * 60 * 60 * 1000;
const kevinPhoneNumber = process.env.STUDIO_OS_ALLOWED_PHONE_NUMBER?.trim();

export const handler = async () => {
  const now = new Date();
  const {
    activitiesService,
    clientsService,
    invoicesService,
  } = createStage3Services();

  const invoices = await invoicesService.listInvoices();
  let overdueStatusesUpdated = 0;
  let clientNudgesSent = 0;
  let kevinAlertsSent = 0;

  for (const invoice of invoices) {
    if (!invoice.dueAt || !["sent", "partial", "overdue"].includes(invoice.status)) {
      continue;
    }

    const daysPastDue = (now.getTime() - invoice.dueAt.getTime()) / millisecondsPerDay;
    if (daysPastDue <= 0) {
      continue;
    }

    if (invoice.status !== "overdue") {
      await invoicesService.updateInvoice(
        invoice.id,
        {
          status: "overdue",
        },
        {
          actor: "system",
          occurredAt: now,
        },
      );
      overdueStatusesUpdated += 1;
    }

    const client = await clientsService.getClientById(invoice.clientId);
    if (daysPastDue >= 3 && client?.email) {
      const result = await sendAutomationEmail({
        services: { activitiesService },
        externalMessageId: `invoice:overdue-client:${invoice.id}:3`,
        actor: "system",
        occurredAt: now,
        clientId: client.id,
        scopeType: "invoice",
        scopeId: invoice.id,
        activityType: "invoice.overdue_nudge",
        recipientEmail: client.email,
        subject: "Invoice reminder from Kevin",
        body: [
          `Hi ${client.primaryName},`,
          "",
          `This is a reminder that invoice ${invoice.id} is overdue with a remaining balance of $${(invoice.balanceCents / 100).toFixed(2)}.`,
          "If you already paid Kevin offline, you can ignore this note.",
          "",
          "Kevin's Studio OS",
        ].join("\n"),
      });

      if (!result.duplicate) {
        clientNudgesSent += 1;
      }
    }

    if (daysPastDue >= 14 && kevinPhoneNumber) {
      const result = await sendAutomationSms({
        services: { activitiesService },
        externalMessageId: `invoice:overdue-kevin:${invoice.id}:14`,
        actor: "system",
        occurredAt: now,
        scopeType: "invoice",
        scopeId: invoice.id,
        activityType: "invoice.overdue_kevin_alert",
        recipientPhone: kevinPhoneNumber,
        body: `Invoice ${invoice.id} is ${Math.floor(daysPastDue)} days overdue with $${(invoice.balanceCents / 100).toFixed(2)} outstanding.`,
      });

      if (!result.duplicate) {
        kevinAlertsSent += 1;
      }
    }
  }

  return {
    overdueStatusesUpdated,
    clientNudgesSent,
    kevinAlertsSent,
  };
};
