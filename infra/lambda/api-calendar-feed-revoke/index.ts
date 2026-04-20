// Stage 4 Calendar Feed Revoke Lambda Purpose
import { revokeCalendarFeedTokens } from "../shared/calendar-feed-token";
import { jsonResponse } from "../shared/http";

export const handler = async () => {
  const result = await revokeCalendarFeedTokens();
  return jsonResponse(200, result);
};
