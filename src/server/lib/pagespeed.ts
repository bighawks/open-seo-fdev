import { z } from "zod";
import { withLighthouseParseLock } from "@/server/lib/lighthouseParseLock";
import {
  buildStoredLighthousePayload,
  lighthouseReportSchema,
  type StoredLighthousePayload,
} from "@/server/lib/lighthouseStoredPayload";

/**
 * Lighthouse through Google's PageSpeed Insights API, which is free (with a
 * daily quota per key) and returns the same report DataForSEO's Lighthouse
 * endpoint does. The audit uses it when GOOGLE_PAGESPEED_API_KEY is set.
 */
const PAGESPEED_URL =
  "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
// A run takes 10-60s on Google's side before the headers arrive.
const REQUEST_TIMEOUT_MS = 90_000;
const CATEGORIES = ["PERFORMANCE", "ACCESSIBILITY", "BEST_PRACTICES", "SEO"];

const pageSpeedResponseSchema = z.object({
  lighthouseResult: lighthouseReportSchema.extend({
    runtimeError: z
      .object({ code: z.string().optional(), message: z.string().optional() })
      .optional(),
  }),
});

const pageSpeedErrorSchema = z.object({
  error: z.object({ message: z.string().optional() }).optional(),
});

export async function fetchPageSpeedLighthouse(input: {
  url: string;
  strategy: "mobile" | "desktop";
  apiKey: string;
}): Promise<StoredLighthousePayload> {
  const params = new URLSearchParams({
    url: input.url,
    strategy: input.strategy.toUpperCase(),
    key: input.apiKey,
  });
  for (const category of CATEGORIES) params.append("category", category);

  // Cleared once headers arrive, so a body read queued behind the parse lock
  // isn't aborted halfway.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${PAGESPEED_URL}?${params}`, {
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  // Never echo the request URL: it carries the API key.
  if (!response.ok) {
    const body = pageSpeedErrorSchema.safeParse(
      await response.json().catch(() => null),
    );
    const message = body.success ? body.data.error?.message : undefined;
    throw new Error(
      `PageSpeed Insights failed (HTTP ${response.status})${message ? `: ${message}` : ""}`,
    );
  }

  return withLighthouseParseLock(async () => {
    const parsed = pageSpeedResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new Error("PageSpeed Insights returned no Lighthouse report");
    }
    const report = parsed.data.lighthouseResult;
    if (report.runtimeError?.code && report.runtimeError.code !== "NO_ERROR") {
      throw new Error(
        `PageSpeed Insights could not load the page (${report.runtimeError.code}): ${report.runtimeError.message ?? ""}`.trim(),
      );
    }
    return buildStoredLighthousePayload(report, input, {
      source: "pagespeed-insights",
      label: "PageSpeed Insights",
      taskId: null,
      cost: 0,
    });
  });
}
