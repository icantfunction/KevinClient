// Stage 7 Public Studio Page Lambda Purpose
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { createStage3Services } from "../shared/database";

const htmlResponse = (body: string, statusCode = 200): APIGatewayProxyStructuredResultV2 => ({
  statusCode,
  headers: {
    "content-type": "text/html; charset=utf-8",
  },
  body,
});

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const handler = async (_event: APIGatewayProxyEventV2) => {
  const { spacesService } = createStage3Services();
  const spaces = await spacesService.listSpaces({ activeOnly: true });

  const cards = spaces
    .map(
      (space) => `
        <article class="card">
          <div class="rate">$${(space.hourlyRateCents / 100).toFixed(0)}/hr</div>
          <h2>${escapeHtml(space.name)}</h2>
          <p>${escapeHtml(space.description ?? "Studio space available for rental.")}</p>
          <div class="meta">Capacity ${space.capacity} • Buffer ${space.bufferMinutes}m • Min ${space.minBookingHours}h</div>
          <div class="rules">${escapeHtml(space.houseRules ?? "House rules available upon confirmation.")}</div>
        </article>`,
    )
    .join("\n");

  return htmlResponse(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Kevin Creator Studio</title>
    <style>
      body { margin: 0; font-family: Georgia, serif; background: linear-gradient(180deg, #f6f1eb 0%, #efe6db 100%); color: #1b1714; }
      main { max-width: 1100px; margin: 0 auto; padding: 48px 24px 72px; }
      h1 { font-size: clamp(2.4rem, 5vw, 4.8rem); margin: 0 0 12px; }
      p.lead { max-width: 760px; line-height: 1.6; color: #5f554b; }
      .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; margin-top: 36px; }
      .card { background: rgba(255,255,255,0.72); border: 1px solid rgba(106, 89, 73, 0.14); border-radius: 22px; padding: 24px; box-shadow: 0 20px 50px rgba(51, 32, 19, 0.08); }
      .rate { display: inline-block; font-size: 0.85rem; letter-spacing: 0.12em; text-transform: uppercase; color: #92400e; margin-bottom: 12px; }
      .meta, .rules { color: #6b5d4d; line-height: 1.5; }
      .cta { margin-top: 40px; padding: 24px; background: #1f2937; color: #f9fafb; border-radius: 22px; }
      code { font-family: ui-monospace, SFMono-Regular, monospace; }
    </style>
  </head>
  <body>
    <main>
      <h1>Kevin Creator Studio</h1>
      <p class="lead">Browse the active studio spaces below, then submit a booking request to Kevin through <code>POST /studio/booking-request</code>. The request becomes a studio-rental inquiry in the unified backend.</p>
      <section class="grid">
        ${cards || '<p>No active spaces are published yet.</p>'}
      </section>
      <section class="cta">
        <strong>Booking request payload</strong>
        <p>Send <code>{ name, email, phone, spaceId, bookingStart, bookingEnd, partySize, message }</code> to the public booking endpoint.</p>
      </section>
    </main>
  </body>
</html>`);
};
