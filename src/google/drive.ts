import type { Environment } from "../core/types.ts";
import { withGoogle, type GoogleCallContext } from "./engine.ts";

export type DriveUploadResult = {
  ok: boolean;
  fileId?: string;
  detail: string;
};

export type DriveReceiptResult = DriveUploadResult & {
  webViewLink?: string;
  sourceHash: string;
};

const DRIVE_FILES = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const MULTIPART_MAX_BYTES = 5 * 1024 * 1024;

function driveQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function findCreatedFile(ctx: GoogleCallContext, input: {
  property: string;
  value: string;
  parentId?: string;
}): Promise<{ id: string; webViewLink?: string } | null> {
  const clauses = [
    `appProperties has { key='${driveQueryValue(input.property)}' and value='${driveQueryValue(input.value)}' }`,
    "trashed=false",
  ];
  if (input.parentId) clauses.push(`'${driveQueryValue(input.parentId)}' in parents`);
  const url = new URL(DRIVE_FILES);
  url.searchParams.set("q", clauses.join(" and "));
  url.searchParams.set("spaces", "drive");
  url.searchParams.set("pageSize", "2");
  url.searchParams.set("fields", "files(id,webViewLink)");
  const result = await ctx.fetch<{ files?: Array<{ id?: string; webViewLink?: string }> }>(
    ctx.session.accessToken,
    url.toString(),
  );
  const file = result.files?.find((item) => item.id);
  return file?.id ? { id: file.id, webViewLink: file.webViewLink } : null;
}

async function ensureFolder(ctx: GoogleCallContext, input: {
  key: string;
  name: string;
  parentId?: string;
}): Promise<string> {
  const existing = await findCreatedFile(ctx, { property: "hearthFolder", value: input.key, parentId: input.parentId });
  if (existing) return existing.id;
  const created = await ctx.fetch<{ id?: string }>(ctx.session.accessToken, `${DRIVE_FILES}?fields=id`, {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      mimeType: FOLDER_MIME,
      ...(input.parentId ? { parents: [input.parentId] } : {}),
      appProperties: { hearthFolder: input.key },
    }),
  });
  if (!created.id) throw new Error(`Drive did not create ${input.name}.`);
  return created.id;
}

async function receiptFolder(ctx: GoogleCallContext, date: string): Promise<string> {
  const year = /^\d{4}/.exec(date)?.[0] ?? "Undated";
  const month = /^\d{4}-(\d{2})/.exec(date)?.[1] ?? "Undated";
  const root = await ensureFolder(ctx, { key: "receipts", name: "Hearth Receipts" });
  const yearFolder = await ensureFolder(ctx, { key: `receipts-${year}`, name: year, parentId: root });
  return ensureFolder(ctx, { key: `receipts-${year}-${month}`, name: month, parentId: yearFolder });
}

function receiptFileName(date: string, sourceName: string, mimeType: string): string {
  const extension = mimeType === "image/png" ? ".png" : mimeType === "image/webp" ? ".webp" : ".jpg";
  const base = sourceName.replace(/\.[^.]+$/, "").replace(/[^a-z0-9 _.-]+/gi, " ").replace(/\s+/g, " ").trim().slice(0, 90) || "Receipt";
  return `${/^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "Undated"} ${base}${extension}`;
}

async function uploadReceiptBytes(ctx: GoogleCallContext, input: {
  file: File;
  metadata: Record<string, unknown>;
}): Promise<{ id?: string; webViewLink?: string }> {
  if (input.file.size <= MULTIPART_MAX_BYTES) {
    const boundary = `hearth_receipt_${crypto.randomUUID()}`;
    const body = new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(input.metadata)}\r\n`,
      `--${boundary}\r\nContent-Type: ${input.file.type}\r\n\r\n`,
      input.file,
      `\r\n--${boundary}--\r\n`,
    ], { type: `multipart/related; boundary=${boundary}` });
    return ctx.fetch(ctx.session.accessToken, `${DRIVE_UPLOAD}?uploadType=multipart&fields=id,webViewLink`, {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    });
  }
  const started = await ctx.fetchResponse(ctx.session.accessToken, `${DRIVE_UPLOAD}?uploadType=resumable&fields=id,webViewLink`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": input.file.type,
      "X-Upload-Content-Length": String(input.file.size),
    },
    body: JSON.stringify(input.metadata),
  });
  const location = started.headers.get("Location");
  if (!location) throw new Error("Drive did not start the receipt upload.");
  const uploaded = await ctx.fetchResponse(ctx.session.accessToken, location, {
    method: "PUT",
    headers: { "Content-Type": input.file.type },
    body: input.file,
  });
  return uploaded.json() as Promise<{ id?: string; webViewLink?: string }>;
}

/** Upload one explicitly selected receipt to the uploader's private Drive. Failure is soft. */
export async function uploadDriveReceipt(input: {
  environment: Environment;
  memberId: string;
  householdId: string;
  enabledServices?: Iterable<string>;
  file: File;
  sourceHash: string;
  date: string;
}): Promise<DriveReceiptResult> {
  try {
    const result = await withGoogle({
      environment: input.environment,
      memberId: input.memberId,
      householdId: input.householdId,
      services: ["drive"],
      enabledServices: input.enabledServices,
      interactive: true,
      fn: async (ctx) => {
        const existing = await findCreatedFile(ctx, { property: "hearthSourceHash", value: input.sourceHash });
        if (existing) return existing;
        const parentId = await receiptFolder(ctx, input.date);
        return uploadReceiptBytes(ctx, {
          file: input.file,
          metadata: {
            name: receiptFileName(input.date, input.file.name, input.file.type),
            parents: [parentId],
            appProperties: {
              hearthKind: "receipt",
              hearthSourceHash: input.sourceHash,
              hearthDate: input.date,
            },
          },
        });
      },
    });
    if (!result.id) return { ok: false, sourceHash: input.sourceHash, detail: "Drive did not return a receipt file." };
    return {
      ok: true,
      sourceHash: input.sourceHash,
      fileId: result.id,
      webViewLink: result.webViewLink,
      detail: "Receipt saved in your private Hearth Receipts folder.",
    };
  } catch (caught) {
    return {
      ok: false,
      sourceHash: input.sourceHash,
      detail: caught instanceof Error ? caught.message : "Drive save needs retry.",
    };
  }
}

/** Explicitly delete a Hearth-created receipt. Nothing in the ledger is deleted. */
export async function deleteDriveReceipt(input: {
  environment: Environment;
  memberId: string;
  householdId: string;
  enabledServices?: Iterable<string>;
  sourceHash: string;
}): Promise<DriveReceiptResult> {
  try {
    const deleted = await withGoogle({
      environment: input.environment,
      memberId: input.memberId,
      householdId: input.householdId,
      services: ["drive"],
      enabledServices: input.enabledServices,
      interactive: true,
      fn: async (ctx) => {
        const file = await findCreatedFile(ctx, { property: "hearthSourceHash", value: input.sourceHash });
        if (!file) return false;
        await ctx.fetch(ctx.session.accessToken, `${DRIVE_FILES}/${encodeURIComponent(file.id)}`, { method: "DELETE" });
        return true;
      },
    });
    return {
      ok: true,
      sourceHash: input.sourceHash,
      detail: deleted ? "Receipt deleted from Drive." : "That receipt is no longer in Drive.",
    };
  } catch (caught) {
    return {
      ok: false,
      sourceHash: input.sourceHash,
      detail: caught instanceof Error ? caught.message : "Drive could not delete that receipt.",
    };
  }
}

/** Create a Hearth-owned Drive file. Never edits an existing household spreadsheet. Failure is soft. */
export async function uploadSitDownWorkbook(input: {
  environment: Environment;
  memberId: string;
  householdId: string;
  enabledServices?: Iterable<string>;
  name: string;
  csv: string;
}): Promise<DriveUploadResult> {
  try {
    const fileId = await withGoogle({
      environment: input.environment,
      memberId: input.memberId,
      householdId: input.householdId,
      services: ["drive"],
      enabledServices: input.enabledServices,
      interactive: true,
      fn: async (ctx) => {
        const boundary = "hearth_sitdown";
        const metadata = JSON.stringify({
          name: input.name,
          mimeType: "application/vnd.google-apps.spreadsheet",
        });
        const body = [
          `--${boundary}`,
          "Content-Type: application/json; charset=UTF-8",
          "",
          metadata,
          `--${boundary}`,
          "Content-Type: text/csv",
          "",
          input.csv,
          `--${boundary}--`,
          "",
        ].join("\r\n");
        const file = await ctx.fetch<{ id?: string }>(
          ctx.session.accessToken,
          "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
          {
            method: "POST",
            headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
            body,
          },
        );
        return file.id ?? "";
      },
    });
    if (!fileId) return { ok: false, detail: "Drive did not return a file." };
    return { ok: true, fileId, detail: "Workbook is in Drive as a Sheet Hearth created." };
  } catch (caught) {
    return {
      ok: false,
      detail: caught instanceof Error ? caught.message : "Drive skipped.",
    };
  }
}
