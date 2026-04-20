// Stage 8 Reports Service Purpose
import { and, eq, gte, isNull, lte } from "drizzle-orm";
import type { StudioOsDatabase } from "../client";
import { clients, expenses, galleries, inquiries, invoices, payments, sessions, studioBookings, studioSpaces } from "../schema";

const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const startOfYearUtc = (year: number) => new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
const endOfYearUtc = (year: number) => new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
const daysInYear = (year: number) => Math.round((endOfYearUtc(year).getTime() - startOfYearUtc(year).getTime()) / 86_400_000) + 1;

const toDate = (value: Date | string | null | undefined): Date | null => {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value : new Date(value);
};

const toMonthIndex = (value: Date | string | null | undefined): number | null => {
  const date = toDate(value);
  return date ? date.getUTCMonth() : null;
};

const centsFromUnknown = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.round(parsed) : 0;
  }

  return 0;
};

const bookingDurationHours = (start: Date | string | null | undefined, end: Date | string | null | undefined): number => {
  const startDate = toDate(start);
  const endDate = toDate(end);
  if (!startDate || !endDate) {
    return 0;
  }

  return Math.max((endDate.getTime() - startDate.getTime()) / 3_600_000, 0);
};

const estimateWeeklyAvailabilityHours = (rules: Record<string, unknown>): number => {
  const scheduleCandidate = (rules.weeklySchedule ?? rules.weekly ?? rules.schedule ?? null) as Record<string, unknown> | null;
  if (!scheduleCandidate || typeof scheduleCandidate !== "object") {
    return 84;
  }

  let hours = 0;
  for (const value of Object.values(scheduleCandidate)) {
    if (!value || typeof value !== "object") {
      continue;
    }

    const typedValue = value as Record<string, unknown>;
    if (typedValue.active === false) {
      continue;
    }

    const explicitHours = centsFromUnknown(typedValue.hours);
    if (explicitHours > 0) {
      hours += explicitHours;
      continue;
    }

    const slots = Array.isArray(typedValue.slots)
      ? (typedValue.slots as Array<Record<string, unknown>>)
      : [typedValue];

    for (const slot of slots) {
      const start = typeof slot.start === "string" ? slot.start : typeof slot.opensAt === "string" ? slot.opensAt : null;
      const end = typeof slot.end === "string" ? slot.end : typeof slot.closesAt === "string" ? slot.closesAt : null;
      if (!start || !end) {
        continue;
      }

      const [startHour, startMinute = "0"] = start.split(":");
      const [endHour, endMinute = "0"] = end.split(":");
      const startMinutes = Number(startHour) * 60 + Number(startMinute);
      const endMinutes = Number(endHour) * 60 + Number(endMinute);
      if (Number.isFinite(startMinutes) && Number.isFinite(endMinutes) && endMinutes > startMinutes) {
        hours += (endMinutes - startMinutes) / 60;
      }
    }
  }

  return hours > 0 ? hours : 84;
};

export class ReportsService {
  public constructor(private readonly database: StudioOsDatabase) {}

  public async getRevenueReport(year: number) {
    const from = startOfYearUtc(year);
    const to = endOfYearUtc(year);
    const invoiceRows = await this.database
      .select()
      .from(invoices)
      .where(and(isNull(invoices.deletedAt), lte(invoices.createdAt, to)));
    const paymentRows = await this.database
      .select({
        invoiceId: payments.invoiceId,
        amountCents: payments.amountCents,
        receivedAt: payments.receivedAt,
      })
      .from(payments)
      .where(and(isNull(payments.deletedAt), gte(payments.receivedAt, from), lte(payments.receivedAt, to)));

    const invoiceById = new Map(invoiceRows.map((invoice) => [invoice.id, invoice]));
    const monthly = monthLabels.map((label, monthIndex) => ({
      month: label,
      monthIndex,
      photoPaidCents: 0,
      studioPaidCents: 0,
      standalonePaidCents: 0,
      outstandingCents: 0,
    }));

    for (const payment of paymentRows) {
      const invoice = invoiceById.get(payment.invoiceId);
      const monthIndex = toMonthIndex(payment.receivedAt);
      if (!invoice || monthIndex === null) {
        continue;
      }

      if (invoice.sourceType === "studio_booking") {
        monthly[monthIndex].studioPaidCents += payment.amountCents;
      } else if (invoice.sourceType === "standalone") {
        monthly[monthIndex].standalonePaidCents += payment.amountCents;
      } else {
        monthly[monthIndex].photoPaidCents += payment.amountCents;
      }
    }

    for (const invoice of invoiceRows) {
      const anchor = invoice.dueAt ?? invoice.sentAt ?? invoice.createdAt;
      const monthIndex = toMonthIndex(anchor);
      if (monthIndex === null) {
        continue;
      }

      if (toDate(anchor) && toDate(anchor)!.getUTCFullYear() !== year) {
        continue;
      }

      if (invoice.balanceCents > 0 && !["paid", "void", "refunded"].includes(invoice.status)) {
        monthly[monthIndex].outstandingCents += invoice.balanceCents;
      }
    }

    return {
      year,
      months: monthly,
      totals: monthly.reduce(
        (accumulator, month) => ({
          photoPaidCents: accumulator.photoPaidCents + month.photoPaidCents,
          studioPaidCents: accumulator.studioPaidCents + month.studioPaidCents,
          standalonePaidCents: accumulator.standalonePaidCents + month.standalonePaidCents,
          outstandingCents: accumulator.outstandingCents + month.outstandingCents,
        }),
        {
          photoPaidCents: 0,
          studioPaidCents: 0,
          standalonePaidCents: 0,
          outstandingCents: 0,
        },
      ),
    };
  }

  public async getProfitReport(year: number) {
    const revenue = await this.getRevenueReport(year);
    const expenseRows = await this.database
      .select()
      .from(expenses)
      .where(
        and(
          isNull(expenses.deletedAt),
          gte(expenses.spentAt, startOfYearUtc(year)),
          lte(expenses.spentAt, endOfYearUtc(year)),
        ),
      );

    const monthly = revenue.months.map((month) => ({
      month: month.month,
      monthIndex: month.monthIndex,
      revenueCents: month.photoPaidCents + month.studioPaidCents + month.standalonePaidCents,
      expenseCents: 0,
      profitCents: 0,
    }));

    for (const expense of expenseRows) {
      const monthIndex = toMonthIndex(expense.spentAt);
      if (monthIndex === null) {
        continue;
      }

      monthly[monthIndex].expenseCents += expense.amountCents;
    }

    for (const month of monthly) {
      month.profitCents = month.revenueCents - month.expenseCents;
    }

    return {
      year,
      months: monthly,
      totals: monthly.reduce(
        (accumulator, month) => ({
          revenueCents: accumulator.revenueCents + month.revenueCents,
          expenseCents: accumulator.expenseCents + month.expenseCents,
          profitCents: accumulator.profitCents + month.profitCents,
        }),
        {
          revenueCents: 0,
          expenseCents: 0,
          profitCents: 0,
        },
      ),
    };
  }

  public async getTaxYearReport(year: number) {
    const revenue = await this.getRevenueReport(year);
    const expenseRows = await this.database
      .select()
      .from(expenses)
      .where(
        and(
          isNull(expenses.deletedAt),
          gte(expenses.spentAt, startOfYearUtc(year)),
          lte(expenses.spentAt, endOfYearUtc(year)),
        ),
      );

    const expensesByCategory = new Map<string, number>();
    let taxDeductibleCents = 0;
    for (const expense of expenseRows) {
      expensesByCategory.set(expense.category, (expensesByCategory.get(expense.category) ?? 0) + expense.amountCents);
      if (expense.taxDeductible) {
        taxDeductibleCents += expense.amountCents;
      }
    }

    return {
      year,
      incomeCents:
        revenue.totals.photoPaidCents + revenue.totals.studioPaidCents + revenue.totals.standalonePaidCents,
      taxDeductibleExpenseCents: taxDeductibleCents,
      expensesByCategory: Array.from(expensesByCategory.entries())
        .map(([category, amountCents]) => ({ category, amountCents }))
        .sort((left, right) => right.amountCents - left.amountCents),
      mileageCents: 0,
      homeOfficeEstimateCents: 0,
      caveats: [
        "Mileage and home-office estimates remain placeholders until Stage 9/10 operations data expands.",
      ],
    };
  }

  public async getStudioUtilizationReport(year: number) {
    const from = startOfYearUtc(year);
    const to = endOfYearUtc(year);
    const [spaces, bookings] = await Promise.all([
      this.database.select().from(studioSpaces).where(isNull(studioSpaces.deletedAt)),
      this.database
        .select()
        .from(studioBookings)
        .where(and(isNull(studioBookings.deletedAt), gte(studioBookings.bookingStart, from), lte(studioBookings.bookingStart, to))),
    ]);

    const spaceMetrics = new Map(
      spaces.map((space) => [
        space.id,
        {
          spaceId: space.id,
          name: space.name,
          bookedHours: 0,
          availableHours: Math.round((estimateWeeklyAvailabilityHours(space.availabilityRules ?? {}) * daysInYear(year)) / 7),
          utilizationRate: 0,
          revenueCents: 0,
          bookingCount: 0,
        },
      ]),
    );

    const busiestWeekdays = weekdayLabels.map((label, index) => ({
      weekday: label,
      weekdayIndex: index,
      bookingCount: 0,
      bookedHours: 0,
    }));
    const busiestHours = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      bookingCount: 0,
      bookedHours: 0,
    }));

    for (const booking of bookings) {
      if (["cancelled", "inquiry"].includes(booking.status)) {
        continue;
      }

      const metrics = spaceMetrics.get(booking.spaceId);
      if (!metrics) {
        continue;
      }

      const durationHours = bookingDurationHours(booking.bookingStart, booking.bookingEnd);
      const totalFromBreakdown =
        booking.pricingBreakdown && typeof booking.pricingBreakdown === "object"
          ? centsFromUnknown((booking.pricingBreakdown as Record<string, unknown>).total)
          : 0;

      metrics.bookedHours += durationHours;
      metrics.revenueCents += totalFromBreakdown;
      metrics.bookingCount += 1;

      const startDate = toDate(booking.bookingStart);
      if (!startDate) {
        continue;
      }

      const weekdayMetric = busiestWeekdays[startDate.getUTCDay()];
      weekdayMetric.bookingCount += 1;
      weekdayMetric.bookedHours += durationHours;

      const hourMetric = busiestHours[startDate.getUTCHours()];
      hourMetric.bookingCount += 1;
      hourMetric.bookedHours += durationHours;
    }

    const spacesSummary = Array.from(spaceMetrics.values())
      .map((space) => ({
        ...space,
        utilizationRate: space.availableHours > 0 ? Number((space.bookedHours / space.availableHours).toFixed(4)) : 0,
      }))
      .sort((left, right) => right.revenueCents - left.revenueCents);

    return {
      year,
      spaces: spacesSummary,
      busiestWeekdays: busiestWeekdays.sort((left, right) => right.bookedHours - left.bookedHours),
      busiestHours: busiestHours.sort((left, right) => right.bookedHours - left.bookedHours).slice(0, 8),
    };
  }

  public async getConversionReport() {
    const inquiryRows = await this.database.select().from(inquiries).where(isNull(inquiries.deletedAt));
    const byEventType = new Map<string, { eventType: string; inquiryCount: number; bookedCount: number }>();
    const bySource = new Map<string, { source: string; inquiryCount: number; bookedCount: number }>();

    for (const inquiry of inquiryRows) {
      const eventEntry = byEventType.get(inquiry.eventType) ?? {
        eventType: inquiry.eventType,
        inquiryCount: 0,
        bookedCount: 0,
      };
      eventEntry.inquiryCount += 1;
      if (inquiry.status === "booked") {
        eventEntry.bookedCount += 1;
      }
      byEventType.set(inquiry.eventType, eventEntry);

      const sourceKey = inquiry.referralSource?.trim() || "Unknown";
      const sourceEntry = bySource.get(sourceKey) ?? {
        source: sourceKey,
        inquiryCount: 0,
        bookedCount: 0,
      };
      sourceEntry.inquiryCount += 1;
      if (inquiry.status === "booked") {
        sourceEntry.bookedCount += 1;
      }
      bySource.set(sourceKey, sourceEntry);
    }

    return {
      byEventType: Array.from(byEventType.values()).map((entry) => ({
        ...entry,
        conversionRate: entry.inquiryCount > 0 ? Number((entry.bookedCount / entry.inquiryCount).toFixed(4)) : 0,
      })),
      bySource: Array.from(bySource.values())
        .map((entry) => ({
          ...entry,
          conversionRate: entry.inquiryCount > 0 ? Number((entry.bookedCount / entry.inquiryCount).toFixed(4)) : 0,
        }))
        .sort((left, right) => right.bookedCount - left.bookedCount),
    };
  }

  public async getTurnaroundReport() {
    const deliveredGalleries = await this.database
      .select()
      .from(galleries)
      .where(and(isNull(galleries.deletedAt), eq(galleries.status, "delivered")));
    const sessionsById = new Map(
      (
        await this.database
          .select()
          .from(sessions)
          .where(isNull(sessions.deletedAt))
      ).map((session) => [session.id, session]),
    );

    const totalsBySessionType = new Map<string, { sessionType: string; deliveredCount: number; totalDays: number }>();

    for (const gallery of deliveredGalleries) {
      if (!gallery.sessionId || !gallery.deliveredAt) {
        continue;
      }

      const session = sessionsById.get(gallery.sessionId);
      const scheduledStart = session?.scheduledStart;
      if (!session || !scheduledStart) {
        continue;
      }

      const turnaroundDays = Math.max(
        (new Date(gallery.deliveredAt).getTime() - new Date(scheduledStart).getTime()) / 86_400_000,
        0,
      );
      const entry = totalsBySessionType.get(session.sessionType) ?? {
        sessionType: session.sessionType,
        deliveredCount: 0,
        totalDays: 0,
      };
      entry.deliveredCount += 1;
      entry.totalDays += turnaroundDays;
      totalsBySessionType.set(session.sessionType, entry);
    }

    const sessionTypes = Array.from(totalsBySessionType.values()).map((entry) => ({
      sessionType: entry.sessionType,
      deliveredCount: entry.deliveredCount,
      averageDays: entry.deliveredCount > 0 ? Number((entry.totalDays / entry.deliveredCount).toFixed(2)) : 0,
    }));

    return {
      averageDays:
        sessionTypes.length > 0
          ? Number(
              (
                sessionTypes.reduce((sum, entry) => sum + entry.averageDays * entry.deliveredCount, 0) /
                sessionTypes.reduce((sum, entry) => sum + entry.deliveredCount, 0)
              ).toFixed(2),
            )
          : 0,
      bySessionType: sessionTypes.sort((left, right) => right.deliveredCount - left.deliveredCount),
    };
  }

  public async getReferralsReport() {
    const clientRows = await this.database.select().from(clients).where(isNull(clients.deletedAt));
    const sources = new Map<string, { source: string; clientCount: number; lifetimeValueCents: number }>();

    for (const client of clientRows) {
      const source = client.referralSource?.trim() || "Unknown";
      const entry = sources.get(source) ?? {
        source,
        clientCount: 0,
        lifetimeValueCents: 0,
      };
      entry.clientCount += 1;
      entry.lifetimeValueCents += client.lifetimeValueCents;
      sources.set(source, entry);
    }

    return {
      sources: Array.from(sources.values()).sort((left, right) => right.lifetimeValueCents - left.lifetimeValueCents),
    };
  }

  public async getLtvReport(now = new Date()) {
    const [clientRows, sessionRows, bookingRows] = await Promise.all([
      this.database.select().from(clients).where(isNull(clients.deletedAt)),
      this.database
        .select({
          clientId: sessions.clientId,
          scheduledStart: sessions.scheduledStart,
        })
        .from(sessions)
        .where(and(isNull(sessions.deletedAt), gte(sessions.scheduledStart, new Date(now.getTime() - 730 * 86_400_000)))),
      this.database
        .select({
          clientId: studioBookings.clientId,
          bookingStart: studioBookings.bookingStart,
        })
        .from(studioBookings)
        .where(and(isNull(studioBookings.deletedAt), gte(studioBookings.bookingStart, new Date(now.getTime() - 730 * 86_400_000)))),
    ]);

    const recentBookingCount = new Map<string, number>();
    for (const session of sessionRows) {
      recentBookingCount.set(session.clientId, (recentBookingCount.get(session.clientId) ?? 0) + 1);
    }
    for (const booking of bookingRows) {
      recentBookingCount.set(booking.clientId, (recentBookingCount.get(booking.clientId) ?? 0) + 1);
    }

    return {
      clients: clientRows
        .map((client) => ({
          clientId: client.id,
          name: client.primaryName,
          clientType: client.clientType,
          lifetimeValueCents: client.lifetimeValueCents,
          recentBookingCount: recentBookingCount.get(client.id) ?? 0,
          repeatBookingLikely: (recentBookingCount.get(client.id) ?? 0) >= 2,
          referralSource: client.referralSource,
          vip: client.vip,
        }))
        .sort((left, right) => right.lifetimeValueCents - left.lifetimeValueCents),
      generatedAt: now.toISOString(),
    };
  }
}
