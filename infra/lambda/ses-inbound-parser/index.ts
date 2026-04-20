// Stage 3 SES Inbound Parser Lambda Purpose
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { S3Event, SQSBatchResponse, SQSEvent } from "aws-lambda";
import type { AddressObject } from "mailparser";
import { simpleParser } from "mailparser";
import { createStage3Services } from "../shared/database";

const s3Client = new S3Client({});

const parseS3Notification = (body: string): S3Event => JSON.parse(body) as S3Event;
const toAddressArray = (value: AddressObject | AddressObject[] | undefined) => (Array.isArray(value) ? value : value?.value ?? []);

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const { activitiesService, clientsService } = createStage3Services();
  const failures: SQSBatchResponse["batchItemFailures"] = [];

  for (const record of event.Records) {
    try {
      const s3Event = parseS3Notification(record.body);

      for (const s3Record of s3Event.Records ?? []) {
        const bucketName = s3Record.s3.bucket.name;
        const objectKey = decodeURIComponent(s3Record.s3.object.key.replace(/\+/g, " "));
        const object = await s3Client.send(
          new GetObjectCommand({
            Bucket: bucketName,
            Key: objectKey,
          }),
        );
        const rawEmail = await object.Body?.transformToString();

        if (!rawEmail) {
          continue;
        }

        const parsedEmail = await simpleParser(rawEmail);
        const externalMessageId = parsedEmail.messageId ?? `${bucketName}/${objectKey}`;
        const existingActivity = await activitiesService.getActivityByExternalMessageId(externalMessageId);

        if (existingActivity) {
          continue;
        }

        const fromAddress = parsedEmail.from?.value?.[0]?.address ?? null;
        const fromName = parsedEmail.from?.value?.[0]?.name ?? null;
        const matchedClient = await clientsService.findClientByContact(fromAddress, null);
        const occurredAt = parsedEmail.date ?? new Date();

        await activitiesService.createActivity(
          {
            clientId: matchedClient?.id ?? null,
            scopeType: matchedClient ? "client" : "communication_unmatched",
            scopeId: matchedClient?.id ?? null,
            channel: "email",
            direction: "inbound",
            activityType: "email.received",
            subject: parsedEmail.subject ?? null,
            body: parsedEmail.text?.trim() || parsedEmail.html || null,
            externalMessageId,
            inReplyTo: parsedEmail.inReplyTo ?? null,
            occurredAt,
            metadata: {
              fromAddress,
              fromName,
              to: toAddressArray(parsedEmail.to),
              cc: toAddressArray(parsedEmail.cc),
              bucketName,
              objectKey,
              attachments: parsedEmail.attachments.length,
            },
          },
          {
            actor: "system",
            occurredAt,
          },
        );
      }
    } catch (error) {
      console.error("Failed to parse inbound email batch record", error);
      failures.push({
        itemIdentifier: record.messageId,
      });
    }
  }

  return {
    batchItemFailures: failures,
  };
};
