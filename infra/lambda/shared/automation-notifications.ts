// Stage 9 Automation Notification Helpers Purpose
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import type { ActivitiesService, TasksService } from "@studio-os/database";
import { sendStudioEmail } from "./ses-outbound";

const snsClient = new SNSClient({});

type ActivityServices = {
  readonly activitiesService: ActivitiesService;
  readonly tasksService?: TasksService;
};

export const sendAutomationEmail = async (input: {
  readonly services: ActivityServices;
  readonly externalMessageId: string;
  readonly actor?: string;
  readonly occurredAt?: Date;
  readonly clientId?: string | null;
  readonly scopeType: string;
  readonly scopeId?: string | null;
  readonly activityType: string;
  readonly recipientEmail?: string | null;
  readonly subject: string;
  readonly body: string;
  readonly metadata?: Record<string, unknown>;
}) => {
  const existing = await input.services.activitiesService.getActivityByExternalMessageId(input.externalMessageId);
  if (existing) {
    return {
      activity: existing,
      deliveryStatus: "skipped" as const,
      deliveryError: "Activity already exists.",
      duplicate: true,
    };
  }

  let deliveryStatus: "sent" | "skipped" | "failed" = "skipped";
  let deliveryError: string | null = null;
  let senderConfigured = true;
  let messageId: string | null = null;

  if (!input.recipientEmail) {
    deliveryError = "Recipient email is missing.";
  } else {
    const delivery = await sendStudioEmail({
      recipientEmail: input.recipientEmail,
      subject: input.subject,
      textBody: input.body,
      htmlBody: `<p>${input.body.replace(/\n/g, "<br/>")}</p>`,
      tags: {
        clientId: input.clientId ?? null,
        scopeType: input.scopeType,
        scopeId: input.scopeId ?? null,
        activityType: input.activityType,
        externalMessageId: input.externalMessageId,
      },
    });
    deliveryStatus = delivery.deliveryStatus;
    deliveryError = delivery.deliveryError;
    senderConfigured = delivery.senderConfigured;
    messageId = delivery.messageId;
  }

  const occurredAt = input.occurredAt ?? new Date();
  const activity = await input.services.activitiesService.createActivity(
    {
      clientId: input.clientId ?? null,
      scopeType: input.scopeType,
      scopeId: input.scopeId ?? null,
      channel: "email",
      direction: "outbound",
      activityType: input.activityType,
      subject: input.subject,
      body: input.body,
      externalMessageId: input.externalMessageId,
      metadata: {
        ...(input.metadata ?? {}),
        deliveryStatus,
        deliveryError,
        senderConfigured,
        sesMessageId: messageId,
        configurationSetName: process.env.STUDIO_OS_SES_CONFIGURATION_SET_NAME ?? null,
      },
      occurredAt,
    },
    {
      actor: input.actor ?? "system",
      occurredAt,
    },
  );

  return {
    activity,
    deliveryStatus,
    deliveryError,
    duplicate: false,
  };
};

export const sendAutomationSms = async (input: {
  readonly services: ActivityServices;
  readonly externalMessageId: string;
  readonly actor?: string;
  readonly occurredAt?: Date;
  readonly clientId?: string | null;
  readonly scopeType: string;
  readonly scopeId?: string | null;
  readonly activityType: string;
  readonly recipientPhone?: string | null;
  readonly body: string;
  readonly metadata?: Record<string, unknown>;
}) => {
  const existing = await input.services.activitiesService.getActivityByExternalMessageId(input.externalMessageId);
  if (existing) {
    return {
      activity: existing,
      deliveryStatus: "skipped" as const,
      deliveryError: "Activity already exists.",
      duplicate: true,
    };
  }

  let deliveryStatus: "sent" | "skipped" | "failed" = "skipped";
  let deliveryError: string | null = null;

  if (!input.recipientPhone) {
    deliveryError = "Recipient phone is missing.";
  } else {
    try {
      await snsClient.send(
        new PublishCommand({
          PhoneNumber: input.recipientPhone,
          Message: input.body,
        }),
      );
      deliveryStatus = "sent";
    } catch (error) {
      deliveryStatus = "failed";
      deliveryError = error instanceof Error ? error.message : "Unknown SNS error.";
    }
  }

  const occurredAt = input.occurredAt ?? new Date();
  const activity = await input.services.activitiesService.createActivity(
    {
      clientId: input.clientId ?? null,
      scopeType: input.scopeType,
      scopeId: input.scopeId ?? null,
      channel: "sms",
      direction: "outbound",
      activityType: input.activityType,
      subject: input.activityType,
      body: input.body,
      externalMessageId: input.externalMessageId,
      metadata: {
        ...(input.metadata ?? {}),
        deliveryStatus,
        deliveryError,
      },
      occurredAt,
    },
    {
      actor: input.actor ?? "system",
      occurredAt,
    },
  );

  return {
    activity,
    deliveryStatus,
    deliveryError,
    duplicate: false,
  };
};

export const ensureAutomationTask = async (input: {
  readonly tasksService: TasksService;
  readonly actor?: string;
  readonly occurredAt?: Date;
  readonly scope: "standalone" | "session" | "studio_booking" | "admin";
  readonly scopeId?: string | null;
  readonly title: string;
  readonly description?: string | null;
  readonly status?: "todo" | "doing" | "waiting_client" | "waiting_vendor" | "blocked" | "done";
  readonly priority?: "low" | "medium" | "high" | "urgent";
  readonly dueAt?: Date | null;
  readonly actualDoneAt?: Date | null;
  readonly blockedReason?: string | null;
  readonly recurringRule?: string | null;
  readonly notes?: string | null;
}) => {
  const existing = await input.tasksService.findTask({
    scope: input.scope,
    scopeId: input.scopeId,
    title: input.title,
  });

  if (existing) {
    return {
      task: existing,
      created: false,
    };
  }

  const occurredAt = input.occurredAt ?? new Date();
  const task = await input.tasksService.createTask(
    {
      scope: input.scope,
      scopeId: input.scopeId ?? null,
      title: input.title,
      description: input.description ?? null,
      status: input.status,
      priority: input.priority,
      dueAt: input.dueAt ?? null,
      actualDoneAt: input.actualDoneAt ?? null,
      blockedReason: input.blockedReason ?? null,
      recurringRule: input.recurringRule ?? null,
      notes: input.notes ?? null,
    },
    {
      actor: input.actor ?? "system",
      occurredAt,
    },
  );

  return {
    task,
    created: true,
  };
};
