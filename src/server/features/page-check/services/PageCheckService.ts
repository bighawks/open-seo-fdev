import { classifyFetch } from "@/server/lib/audit/classify-fetch";
import { MAX_HTML_BYTES, readTextUpTo } from "@/server/lib/audit/html-response";
import { runPageReporters } from "@/server/lib/audit/issues/page-reporters";
import { normalizeAndValidateStartUrl } from "@/server/lib/audit/url-policy";
import { auditRequestHeaders } from "@/server/lib/audit/web-bot-auth";
import { AppError } from "@/server/lib/errors";
import { publicFetch } from "@/server/lib/public-fetch";
import {
  analyzedPageResult,
  parseLinkHeaderCanonical,
} from "@/server/workflows/site-audit-workflow-helpers";
import type { AuditIssueType } from "@/shared/audit-issues";
import type { PageFetchClass } from "@/shared/audit-fetch-class";

const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT_MS = 15_000;

export interface PageCheckResult {
  requestedUrl: string;
  finalUrl: string;
  redirects: Array<{ url: string; statusCode: number }>;
  statusCode: number;
  contentType: string | null;
  responseTimeMs: number;
  fetchClass: PageFetchClass;
  /** Null when the page isn't readable HTML (an error, a block, a PDF…). */
  page: {
    title: string;
    metaDescription: string;
    canonicalUrl: string | null;
    headerCanonicalUrl: string | null;
    robotsMeta: string | null;
    xRobotsTag: string | null;
    isIndexable: boolean;
    javascriptShell: boolean;
    wordCount: number;
    links: { internal: number; external: number; nofollow: number };
    images: { total: number; missingAlt: number };
    headings: Array<{ level: number; text: string }>;
    structuredDataTypes: string[];
    hasStructuredData: boolean;
    socialTags: Array<{ property: string; content: string }>;
    hreflang: Array<{ lang: string; href: string }>;
  } | null;
  /** The same per-page issues an audit reports for this page. */
  issues: AuditIssueType[];
}

/**
 * Fetches one page the way the site audit does and reports what an SEO
 * browser extension would show. Free: no DataForSEO call.
 */
async function checkPage(rawUrl: string): Promise<PageCheckResult> {
  const requestedUrl = await normalizeAndValidateStartUrl(rawUrl);
  const redirects: PageCheckResult["redirects"] = [];
  let url = requestedUrl;

  for (;;) {
    const startedAt = Date.now();
    const response = await publicFetch(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        ...(await auditRequestHeaders(url, null)),
      },
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const responseTimeMs = Date.now() - startedAt;
    const location = response.headers.get("location");
    if (response.status < 300 || response.status >= 400 || !location) {
      return describeResponse({
        requestedUrl,
        url,
        redirects,
        response,
        responseTimeMs,
      });
    }

    await response.body?.cancel();
    if (redirects.length >= MAX_REDIRECTS) {
      throw new AppError(
        "VALIDATION_ERROR",
        `The page redirects more than ${MAX_REDIRECTS} times.`,
      );
    }
    redirects.push({ url, statusCode: response.status });
    // Every hop is a new target the page's owner chose: validate it before
    // fetching, exactly like the start URL.
    url = await normalizeAndValidateStartUrl(new URL(location, url).toString());
  }
}

async function describeResponse(input: {
  requestedUrl: string;
  url: string;
  redirects: PageCheckResult["redirects"];
  response: Response;
  responseTimeMs: number;
}): Promise<PageCheckResult> {
  const { url, response, responseTimeMs } = input;
  const statusCode = response.status;
  const contentType = response.headers.get("content-type");
  const xRobotsTag = response.headers.get("x-robots-tag");
  const headerCanonicalUrl = parseLinkHeaderCanonical(
    response.headers.get("link"),
    url,
  );
  const isHtml = (contentType ?? "").includes("text/html");
  let body = "";
  if (isHtml) body = await readTextUpTo(response, MAX_HTML_BYTES);
  else await response.body?.cancel();
  const fetchClass = classifyFetch(
    statusCode,
    Boolean(response.headers.get("cf-mitigated")),
    body.slice(0, 4_000),
  );
  const result: PageCheckResult = {
    requestedUrl: input.requestedUrl,
    finalUrl: url,
    redirects: input.redirects,
    statusCode,
    contentType,
    responseTimeMs,
    fetchClass,
    page: null,
    issues: [],
  };
  if (!isHtml || fetchClass !== "ok" || statusCode >= 400) return result;

  // Dynamic imports keep the HTML parsers out of the worker's startup graph.
  const [{ analyzeHtml }, { extractPageDetails }] = await Promise.all([
    import("@/server/lib/audit/page-analyzer"),
    import("@/server/lib/audit/page-details"),
  ]);
  const analysis = analyzeHtml(body, url, statusCode, responseTimeMs);
  const row = await analyzedPageResult({
    analysis,
    url,
    statusCode,
    fetchClass,
    xRobotsTag,
    headerCanonicalUrl,
    responseTimeMs,
    htmlBytes: body.length,
    rateLimited: false,
    crawlDepth: 0,
    inSitemap: false,
  });
  const details = extractPageDetails(body, url);

  return {
    ...result,
    page: {
      title: row.title,
      metaDescription: row.metaDescription,
      canonicalUrl: row.canonicalUrl,
      headerCanonicalUrl,
      robotsMeta: row.robotsMeta,
      xRobotsTag,
      isIndexable: row.isIndexable,
      javascriptShell: row.javascriptShell === true,
      wordCount: row.wordCount,
      links: {
        internal: row.links.filter((link) => link.isInternal).length,
        external: row.links.filter((link) => !link.isInternal).length,
        nofollow: row.links.filter((link) => link.isNofollow).length,
      },
      images: { total: row.imagesTotal, missingAlt: row.imagesMissingAlt },
      headings: details.headings,
      structuredDataTypes: details.structuredDataTypes,
      hasStructuredData: row.hasStructuredData,
      socialTags: details.socialTags,
      hreflang: details.hreflang,
    },
    issues: runPageReporters(row).map((issue) => issue.issueType),
  };
}

export const PageCheckService = { checkPage };
