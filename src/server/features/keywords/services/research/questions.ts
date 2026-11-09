import { waitUntil } from "cloudflare:workers";
import { z } from "zod";
import type { BillingCustomerContext } from "@/server/billing/subscription";
import { fetchGoogleAutocompleteBatch } from "@/server/lib/dataforseo/autocomplete";
import {
  buildCacheKey,
  CACHE_TTL,
  getCached,
  setCached,
} from "@/server/lib/r2-cache";
import { normalizeKeyword } from "./helpers";

/**
 * Questions and phrases people search around a keyword, grouped the way
 * AnswerThePublic shows them: Google's autocomplete for the keyword with
 * question words in front, and prepositions and comparisons after it.
 */
const QUESTION_CACHE_VERSION = 1;
const MAX_PER_GROUP = 10;

type Modifiers = {
  questions: string[];
  prepositions: string[];
  comparisons: string[];
};

const MODIFIERS: Record<string, Modifiers> = {
  it: {
    questions: [
      "come",
      "perché",
      "cosa",
      "quando",
      "dove",
      "chi",
      "quale",
      "quanto",
      "quali",
    ],
    prepositions: ["per", "con", "senza", "vicino a"],
    comparisons: ["vs", "o"],
  },
  en: {
    questions: [
      "how",
      "why",
      "what",
      "when",
      "where",
      "who",
      "which",
      "can",
      "is",
    ],
    prepositions: ["for", "with", "without", "near"],
    comparisons: ["vs", "or"],
  },
  es: {
    questions: [
      "cómo",
      "por qué",
      "qué",
      "cuándo",
      "dónde",
      "quién",
      "cuál",
      "cuánto",
    ],
    prepositions: ["para", "con", "sin", "cerca de"],
    comparisons: ["vs", "o"],
  },
  fr: {
    questions: [
      "comment",
      "pourquoi",
      "quoi",
      "quand",
      "où",
      "qui",
      "quel",
      "combien",
    ],
    prepositions: ["pour", "avec", "sans", "près de"],
    comparisons: ["vs", "ou"],
  },
  de: {
    questions: [
      "wie",
      "warum",
      "was",
      "wann",
      "wo",
      "wer",
      "welche",
      "wie viel",
    ],
    prepositions: ["für", "mit", "ohne", "in der nähe"],
    comparisons: ["vs", "oder"],
  },
};
// Other languages get the keyword's own suggestions and "vs" comparisons.
const FALLBACK_MODIFIERS: Modifiers = {
  questions: [],
  prepositions: [],
  comparisons: ["vs"],
};

const groupKinds = [
  "related",
  "questions",
  "prepositions",
  "comparisons",
] as const;

const questionsResultSchema = z.object({
  keyword: z.string(),
  locationCode: z.number(),
  languageCode: z.string(),
  groups: z.array(
    z.object({
      kind: z.enum(groupKinds),
      modifier: z.string(),
      suggestions: z.array(z.string()),
    }),
  ),
});

export type KeywordQuestionsResult = z.infer<typeof questionsResultSchema>;

export async function researchQuestions(
  input: { keyword: string; locationCode: number; languageCode: string },
  customer: BillingCustomerContext,
): Promise<KeywordQuestionsResult> {
  const keyword = normalizeKeyword(input.keyword);
  const market = {
    locationCode: input.locationCode,
    languageCode: input.languageCode,
  };
  const cacheKey = await buildCacheKey("keywords:questions", {
    version: QUESTION_CACHE_VERSION,
    organizationId: customer.organizationId,
    keyword,
    ...market,
  });
  const cached = questionsResultSchema.safeParse(await getCached(cacheKey));
  if (cached.success) return cached.data;

  const modifiers = MODIFIERS[input.languageCode] ?? FALLBACK_MODIFIERS;
  const lookups = [
    { kind: "related" as const, modifier: "", query: keyword },
    ...modifiers.questions.map((modifier) => ({
      kind: "questions" as const,
      modifier,
      query: `${modifier} ${keyword}`,
    })),
    ...modifiers.prepositions.map((modifier) => ({
      kind: "prepositions" as const,
      modifier,
      query: `${keyword} ${modifier}`,
    })),
    ...modifiers.comparisons.map((modifier) => ({
      kind: "comparisons" as const,
      modifier,
      query: `${keyword} ${modifier}`,
    })),
  ];

  const settled = await fetchGoogleAutocompleteBatch(
    customer,
    lookups.map((lookup) => ({ keyword: lookup.query, ...market })),
  );
  const failure = settled.find((result) => result.status === "rejected");
  if (failure && settled.every((result) => result.status === "rejected")) {
    throw failure.reason;
  }

  // A suggestion appears once, in the first group that found it.
  const seen = new Set([keyword]);
  const groups = lookups.flatMap((lookup, index) => {
    const result = settled[index];
    if (result?.status !== "fulfilled") return [];
    const suggestions = result.value
      .map(normalizeKeyword)
      .filter((suggestion) => {
        if (seen.has(suggestion)) return false;
        seen.add(suggestion);
        return true;
      })
      .slice(0, MAX_PER_GROUP);
    return suggestions.length > 0
      ? [{ kind: lookup.kind, modifier: lookup.modifier, suggestions }]
      : [];
  });

  const result = { keyword, ...market, groups };
  // A partial answer isn't cached, so the failed lookups run again next time.
  if (!failure) {
    waitUntil(
      setCached(cacheKey, result, CACHE_TTL.researchResult).catch((error) => {
        console.error("keywords.questions.cache-write-failed", error);
      }),
    );
  }
  return result;
}
