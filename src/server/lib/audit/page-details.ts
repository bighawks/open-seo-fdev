/**
 * Details the single-page check shows that the audit's analyzer doesn't keep:
 * every heading's text, structured-data types, social tags and hreflang links.
 * Same htmlparser2 tokenizer as page-analyzer.ts, for one page at a time.
 */
import { Parser } from "htmlparser2";
import { normalizeUrl } from "./url-utils";

const MAX_HEADINGS = 300;
const MAX_HEADING_CHARS = 200;
const MAX_SOCIAL_TAGS = 40;
const MAX_STRUCTURED_DATA_DEPTH = 8;
const HEADING_LEVELS: Record<string, number> = {
  h1: 1,
  h2: 2,
  h3: 3,
  h4: 4,
  h5: 5,
  h6: 6,
};

interface PageDetails {
  headings: Array<{ level: number; text: string }>;
  structuredDataTypes: string[];
  socialTags: Array<{ property: string; content: string }>;
  hreflang: Array<{ lang: string; href: string }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function collectTypes(node: unknown, types: Set<string>, depth = 0): void {
  if (depth > MAX_STRUCTURED_DATA_DEPTH) return;
  if (Array.isArray(node)) {
    for (const item of node) collectTypes(item, types, depth + 1);
    return;
  }
  if (!isRecord(node)) return;
  const type = node["@type"];
  for (const value of Array.isArray(type) ? type : [type]) {
    if (typeof value === "string") types.add(value);
  }
  if ("@graph" in node) collectTypes(node["@graph"], types, depth + 1);
}

export function extractPageDetails(html: string, pageUrl: string): PageDetails {
  const headings: PageDetails["headings"] = [];
  const types = new Set<string>();
  const socialTags: PageDetails["socialTags"] = [];
  const hreflang: PageDetails["hreflang"] = [];
  let heading: { level: number; text: string } | null = null;
  let jsonLd: string | null = null;

  const parser = new Parser({
    onopentag(name, attribs) {
      const level = HEADING_LEVELS[name];
      if (level && headings.length < MAX_HEADINGS) {
        heading = { level, text: "" };
      } else if (
        name === "script" &&
        attribs.type?.toLowerCase() === "application/ld+json"
      ) {
        jsonLd = "";
      } else if (name === "meta") {
        const property = (attribs.property ?? attribs.name ?? "").toLowerCase();
        if (
          (property.startsWith("og:") || property.startsWith("twitter:")) &&
          attribs.content &&
          socialTags.length < MAX_SOCIAL_TAGS
        ) {
          socialTags.push({ property, content: attribs.content.trim() });
        }
      } else if (
        name === "link" &&
        attribs.rel?.toLowerCase() === "alternate" &&
        attribs.hreflang &&
        attribs.href
      ) {
        hreflang.push({
          lang: attribs.hreflang,
          href: normalizeUrl(attribs.href, pageUrl) ?? attribs.href,
        });
      }
    },
    ontext(text) {
      if (heading) heading.text += text;
      if (jsonLd !== null) jsonLd += text;
    },
    onclosetag(name) {
      if (heading && HEADING_LEVELS[name] === heading.level) {
        const text = heading.text.replace(/\s+/g, " ").trim();
        headings.push({
          level: heading.level,
          text: text.slice(0, MAX_HEADING_CHARS),
        });
        heading = null;
      } else if (name === "script" && jsonLd !== null) {
        try {
          collectTypes(JSON.parse(jsonLd), types);
        } catch {
          // Invalid JSON-LD is common and doesn't stop the rest of the page.
        }
        jsonLd = null;
      }
    },
  });
  parser.write(html);
  parser.end();

  return {
    headings,
    structuredDataTypes: [...types],
    socialTags,
    hreflang,
  };
}
