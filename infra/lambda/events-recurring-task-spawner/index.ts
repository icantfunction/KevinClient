// Stage 9 Recurring Task Spawner Lambda Purpose
import { and, isNotNull, isNull } from "drizzle-orm";
import { tasks } from "@studio-os/database";
import { RRule } from "rrule";
import { createStage3Services } from "../shared/database";
import { ensureAutomationTask } from "../shared/automation-notifications";

const startOfUtcDay = (value: Date) => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 0, 0, 0, 0));
const endOfUtcDay = (value: Date) => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 23, 59, 59, 999));

export const handler = async () => {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const {
    database,
    tasksService,
  } = createStage3Services();

  const recurringTemplates = await database
    .select()
    .from(tasks)
    .where(and(isNull(tasks.deletedAt), isNotNull(tasks.recurringRule)));

  let spawnedTasks = 0;

  for (const template of recurringTemplates) {
    if (!template.recurringRule) {
      continue;
    }

    let nextOccurrence: Date | null = null;
    try {
      const rule = RRule.fromString(template.recurringRule);
      nextOccurrence = rule.after(new Date(now.getTime() - 1000), true);
    } catch {
      continue;
    }

    if (!nextOccurrence || nextOccurrence > tomorrow) {
      continue;
    }

    const existingTasks = await tasksService.listTasks({
      scope: template.scope,
      scopeId: template.scopeId ?? undefined,
      includeDone: true,
      from: startOfUtcDay(nextOccurrence),
      to: endOfUtcDay(nextOccurrence),
      limit: 50,
    });

    if (existingTasks.some((task) => task.title === template.title && task.id !== template.id)) {
      continue;
    }

    const created = await ensureAutomationTask({
      tasksService,
      actor: "system",
      occurredAt: now,
      scope: template.scope,
      scopeId: template.scopeId ?? null,
      title: template.title,
      description: template.description,
      status: "todo",
      priority: template.priority,
      dueAt: nextOccurrence,
      notes: [template.notes, `Generated from recurring template ${template.id}`].filter(Boolean).join("\n"),
    });

    if (created.created) {
      spawnedTasks += 1;
    }
  }

  return {
    spawnedTasks,
  };
};
