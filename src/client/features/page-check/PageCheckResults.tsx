import type { ReactNode } from "react";
import { SafeExternalLink } from "@/client/components/SafeExternalLink";
import { Badge } from "@/client/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import { HttpStatusBadge } from "@/client/features/audit/shared";
import type { PageCheckResult } from "@/server/features/page-check/services/PageCheckService";
import { getIssueDescriptor } from "@/shared/audit-issues";

const linkClassName =
  "inline-flex min-w-0 items-center gap-1 break-all text-primary underline-offset-4 hover:underline";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">{children}</CardContent>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[10rem_1fr]">
      <span className="text-muted-foreground">{label}</span>
      <div className="min-w-0 break-words">{children}</div>
    </div>
  );
}

function Missing() {
  return <span className="text-muted-foreground">Missing</span>;
}

/** Text with its length, flagged when outside the range search engines show. */
function SizedText({
  text,
  min,
  max,
}: {
  text: string;
  min: number;
  max: number;
}) {
  if (!text) return <Missing />;
  const fits = text.length >= min && text.length <= max;
  return (
    <span>
      {text}{" "}
      <Badge variant={fits ? "success" : "warning"}>{text.length} chars</Badge>
    </span>
  );
}

function UrlOrMissing({ url }: { url: string | null }) {
  return url ? (
    <SafeExternalLink url={url} label={url} className={linkClassName} />
  ) : (
    <Missing />
  );
}

export function PageCheckResults({ result }: { result: PageCheckResult }) {
  const { page } = result;
  return (
    <div className="space-y-4">
      <Section title="Response">
        <Row label="Page">
          <SafeExternalLink
            url={result.finalUrl}
            label={result.finalUrl}
            className={linkClassName}
          />
        </Row>
        <Row label="Status">
          <HttpStatusBadge code={result.statusCode} />
        </Row>
        {result.redirects.length > 0 ? (
          <Row label="Redirects">
            <ol className="space-y-1">
              {result.redirects.map((hop) => (
                <li key={hop.url} className="flex items-center gap-2">
                  <HttpStatusBadge code={hop.statusCode} />
                  <span className="break-all">{hop.url}</span>
                </li>
              ))}
            </ol>
          </Row>
        ) : null}
        <Row label="Response time">{result.responseTimeMs} ms</Row>
        <Row label="Content type">{result.contentType ?? <Missing />}</Row>
        {page ? (
          <Row label="Indexable">
            <Badge variant={page.isIndexable ? "success" : "destructive"}>
              {page.isIndexable ? "Yes" : "No: noindex"}
            </Badge>
          </Row>
        ) : (
          <p className="text-muted-foreground">
            This address didn't return a readable HTML page, so there are no
            tags to show.
          </p>
        )}
      </Section>

      {result.issues.length > 0 ? (
        <Section title={`Issues (${result.issues.length})`}>
          <ul className="space-y-3">
            {result.issues.map((issueType) => {
              const issue = getIssueDescriptor(issueType);
              return (
                <li key={issueType} className="space-y-1">
                  <div className="flex items-center gap-2 font-medium">
                    <Badge
                      variant={
                        issue?.severity === "critical"
                          ? "destructive"
                          : issue?.severity === "warning"
                            ? "warning"
                            : "outline"
                      }
                    >
                      {issue?.severity ?? "info"}
                    </Badge>
                    {issue?.title ?? issueType}
                  </div>
                  {issue ? (
                    <p className="text-muted-foreground">{issue.howToFix}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Section>
      ) : null}

      {page ? (
        <>
          <Section title="Search appearance">
            <Row label="Title">
              <SizedText text={page.title} min={10} max={60} />
            </Row>
            <Row label="Meta description">
              <SizedText text={page.metaDescription} min={70} max={160} />
            </Row>
            <Row label="Canonical">
              <UrlOrMissing
                url={page.canonicalUrl ?? page.headerCanonicalUrl}
              />
            </Row>
            <Row label="Robots meta">{page.robotsMeta ?? <Missing />}</Row>
            <Row label="X-Robots-Tag">{page.xRobotsTag ?? <Missing />}</Row>
          </Section>

          <Section title={`Headings (${page.headings.length})`}>
            {page.headings.length > 0 ? (
              <ul className="space-y-1">
                {page.headings.map((heading, index) => (
                  <li
                    key={index}
                    className="flex gap-2"
                    style={{ paddingLeft: `${(heading.level - 1) * 1}rem` }}
                  >
                    <Badge variant="outline">H{heading.level}</Badge>
                    <span>{heading.text || <Missing />}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <Missing />
            )}
          </Section>

          <Section title="Content">
            <Row label="Words">{page.wordCount}</Row>
            <Row label="Links">
              {page.links.internal} internal, {page.links.external} external,{" "}
              {page.links.nofollow} nofollow
            </Row>
            <Row label="Images">
              {page.images.total} total, {page.images.missingAlt} without alt
              text
            </Row>
            {page.javascriptShell ? (
              <p className="text-warning-foreground dark:text-warning">
                This page looks like a JavaScript app shell: search engines may
                see less content than a browser does.
              </p>
            ) : null}
          </Section>

          <Section title="Structured data">
            {page.structuredDataTypes.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {page.structuredDataTypes.map((type) => (
                  <Badge key={type} variant="secondary">
                    {type}
                  </Badge>
                ))}
              </div>
            ) : page.hasStructuredData ? (
              <p>Structured data found, but no JSON-LD types could be read.</p>
            ) : (
              <Missing />
            )}
          </Section>

          <Section title="Social tags">
            {page.socialTags.length > 0 ? (
              page.socialTags.map((tag, index) => (
                <Row key={index} label={tag.property}>
                  {tag.content}
                </Row>
              ))
            ) : (
              <Missing />
            )}
          </Section>

          {page.hreflang.length > 0 ? (
            <Section title={`Hreflang (${page.hreflang.length})`}>
              {page.hreflang.map((alternate) => (
                <Row
                  key={alternate.lang + alternate.href}
                  label={alternate.lang}
                >
                  <UrlOrMissing url={alternate.href} />
                </Row>
              ))}
            </Section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
