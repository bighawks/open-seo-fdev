import { z } from "zod";
import {
  buildStoredLighthousePayload,
  lighthouseReportSchema,
  type StoredLighthousePayload,
  summarizeZodIssues,
} from "@/server/lib/lighthouseStoredPayload";

export const requestCategories = [
  "performance",
  "accessibility",
  "best_practices",
  "seo",
] as const;

export type LighthouseStrategy = "mobile" | "desktop";

const dataforseoTaskSchema = z.object({
  id: z.string().optional(),
  cost: z.number().optional(),
  status_code: z.number().optional(),
  status_message: z.string().optional(),
  result: z.array(lighthouseReportSchema).optional(),
});

const dataforseoLighthouseResponseSchema = z.object({
  status_code: z.number().optional(),
  status_message: z.string().optional(),
  tasks: z.array(dataforseoTaskSchema).optional(),
});

export function parseDataforseoLighthousePayload(
  payload: unknown,
  input: { url: string; strategy: LighthouseStrategy },
): StoredLighthousePayload {
  // Only the envelope scalars are validated up front; the report itself is
  // reduced and validated by buildStoredLighthousePayload.
  const parsed = dataforseoLighthouseResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(
      `DataForSEO Lighthouse returned an invalid response: ${summarizeZodIssues(parsed.error)}`,
    );
  }

  if (parsed.data.status_code !== 20000) {
    throw new Error(
      parsed.data.status_message ?? "DataForSEO Lighthouse request failed",
    );
  }

  const task = parsed.data.tasks?.[0];
  if (!task) {
    throw new Error("DataForSEO Lighthouse response missing task");
  }

  if (task.status_code !== 20000) {
    throw new Error(task.status_message ?? "DataForSEO Lighthouse task failed");
  }

  const result = task.result?.[0];
  if (!result) {
    throw new Error("DataForSEO Lighthouse response missing result");
  }

  return buildStoredLighthousePayload(result, input, {
    source: "dataforseo-lighthouse",
    label: "DataForSEO Lighthouse",
    taskId: task.id ?? null,
    cost: task.cost ?? null,
  });
}
