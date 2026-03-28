import AdmZip from "adm-zip";
import { join } from "node:path";
import { ParatranzClient } from "../clients/paratranz.js";
import { ensureDir, resetDir } from "../utils/fs.js";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface ExportResult {
  artifactPath: string;
  extractedDir: string;
}

export async function downloadAndExtractArtifact(input: {
  client: ParatranzClient;
  projectId: number;
  dataDir: string;
  retries: number;
  waitMs: number;
}): Promise<ExportResult> {
  const artifactDir = join(input.dataDir, "artifacts");
  const extractedDir = join(input.dataDir, "extracted", `project-${input.projectId}`);
  const artifactPath = join(artifactDir, `project-${input.projectId}.zip`);
  ensureDir(artifactDir);
  await input.client.triggerArtifact(input.projectId);

  let lastError: unknown;
  for (let attempt = 1; attempt <= input.retries; attempt += 1) {
    try {
      await delay(input.waitMs * attempt);
      await input.client.downloadArtifact(input.projectId, artifactPath);
      resetDir(extractedDir);
      const zip = new AdmZip(artifactPath);
      zip.extractAllTo(extractedDir, true);
      return { artifactPath, extractedDir };
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `Failed to download artifact after ${input.retries} attempts: ${String(lastError)}`,
  );
}
