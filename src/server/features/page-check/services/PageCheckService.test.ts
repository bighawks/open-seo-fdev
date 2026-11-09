import { beforeEach, expect, it, vi } from "vitest";
import { publicFetch } from "@/server/lib/public-fetch";
import { PageCheckService } from "./PageCheckService";

vi.mock("@/server/lib/public-fetch", () => ({ publicFetch: vi.fn() }));
// Request signing reads Worker secrets; it doesn't decide what is fetched.
vi.mock("@/server/lib/audit/web-bot-auth", () => ({
  auditRequestHeaders: async () => ({}),
}));

beforeEach(() => {
  vi.mocked(publicFetch).mockResolvedValue(
    new Response(null, {
      status: 301,
      headers: { location: "http://127.0.0.1/admin" },
    }),
  );
});

it("refuses to follow a redirect to a private address", async () => {
  await expect(
    PageCheckService.checkPage("https://93.184.215.14/"),
  ).rejects.toMatchObject({ code: "CRAWL_TARGET_BLOCKED" });
  expect(publicFetch).toHaveBeenCalledOnce();
});

it("reports the page's headings, structured data and audit issues", async () => {
  vi.mocked(publicFetch).mockResolvedValue(
    new Response(
      `<html><head><title>Hi</title>
        <script type="application/ld+json">{"@graph":[{"@type":"Organization"},{"@type":["WebPage","FAQPage"]}]}</script>
      </head><body><h1>Main</h1><h3>Skipped a level</h3></body></html>`,
      { status: 200, headers: { "content-type": "text/html" } },
    ),
  );

  const result = await PageCheckService.checkPage("https://93.184.215.14/");

  expect(result.page?.headings).toEqual([
    { level: 1, text: "Main" },
    { level: 3, text: "Skipped a level" },
  ]);
  expect(result.page?.structuredDataTypes).toEqual([
    "Organization",
    "WebPage",
    "FAQPage",
  ]);
  expect(result.issues).toContain("title-too-short");
});
