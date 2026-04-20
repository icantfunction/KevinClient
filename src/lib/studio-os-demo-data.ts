// Stage 11.5 Demo Seed Purpose
// Realistic mock payloads for every dashboard read route so the UI can be demoed
// without live AWS. Shapes mirror the real API responses consumed by studio-os-app.

const DAY_MS = 86400000;
const HOUR_MS = 3600000;

const offsetDate = (deltaDays: number, deltaHours = 0) =>
  new Date(Date.now() + deltaDays * DAY_MS + deltaHours * HOUR_MS).toISOString();

const currentYear = new Date().getUTCFullYear();

type DemoPayload = Record<string, unknown>;

export const demoDashboard = {
  dashboard: {
    new_inquiry_count: 6,
    active_session_count: 9,
    open_task_count: 14,
    outstanding_invoice_cents: 742500,
    upcoming_sessions: [
      {
        id: "sess_001",
        title: "Ortiz wedding — ceremony + reception",
        sessionType: "wedding",
        locationName: "The Addison, Boca Raton",
        scheduledStart: offsetDate(2, 3),
        status: "confirmed",
      },
      {
        id: "sess_002",
        title: "Maren Parker — maternity editorial",
        sessionType: "portrait",
        locationName: "Kevin's Creator Studio",
        scheduledStart: offsetDate(3, -2),
        status: "confirmed",
      },
      {
        id: "sess_003",
        title: "HALO brand campaign",
        sessionType: "branding",
        locationName: "Wynwood rooftop",
        scheduledStart: offsetDate(5, 1),
        status: "confirmed",
      },
      {
        id: "sess_004",
        title: "Garcia family session",
        sessionType: "family",
        locationName: "Deerfield Beach",
        scheduledStart: offsetDate(7, 4),
        status: "tentative",
      },
      {
        id: "sess_005",
        title: "Truly Studio — e-comm day",
        sessionType: "commercial",
        locationName: "Creator Studio, Bay A",
        scheduledStart: offsetDate(9, 2),
        status: "confirmed",
      },
    ],
  },
  inquiries: {
    inquiries: [
      {
        id: "inq_01",
        inquirerName: "Sofia Ramirez",
        contactEmail: "sofia.r@gmail.com",
        contactPhone: "+1 (305) 555-0188",
        eventType: "wedding",
        status: "new",
        message: "Looking for full-day wedding coverage in February. Venue is The Biltmore.",
        receivedAt: offsetDate(0, -2),
      },
      {
        id: "inq_02",
        inquirerName: "Derek James",
        contactEmail: "derek@haloathletics.co",
        contactPhone: "+1 (786) 555-0121",
        eventType: "branding",
        status: "qualifying",
        message: "Launch campaign for HALO sneaker drop — mid-March, 2-day shoot.",
        receivedAt: offsetDate(-1, 4),
      },
      {
        id: "inq_03",
        inquirerName: "Priya Shah",
        contactEmail: "priya@shahfoods.com",
        contactPhone: "+1 (954) 555-0160",
        eventType: "studio_rental",
        status: "proposal_sent",
        message: "Need the studio for a 4-hour product photo session in late April.",
        receivedAt: offsetDate(-2),
      },
      {
        id: "inq_04",
        inquirerName: "Mateo Alvarez",
        contactEmail: "mateo.alvarez@icloud.com",
        contactPhone: "+1 (305) 555-0143",
        eventType: "portrait",
        status: "new",
        message: "Senior portraits for my daughter. Hoping for outdoor golden hour.",
        receivedAt: offsetDate(-3),
      },
      {
        id: "inq_05",
        inquirerName: "Tasha Brooks",
        contactEmail: "tasha@brookscreative.studio",
        contactPhone: "+1 (561) 555-0112",
        eventType: "podcast",
        status: "qualifying",
        message: "Monthly podcast recordings — interested in recurring discount.",
        receivedAt: offsetDate(-4),
      },
      {
        id: "inq_06",
        inquirerName: "Jordan Lee",
        contactEmail: "jordan@leeweddings.com",
        contactPhone: "+1 (954) 555-0199",
        eventType: "wedding",
        status: "new",
        message: "June elopement at the beach. Just us two.",
        receivedAt: offsetDate(-5),
      },
    ],
  },
  sessions: {
    sessions: [
      {
        id: "sess_001",
        title: "Ortiz wedding — ceremony + reception",
        sessionType: "wedding",
        locationName: "The Addison, Boca Raton",
        scheduledStart: offsetDate(2, 3),
        scheduledEnd: offsetDate(2, 11),
        status: "confirmed",
        clientName: "Isabella & Marco Ortiz",
      },
      {
        id: "sess_002",
        title: "Maren Parker — maternity editorial",
        sessionType: "portrait",
        locationName: "Kevin's Creator Studio",
        scheduledStart: offsetDate(3, -2),
        scheduledEnd: offsetDate(3, 1),
        status: "confirmed",
        clientName: "Maren Parker",
      },
      {
        id: "sess_003",
        title: "HALO brand campaign",
        sessionType: "branding",
        locationName: "Wynwood rooftop",
        scheduledStart: offsetDate(5, 1),
        scheduledEnd: offsetDate(5, 9),
        status: "confirmed",
        clientName: "HALO Athletics",
      },
      {
        id: "sess_004",
        title: "Garcia family session",
        sessionType: "family",
        locationName: "Deerfield Beach",
        scheduledStart: offsetDate(7, 4),
        scheduledEnd: offsetDate(7, 6),
        status: "tentative",
        clientName: "Garcia family",
      },
      {
        id: "sess_005",
        title: "Truly Studio — e-comm day",
        sessionType: "commercial",
        locationName: "Creator Studio, Bay A",
        scheduledStart: offsetDate(9, 2),
        scheduledEnd: offsetDate(9, 10),
        status: "confirmed",
        clientName: "Truly Studio",
      },
      {
        id: "sess_006",
        title: "Nguyen engagement",
        sessionType: "portrait",
        locationName: "Fairchild Tropical Garden",
        scheduledStart: offsetDate(12, 3),
        scheduledEnd: offsetDate(12, 5),
        status: "confirmed",
        clientName: "Linh & Robert Nguyen",
      },
    ],
  },
  calendar: {
    entries: [],
  },
  smartFiles: {
    smartFiles: [
      {
        id: "sf_001",
        title: "Ortiz — Wedding Agreement + Questionnaire",
        recipientEmail: "isabella.ortiz@gmail.com",
        status: "signed",
        updatedAt: offsetDate(-1),
      },
      {
        id: "sf_002",
        title: "HALO — Commercial License & SOW",
        recipientEmail: "derek@haloathletics.co",
        status: "sent",
        updatedAt: offsetDate(-2),
      },
      {
        id: "sf_003",
        title: "Parker — Maternity Contract",
        recipientEmail: "maren.parker@icloud.com",
        status: "signed",
        updatedAt: offsetDate(-3),
      },
      {
        id: "sf_004",
        title: "Truly — Full-Day Buyout Agreement",
        recipientEmail: "ops@trulystudio.co",
        status: "draft",
        updatedAt: offsetDate(-4),
      },
    ],
  },
  galleries: {
    galleries: [
      {
        id: "gal_001",
        name: "Harper & James — Wedding Highlights",
        status: "delivered",
        photoCount: 428,
        deliveredAt: offsetDate(-8),
      },
      {
        id: "gal_002",
        name: "Nguyen — Engagement Preview",
        status: "ready",
        photoCount: 52,
        deliveredAt: offsetDate(-2),
      },
      {
        id: "gal_003",
        name: "HALO — Campaign Selects",
        status: "processing",
        photoCount: 186,
        deliveredAt: null,
      },
    ],
  },
  bookings: {
    bookings: [
      {
        id: "bk_001",
        purpose: "Carlos Mendez — product still-life",
        bookingStart: offsetDate(1, 2),
        bookingEnd: offsetDate(1, 6),
        status: "confirmed",
        accessCode: "4782",
        depositPaid: true,
        spaceId: "space_a",
        totalCents: 38000,
      },
      {
        id: "bk_002",
        purpose: "Mila Grant — podcast recording",
        bookingStart: offsetDate(2, -1),
        bookingEnd: offsetDate(2, 2),
        status: "confirmed",
        accessCode: "8103",
        depositPaid: true,
        spaceId: "space_b",
        totalCents: 28500,
      },
      {
        id: "bk_003",
        purpose: "Kingsley Films — BTS reel",
        bookingStart: offsetDate(4, 4),
        bookingEnd: offsetDate(4, 10),
        status: "hold",
        accessCode: "pending",
        depositPaid: false,
        spaceId: "space_a",
        totalCents: 57000,
      },
      {
        id: "bk_004",
        purpose: "Creator Summit — meetup",
        bookingStart: offsetDate(10, 3),
        bookingEnd: offsetDate(10, 8),
        status: "confirmed",
        accessCode: "2918",
        depositPaid: true,
        spaceId: "space_a",
        totalCents: 82500,
      },
    ],
  },
  spaces: {
    spaces: [
      { id: "space_a", name: "Bay A — Natural Light Loft", hourlyRateCents: 9500 },
      { id: "space_b", name: "Bay B — Cyc Wall Studio", hourlyRateCents: 11500 },
      { id: "space_c", name: "Podcast Nook", hourlyRateCents: 6500 },
    ],
  },
  equipment: {
    equipment: [
      { id: "eq_001", name: "Profoto B10x Plus kit", quantityOwned: 4, quantityAvailable: 4 },
      { id: "eq_002", name: "Sony FX3 body", quantityOwned: 2, quantityAvailable: 1 },
      { id: "eq_003", name: "Godox AD600Pro", quantityOwned: 3, quantityAvailable: 3 },
      { id: "eq_004", name: "Aputure LS 600d Pro", quantityOwned: 2, quantityAvailable: 2 },
      { id: "eq_005", name: "DJI Ronin 4D", quantityOwned: 1, quantityAvailable: 1 },
    ],
  },
  invoices: {
    invoices: [
      {
        id: "inv_001",
        clientId: "cl_001",
        clientName: "Isabella & Marco Ortiz",
        sourceType: "wedding",
        status: "partial",
        totalCents: 520000,
        balanceCents: 260000,
        issuedAt: offsetDate(-14),
        dueAt: offsetDate(2),
      },
      {
        id: "inv_002",
        clientId: "cl_002",
        clientName: "HALO Athletics",
        sourceType: "branding",
        status: "sent",
        totalCents: 385000,
        balanceCents: 385000,
        issuedAt: offsetDate(-4),
        dueAt: offsetDate(11),
      },
      {
        id: "inv_003",
        clientId: "cl_003",
        clientName: "Truly Studio",
        sourceType: "studio_buyout",
        status: "paid",
        totalCents: 125000,
        balanceCents: 0,
        issuedAt: offsetDate(-20),
        dueAt: offsetDate(-6),
      },
      {
        id: "inv_004",
        clientId: "cl_004",
        clientName: "Maren Parker",
        sourceType: "portrait",
        status: "overdue",
        totalCents: 95000,
        balanceCents: 95000,
        issuedAt: offsetDate(-22),
        dueAt: offsetDate(-8),
      },
    ],
  },
  payments: {
    payments: [
      {
        id: "pay_001",
        invoiceId: "inv_001",
        method: "stripe_card",
        amountCents: 260000,
        receivedAt: offsetDate(-10),
        providerTransactionId: "pi_3O1x",
      },
      {
        id: "pay_002",
        invoiceId: "inv_003",
        method: "stripe_card",
        amountCents: 125000,
        receivedAt: offsetDate(-6),
        providerTransactionId: "pi_3Nzb",
      },
      {
        id: "pay_003",
        invoiceId: "inv_001",
        method: "zelle",
        amountCents: 50000,
        receivedAt: offsetDate(-12),
        providerTransactionId: null,
      },
      {
        id: "pay_004",
        invoiceId: "inv_005",
        method: "cash",
        amountCents: 20000,
        receivedAt: offsetDate(-3),
        providerTransactionId: null,
      },
    ],
  },
  paymentProvider: {
    configuration: {
      provider: "stripe",
      mode: "test",
      available: true,
      reason: null,
    },
  },
  expenses: {
    expenses: [
      {
        id: "exp_001",
        category: "gear",
        description: "Profoto B10x Plus 2-head kit",
        amountCents: 385000,
        spentAt: offsetDate(-10),
      },
      {
        id: "exp_002",
        category: "software",
        description: "Adobe Creative Cloud — annual",
        amountCents: 59990,
        spentAt: offsetDate(-18),
      },
      {
        id: "exp_003",
        category: "travel",
        description: "Fuel — Palm Beach destination wedding",
        amountCents: 14200,
        spentAt: offsetDate(-5),
      },
      {
        id: "exp_004",
        category: "studio",
        description: "Seamless paper — neutrals restock",
        amountCents: 22800,
        spentAt: offsetDate(-8),
      },
      {
        id: "exp_005",
        category: "marketing",
        description: "Meta ads — studio rental campaign",
        amountCents: 50000,
        spentAt: offsetDate(-2),
      },
    ],
  },
  tasks: {
    tasks: [
      {
        id: "tk_001",
        title: "Send Ortiz wedding timeline draft",
        priority: "high",
        status: "open",
        dueAt: offsetDate(0, 4),
      },
      {
        id: "tk_002",
        title: "Cull HALO campaign day-1 selects",
        priority: "high",
        status: "in_progress",
        dueAt: offsetDate(1),
      },
      {
        id: "tk_003",
        title: "Confirm studio cleaning slot Fri AM",
        priority: "medium",
        status: "open",
        dueAt: offsetDate(1, 2),
      },
      {
        id: "tk_004",
        title: "Quarterly P&L review with bookkeeper",
        priority: "medium",
        status: "open",
        dueAt: offsetDate(4),
      },
      {
        id: "tk_005",
        title: "Follow up with Parker on overdue invoice",
        priority: "high",
        status: "open",
        dueAt: offsetDate(0),
      },
      {
        id: "tk_006",
        title: "Reconcile April expense receipts",
        priority: "low",
        status: "open",
        dueAt: offsetDate(6),
      },
      {
        id: "tk_007",
        title: "Ship Nguyen engagement preview",
        priority: "medium",
        status: "in_progress",
        dueAt: offsetDate(2),
      },
    ],
  },
  inbox: {
    activities: [
      {
        id: "act_001",
        subject: "Ortiz — timeline approval",
        activityType: "email_received",
        occurredAt: offsetDate(0, -1),
      },
      {
        id: "act_002",
        subject: "HALO — contract signed",
        activityType: "smart_file_signed",
        occurredAt: offsetDate(0, -3),
      },
      {
        id: "act_003",
        subject: "Stripe payment received — $1,250",
        activityType: "payment_received",
        occurredAt: offsetDate(-1, 2),
      },
      {
        id: "act_004",
        subject: "Gallery delivered — Nguyen",
        activityType: "gallery_delivered",
        occurredAt: offsetDate(-2),
      },
      {
        id: "act_005",
        subject: "New booking request — Kingsley Films",
        activityType: "booking_request",
        occurredAt: offsetDate(-2, 4),
      },
      {
        id: "act_006",
        subject: "Parker — invoice reminder auto-sent",
        activityType: "automation_fired",
        occurredAt: offsetDate(-3),
      },
    ],
  },
  revenue: {
    year: currentYear,
    totals: {
      photoPaidCents: 2845000,
      studioPaidCents: 1125000,
      outstandingCents: 742500,
    },
    monthly: [],
  },
  profit: {
    year: currentYear,
    totals: {
      revenueCents: 3970000,
      expenseCents: 1185000,
      profitCents: 2785000,
    },
    monthly: [],
  },
  conversion: {
    byEventType: [
      { eventType: "wedding", inquiryCount: 24, bookedCount: 14, conversionRate: 0.58 },
      { eventType: "portrait", inquiryCount: 36, bookedCount: 19, conversionRate: 0.53 },
      { eventType: "branding", inquiryCount: 12, bookedCount: 8, conversionRate: 0.67 },
      { eventType: "studio_rental", inquiryCount: 48, bookedCount: 31, conversionRate: 0.65 },
      { eventType: "family", inquiryCount: 18, bookedCount: 11, conversionRate: 0.61 },
    ],
  },
  ltv: {
    clients: [
      { clientId: "cl_010", name: "Harper Media Group", lifetimeValueCents: 1485000, repeatBookingLikely: true },
      { clientId: "cl_011", name: "Truly Studio", lifetimeValueCents: 845000, repeatBookingLikely: true },
      { clientId: "cl_012", name: "HALO Athletics", lifetimeValueCents: 720000, repeatBookingLikely: true },
      { clientId: "cl_013", name: "Ortiz family", lifetimeValueCents: 640000, repeatBookingLikely: false },
      { clientId: "cl_014", name: "Creator Summit", lifetimeValueCents: 420000, repeatBookingLikely: true },
    ],
  },
  time: {
    entries: [
      {
        id: "te_001",
        title: "Culling HALO day-1",
        scope: "session",
        startedAt: offsetDate(0, -1.5),
        endedAt: null,
        notes: null,
      },
    ],
    summary: {
      activeEntry: {
        id: "te_001",
        title: "Culling HALO day-1",
        scope: "session",
        startedAt: offsetDate(0, -1.5),
        notes: null,
      },
      todayMinutes: 312,
      weekMinutes: 1640,
    },
  },
  search: {
    results: [
      { entityType: "session", entityId: "sess_001", title: "Ortiz wedding", subtitle: "Sat 3:00 PM · The Addison" },
      { entityType: "client", entityId: "cl_010", title: "Harper Media Group", subtitle: "Lifetime value $14,850" },
      { entityType: "invoice", entityId: "inv_001", title: "Ortiz wedding invoice", subtitle: "Balance $2,600" },
    ],
  },
} as const;

const demoRouteTable: ReadonlyArray<readonly [RegExp, DemoPayload]> = [
  [/^\/dashboard(\?|$)/, demoDashboard.dashboard as unknown as DemoPayload],
  [/^\/inquiries(\?|$)/, demoDashboard.inquiries as DemoPayload],
  [/^\/sessions(\?|$)/, demoDashboard.sessions as DemoPayload],
  [/^\/calendar(\?|$)/, demoDashboard.calendar as DemoPayload],
  [/^\/smart-files(\?|$)/, demoDashboard.smartFiles as DemoPayload],
  [/^\/galleries(\?|$)/, demoDashboard.galleries as DemoPayload],
  [/^\/studio\/bookings(\?|$)/, demoDashboard.bookings as DemoPayload],
  [/^\/studio\/spaces(\?|$)/, demoDashboard.spaces as DemoPayload],
  [/^\/studio\/equipment(\?|$)/, demoDashboard.equipment as DemoPayload],
  [/^\/invoices(\?|$)/, demoDashboard.invoices as DemoPayload],
  [/^\/payments(\?|$)/, demoDashboard.payments as DemoPayload],
  [/^\/payments\/provider(\?|$)/, demoDashboard.paymentProvider as DemoPayload],
  [/^\/expenses(\?|$)/, demoDashboard.expenses as DemoPayload],
  [/^\/tasks(\?|$)/, demoDashboard.tasks as DemoPayload],
  [/^\/inbox(\?|$)/, demoDashboard.inbox as DemoPayload],
  [/^\/reports\/revenue(\?|$)/, demoDashboard.revenue as DemoPayload],
  [/^\/reports\/profit(\?|$)/, demoDashboard.profit as DemoPayload],
  [/^\/reports\/conversion(\?|$)/, demoDashboard.conversion as DemoPayload],
  [/^\/reports\/ltv(\?|$)/, demoDashboard.ltv as DemoPayload],
  [/^\/time-entries(\?|$)/, demoDashboard.time as DemoPayload],
  [/^\/search(\?|$)/, demoDashboard.search as DemoPayload],
];

const bookingsById = Object.fromEntries(
  demoDashboard.bookings.bookings.map((booking) => [booking.id, booking]),
);

const sessionsById = Object.fromEntries(
  demoDashboard.sessions.sessions.map((session) => [session.id, session]),
);

export function resolveDemoPayload(path: string): DemoPayload | null {
  const bookingMatch = path.match(/^\/studio\/bookings\/([^?\/]+)/);
  if (bookingMatch) {
    const booking = bookingsById[bookingMatch[1]];
    return {
      booking:
        booking ?? {
          id: bookingMatch[1],
          purpose: "Demo booking",
          bookingStart: new Date().toISOString(),
          bookingEnd: new Date(Date.now() + 3600000).toISOString(),
          status: "confirmed",
          accessCode: "0000",
          depositPaid: false,
          spaceId: "space_a",
        },
    };
  }

  const sessionShotListMatch = path.match(
    /^\/sessions\/([^?\/]+)\/shot-list/,
  );
  if (sessionShotListMatch) {
    const session = sessionsById[sessionShotListMatch[1]];
    return {
      session: session ?? {
        id: sessionShotListMatch[1],
        title: "Demo session",
        sessionType: "portrait",
        locationName: "Demo location",
      },
      shotList: {
        items: [
          {
            id: "demo-shot-1",
            description: "Wide establishing shot of venue exterior",
            mustHave: true,
            captured: true,
            notes: null,
          },
          {
            id: "demo-shot-2",
            description: "Detail: rings on invitation suite",
            mustHave: true,
            captured: false,
            notes: null,
          },
          {
            id: "demo-shot-3",
            description: "First-look reaction, couple entering frame",
            mustHave: true,
            captured: false,
            notes: null,
          },
          {
            id: "demo-shot-4",
            description: "Bridal party candid, natural light",
            mustHave: false,
            captured: false,
            notes: null,
          },
        ],
        notes: "Backup second shooter on stage left for ceremony.",
      },
    };
  }

  for (const [pattern, payload] of demoRouteTable) {
    if (pattern.test(path)) {
      return payload;
    }
  }
  return null;
}

export const demoSession = {
  phoneNumber: "+1 (954) 854-1484",
  displayName: "Kevin Ramos",
  accessToken: "demo.accessToken",
  idToken: "demo.idToken",
  refreshToken: "demo.refreshToken",
  expiresAt: Date.now() + 86400000,
  demoMode: true,
} as const;
