// Stage 8 Database Smoke Script Purpose
import {
  ClientsService,
  ExpenseReceiptScansService,
  ExpensesService,
  InvoicesService,
  PaymentsService,
  ReportsService,
  SessionsService,
  SpacesService,
  StudioBookingsService,
  createDatabaseClient,
} from "../src/index";
import { sql } from "drizzle-orm";
import { applyStageEnvironment, withDatabaseResumeRetry } from "./shared";

const run = async () => {
  await applyStageEnvironment();

  const database = createDatabaseClient();
  await withDatabaseResumeRetry(
    () => database.execute(sql`select 1`),
    {
      label: "stage-8-smoke warmup",
    },
  );
  const actor = "system:stage-8-smoke";
  const occurredAt = new Date();
  const clientsService = new ClientsService(database);
  const sessionsService = new SessionsService(database);
  const spacesService = new SpacesService(database);
  const studioBookingsService = new StudioBookingsService(database);
  const invoicesService = new InvoicesService(database);
  const paymentsService = new PaymentsService(database);
  const expenseReceiptScansService = new ExpenseReceiptScansService(database);
  const expensesService = new ExpensesService(database);
  const reportsService = new ReportsService(database);

  const client = await clientsService.createClient(
    {
      clientType: "both",
      primaryName: "Stage 8 Financial Client",
      email: "stage8-financial@example.com",
      phone: "+19545550081",
      referralSource: "Instagram",
      lifetimeValueCents: 820000,
    },
    { actor, occurredAt },
  );

  const session = await sessionsService.createSession(
    {
      clientId: client.id,
      sessionType: "wedding",
      title: "Stage 8 Wedding Session",
      status: "confirmed",
      scheduledStart: new Date("2026-09-10T18:00:00.000Z"),
      scheduledEnd: new Date("2026-09-10T23:00:00.000Z"),
    },
    { actor, occurredAt },
  );

  const space = await spacesService.createSpace(
    {
      name: `Stage 8 Podcast Booth ${Date.now()}`,
      capacity: 4,
      hourlyRateCents: 9000,
      minBookingHours: 1,
      availabilityRules: {
        weeklySchedule: {
          mon: { start: "08:00", end: "20:00" },
          tue: { start: "08:00", end: "20:00" },
          wed: { start: "08:00", end: "20:00" },
          thu: { start: "08:00", end: "20:00" },
          fri: { start: "08:00", end: "20:00" },
        },
      },
      active: true,
    },
    { actor, occurredAt },
  );

  const booking = await studioBookingsService.createBooking(
    {
      clientId: client.id,
      spaceId: space.id,
      status: "completed",
      bookingStart: new Date("2026-09-15T14:00:00.000Z"),
      bookingEnd: new Date("2026-09-15T17:00:00.000Z"),
      depositPaid: true,
      balancePaid: true,
      pricingBreakdown: {
        spaceCost: 27000,
        total: 27000,
      },
    },
    { actor, occurredAt },
  );

  const photoInvoice = await invoicesService.createInvoice(
    {
      clientId: client.id,
      sourceType: "session",
      sourceId: session.id,
      lineItems: [{ description: "Wedding Collection", quantity: 1, amountCents: 350000 }],
      subtotalCents: 350000,
      taxCents: 0,
      totalCents: 350000,
      sentAt: new Date("2026-03-01T12:00:00.000Z"),
      dueAt: new Date("2026-03-15T12:00:00.000Z"),
    },
    { actor, occurredAt },
  );

  const studioInvoice = await invoicesService.createInvoice(
    {
      clientId: client.id,
      sourceType: "studio_booking",
      sourceId: booking.id,
      lineItems: [{ description: "Studio Rental", quantity: 1, amountCents: 27000 }],
      subtotalCents: 27000,
      totalCents: 27000,
      sentAt: new Date("2026-03-03T12:00:00.000Z"),
      dueAt: new Date("2026-03-03T12:00:00.000Z"),
    },
    { actor, occurredAt },
  );

  const payment = await paymentsService.createPayment(
    {
      invoiceId: photoInvoice.id,
      amountCents: 175000,
      method: "zelle",
      referenceNote: "Retainer",
      receivedAt: new Date("2026-03-05T12:00:00.000Z"),
    },
    { actor, occurredAt },
  );

  const scan = await expenseReceiptScansService.createPendingScan(
    {
      receiptS3Key: `receipts/stage-8/${Date.now()}-receipt.jpg`,
      fileName: "receipt.jpg",
      contentType: "image/jpeg",
    },
    { actor, occurredAt },
  );

  const completedScan = await expenseReceiptScansService.completeScan(
    scan.id,
    {
      vendor: "B&H Photo",
      receiptDate: new Date("2026-03-02T12:00:00.000Z"),
      totalCents: 48500,
      taxCents: 2500,
      ocrResult: {
        vendor: "B&H Photo",
        total: "485.00",
      },
    },
    { actor, occurredAt },
  );

  const expense = await expensesService.createExpense(
    {
      spentAt: completedScan.receiptDate ?? new Date("2026-03-02T12:00:00.000Z"),
      category: "gear",
      description: "LED panel replacement",
      amountCents: completedScan.totalCents ?? 48500,
      vendor: completedScan.vendor,
      receiptS3Key: completedScan.receiptS3Key,
      receiptScanId: completedScan.id,
      ocrMetadata: completedScan.ocrResult,
    },
    { actor, occurredAt },
  );

  const [revenueReport, profitReport, taxYearReport, studioUtilizationReport, conversionReport, ltvReport] =
    await Promise.all([
      reportsService.getRevenueReport(2026),
      reportsService.getProfitReport(2026),
      reportsService.getTaxYearReport(2026),
      reportsService.getStudioUtilizationReport(2026),
      reportsService.getConversionReport(),
      reportsService.getLtvReport(new Date("2026-12-31T23:59:59.000Z")),
    ]);

  console.log(
    JSON.stringify(
      {
        clientId: client.id,
        photoInvoiceId: photoInvoice.id,
        studioInvoiceId: studioInvoice.id,
        paymentId: payment.id,
        expenseId: expense.id,
        receiptScanStatus: completedScan.status,
        marchRevenue: revenueReport.months[2],
        marchProfit: profitReport.months[2],
        taxYearIncomeCents: taxYearReport.incomeCents,
        studioTopSpace: studioUtilizationReport.spaces[0],
        conversionSources: conversionReport.bySource.slice(0, 3),
        topLtvClient: ltvReport.clients[0],
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
