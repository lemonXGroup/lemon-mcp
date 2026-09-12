import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { DiscoveryService } from "./discovery";
import { lemonApi } from "./apiClient";
import { registerTools } from "./tools";
import { registerResources } from "./resources";

async function main() {
  console.error("Starting LemonMCP Server...");
  let discovery: DiscoveryService | undefined;

  // Create the unified MCP Server before touching the iOS device. Discovery's
  // fallback status probe also emits an activity ping, so it must not run
  // before the MCP stdio handshake has completed.
  const server = new McpServer({
    name: "LemonMCP",
    version: "1.0.0"
  });

  // A closed stdio transport is the authoritative MCP disconnect signal. The
  // DELETE is best-effort; iOS still expires the heartbeat if the process is
  // terminated without a chance to send it.
  server.server.onclose = () => {
    discovery?.stop();
    if (discovery) {
      void lemonApi.disconnect().catch(() => {});
    }
  };

  // `connect()` only starts the stdio listener. Wait for the protocol's
  // `initialized` notification before probing the device or emitting any
  // heartbeat, otherwise a spawned-but-unattached MCP process looks connected.
  server.server.oninitialized = () => {
    if (discovery) return;
    discovery = new DiscoveryService();
    discovery.startDiscovery();
    console.error("LemonMCP MCP session initialized. Listening for JSON-RPC...");
  };

  // Mount tools and resources
  registerTools(server);
  registerResources(server);

  // Start the stdio transport first. Only a successfully connected MCP
  // client may cause the iOS connection indicator to become active.
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("LemonMCP stdio transport ready; waiting for MCP initialization...");
}

// Global process exception catches so STDIO stream does not corrupt
process.on('unhandledRejection', (reason: any) => {
  console.error('[LemonMCP] Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err: any) => {
  console.error('[LemonMCP] Uncaught Exception:', err);
});

main().catch(err => {
  console.error("Fatal Error initializing MCP Server: ", err);
  process.exit(1);
});
