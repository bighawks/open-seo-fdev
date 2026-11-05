---
title: "Set up OpenSEO MCP"
description: "Connect OpenSEO MCP to Claude and other MCP clients."
---

OpenSEO MCP lets compatible AI clients call OpenSEO tools for keyword research, SERP inspection, local business research, competitive search intelligence, domain research, backlink overview, saved keywords, rank tracking, shared project context, and Google Search Console performance and URL inspection.

The hosted MCP server URL is:

```txt
https://app.openseo.so/mcp
```

The first connection sends you through OpenSEO login. After authorization, your MCP client can call OpenSEO tools with the project context and account scopes you approved. For headless environments and CI, [connect with an API key](#connect-with-an-api-key) instead.

For the most current setup UI and a copyable endpoint, open [Agent setup in OpenSEO](https://app.openseo.so/ai).

For setup prompts, plugin commands, and skill updates, see [Agent setup](/docs/agent-setup).

No account yet? Try the [free SEO tools](/tools).

## Claude Code

The [OpenSEO plugin](/docs/claude-code-plugin) is the preferred way to connect Claude Code — one install adds MCP and the public SEO skills together. Use the steps below only if you want MCP on its own.

Use user scope to make OpenSEO available across projects. Use local scope for the current repository.

```bash
claude mcp add --transport http --scope user openseo https://app.openseo.so/mcp
```

After adding the server, approve the OpenSEO login when prompted.

## Claude Desktop

On a paid Claude plan, prefer the [OpenSEO plugin](/docs/claude-code-plugin#install-in-claude-cowork), which adds MCP and the SEO skills in one install. Use the custom connector below for MCP only or on the Free plan.

1. Open Customize -> Connectors.
2. Click Add (or +), then choose Add custom connector.
3. Paste `https://app.openseo.so/mcp`.
4. Approve the OpenSEO login when prompted.

Claude Desktop custom connectors are available on Free, Pro, Max, Team, and Enterprise plans. Free plans support one custom connector.

## Connect with an API key

Use an API key in headless environments, CI, or clients where OAuth is inconvenient. API keys are personal: anything an agent does with your key acts as you in the workspace that was active when you created it.

In the [OpenSEO app](https://app.openseo.so/settings), open **Settings -> API keys**, create a key, and copy it when it appears. It won't be shown again.

For Claude Code, run:

```bash
claude mcp add --transport http --scope user openseo https://app.openseo.so/mcp --header "Authorization: Bearer oseo_YOUR_KEY"
```

Any other client that supports custom HTTP headers can send `Authorization: Bearer oseo_YOUR_KEY` or `x-api-key: oseo_YOUR_KEY`.

## Workspaces and revoking access

An OAuth connection or API key is tied to the workspace that was active when you authorized or created it. To use OpenSEO in another workspace, connect again and pick that workspace on the authorization page, or switch to it in the app before creating a key. To disconnect an agent, open [Settings](https://app.openseo.so/settings) and choose **Disconnect** under **Connected agents**. To revoke a key, choose **Revoke key** under **API keys**. A disconnected agent has to sign in again before it can call OpenSEO.

## Available tools

OpenSEO MCP exposes tools for SEO research workflows:

- Research keywords with volume, difficulty, and CPC.
- Fetch live Google organic SERP results for keywords.
- Find exact keyword, page, rank, volume, CPC, intent, and traffic rows for a domain or page.
- Compare SERP competitors across a supplied keyword set.
- Search local businesses near a coordinate, filtering by rating, review count, or claimed status.
- Fetch one Maps or Local Finder SERP, and read Google Business Q&A when needed.
- Audit a Google Business Profile: categories, rating, hours, photos, and claim status.
- Collect Google reviews (including reviews from other sites) and Google Business posts.
- Look up valid Google Business category slugs.
- Check Google Maps rank at each point of a grid around a business.
- Hydrate keywords with search volume, difficulty, intent, CPC, and trends.
- List saved keywords from an OpenSEO project.
- Save useful keywords back to OpenSEO.
- Read rank tracker configs and latest keyword positions.
- Summarize a domain's organic footprint.
- Find keywords a domain already ranks for.
- Check backlink and referring-domain overview data.
- Explore a prompt in ChatGPT or compare answers and available citations across selected AI models. ChatGPT is the default; uncached answers use credits.
- Research questions about a keyword with ChatGPT's answers and cited sources (uses credits).
- Configure AI prompt tracking, preview cost, and start or pause scheduled checks.
- Read and export saved AI answers, trends, citations, and competitor appearances without using credits.
- List the Search Console sites and Google Analytics properties your connected Google accounts can see, and bind one to a project (free, no credits). Connecting a Google account itself still happens in Settings > Integrations.
- Read first-party Google Search Console performance (clicks, impressions, CTR, position).
- Inspect index status, crawl, and canonical for specific URLs (up to 10 per call).
- Tell Bing and other IndexNow search engines which pages on your site were added, changed, or removed (free, no credits). Your site hosts the project's key file, shown in Settings > Integrations. Google doesn't use IndexNow.
- Read and update a project's shared context: business, goal, positioning, writing preferences, competitors, key pages, and a research log (free, no credits).
- Save and read HTML reports on a project (free, no credits). New reports are private. On hosted OpenSEO, explicitly ask the agent to publish with `set_report_sharing` (`public: true`) or revoke the link (`public: false`). `get_report` returns `report.shareUrl` for an existing public link, or `null` when unavailable.
- List a project's report templates, and save a reusable report brief to the project (free, no credits).

## What to do after setup

See the [AI Visibility guide](/docs/ai-visibility) for supported engines, research coverage, and costs.

Once OpenSEO MCP is connected, [set up OpenSEO Agent Skills](/docs/skills/setup). MCP gives your agent access to OpenSEO data. Skills are separate `SKILL.md` files that tell your agent how to use that data for specific SEO jobs.

Start with one focused workflow instead of asking your agent to "do SEO" broadly.

- Use [SEO project setup](/docs/skills/seo-project-setup) to save your goals, positioning, competitors, and key pages to your project context, so every other skill reuses them.
- Use [SEO coach](/docs/skills/seo-coach) if you are new to SEO or are not sure which workflow to run first.
- Use [AI Prompt Research](/docs/skills/ai-prompt-research) to find questions and cited sources before choosing what to track.
- Use [AI Visibility Audit](/docs/skills/ai-visibility-audit) to investigate why competitors appear and which changes to try.
- Use [keyword research](/docs/skills/keyword-research) to discover keyword opportunities.
- Use [competitive landscape](/docs/skills/competitive-landscape) to map a market before choosing competitors or pages.
- Use [competitor analysis](/docs/skills/competitor-analysis) to study one competitor.
- Use [keyword clustering](/docs/skills/keyword-clustering) to turn keywords into page groups.
- Use [link prospecting](/docs/skills/link-prospecting) to find outreach prospects for a linkable asset.

## Troubleshooting

If your client cannot connect, check that the server URL is exactly `https://app.openseo.so/mcp`.

If authorization fails, disconnect the OpenSEO server in your client, add it again, and repeat the login flow.

If your agent cannot find a project, ask it to list OpenSEO projects first and use the returned project ID in later tool calls.
