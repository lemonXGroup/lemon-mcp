import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { lemonApi } from "./apiClient";

export function registerResources(server: McpServer) {

  // 1. Hardware Status Env Resource
  server.registerResource("hardware_status",
    "lemonmcp://env/hardware_status",
    { description: "Snapshot of real-time device health, CPU, memory, and CA certificate installation status." },
    async (uri: URL) => {
      try {
        const env = await lemonApi.get<any>('/api/env');
        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify(env, null, 2),
            },
          ],
        };
      } catch (err: any) {
        return {
          contents: [
            {
              uri: uri.href,
              text: `[Error fetching environment status]: ${err.message}`,
            },
          ],
        };
      }
    }
  );

  // 2. Database Schema Resource
  server.registerResource("database_schema",
    "lemonmcp://database/schema",
    { description: "Lemon's native app.sqlite table definitions (to aid LLM in generating raw SQLs)." },
    async (uri: URL) => {
      try {
        const tables = await lemonApi.get<string[]>('/api/database/tables');

        let schemas = "";
        for (const tableName of tables) {
          const detail = await lemonApi.get<any>(`/api/database/table/${tableName}`);
          schemas += `\n-- Table: ${tableName} --\n`;
          schemas += JSON.stringify(detail, null, 2) + "\n";
        }

        return {
          contents: [
            {
              uri: uri.href,
              text: schemas,
            },
          ],
        };
      } catch (err: any) {
        return {
          contents: [
            {
              uri: uri.href,
              text: `[Error fetching database schema]: ${err.message}`,
            },
          ],
        };
      }
    }
  );
}
