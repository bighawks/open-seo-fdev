import { useEffect } from "react";
import { useForm, useStore } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CopyButton } from "@/client/components/CopyButton";
import { PageHeader } from "@/client/components/PageHeader";
import { SearchCard, SearchInput } from "@/client/components/SearchCard";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import {
  createFormValidationErrors,
  getFieldError,
  shouldValidateFieldOnChange,
} from "@/client/lib/forms";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import type { KeywordQuestionsResult } from "@/server/features/keywords/services/research/questions";
import { researchKeywordQuestions } from "@/serverFunctions/keywords";
import { LOCATION_OPTIONS } from "@/shared/keyword-locations";

const GROUP_TITLES: Record<
  KeywordQuestionsResult["groups"][number]["kind"],
  string
> = {
  related: "Related searches",
  questions: "Questions",
  prepositions: "Prepositions",
  comparisons: "Comparisons",
};

function validate(keyword: string, validateUntouched: boolean) {
  if (keyword.trim() || !validateUntouched) return null;
  return createFormValidationErrors({
    fields: { keyword: "Enter a keyword." },
  });
}

/**
 * What people search around a keyword, like AnswerThePublic: Google's
 * suggestions with question words, prepositions and comparisons.
 */
export function KeywordQuestionsPage({
  projectId,
  keyword,
  onSearch,
}: {
  projectId: string;
  keyword: string;
  onSearch: (keyword: string) => void;
}) {
  const form = useForm({
    defaultValues: { keyword },
    validators: {
      onChange: ({ formApi, value }) =>
        validate(
          value.keyword,
          shouldValidateFieldOnChange(formApi, "keyword"),
        ),
      onSubmit: ({ value }) => validate(value.keyword, true),
    },
    onSubmit: ({ value }) => onSearch(value.keyword.trim()),
  });

  useEffect(() => {
    form.reset({ keyword });
  }, [form, keyword]);

  const keywordError = useStore(form.store, (state) =>
    getFieldError(state.fieldMeta.keyword?.errors ?? []),
  );

  const result = useQuery({
    queryKey: ["keywordQuestions", projectId, keyword],
    queryFn: () => researchKeywordQuestions({ data: { projectId, keyword } }),
    enabled: keyword !== "",
    retry: false,
    staleTime: 5 * 60_000,
  });
  const data = result.data;
  const market = data
    ? LOCATION_OPTIONS.find((option) => option.code === data.locationCode)
    : undefined;

  return (
    <div className="h-full overflow-auto px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title="Questions"
          description="The questions and phrases people type into Google around a keyword, grouped by question word, preposition and comparison. Each search makes about 16 Google Autocomplete lookups in DataForSEO, in your project's market."
        />
        <SearchCard
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
          pending={result.isFetching}
          error={
            keywordError ??
            (result.isError ? getStandardErrorMessage(result.error) : null)
          }
          errorId="questions-keyword-error"
        >
          <form.Field name="keyword">
            {(field) => (
              <SearchInput
                placeholder="e.g. sito web"
                aria-label="Keyword"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                aria-invalid={keywordError ? true : undefined}
                aria-describedby={
                  keywordError ? "questions-keyword-error" : undefined
                }
              />
            )}
          </form.Field>
        </SearchCard>

        {data ? (
          <>
            <p className="text-sm text-muted-foreground">
              {data.groups.reduce(
                (count, group) => count + group.suggestions.length,
                0,
              )}{" "}
              suggestions for “{data.keyword}” in{" "}
              {market?.label ?? data.locationCode} ({data.languageCode}). Open
              one to see its volume in Keyword Research.
            </p>
            {data.groups.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Google had no suggestions for this keyword in this market.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {data.groups.map((group) => (
                  <Card key={group.kind + group.modifier}>
                    <CardHeader>
                      <CardTitle className="text-base">
                        {group.modifier ? (
                          <>
                            <span className="text-muted-foreground">
                              {GROUP_TITLES[group.kind]}:
                            </span>{" "}
                            {group.modifier}
                          </>
                        ) : (
                          GROUP_TITLES[group.kind]
                        )}
                      </CardTitle>
                      <CardAction>
                        <CopyButton
                          value={group.suggestions.join("\n")}
                          successMessage="Suggestions copied"
                        />
                      </CardAction>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-1 text-sm">
                        {group.suggestions.map((suggestion) => (
                          <li key={suggestion}>
                            <Link
                              to="/p/$projectId/keywords"
                              params={{ projectId }}
                              search={{ q: suggestion, loc: data.locationCode }}
                              className="text-primary underline-offset-4 hover:underline"
                            >
                              {suggestion}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
