import { tmpdir } from "node:os";
import { join } from "node:path";

export function hearthArtifactDir(): string {
  return process.env.HEARTH_ARTIFACTS_DIR?.trim() || join(tmpdir(), "hearth-test-artifacts");
}
