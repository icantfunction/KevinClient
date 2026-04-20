// Stage 4 Calendar Feed Token Lambda Purpose
import { issueCalendarFeedToken } from "../shared/calendar-feed-token";
import { jsonResponse } from "../shared/http";

export const handler = async () => {
  const issued = await issueCalendarFeedToken();
  const baseUrl = process.env.STUDIO_OS_API_URL;

  return jsonResponse(200, {
    token: issued.token,
    version: issued.version,
    calendarUrl: `${baseUrl}calendar.ics?token=${encodeURIComponent(issued.token)}`,
  });
};
