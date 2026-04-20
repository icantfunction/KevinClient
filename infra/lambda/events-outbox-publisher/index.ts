// Stage 11.5 Outbox Publisher Lambda Purpose
import {
  EventOutboxService,
  createDatabaseClient,
  publishOutboxEvents,
  type OutboxDomainEventDetail,
} from "@studio-os/database";

const OUTBOX_NAMESPACE = "StudioOs/Events";
const OUTBOX_FUNCTION = "OutboxPublisher";

const emitMetrics = (input: {
  readonly publishedCount: number;
  readonly failedPublishCount: number;
  readonly pendingCount: number;
  readonly failedRows: number;
  readonly staleRows: number;
  readonly oldestUnpublishedAgeSeconds: number;
}) => {
  console.log(
    JSON.stringify({
      _aws: {
        Timestamp: Date.now(),
        CloudWatchMetrics: [
          {
            Namespace: OUTBOX_NAMESPACE,
            Dimensions: [["Stage", "Function"]],
            Metrics: [
              { Name: "OutboxPublishedCount", Unit: "Count" },
              { Name: "OutboxFailedPublishCount", Unit: "Count" },
              { Name: "OutboxPendingCount", Unit: "Count" },
              { Name: "OutboxFailedRows", Unit: "Count" },
              { Name: "OutboxStaleRows", Unit: "Count" },
              { Name: "OutboxOldestUnpublishedAgeSeconds", Unit: "Seconds" },
            ],
          },
        ],
      },
      Stage: process.env.STAGE_NAME ?? "unknown",
      Function: OUTBOX_FUNCTION,
      OutboxPublishedCount: input.publishedCount,
      OutboxFailedPublishCount: input.failedPublishCount,
      OutboxPendingCount: input.pendingCount,
      OutboxFailedRows: input.failedRows,
      OutboxStaleRows: input.staleRows,
      OutboxOldestUnpublishedAgeSeconds: Math.max(0, Math.round(input.oldestUnpublishedAgeSeconds)),
    }),
  );
};

export const handler = async () => {
  const database = createDatabaseClient();
  const outboxService = new EventOutboxService(database);
  const batchSize = Math.max(1, Math.min(Number.parseInt(process.env.STUDIO_OS_OUTBOX_BATCH_SIZE ?? "100", 10), 100));
  const now = new Date();

  const pending = await outboxService.listPending(batchSize);
  const publishResults = await publishOutboxEvents(
    pending.map((entry) => ({
      id: entry.id,
      entityType: entry.entityType,
      entityId: entry.entityId,
      eventName: entry.eventName,
      detail: entry.detail as OutboxDomainEventDetail,
    })),
  );

  let publishedCount = 0;
  let failedPublishCount = 0;

  for (const result of publishResults) {
    if (result.success) {
      publishedCount += 1;
      await outboxService.markPublished(result.id, now);
      continue;
    }

    failedPublishCount += 1;
    await outboxService.markFailed(result.id, result.errorMessage ?? "Unknown EventBridge publish failure.", now);
  }

  const health = await outboxService.getHealthSnapshot(now);
  emitMetrics({
    publishedCount,
    failedPublishCount,
    pendingCount: pending.length,
    failedRows: health.failedCount,
    staleRows: health.staleCount,
    oldestUnpublishedAgeSeconds: health.oldestUnpublishedAgeSeconds,
  });

  if (health.failedCount > 0 || health.staleCount > 0) {
    console.warn(
      JSON.stringify({
        event: "outbox.publisher.health_warning",
        failed_rows: health.failedCount,
        stale_rows: health.staleCount,
        oldest_unpublished_age_seconds: health.oldestUnpublishedAgeSeconds,
      }),
    );
  }

  return {
    processed: publishResults.length,
    publishedCount,
    failedPublishCount,
    health,
  };
};
