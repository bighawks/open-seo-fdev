# OpenSEO, Claude edition

A self-hosted SEO platform that uses Claude as its only AI. You run it on your own server and pay your data and AI providers directly, with no subscription.

This is an independent fork of [OpenSEO](https://github.com/every-app/open-seo), an open source alternative to Semrush and Ahrefs. It is not affiliated with or supported by the OpenSEO project.

<img width="100%" alt="OpenSEO keyword research" src="https://github.com/user-attachments/assets/8ebdc439-3e72-41ab-8bde-8cda771ef2e8" />

## What it does

- **Keyword research:** ideas, search volumes and difficulty.
- **Competitors:** domain overviews and the keywords a site ranks for.
- **Backlinks:** a domain's link profile and referring domains.
- **Rank tracking and local SEO:** scheduled position checks, including local results.
- **Site audits:** crawl a site for broken links, missing tags and pages Google can't index.
- **Search Console and Google Analytics:** your own traffic data next to the research.
- **AI visibility:** see whether ChatGPT, Gemini, Claude, Perplexity and Google AI Overviews mention your brand and cite your site.
- **Reports and project memory:** save findings and context for each site you work on.

### Where Claude comes in

- **SAM:** a chat agent inside the app that can use all of the tools above. It is in beta and has no menu entry: open `/p/<project-id>/sam`.
- **Setup help:** Claude reads your website, summarizes the business and suggests competitors and prompts to track.
- **Claude Code and Claude Desktop:** connect them over MCP to use your SEO data from there.

The AI engines listed under AI visibility are what the app measures, through DataForSEO. Claude is the only AI that runs the app itself.

## How this fork differs

- **Claude only.** The app calls the Anthropic API directly. OpenRouter, GPT and MiniMax are gone.
- **Lower AI costs.** Prompt caching cuts the cost of SAM's later turns by about 90%.
- **SAM keeps its replies on Docker.** celld, the runtime behind the Docker edition, is updated to 0.6.3. On 0.5.1, replies to turns that used no tools disappeared on reload.
- **No other clients.** Support and setup guides for ChatGPT, Codex, Cursor and similar clients are removed. Other MCP clients may still connect, but they are not supported here.

## Run it with Docker

You need Docker with Compose, at least 4 GiB of memory for Docker, and a [DataForSEO API key](./docs/DATAFORSEO_API_KEY.md). An [Anthropic API key](https://platform.claude.com/settings/keys) is optional, but the AI features stay off without it.

```sh
git clone https://github.com/bighawks/open-seo-fdev.git
cd open-seo-fdev
export COMPOSE_FILE=deploy/standalone/compose.yaml:deploy/standalone/compose.build.yaml
cp deploy/standalone/.env.example deploy/standalone/.env
```

In `deploy/standalone/.env`, set:

| Variable             | Value                                                                   |
| -------------------- | ----------------------------------------------------------------------- |
| `STORAGE_SECRET_KEY` | A unique random value, for example the output of `openssl rand -hex 32` |
| `DATAFORSEO_API_KEY` | Your DataForSEO key                                                     |
| `ANTHROPIC_API_KEY`  | Your Anthropic key                                                      |
| `ANTHROPIC_MODEL`    | Optional. The default is `claude-sonnet-5-5`                            |

Then build and start it:

```sh
docker compose up -d --build
docker compose logs -f init
```

Wait for `OpenSEO initialized and ready.`, open <http://localhost:3001> and create the administrator's account. Registration closes once that account exists, so create it before you put the app on the internet.

> **Build the image from this repository.** No image of this fork is published. Without `compose.build.yaml`, Compose pulls upstream's image, which has none of the changes above.

For any address other than `localhost`, the app requires HTTPS. Set `BETTER_AUTH_URL` to your `https://` address and put a reverse proxy in front of it. See [Public HTTPS](./docs/SELF_HOSTING_DOCKER.md#public-https).

The [Docker guide](./docs/SELF_HOSTING_DOCKER.md) covers backups, updates and optional features. It comes from upstream, so where it says to clone `every-app/open-seo` or run `docker compose pull`, use the commands above instead.

The [Cloudflare deployment](./docs/SELF_HOSTING_CLOUDFLARE.md) is also inherited from upstream. It has not been tested on this fork.

## Connect Claude Code

```sh
claude mcp add --transport http --scope user openseo https://your-domain.example/mcp
```

Sign in with your OpenSEO account when asked. Use your own address: the setup guides and the plugin in this repository point at upstream's hosted service, `app.openseo.so`.

## Costs

The software is free. You pay two providers directly, only for what you use:

- **[DataForSEO](https://dataforseo.com):** the SEO data. The app shows the cost before a tracking check or schedule starts.
- **[Anthropic](https://platform.claude.com):** SAM and the setup help.

With the default model, a SAM turn costs about $0.13 when the cache is cold, and about $0.01 to $0.02 after that. These are figures from short test chats. Long chats, and pauses of more than 5 minutes, cost more.

## Development

See [`docs/LOCAL_DEVELOPMENT.md`](./docs/LOCAL_DEVELOPMENT.md). Use [issues on this repository](https://github.com/bighawks/open-seo-fdev/issues) for problems with this fork, not the upstream project's channels.

## Credits and license

Built on [OpenSEO](https://github.com/every-app/open-seo) by Ben Senescu and its contributors. Released under the [MIT License](./LICENSE), which keeps the original copyright notice.
