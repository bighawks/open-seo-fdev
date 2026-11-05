import type { McpServer } from "@modelcontextprotocol/server";
import { MCP_WIDGET_URI } from "@/shared/mcp-contracts";

export function registerWidgetResource(server: McpServer) {
  const meta = {
    ui: {
      prefersBorder: true,
      csp: { connectDomains: [], resourceDomains: [] },
    },
  };
  server.registerResource(
    "OpenSEO research",
    MCP_WIDGET_URI,
    { mimeType: "text/html;profile=mcp-app", _meta: meta },
    async () => {
      const { default: html } = await import("virtual:openseo-mcp-widget");
      return {
        contents: [
          {
            uri: MCP_WIDGET_URI,
            mimeType: "text/html;profile=mcp-app",
            text: html,
            _meta: meta,
          },
        ],
      };
    },
  );
}
