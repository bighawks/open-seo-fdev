import { createAnthropic } from "@ai-sdk/anthropic";
import { ConfigurationError, createGatewayFetch } from "@every-app/sdk/server";
import { wrapLanguageModel } from "ai";
import { isEveryAppAuthMode } from "@/lib/auth-mode";
import { gatewayCallFor } from "@/server/lib/gateway-attribution";
import { getEnvValueSync, getWorkersEnv } from "@/server/lib/runtime-env";

/**
 * How a deployment reaches Claude: with its own Anthropic key, or behind an
 * Every App gateway (AUTH_MODE=everyapp) through the gateway's AI proxy, which
 * holds the key. The proxy's host is a placeholder the binding never resolves.
 */
export type ClaudeAccess = { apiKey: string } | { gatewayFetch: typeof fetch };

const GATEWAY_BASE_URL =
  "https://every-app-gateway.invalid/api/ai/anthropic/v1";

// Override with ANTHROPIC_MODEL to swap models without a code change.
const DEFAULT_CLAUDE_MODEL = "claude-sonnet-5-5";

// Models that accept `fallbacks: "default"`: a request a safety classifier
// declines (an audit quoting exploit strings, say) reruns on the API's
// recommended fallback model instead of ending the turn with no answer.
const SERVER_SIDE_FALLBACK_MODELS = [
  "claude-sonnet-5-5",
  "claude-opus-5-5",
  "claude-fable-5-1",
];

function isBehindEveryAppGateway(env: object): boolean {
  return isEveryAppAuthMode(getEnvValueSync(env, "AUTH_MODE"));
}

/** This deployment's Claude access, or null without one. Sync for samAccess. */
export function getClaudeAccess(env: object): ClaudeAccess | null {
  if (isBehindEveryAppGateway(env)) {
    try {
      // Whose call it is: gateway-attribution.ts.
      return {
        gatewayFetch: createGatewayFetch({ env, for: gatewayCallFor() }),
      };
    } catch (error) {
      // No gateway binding (and no local key in dev). A call that says
      // nobody's (AttributionError) is a bug, so it is thrown.
      if (error instanceof ConfigurationError) return null;
      throw error;
    }
  }
  const apiKey = getEnvValueSync(env, "ANTHROPIC_API_KEY");
  return apiKey ? { apiKey } : null;
}

/** SAM's model, from its Durable Object env. Sync: Think's getModel() is. */
export function buildSamChatModel(env: object, effort: "high" | "low") {
  const access = getClaudeAccess(env);
  if (!access) {
    throw new Error("ANTHROPIC_API_KEY is required for the SAM agent");
  }
  return buildChatAgentModel(
    access,
    getEnvValueSync(env, "ANTHROPIC_MODEL"),
    effort,
  );
}

/** For server code: the access, or the error a missing key always threw. */
export async function requireClaudeAccess(): Promise<ClaudeAccess> {
  const access = getClaudeAccess((await getWorkersEnv()) ?? {});
  if (!access) {
    throw new Error("Missing required environment variable: ANTHROPIC_API_KEY");
  }
  return access;
}

/**
 * The AI SDK LanguageModel for the chat agent and the one-shot research calls.
 * Effort rides in a middleware because Think's `getModel()` only returns a
 * model, and it is sync, so SAM reads its access and model from its DO env.
 *
 * `drop_block` is what keeps long SAM chats working on current models: a
 * thinking block is bound to the history that produced it, and Think edits
 * that history on every call (it clips older tool outputs, compacts, and
 * rebuilds the system prompt from project memory). Without it, accounts under
 * enforcement get a 400 on the turn after any such edit; with it, the API drops
 * the stale blocks and answers.
 */
export function buildChatAgentModel(
  access: ClaudeAccess,
  modelId?: string,
  effort: "high" | "low" = "high",
) {
  const model = modelId || DEFAULT_CLAUDE_MODEL;
  const anthropic =
    "apiKey" in access
      ? createAnthropic({ apiKey: access.apiKey })
      : createAnthropic({
          authToken: "gateway-managed",
          baseURL: GATEWAY_BASE_URL,
          fetch: access.gatewayFetch,
        });
  return wrapLanguageModel({
    model: anthropic(model),
    middleware: {
      specificationVersion: "v3",
      transformParams: async ({ params }) => ({
        ...params,
        providerOptions: {
          ...params.providerOptions,
          anthropic: {
            ...params.providerOptions?.anthropic,
            effort,
            thinking: {
              type: "adaptive",
              blockBinding: { prefixMismatchBehavior: "drop_block" },
            },
            ...(SERVER_SIDE_FALLBACK_MODELS.includes(model) && {
              fallbacks: "default",
            }),
          },
        },
      }),
    },
  });
}
