import { z } from "zod";

export const pageCheckSchema = z.object({
  projectId: z.string().min(1),
  url: z.string().trim().min(1).max(2048),
});

/** URL search params for /p/$projectId/page-check. */
export const pageCheckSearchSchema = z.object({
  url: z.string().optional(),
});
