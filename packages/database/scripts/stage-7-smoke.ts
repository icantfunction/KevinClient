// Stage 7 Database Smoke Script Purpose
import {
  ClientsService,
  EquipmentService,
  SessionsService,
  SpacesService,
  StudioBookingsService,
  createDatabaseClient,
} from "../src/index";
import { applyStageEnvironment } from "./shared";

const run = async () => {
  await applyStageEnvironment();

  const database = createDatabaseClient();
  const actor = "system:stage-7-smoke";
  const occurredAt = new Date();
  const clientsService = new ClientsService(database);
  const spacesService = new SpacesService(database);
  const equipmentService = new EquipmentService(database);
  const sessionsService = new SessionsService(database);
  const studioBookingsService = new StudioBookingsService(database);

  const [clientOne, clientTwo] = await Promise.all([
    clientsService.createClient(
      {
        clientType: "studio_renter",
        primaryName: "Stage 7 Booker One",
        email: "stage7-booker-one@example.com",
        phone: "+19545550071",
      },
      { actor, occurredAt },
    ),
    clientsService.createClient(
      {
        clientType: "studio_renter",
        primaryName: "Stage 7 Booker Two",
        email: "stage7-booker-two@example.com",
        phone: "+19545550072",
      },
      { actor, occurredAt },
    ),
  ]);

  const space = await spacesService.createSpace(
    {
      name: `Stage 7 Main Space ${Date.now()}`,
      description: "Main cyc wall test space",
      capacity: 8,
      hourlyRateCents: 12000,
      minBookingHours: 2,
      bufferMinutes: 30,
      active: true,
    },
    { actor, occurredAt },
  );

  const equipment = await equipmentService.createEquipment(
    {
      name: `Stage 7 Light Kit ${Date.now()}`,
      quantityOwned: 2,
      quantityAvailable: 2,
      hourlyRateCents: 2500,
      dailyRateCents: 12000,
      active: true,
    },
    { actor, occurredAt },
  );

  const booking = await studioBookingsService.createBooking(
    {
      clientId: clientOne.id,
      spaceId: space.id,
      status: "confirmed",
      bookingStart: new Date("2026-08-05T14:00:00.000Z"),
      bookingEnd: new Date("2026-08-05T16:00:00.000Z"),
      depositAmountCents: 10000,
      depositPaid: true,
      equipmentItems: [{ equipmentId: equipment.id, quantity: 1 }],
      pricingBreakdown: {
        spaceCost: 24000,
        equipmentCost: 2500,
        total: 26500,
      },
    },
    { actor, occurredAt },
  );

  const accessVerification = await studioBookingsService.verifyAccessCode(
    {
      accessCode: booking.accessCode ?? "",
      attemptedAt: new Date("2026-08-05T14:15:00.000Z"),
    },
    { actor, occurredAt },
  );

  let overlapConflictDetected = false;
  try {
    await studioBookingsService.createBooking(
      {
        clientId: clientTwo.id,
        spaceId: space.id,
        status: "hold",
        bookingStart: new Date("2026-08-05T15:00:00.000Z"),
        bookingEnd: new Date("2026-08-05T17:00:00.000Z"),
      },
      { actor, occurredAt },
    );
  } catch (error) {
    overlapConflictDetected = error instanceof Error;
  }

  await sessionsService.createSession(
    {
      clientId: clientOne.id,
      sessionType: "branding",
      title: "Stage 7 Kevin Studio Session",
      status: "confirmed",
      scheduledStart: new Date("2026-08-06T14:00:00.000Z"),
      scheduledEnd: new Date("2026-08-06T16:00:00.000Z"),
      usesOwnStudio: true,
    },
    { actor, occurredAt },
  );

  let sessionConflictDetected = false;
  try {
    await studioBookingsService.createBooking(
      {
        clientId: clientTwo.id,
        spaceId: space.id,
        status: "confirmed",
        bookingStart: new Date("2026-08-06T14:30:00.000Z"),
        bookingEnd: new Date("2026-08-06T15:30:00.000Z"),
      },
      { actor, occurredAt },
    );
  } catch (error) {
    sessionConflictDetected = error instanceof Error;
  }

  const completedBooking = await studioBookingsService.updateBooking(
    booking.id,
    {
      status: "completed",
      checkoutAt: new Date("2026-08-05T16:10:00.000Z"),
    },
    { actor, occurredAt },
  );

  console.log(
    JSON.stringify(
      {
        clientId: clientOne.id,
        spaceId: space.id,
        equipmentId: equipment.id,
        bookingId: booking.id,
        accessCodeIssued: booking.accessCode,
        accessVerification,
        overlapConflictDetected,
        sessionConflictDetected,
        completedStatus: completedBooking.status,
      },
      null,
      2,
    ),
  );
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
