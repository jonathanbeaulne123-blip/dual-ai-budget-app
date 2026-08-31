import type { Environment } from "../core/types.ts";
import { DESK_FILE_NAME, deskFileIdKey, parseDeskSyncPayload, type DeskSyncPayload } from "../core/deskSync.ts";
import { withGoogle } from "./engine.ts";

export type DeskSyncResult = {
  ok: boolean;
  fileId?: string;
  payload?: DeskSyncPayload;
  detail: string;
};

function rememberFileId(
  environment: Environment,
  memberId: string,
  fileId: string,
  storage?: { setItem(key: string, value: string): void },
): void {
  if (!storage) return;
  try {
    storage.setItem(deskFileIdKey(environment, memberId), fileId);
  } catch {
    /* private mode */
  }
}

function rememberedFileId(
  environment: Environment,
  memberId: string,
  storage?: { getItem(key: string): string | null },
): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(deskFileIdKey(environment, memberId));
  } catch {
    return null;
  }
}

async function findDeskFileId(token: string, fetchFn: typeof import("./engine.ts").googleApiFetch): Promise<string | null> {
  const query = encodeURIComponent(`name = '${DESK_FILE_NAME}' and trashed = false`);
  const list = await fetchFn<{ files?: { id?: string }[] }>(
    token,
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&pageSize=5&spaces=drive`,
  );
  return list.files?.find((row) => row.id)?.id ?? null;
}

export async function pushDeskAppearance(input: {
  environment: Environment;
  memberId: string;
  householdId: string;
  enabledServices?: Iterable<string>;
  payload: DeskSyncPayload;
  /** Set only from an explicit Save desk click. Automatic persistence stays silent. */
  interactive?: boolean;
  storage?: { getItem(key: string): string | null; setItem(key: string, value: string): void };
}): Promise<DeskSyncResult> {
  try {
    const body = JSON.stringify(input.payload);
    const known = rememberedFileId(input.environment, input.memberId, input.storage);
    const fileId = await withGoogle({
      environment: input.environment,
      memberId: input.memberId,
      householdId: input.householdId,
      services: ["drive"],
      enabledServices: input.enabledServices,
      interactive: input.interactive,
      fn: async (ctx) => {
        let id = known || await findDeskFileId(ctx.session.accessToken, ctx.fetch);
        if (id) {
          await ctx.fetch(
            ctx.session.accessToken,
            `https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body,
            },
          );
          return id;
        }
        const boundary = "hearth_desk";
        const metadata = JSON.stringify({
          name: DESK_FILE_NAME,
          mimeType: "application/json",
        });
        const multipart = [
          `--${boundary}`,
          "Content-Type: application/json; charset=UTF-8",
          "",
          metadata,
          `--${boundary}`,
          "Content-Type: application/json; charset=UTF-8",
          "",
          body,
          `--${boundary}--`,
          "",
        ].join("\r\n");
        const created = await ctx.fetch<{ id?: string }>(
          ctx.session.accessToken,
          "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
          {
            method: "POST",
            headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
            body: multipart,
          },
        );
        return created.id ?? "";
      },
    });
    if (!fileId) return { ok: false, detail: "Drive did not keep the desk file." };
    rememberFileId(input.environment, input.memberId, fileId, input.storage);
    return { ok: true, fileId, detail: "Desk look is on this Google account." };
  } catch (caught) {
    return {
      ok: false,
      detail: caught instanceof Error ? caught.message : "Drive skipped the desk.",
    };
  }
}

export async function pullDeskAppearance(input: {
  environment: Environment;
  memberId: string;
  householdId: string;
  enabledServices?: Iterable<string>;
  /** Set only from an explicit Pull previous desk click. */
  interactive?: boolean;
  storage?: { getItem(key: string): string | null; setItem(key: string, value: string): void };
}): Promise<DeskSyncResult> {
  try {
    const known = rememberedFileId(input.environment, input.memberId, input.storage);
    const result = await withGoogle({
      environment: input.environment,
      memberId: input.memberId,
      householdId: input.householdId,
      services: ["drive"],
      enabledServices: input.enabledServices,
      interactive: input.interactive,
      fn: async (ctx) => {
        const id = known || await findDeskFileId(ctx.session.accessToken, ctx.fetch);
        if (!id) return { id: "", payload: null as DeskSyncPayload | null };
        const payload = await ctx.fetch<unknown>(
          ctx.session.accessToken,
          `https://www.googleapis.com/drive/v3/files/${id}?alt=media`,
        );
        return { id, payload: parseDeskSyncPayload(payload) };
      },
    });
    if (!result.id) return { ok: false, detail: "No previous desk on this Google account." };
    if (!result.payload) return { ok: false, fileId: result.id, detail: "The desk file was not a Hearth desk." };
    rememberFileId(input.environment, input.memberId, result.id, input.storage);
    return { ok: true, fileId: result.id, payload: result.payload, detail: "Pulled the desk from this Google account." };
  } catch (caught) {
    return {
      ok: false,
      detail: caught instanceof Error ? caught.message : "Drive skipped the desk.",
    };
  }
}
