import { join } from "node:path";
import { ParatranzClient, type ParatranzTerm } from "../clients/paratranz.js";
import { writeJsonFile } from "../utils/json.js";

export interface NormalizedTerm {
  term: string;
  translation: string;
  note?: string;
  variants?: string[];
}

export async function fetchAndSaveTerms(input: {
  client: ParatranzClient;
  projectId: number;
  dataDir: string;
}): Promise<{ path: string; terms: NormalizedTerm[] }> {
  const path = join(input.dataDir, "terms", `project-${input.projectId}.json`);
  const terms = (await input.client.getTerms(input.projectId)).map(normalizeTerm);
  writeJsonFile(path, terms);
  return { path, terms };
}

function normalizeTerm(term: ParatranzTerm): NormalizedTerm {
  return {
    term: term.term,
    translation: term.translation,
    note: term.note ?? undefined,
    variants: term.variants,
  };
}
