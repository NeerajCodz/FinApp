import { toolCatalog } from '@finapp/mcp/server';
import { McpConnectionsClient } from './McpConnectionsClient';

/** MCP connections and access control; the tool list comes from the server's registry. */
export default function McpConnectionsPage() {
  const tools = toolCatalog().map(({ name, title, domain, readOnly, destructive }) => ({
    name,
    title,
    domain,
    readOnly,
    destructive,
  }));
  return <McpConnectionsClient tools={tools} />;
}
