// Stage 9 Weather Fetcher Lambda Purpose
import { createStage3Services } from "../shared/database";
import { sendAutomationSms } from "../shared/automation-notifications";

const kevinPhoneNumber = process.env.STUDIO_OS_ALLOWED_PHONE_NUMBER?.trim();
const noaaHeaders = {
  "User-Agent": "KevinStudioOS/1.0 (kevin studio operations)",
  Accept: "application/geo+json",
};

const hasSevereAlert = (alert: Record<string, unknown>) => {
  const severity = `${alert.severity ?? ""}`.toLowerCase();
  const event = `${alert.event ?? ""}`.toLowerCase();
  const certainty = `${alert.certainty ?? ""}`.toLowerCase();
  return (
    severity.includes("severe") ||
    severity.includes("extreme") ||
    event.includes("warning") ||
    event.includes("watch") ||
    certainty.includes("observed")
  );
};

export const handler = async () => {
  const now = new Date();
  const {
    activitiesService,
    sessionsService,
  } = createStage3Services();

  const from = new Date(now.getTime() + 36 * 60 * 60 * 1000);
  const to = new Date(now.getTime() + 60 * 60 * 60 * 1000);
  const candidates = await sessionsService.listSessions({
    from,
    to,
    limit: 200,
  });

  let sessionsChecked = 0;
  let severeAlertsSent = 0;

  for (const session of candidates) {
    if (!session.scheduledStart || session.usesOwnStudio) {
      continue;
    }

    const lat = Number(session.locationCoords?.lat);
    const lng = Number(session.locationCoords?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      continue;
    }

    sessionsChecked += 1;

    let forecastSummary: Record<string, unknown> = {};
    let alertSummary: Array<Record<string, unknown>> = [];

    try {
      const pointResponse = await fetch(`https://api.weather.gov/points/${lat},${lng}`, {
        headers: noaaHeaders,
      });
      if (pointResponse.ok) {
        const pointJson = (await pointResponse.json()) as {
          readonly properties?: { readonly forecast?: string };
        };
        const forecastUrl = pointJson.properties?.forecast;
        if (forecastUrl) {
          const forecastResponse = await fetch(forecastUrl, { headers: noaaHeaders });
          if (forecastResponse.ok) {
            const forecastJson = (await forecastResponse.json()) as {
              readonly properties?: { readonly periods?: Array<Record<string, unknown>> };
            };
            forecastSummary = forecastJson.properties?.periods?.[0] ?? {};
          }
        }
      }

      const alertsResponse = await fetch(`https://api.weather.gov/alerts/active?point=${lat},${lng}`, {
        headers: noaaHeaders,
      });
      if (alertsResponse.ok) {
        const alertsJson = (await alertsResponse.json()) as {
          readonly features?: Array<{ readonly properties?: Record<string, unknown> }>;
        };
        alertSummary = (alertsJson.features ?? [])
          .map((feature) => feature.properties ?? {})
          .filter(hasSevereAlert)
          .map((alert) => ({
            event: alert.event ?? null,
            severity: alert.severity ?? null,
            headline: alert.headline ?? null,
            effective: alert.effective ?? null,
            expires: alert.expires ?? null,
          }));
      }
    } catch (error) {
      forecastSummary = {
        fetchError: error instanceof Error ? error.message : "Unknown NOAA error.",
      };
    }

    await sessionsService.updateSession(
      session.id,
      {
        weatherForecast: {
          checkedAt: now.toISOString(),
          source: "NOAA",
          forecast: forecastSummary,
          alerts: alertSummary,
        },
      },
      {
        actor: "system",
        occurredAt: now,
      },
    );

    if (alertSummary.length > 0 && kevinPhoneNumber) {
      const result = await sendAutomationSms({
        services: { activitiesService },
        externalMessageId: `weather:severe-alert:${session.id}:${now.toISOString().slice(0, 10)}`,
        actor: "system",
        occurredAt: now,
        scopeType: "session",
        scopeId: session.id,
        activityType: "session.weather_alert",
        recipientPhone: kevinPhoneNumber,
        body: `Weather alert for ${session.title} on ${session.scheduledStart.toISOString()}: ${alertSummary
          .map((alert) => alert.event ?? "alert")
          .join(", ")}`,
        metadata: {
          alertSummary,
        },
      });

      if (!result.duplicate) {
        severeAlertsSent += 1;
      }
    }
  }

  return {
    sessionsChecked,
    severeAlertsSent,
  };
};
