import { z } from "zod";
import type { BillingCustomerContext } from "@/server/billing/subscription";
import { meterDataforseoCalls } from "@/server/lib/dataforseo/client";
import { dataforseoPost } from "@/server/lib/dataforseo/core";
import {
  assertOk,
  buildTaskBilling,
  type DataforseoApiResponse,
  parseTaskItems,
} from "@/server/lib/dataforseo/envelope";
import { creditsForProviderUsd } from "@/shared/billing";

// One live Google Autocomplete task. DataForSEO's documented sample cost; the
// settled cost is the provider's own figure.
const AUTOCOMPLETE_LIVE_USD = 0.002;

type AutocompleteInput = {
  keyword: string;
  locationCode: number;
  languageCode: string;
};

const autocompleteItemSchema = z
  .object({ suggestion: z.string().nullable().optional() })
  .passthrough();

/**
 * Google's search suggestions for one query, as typed into the search box.
 * One live task per call: DataForSEO allows no batching here.
 */
async function fetchGoogleAutocomplete(
  input: AutocompleteInput,
): Promise<DataforseoApiResponse<string[]>> {
  const response = await dataforseoPost(
    "/v3/serp/google/autocomplete/live/advanced",
    [
      {
        keyword: input.keyword,
        location_code: input.locationCode,
        language_code: input.languageCode,
        client: "chrome",
      },
    ],
  );
  const task = assertOk(response, { treatNoResultsAsEmpty: true });
  return {
    data: parseTaskItems(
      "google-autocomplete-live-advanced",
      task,
      autocompleteItemSchema,
    ).flatMap((item) => (item.suggestion ? [item.suggestion] : [])),
    billing: buildTaskBilling(task),
  };
}

/**
 * Many autocomplete lookups sharing one credit hold and one settle, like the
 * client's liveBatch. Resolves per call, in order.
 */
export function fetchGoogleAutocompleteBatch(
  customer: BillingCustomerContext,
  inputs: AutocompleteInput[],
) {
  return meterDataforseoCalls(
    customer,
    inputs.map((input) => () => fetchGoogleAutocomplete(input)),
    inputs.map(() => creditsForProviderUsd(AUTOCOMPLETE_LIVE_USD)),
    "keyword_research",
  );
}
