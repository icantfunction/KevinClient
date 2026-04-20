// Stage 5 Database Smoke Script Purpose
import {
  ClientsService,
  SmartFileTemplatesService,
  SmartFilesService,
  createDatabaseClient,
} from "../src/index";
import { applyStageEnvironment } from "./shared";

const run = async () => {
  await applyStageEnvironment();

  const database = createDatabaseClient();
  const actor = "system:stage-5-smoke";
  const occurredAt = new Date();
  const clientsService = new ClientsService(database);
  const templatesService = new SmartFileTemplatesService(database);
  const smartFilesService = new SmartFilesService(database);

  const client = await clientsService.createClient(
    {
      clientType: "photo",
      primaryName: "Stage 5 Client",
      email: "stage5-client@example.com",
      phone: "+19545550005",
    },
    { actor, occurredAt },
  );

  const template = await templatesService.createTemplate(
    {
      name: "Portrait Session Booking",
      category: "portrait",
      title: "Portrait Session Booking",
      blocks: [
        {
          id: "block-1",
          type: "TEXT_BLOCK",
          order: 1,
          title: "Welcome",
          content: "Hi {{client.name}}, your session is on {{session.date}}.",
        },
        {
          id: "block-2",
          type: "CONTRACT_BLOCK",
          order: 2,
          title: "Agreement",
          content: "I, {{request:full_legal_name}}, agree to the portrait session terms.",
        },
      ],
    },
    { actor, occurredAt },
  );

  const smartFile = await smartFilesService.instantiateSmartFile(
    {
      templateId: template.id,
      clientId: client.id,
      title: "Stage 5 Portrait Booking",
      recipientEmail: client.email,
      recipientPhone: client.phone,
    },
    { actor, occurredAt },
  );

  const context = await smartFilesService.buildSmartFieldContext(smartFile.id);
  const resolved = smartFilesService.resolveBlocks(smartFile.snapshotBlocks, context, {
    full_legal_name: "Stage Five Client",
  });

  console.log(
    JSON.stringify(
      {
        templateId: template.id,
        smartFileId: smartFile.id,
        resolvedBlocks: resolved,
      },
      null,
      2,
    ),
  );
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
