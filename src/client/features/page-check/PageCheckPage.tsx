import { useEffect } from "react";
import { useForm, useStore } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/client/components/PageHeader";
import { SearchCard, SearchInput } from "@/client/components/SearchCard";
import {
  createFormValidationErrors,
  getFieldError,
  shouldValidateFieldOnChange,
} from "@/client/lib/forms";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { checkPage } from "@/serverFunctions/page-check";
import { PageCheckResults } from "./PageCheckResults";

function validate(url: string, validateUntouched: boolean) {
  if (url.trim() || !validateUntouched) return null;
  return createFormValidationErrors({
    fields: { url: "Enter the address of a page." },
  });
}

/** Checks one page's SEO tags, like a browser extension, from the server. */
export function PageCheckPage({
  projectId,
  url,
  onCheck,
}: {
  projectId: string;
  url: string;
  onCheck: (url: string) => void;
}) {
  const form = useForm({
    defaultValues: { url },
    validators: {
      onChange: ({ formApi, value }) =>
        validate(value.url, shouldValidateFieldOnChange(formApi, "url")),
      onSubmit: ({ value }) => validate(value.url, true),
    },
    onSubmit: ({ value }) => onCheck(value.url.trim()),
  });

  useEffect(() => {
    form.reset({ url });
  }, [form, url]);

  const urlError = useStore(form.store, (state) =>
    getFieldError(state.fieldMeta.url?.errors ?? []),
  );

  const result = useQuery({
    queryKey: ["pageCheck", projectId, url],
    queryFn: () => checkPage({ data: { projectId, url } }),
    enabled: url !== "",
    retry: false,
    staleTime: 60_000,
  });

  return (
    <div className="h-full overflow-auto px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader
          title="Page Check"
          description="See one page's title, description, headings, links, structured data and social tags, and the issues a site audit would report. Free: it uses no DataForSEO credits."
        />
        <SearchCard
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
          pending={result.isFetching}
          error={
            urlError ??
            (result.isError ? getStandardErrorMessage(result.error) : null)
          }
          errorId="page-check-url-error"
        >
          <form.Field name="url">
            {(field) => (
              <SearchInput
                placeholder="https://example.com/page"
                aria-label="Page address"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                aria-invalid={urlError ? true : undefined}
                aria-describedby={urlError ? "page-check-url-error" : undefined}
              />
            )}
          </form.Field>
        </SearchCard>
        {result.data ? <PageCheckResults result={result.data} /> : null}
      </div>
    </div>
  );
}
