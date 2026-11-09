import { afterEach, expect, it, vi } from "vitest";
import { z } from "zod";
import { fetchPageSpeedLighthouse } from "./pagespeed";

afterEach(() => {
  vi.unstubAllGlobals();
});

const input = {
  url: "https://example.com/",
  strategy: "mobile" as const,
  apiKey: "test-key",
};

it("asks for all four categories and stores PageSpeed's report like DataForSEO's", async () => {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
    Response.json({
      lighthouseResult: {
        requestedUrl: "https://example.com/",
        finalUrl: "https://example.com/",
        lighthouseVersion: "12.0.0",
        categories: {
          performance: { score: 0.91 },
          accessibility: { score: 0.8 },
          "best-practices": { score: 1 },
          seo: { score: 0.7 },
        },
        audits: {},
      },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);

  const stored = await fetchPageSpeedLighthouse(input);

  const url = new URL(z.string().parse(fetchMock.mock.calls[0]?.[0]));
  expect(url.searchParams.get("strategy")).toBe("MOBILE");
  expect(url.searchParams.getAll("category")).toEqual([
    "PERFORMANCE",
    "ACCESSIBILITY",
    "BEST_PRACTICES",
    "SEO",
  ]);
  expect(stored).toMatchObject({
    source: "pagespeed-insights",
    metadata: { cost: 0, taskId: null, strategy: "mobile" },
    scores: {
      performance: 91,
      accessibility: 80,
      "best-practices": 100,
      seo: 70,
    },
  });
});

it("reports a page Lighthouse could not load, without leaking the key", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json(
          { error: { message: "Lighthouse returned error: NOT_HTML" } },
          { status: 500 },
        ),
      ),
  );

  const failure = fetchPageSpeedLighthouse(input);

  await expect(failure).rejects.toThrow("NOT_HTML");
  await expect(failure).rejects.not.toThrow("test-key");
});
