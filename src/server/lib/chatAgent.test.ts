import type { LanguageModelUsage } from "ai";
import { beforeEach, expect, it, vi } from "vitest";
import { isHostedServerAuthMode } from "@/server/lib/runtime-env";
import { claudeCostUsd, requireClaudeCostUsd } from "./chatAgent";

vi.mock("@/server/lib/runtime-env", () => ({
  isHostedServerAuthMode: vi.fn(),
}));

const usage: LanguageModelUsage = {
  inputTokens: 1_500_000,
  inputTokenDetails: {
    noCacheTokens: 1_000_000,
    cacheReadTokens: 400_000,
    cacheWriteTokens: 100_000,
  },
  outputTokens: 100_000,
  outputTokenDetails: { textTokens: 100_000, reasoningTokens: 0 },
  totalTokens: 1_600_000,
};

beforeEach(() => {
  vi.mocked(isHostedServerAuthMode).mockResolvedValue(false);
});

it("prices uncached, cached and output tokens at the model's rates", () => {
  expect(
    claudeCostUsd({ usage, response: { modelId: "claude-sonnet-5-5" } }),
  ).toBeCloseTo(2 + 0.08 + 0.25 + 1);
});

it("treats an unknown model as free off hosted, and refuses it on hosted", async () => {
  const unknown = { usage, response: { modelId: "claude-future-9" } };
  await expect(requireClaudeCostUsd(unknown)).resolves.toBe(0);
  vi.mocked(isHostedServerAuthMode).mockResolvedValue(true);
  await expect(requireClaudeCostUsd(unknown)).rejects.toThrow();
});
