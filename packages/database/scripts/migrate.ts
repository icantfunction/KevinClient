// Stage 2 Migration Script Purpose
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  BeginTransactionCommand,
  CommitTransactionCommand,
  ExecuteStatementCommand,
  RDSDataClient,
  RollbackTransactionCommand,
} from "@aws-sdk/client-rds-data";
import { applyStageEnvironment, withDatabaseResumeRetry } from "./shared";

type DataApiField = {
  readonly stringValue?: string;
  readonly longValue?: number;
};

const splitSqlStatements = (input: string): string[] => {
  const statements: string[] = [];
  let current = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let dollarTag = "";

  for (let index = 0; index < input.length; index += 1) {
    const currentCharacter = input[index];
    const nextTwoCharacters = input.slice(index, index + 2);

    if (!inSingleQuote && !inDoubleQuote && nextTwoCharacters === "--") {
      while (index < input.length && input[index] !== "\n") {
        index += 1;
      }
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && currentCharacter === "$") {
      const remaining = input.slice(index);
      const match = remaining.match(/^\$[A-Za-z0-9_]*\$/);
      if (match) {
        const token = match[0];
        current += token;
        index += token.length - 1;
        if (!dollarTag) {
          dollarTag = token;
        } else if (dollarTag === token) {
          dollarTag = "";
        }
        continue;
      }
    }

    if (!dollarTag && currentCharacter === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      current += currentCharacter;
      continue;
    }

    if (!dollarTag && currentCharacter === "\"" && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      current += currentCharacter;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && !dollarTag && currentCharacter === ";") {
      const statement = current.trim();
      if (statement.length > 0) {
        statements.push(statement);
      }
      current = "";
      continue;
    }

    current += currentCharacter;
  }

  const trailingStatement = current.trim();
  if (trailingStatement.length > 0) {
    statements.push(trailingStatement);
  }

  return statements;
};

const readScalar = (field: DataApiField | undefined): string => {
  if (!field) {
    return "";
  }

  if (typeof field.stringValue === "string") {
    return field.stringValue;
  }

  if (typeof field.longValue === "number") {
    return `${field.longValue}`;
  }

  return "";
};

const main = async () => {
  const outputs = await applyStageEnvironment();
  const rdsDataClient = new RDSDataClient({
    region: process.env.AWS_REGION,
  });
  const sendWithRetry = <T>(operation: () => Promise<T>) =>
    withDatabaseResumeRetry(
      operation,
      {
        label: "migration",
      },
    );

  await sendWithRetry(
    () =>
      rdsDataClient.send(
        new ExecuteStatementCommand({
          resourceArn: outputs.resourceArn,
          secretArn: outputs.secretArn,
          database: outputs.databaseName,
          sql: `CREATE TABLE IF NOT EXISTS __studio_os_migrations (
            id text PRIMARY KEY,
            hash text NOT NULL,
            created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
          )`,
        }),
      ),
  );

  const existingMigrationsResponse = await sendWithRetry(
    () =>
      rdsDataClient.send(
        new ExecuteStatementCommand({
          resourceArn: outputs.resourceArn,
          secretArn: outputs.secretArn,
          database: outputs.databaseName,
          sql: "SELECT id, hash FROM __studio_os_migrations ORDER BY id ASC",
        }),
      ),
  );

  const appliedMigrations = new Map<string, string>(
    (existingMigrationsResponse.records ?? []).map((record) => [readScalar(record[0]), readScalar(record[1])]),
  );

  const migrationsDirectory = join(process.cwd(), "drizzle");
  const migrationFiles = (await readdir(migrationsDirectory))
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort();

  for (const fileName of migrationFiles) {
    const migrationSql = await readFile(join(migrationsDirectory, fileName), "utf8");
    const migrationHash = createHash("sha256").update(migrationSql).digest("hex");

    if (appliedMigrations.get(fileName) === migrationHash) {
      continue;
    }

    const begin = await sendWithRetry(
      () =>
        rdsDataClient.send(
          new BeginTransactionCommand({
            resourceArn: outputs.resourceArn,
            secretArn: outputs.secretArn,
            database: outputs.databaseName,
          }),
        ),
    );

    const transactionId = begin.transactionId;
    if (!transactionId) {
      throw new Error(`Failed to open transaction for migration ${fileName}.`);
    }

      try {
        for (const statement of splitSqlStatements(migrationSql)) {
        await sendWithRetry(
          () =>
            rdsDataClient.send(
              new ExecuteStatementCommand({
                resourceArn: outputs.resourceArn,
                secretArn: outputs.secretArn,
                database: outputs.databaseName,
                transactionId,
                sql: statement,
              }),
            ),
        );
      }

      await sendWithRetry(
        () =>
          rdsDataClient.send(
            new ExecuteStatementCommand({
              resourceArn: outputs.resourceArn,
              secretArn: outputs.secretArn,
              database: outputs.databaseName,
              transactionId,
              sql: `INSERT INTO __studio_os_migrations (id, hash)
                    VALUES (:id, :hash)
                    ON CONFLICT (id) DO UPDATE SET hash = EXCLUDED.hash`,
              parameters: [
                {
                  name: "id",
                  value: { stringValue: fileName },
                },
                {
                  name: "hash",
                  value: { stringValue: migrationHash },
                },
              ],
            }),
          ),
      );

      await sendWithRetry(
        () =>
          rdsDataClient.send(
            new CommitTransactionCommand({
              resourceArn: outputs.resourceArn,
              secretArn: outputs.secretArn,
              transactionId,
            }),
          ),
      );
    } catch (error) {
      await sendWithRetry(
        () =>
          rdsDataClient.send(
            new RollbackTransactionCommand({
              resourceArn: outputs.resourceArn,
              secretArn: outputs.secretArn,
              transactionId,
            }),
          ),
      );

      throw error;
    }
  }

  console.log(
    JSON.stringify(
      {
        appliedMigrations: migrationFiles,
        databaseName: outputs.databaseName,
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
