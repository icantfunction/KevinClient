// Stage 11 Smart File Payment Resolution Purpose
import type { InvoicesService, SessionsService, SmartFilesService } from "@studio-os/database";

type SmartFileRecord = Awaited<ReturnType<SmartFilesService["getSmartFileById"]>>;
type InvoiceRecord = Awaited<ReturnType<InvoicesService["getInvoiceById"]>>;

const asStringArray = (value: unknown) =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0) : [];

const collectInvoiceIdsFromBlocks = (smartFile: NonNullable<SmartFileRecord>) => {
  const ids = new Set<string>();

  for (const block of smartFile.snapshotBlocks) {
    if (block.type !== "INVOICE_BLOCK" && block.type !== "PAYMENT_BLOCK") {
      continue;
    }

    const settings = block.settings ?? {};
    const invoiceId = typeof settings.invoiceId === "string" ? settings.invoiceId : null;
    if (invoiceId) {
      ids.add(invoiceId);
    }

    for (const candidate of asStringArray(settings.invoiceIds)) {
      ids.add(candidate);
    }
  }

  return [...ids];
};

export const listPayableInvoicesForSmartFile = async (input: {
  readonly smartFileId: string;
  readonly smartFilesService: SmartFilesService;
  readonly invoicesService: InvoicesService;
  readonly sessionsService: SessionsService;
}) => {
  const smartFile = await input.smartFilesService.getSmartFileById(input.smartFileId);
  if (!smartFile) {
    throw new Error(`Smart File ${input.smartFileId} was not found.`);
  }

  const candidateIds = new Set(collectInvoiceIdsFromBlocks(smartFile));
  if (smartFile.sessionId) {
    const session = await input.sessionsService.getSessionById(smartFile.sessionId);
    for (const invoiceId of session?.invoiceIds ?? []) {
      candidateIds.add(invoiceId);
    }
  }

  let invoiceCandidates: InvoiceRecord[] = [];
  if (candidateIds.size > 0) {
    invoiceCandidates = (
      await Promise.all([...candidateIds].map((invoiceId) => input.invoicesService.getInvoiceById(invoiceId)))
    ).filter((invoice): invoice is NonNullable<InvoiceRecord> => Boolean(invoice));
  } else if (smartFile.clientId) {
    invoiceCandidates = await input.invoicesService.listInvoices({ clientId: smartFile.clientId });
  }

  return invoiceCandidates.filter(
    (invoice): invoice is NonNullable<InvoiceRecord> =>
      Boolean(invoice) && invoice.balanceCents > 0 && invoice.status !== "void" && invoice.status !== "refunded",
  );
};
