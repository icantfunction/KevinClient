// Stage 9 Access Code SMS Lambda Purpose
import { createStage3Services } from "../shared/database";
import { sendAutomationSms } from "../shared/automation-notifications";

const millisecondsPerHour = 60 * 60 * 1000;

export const handler = async () => {
  const now = new Date();
  const {
    activitiesService,
    clientsService,
    studioBookingsService,
  } = createStage3Services();

  const bookings = await studioBookingsService.listBookings({
    status: "confirmed",
    from: now,
    to: new Date(now.getTime() + 3 * millisecondsPerHour),
  });

  let accessCodesSent = 0;

  for (const booking of bookings) {
    const hoursUntilBooking = (booking.bookingStart.getTime() - now.getTime()) / millisecondsPerHour;
    if (hoursUntilBooking < 0 || hoursUntilBooking > 2) {
      continue;
    }

    if (!booking.depositPaid || !booking.accessCode) {
      continue;
    }

    const client = await clientsService.getClientById(booking.clientId);
    if (!client?.phone) {
      continue;
    }

    const result = await sendAutomationSms({
      services: { activitiesService },
      externalMessageId: `studio:access-code:${booking.id}`,
      actor: "system",
      occurredAt: now,
      clientId: client.id,
      scopeType: "studio_booking",
      scopeId: booking.id,
      activityType: "studio_booking.access_code",
      recipientPhone: client.phone,
      body: `Your studio access code is ${booking.accessCode}. It is valid from ${booking.accessValidFrom?.toISOString() ?? "soon"} until ${booking.accessValidUntil?.toISOString() ?? "after your booking"}.`,
      metadata: {
        bookingStart: booking.bookingStart.toISOString(),
        accessValidFrom: booking.accessValidFrom?.toISOString() ?? null,
        accessValidUntil: booking.accessValidUntil?.toISOString() ?? null,
      },
    });

    if (!result.duplicate) {
      accessCodesSent += 1;
    }
  }

  return {
    accessCodesSent,
  };
};
