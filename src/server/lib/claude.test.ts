import { generateText } from "ai";
import { expect, it, vi } from "vitest";
import { z } from "zod";
import { buildChatAgentModel } from "./claude";

const completion = () =>
  Response.json({
    id: "msg_1",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-5-5",
    content: [{ type: "text", text: "ok" }],
    stop_reason: "end_turn",
    usage: { input_tokens: 1, output_tokens: 1 },
  });

async function sentRequest(model: ReturnType<typeof buildChatAgentModel>) {
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(completion());
  await generateText({ model, prompt: "hi" });
  const init = fetchMock.mock.lastCall?.[1];
  return {
    headers: new Headers(init?.headers),
    body: z
      .record(z.string(), z.unknown())
      .parse(JSON.parse(z.string().parse(init?.body))),
  };
}

it("lets the API drop thinking blocks Think's history edits invalidated", async () => {
  const { body, headers } = await sentRequest(
    buildChatAgentModel({ apiKey: "key" }),
  );
  expect(body.thinking).toEqual({
    type: "adaptive",
    block_binding: { prefix_mismatch_behavior: "drop_block" },
  });
  expect(headers.get("anthropic-beta")).toContain(
    "thinking-binding-controls-2026-08-01",
  );
});

it("sends the requested effort, so a low call does not run at the model's default", async () => {
  const { body } = await sentRequest(
    buildChatAgentModel({ apiKey: "key" }, undefined, "low"),
  );
  expect(body.output_config).toEqual({ effort: "low" });
});

it("treats an empty ANTHROPIC_MODEL as unset", async () => {
  const { body } = await sentRequest(
    buildChatAgentModel({ apiKey: "key" }, ""),
  );
  expect(body.model).toBe("claude-sonnet-5-5");
});

it("only asks for server-side fallbacks on models that accept them", async () => {
  const fallback = await sentRequest(buildChatAgentModel({ apiKey: "key" }));
  expect(fallback.body.fallbacks).toBe("default");
  const none = await sentRequest(
    buildChatAgentModel({ apiKey: "key" }, "claude-haiku-5-5"),
  );
  expect(none.body.fallbacks).toBeUndefined();
});

it("goes through the gateway's Anthropic proxy without a key of its own", async () => {
  const gatewayFetch = vi.fn<typeof fetch>().mockResolvedValue(completion());
  await generateText({
    model: buildChatAgentModel({ gatewayFetch }),
    prompt: "hi",
  });
  expect(gatewayFetch).toHaveBeenCalledWith(
    "https://every-app-gateway.invalid/api/ai/anthropic/v1/messages",
    expect.anything(),
  );
});
