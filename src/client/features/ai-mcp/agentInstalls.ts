import { ClaudeIcon } from "./AgentIcons";

// newChatUrl opens a new chat with the prompt filled in. The link is not
// documented by the chat app.
export const ONE_CLICK_INSTALLS = [
  {
    agent: "claude",
    name: "Claude",
    href: "https://claude.com/marketplace/connectors/openseo",
    newChatUrl: (prompt: string) =>
      `https://claude.ai/new?q=${encodeURIComponent(prompt)}`,
    Icon: ClaudeIcon,
  },
];
