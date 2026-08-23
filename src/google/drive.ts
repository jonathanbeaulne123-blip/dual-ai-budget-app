import type { Environment } from "../core/types.ts";
import { withGoogle } from "./engine.ts";

export type DriveUploadResult = {
  ok: boolean;
  fileId?: string;
  detail: string;
};

/** Create a Hearth-owned Drive file. Never edits an existing household spreadsheet. Failure is soft. */
export async function uploadSitDownWorkbook(input: {
  environment: Environment;
  memberId: string;
  enabledServices?: Iterable<string>;
  name: string;
  csv: string;
}): Promise<DriveUploadResult> {
  try {
    const fileId = await withGoogle({
      environment: input.environment,
      memberId: input.memberId,
      services: ["drive"],
      enabledServices: input.enabledServices,
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
