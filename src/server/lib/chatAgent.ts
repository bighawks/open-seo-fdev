import type { AnthropicProvider } from "@ai-sdk/anthropic";
import { subscribe } from "agents/observability";
import type { LanguageModelUsage } from "ai";
import { isHostedServerAuthMode } from "@/server/lib/runtime-env";

// The chat agent's most common failure modes — a provider stream dying
// mid-turn ("chat:request:failed", stage "stream") and a DO restart whose
// recovery gives up ("chat:recovery:exhausted") — never reach an onChatError
// hook; their only signal is the agents:chat diagnostics channel, which is
// silent without a subscriber. This module-level subscription puts them in
// the Workers logs for every chat DO in the isolate. The user-visible residue
// of these is the replayed "Something went wrong" banner plus a
// partially-streamed assistant message.
subscribe("chat", (event) => {
  if (
    event.type === "chat:request:failed" ||
    event.type === "chat:recovery:exhausted"
  ) {
    console.error(
      `[chat] ${event.type}`,
      { agent: event.agent, name: event.name },
      event.payload,
    );
  }
});

// The Anthropic API reports tokens, not dollars, so cost comes from this table:
// USD per million tokens at first-party rates. Most specific id first: lookup is
// by prefix. A model missing here costs nothing off hosted and fails closed on
// hosted (requireClaudeCostUsd), so add a row when pointing ANTHROPIC_MODEL at
// a new one.
const CLAUDE_PRICES = [
  {
    model: "claude-fable-5-1",
    input: 10,
    output: 50,
    cacheRead: 0.25,
    cacheWrite: 12.5,
  },
  {
    model: "claude-opus-5-5",
    input: 4,
    output: 20,
    cacheRead: 0.2,
    cacheWrite: 5,
  },
  {
    model: "claude-opus-5",
    input: 5,
    output: 25,
    cacheRead: 0.5,
    cacheWrite: 6.25,
  },
  {
    model: "claude-sonnet-5-5",
    input: 2,
    output: 10,
    cacheRead: 0.2,
    cacheWrite: 2.5,
  },
  {
    model: "claude-sonnet-5",
    input: 2,
    output: 10,
    cacheRead: 0.2,
    cacheWrite: 2.5,
  },
];

type ClaudeCompletion = {
  usage: LanguageModelUsage;
  response: { modelId: string };
};

function knownClaudeCostUsd({ usage, response }: ClaudeCompletion) {
  const price = CLAUDE_PRICES.find(({ model }) =>
    response.modelId.startsWith(model),
  );
  if (!price) return null;
  const { noCacheTokens, cacheReadTokens, cacheWriteTokens } =
    usage.inputTokenDetails;
  const uncached = noCacheTokens ?? usage.inputTokens ?? 0;
  return (
    (uncached * price.input +
      (cacheReadTokens ?? 0) * price.cacheRead +
      (cacheWriteTokens ?? 0) * price.cacheWrite +
      (usage.outputTokens ?? 0) * price.output) /
    1_000_000
  );
}

/** A step or response's USD cost. Used by SAM to meter against the credit pool. */
export function claudeCostUsd(completion: ClaudeCompletion): number {
  return knownClaudeCostUsd(completion) ?? 0;
}

/**
 * The cost hosted billing settles, so hosted fails closed when it is unknown.
 * Off hosted nothing is billed.
 */
export async function requireClaudeCostUsd(
  completion: ClaudeCompletion,
): Promise<number> {
  const cost = knownClaudeCostUsd(completion);
  if (cost !== null) return cost;
  if (await isHostedServerAuthMode()) {
    throw new Error(`No price for model ${completion.response.modelId}`);
  }
  return 0;
}

// The provider package exports only the provider's type, so the model and its
// stream shape are derived from it.
type LanguageModelV3 = ReturnType<AnthropicProvider>;
type StreamResult = Awaited<ReturnType<LanguageModelV3["doStream"]>>;

// Nothing is generated, so every counter is zero and there is no provider
// finish reason to report.
const NO_USAGE = {
  inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 0, text: 0, reasoning: 0 },
};
const FINISH_STOP = { unified: "stop", raw: undefined } as const;

// A model that ignores its prompt and streams `text` back verbatim. Lets a
// Think agent answer a gated turn through the normal turn pipeline — streamed,
// persisted and rendered like any other assistant message — without ever
// calling a provider: no request, no tokens, and no reasoning channel that
// could leak a chain-of-thought instead of the reply.
export function staticAssistantModel(text: string): LanguageModelV3 {
  return {
    specificationVersion: "v3",
    provider: "openseo",
    modelId: "static-assistant",
    supportedUrls: {},
    doGenerate: async () => ({
      content: [{ type: "text", text }],
      finishReason: FINISH_STOP,
      usage: NO_USAGE,
      warnings: [],
    }),
    doStream: async () => {
      const stream: StreamResult["stream"] = new ReadableStream({
        start(controller) {
          controller.enqueue({ type: "stream-start", warnings: [] });
          controller.enqueue({ type: "text-start", id: "0" });
          controller.enqueue({ type: "text-delta", id: "0", delta: text });
          controller.enqueue({ type: "text-end", id: "0" });
          controller.enqueue({
            type: "finish",
            finishReason: FINISH_STOP,
            usage: NO_USAGE,
          });
          controller.close();
        },
      });
      return { stream };
    },
  };
}
