// Stage 5 Smart File PDF Worker Lambda Purpose
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { PDFDocument, StandardFonts, type PDFFont, rgb } from "pdf-lib";
import type { SQSBatchResponse, SQSEvent } from "aws-lambda";
import { createStage3Services } from "../shared/database";
import { sendSmartFileEmail } from "../shared/smart-file-email";

const bucketName = process.env.STUDIO_OS_SMART_FILE_BUCKET_NAME;
const s3Client = new S3Client({});

if (!bucketName) {
  throw new Error("Missing required environment variable: STUDIO_OS_SMART_FILE_BUCKET_NAME");
}

const pageWidth = 612;
const pageHeight = 792;
const margin = 48;
const bodyFontSize = 11;
const titleFontSize = 20;
const lineHeight = 16;
const maxTextWidth = pageWidth - margin * 2;

const wrapText = (text: string, font: PDFFont, fontSize: number) => {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxTextWidth) {
      currentLine = candidate;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    currentLine = word;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [""];
};

const renderPdfBuffer = async (title: string, bodyLines: string[]) => {
  const pdf = await PDFDocument.create();
  const titleFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const bodyFont = await pdf.embedFont(StandardFonts.Helvetica);
  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const nextPage = () => {
    page = pdf.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
  };

  page.drawText(title, {
    x: margin,
    y,
    size: titleFontSize,
    font: titleFont,
    color: rgb(0.08, 0.08, 0.08),
  });
  y -= titleFontSize + 20;

  for (const rawLine of bodyLines) {
    const lines = rawLine.trim().length === 0 ? [""] : wrapText(rawLine, bodyFont, bodyFontSize);

    for (const line of lines) {
      if (y <= margin + lineHeight) {
        nextPage();
      }

      if (line.length > 0) {
        page.drawText(line, {
          x: margin,
          y,
          size: bodyFontSize,
          font: bodyFont,
          color: rgb(0.15, 0.15, 0.15),
        });
      }

      y -= lineHeight;
    }

    y -= 4;
  }

  return Buffer.from(await pdf.save());
};

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const { activitiesService, smartFilesService } = createStage3Services();
  const failures: SQSBatchResponse["batchItemFailures"] = [];

  for (const record of event.Records) {
    try {
      const payload = JSON.parse(record.body) as { smartFileId?: string };
      if (!payload.smartFileId) {
        continue;
      }

      const smartFile = await smartFilesService.getSmartFileById(payload.smartFileId);
      if (!smartFile) {
        continue;
      }

      const signature = await smartFilesService.getLatestSignature(smartFile.id);
      if (!signature) {
        continue;
      }

      const context = await smartFilesService.buildSmartFieldContext(smartFile.id);
      const resolvedBlocks = smartFilesService.resolveBlocks(smartFile.snapshotBlocks, context, smartFile.responseData);
      const pdfBuffer = await renderPdfBuffer(
        smartFile.title,
        [
          `Status: ${smartFile.status}`,
          "",
          ...resolvedBlocks.flatMap((block) => [
            `[${block.type}] ${block.title ?? ""}`.trim(),
            block.renderedContent ?? block.content ?? "",
            "",
          ]),
          `Signed by ${signature.signatureName} via ${signature.signatureMethod} on ${signature.signedAt.toISOString()}`,
          `Signer IP: ${signature.signerIp ?? "unknown"}`,
        ],
      );

      const key = `smart-files/${smartFile.id}/signed-${Date.now()}.pdf`;
      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: key,
          Body: pdfBuffer,
          ContentType: "application/pdf",
        }),
      );

      const occurredAt = new Date();
      await smartFilesService.updateSmartFileStatus(
        smartFile.id,
        "completed",
        { actor: "system", occurredAt },
        {
          pdfS3Key: key,
          completedAt: occurredAt,
        },
      );

      await activitiesService.createActivity(
        {
          clientId: smartFile.clientId ?? null,
          scopeType: "smart_file",
          scopeId: smartFile.id,
          channel: "system",
          direction: "system",
          activityType: "smart_file.pdf_generated",
          subject: smartFile.title,
          body: `Signed PDF generated at ${key}.`,
          occurredAt,
          metadata: {
            pdfS3Key: key,
          },
        },
        { actor: "system", occurredAt },
      );

      if (smartFile.recipientEmail) {
        await sendSmartFileEmail({
          recipientEmail: smartFile.recipientEmail,
          subject: `${smartFile.title} is complete`,
          textBody: [`Kevin's Studio OS generated your signed document.`, `Stored PDF key: ${key}`].join("\n"),
          htmlBody: `<p>Kevin's Studio OS generated your signed document.</p><p>Stored PDF key: <code>${key}</code></p>`,
          tags: {
            clientId: smartFile.clientId ?? null,
            scopeType: "smart_file",
            scopeId: smartFile.id,
            activityType: "smart_file.pdf_generated",
            externalMessageId: `smart-file-pdf:${smartFile.id}:${key}`,
          },
        });
      }
    } catch (error) {
      console.error("Failed to process Smart File PDF job", error);
      failures.push({
        itemIdentifier: record.messageId,
      });
    }
  }

  return {
    batchItemFailures: failures,
  };
};
