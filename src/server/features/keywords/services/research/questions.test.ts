import { beforeEach, expect, it, vi } from "vitest";
import { fetchGoogleAutocompleteBatch } from "@/server/lib/dataforseo/autocomplete";
import { setCached } from "@/server/lib/r2-cache";
import { researchQuestions } from "./questions";

vi.mock("cloudflare:workers", () => ({ waitUntil: () => {} }));
vi.mock("@/server/lib/dataforseo/autocomplete", () => ({
  fetchGoogleAutocompleteBatch: vi.fn(),
}));
vi.mock("@/server/lib/r2-cache", () => ({
  CACHE_TTL: { researchResult: 86400 },
  buildCacheKey: async () => "key",
  getCached: async () => null,
  setCached: vi.fn(async () => {}),
}));

const customer = { organizationId: "org", userId: "u", userEmail: "e@x" };
const input = { keyword: "Sito Web", locationCode: 2380, languageCode: "it" };

beforeEach(() => {
  vi.mocked(fetchGoogleAutocompleteBatch).mockImplementation(
    async (_customer, inputs) =>
      inputs.map((lookup) => ({
        status: "fulfilled" as const,
        // Google repeats the seed and its plain suggestion in many lookups.
        value: ["sito web", "sito web gratis", `${lookup.keyword} oggi`],
      })),
  );
});

it("asks Google with Italian question words and shows each suggestion once", async () => {
  const result = await researchQuestions(input, customer);

  const queries = vi
    .mocked(fetchGoogleAutocompleteBatch)
    .mock.calls[0]?.[1].map((lookup) => lookup.keyword);
  expect(queries).toContain("come sito web");
  expect(queries).toContain("sito web senza");
  expect(result.groups[0]).toEqual({
    kind: "related",
    modifier: "",
    suggestions: ["sito web gratis", "sito web oggi"],
  });
  expect(result.groups[1]).toEqual({
    kind: "questions",
    modifier: "come",
    suggestions: ["come sito web oggi"],
  });
  expect(setCached).toHaveBeenCalledOnce();
});

it("doesn't cache an answer that is missing failed lookups", async () => {
  vi.mocked(fetchGoogleAutocompleteBatch).mockImplementation(
    async (_customer, inputs) =>
      inputs.map((_lookup, index) =>
        index === 0
          ? { status: "rejected" as const, reason: new Error("timeout") }
          : { status: "fulfilled" as const, value: ["sito web economico"] },
      ),
  );

  const result = await researchQuestions(input, customer);

  expect(result.groups).toHaveLength(1);
  expect(setCached).not.toHaveBeenCalled();
});
