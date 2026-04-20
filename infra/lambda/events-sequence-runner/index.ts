// Stage 9 Sequence Runner Lambda Purpose
import { createStage3Services } from "../shared/database";
import { sendAutomationEmail } from "../shared/automation-notifications";
import { sendSmartFileWorkflow } from "../shared/smart-file-send-workflow";

const millisecondsPerHour = 60 * 60 * 1000;
const hoursUntil = (value: Date, now: Date) => (value.getTime() - now.getTime()) / millisecondsPerHour;

export const handler = async () => {
  const now = new Date();
  const {
    activitiesService,
    clientsService,
    sessionsService,
    smartFilesService,
    studioBookingsService,
  } = createStage3Services();

  let scheduledSmartFilesSent = 0;
  let sessionRemindersSent = 0;
  let sessionThankYousSent = 0;
  let bookingRemindersSent = 0;
  let bookingThankYousSent = 0;
  let expiredHoldsCancelled = 0;

  const scheduledSmartFiles = await smartFilesService.listSmartFiles({
    status: "draft",
  });

  for (const smartFile of scheduledSmartFiles) {
    if (!smartFile.scheduledSendAt || smartFile.scheduledSendAt > now) {
      continue;
    }

    await sendSmartFileWorkflow({
      smartFileId: smartFile.id,
      smartFilesService,
      activitiesService,
      actor: "system",
      occurredAt: now,
    });
    scheduledSmartFilesSent += 1;
  }

  const sessionReminderWindowStart = new Date(now.getTime() + 6.5 * 24 * millisecondsPerHour);
  const sessionReminderWindowEnd = new Date(now.getTime() + 7.5 * 24 * millisecondsPerHour);
  const sessionCandidates = await sessionsService.listSessions({
    from: sessionReminderWindowStart,
    to: sessionReminderWindowEnd,
    limit: 200,
  });

  for (const session of sessionCandidates) {
    if (!session.scheduledStart || !["scheduled", "confirmed"].includes(session.status)) {
      continue;
    }

    const client = await clientsService.getClientById(session.clientId);
    if (!client?.email) {
      continue;
    }

    const questionnaireNote = session.questionnaireResponseId
      ? "Kevin has your questionnaire on file."
      : "Please send Kevin any remaining questionnaire details before the session.";

    const result = await sendAutomationEmail({
      services: { activitiesService },
      externalMessageId: `sequence:session-prep:${session.id}`,
      actor: "system",
      occurredAt: now,
      clientId: client.id,
      scopeType: "session",
      scopeId: session.id,
      activityType: "session.pre_session_reminder",
      recipientEmail: client.email,
      subject: `Reminder: ${session.title} is one week away`,
      body: [
        `Hi ${client.primaryName},`,
        "",
        `${session.title} is coming up on ${session.scheduledStart.toISOString()}.`,
        questionnaireNote,
        session.locationName ? `Location: ${session.locationName}` : null,
        "",
        "Reply if anything has changed before the shoot.",
        "",
        "Kevin's Studio OS",
      ]
        .filter(Boolean)
        .join("\n"),
      metadata: {
        sessionId: session.id,
        questionnaireOutstanding: !session.questionnaireResponseId,
      },
    });

    if (!result.duplicate) {
      sessionRemindersSent += 1;
    }
  }

  const sessionThankYouStart = new Date(now.getTime() - 32 * millisecondsPerHour);
  const sessionThankYouEnd = new Date(now.getTime() - 12 * millisecondsPerHour);
  const recentSessions = await sessionsService.listSessions({
    from: sessionThankYouStart,
    to: now,
    limit: 200,
  });

  for (const session of recentSessions) {
    if (session.status !== "completed") {
      continue;
    }

    const sessionEnd = session.actualEnd ?? session.scheduledEnd ?? session.scheduledStart;
    if (!sessionEnd) {
      continue;
    }

    const hoursSinceSessionEnd = (now.getTime() - sessionEnd.getTime()) / millisecondsPerHour;
    if (hoursSinceSessionEnd < 12 || hoursSinceSessionEnd > 32) {
      continue;
    }

    const client = await clientsService.getClientById(session.clientId);
    if (!client?.email) {
      continue;
    }

    const result = await sendAutomationEmail({
      services: { activitiesService },
      externalMessageId: `sequence:session-thank-you:${session.id}`,
      actor: "system",
      occurredAt: now,
      clientId: client.id,
      scopeType: "session",
      scopeId: session.id,
      activityType: "session.thank_you",
      recipientEmail: client.email,
      subject: `Thank you for ${session.title}`,
      body: [
        `Hi ${client.primaryName},`,
        "",
        `Thank you again for ${session.title}. Kevin is starting post-production and will keep you posted on delivery.`,
        "",
        "Kevin's Studio OS",
      ].join("\n"),
    });

    if (!result.duplicate) {
      sessionThankYousSent += 1;
    }
  }

  const upcomingBookings = await studioBookingsService.listBookings({
    status: "confirmed",
    from: now,
    to: new Date(now.getTime() + 30 * millisecondsPerHour),
  });

  for (const booking of upcomingBookings) {
    const hoursUntilBooking = hoursUntil(booking.bookingStart, now);
    if (hoursUntilBooking < 23 || hoursUntilBooking > 25) {
      continue;
    }

    const client = await clientsService.getClientById(booking.clientId);
    if (!client?.email) {
      continue;
    }

    const result = await sendAutomationEmail({
      services: { activitiesService },
      externalMessageId: `sequence:studio-24h:${booking.id}`,
      actor: "system",
      occurredAt: now,
      clientId: client.id,
      scopeType: "studio_booking",
      scopeId: booking.id,
      activityType: "studio_booking.reminder_24h",
      recipientEmail: client.email,
      subject: "Studio booking reminder for tomorrow",
      body: [
        `Hi ${client.primaryName},`,
        "",
        `This is a reminder that your studio booking starts at ${booking.bookingStart.toISOString()}.`,
        "Please review house rules, arrive on time, and reply if you need anything before check-in.",
        "",
        "Kevin's Studio OS",
      ].join("\n"),
    });

    if (!result.duplicate) {
      bookingRemindersSent += 1;
    }
  }

  const recentCompletedBookings = await studioBookingsService.listBookings({
    status: "completed",
    from: new Date(now.getTime() - 48 * millisecondsPerHour),
    to: now,
  });

  for (const booking of recentCompletedBookings) {
    const hoursSinceBookingEnd = (now.getTime() - booking.bookingEnd.getTime()) / millisecondsPerHour;
    if (hoursSinceBookingEnd < 12 || hoursSinceBookingEnd > 36) {
      continue;
    }

    const client = await clientsService.getClientById(booking.clientId);
    if (!client?.email) {
      continue;
    }

    const result = await sendAutomationEmail({
      services: { activitiesService },
      externalMessageId: `sequence:studio-review:${booking.id}`,
      actor: "system",
      occurredAt: now,
      clientId: client.id,
      scopeType: "studio_booking",
      scopeId: booking.id,
      activityType: "studio_booking.review_request",
      recipientEmail: client.email,
      subject: "Thanks for booking Kevin's studio",
      body: [
        `Hi ${client.primaryName},`,
        "",
        "Thanks for using Kevin's creator studio.",
        "If you have a minute, reply with a quick review or anything Kevin should improve before your next booking.",
        "",
        "Kevin's Studio OS",
      ].join("\n"),
    });

    if (!result.duplicate) {
      bookingThankYousSent += 1;
    }
  }

  const heldBookings = await studioBookingsService.listBookings({ status: "hold" });
  for (const booking of heldBookings) {
    if (!booking.holdExpiresAt || booking.holdExpiresAt > now) {
      continue;
    }

    await studioBookingsService.updateBooking(
      booking.id,
      {
        status: "cancelled",
      },
      {
        actor: "system",
        occurredAt: now,
      },
    );
    expiredHoldsCancelled += 1;
  }

  return {
    scheduledSmartFilesSent,
    sessionRemindersSent,
    sessionThankYousSent,
    bookingRemindersSent,
    bookingThankYousSent,
    expiredHoldsCancelled,
  };
};
