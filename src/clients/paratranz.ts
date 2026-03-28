import { writeFileSync } from "node:fs";
import { fetch, request } from "undici";
import { z } from "zod";

const termSchema = z.object({
  id: z.number().optional(),
  term: z.string(),
  translation: z.string(),
  note: z.string().nullable().optional(),
  variants: z.array(z.string()).optional(),
});

const termsResponseSchema = z.object({
  page: z.number().optional(),
  pageSize: z.number().optional(),
  rowCount: z.number().optional(),
  pageCount: z.number().optional(),
  results: z.array(termSchema),
});

export type ParatranzTerm = z.infer<typeof termSchema>;

export interface ParatranzClientOptions {
  apiKey: string;
  baseUrl?: string;
}

export class ParatranzClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(options: ParatranzClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? "https://paratranz.cn/api";
  }

  private async requestJson<T>(
    path: string,
    init?: { method?: string; body?: unknown; headers?: Record<string, string> },
  ): Promise<T> {
    const response = await request(`${this.baseUrl}${path}`, {
      method: init?.method ?? "GET",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });

    if (response.statusCode >= 400) {
      const body = await response.body.text();
      throw new Error(`Paratranz request failed (${response.statusCode}): ${body}`);
    }

    return (await response.body.json()) as T;
  }

  async triggerArtifact(projectId: number): Promise<void> {
    await this.requestJson(`/projects/${projectId}/artifacts`, { method: "POST" });
  }

  async downloadArtifact(projectId: number, outputPath: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/projects/${projectId}/artifacts/download`, {
      method: "GET",
      redirect: "follow",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Artifact download failed (${response.status}): ${body}`);
    }

    const bytes = await response.arrayBuffer();
    writeFileSync(outputPath, Buffer.from(bytes));
  }

  async getTerms(projectId: number): Promise<ParatranzTerm[]> {
    const pageSize = 800;
    let page = 1;
    let pageCount = 1;
    const terms: ParatranzTerm[] = [];

    while (page <= pageCount) {
      const payload = await this.requestJson<unknown>(
        `/projects/${projectId}/terms?page=${page}&pageSize=${pageSize}`,
      );
      const parsed = termsResponseSchema.parse(payload);

      terms.push(...parsed.results);
      pageCount = parsed.pageCount ?? 1;
      page += 1;
    }

    return terms;
  }
}
