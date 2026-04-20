// Stage 5 Smart File Email Helpers Purpose
import { sendStudioEmail, type StudioEmailTagInput } from "./ses-outbound";

export const sendSmartFileEmail = async (input: {
  readonly recipientEmail: string;
  readonly subject: string;
  readonly textBody: string;
  readonly htmlBody?: string | null;
  readonly tags?: StudioEmailTagInput;
}) =>
  sendStudioEmail({
    recipientEmail: input.recipientEmail,
    subject: input.subject,
    textBody: input.textBody,
    htmlBody: input.htmlBody,
    tags: input.tags,
  });
