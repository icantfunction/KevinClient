// Stage 4 Calendar ICS Lambda Purpose
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { verifyCalendarFeedToken } from "../shared/calendar-feed-token";
import { createStage3Services } from "../shared/database";

const escapeText = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");

const toUtcValue = (value: Date) => value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

export const handler = async (event: APIGatewayProxyEventV2) => {
  const token = event.queryStringParameters?.token;
  if (!token) {
    return {
      statusCode: 401,
      body: "Missing calendar token.",
    };
  }

  try {
    await verifyCalendarFeedToken(token);
  } catch (error) {
    return {
      statusCode: 401,
      body: error instanceof Error ? error.message : "Invalid calendar token.",
    };
  }

  const from = event.queryStringParameters?.from
    ? new Date(event.queryStringParameters.from)
    : new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
  const to = event.queryStringParameters?.to
    ? new Date(event.queryStringParameters.to)
    : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  const { sessionsService } = createStage3Services();
  const entries = await sessionsService.listCalendarEntries(from, to);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kevin Studio OS//Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const entry of entries) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${entry.entryType}-${entry.id}@studio-os`);
    lines.push(`DTSTAMP:${toUtcValue(new Date())}`);
    lines.push(`DTSTART:${toUtcValue(new Date(entry.startsAt))}`);
    if (entry.endsAt) {
      lines.push(`DTEND:${toUtcValue(new Date(entry.endsAt))}`);
    }
    lines.push(`SUMMARY:${escapeText(entry.title)}`);
    lines.push(`DESCRIPTION:${escapeText(`${entry.entryType} | ${entry.status ?? "unknown"}`)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  return {
    statusCode: 200,
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "cache-control": "no-store",
    },
    body: lines.join("\r\n"),
  };
};
