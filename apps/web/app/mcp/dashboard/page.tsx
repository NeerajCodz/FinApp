import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { widgetPreviews } from '@/lib/mcp/previews';
import { toolCatalog } from '@/lib/mcp/server';
import { McpDashboardClient } from './client';

export const metadata: Metadata = {
  title: 'FinApp for ChatGPT & Claude',
  description:
    'Connect FinApp to ChatGPT, Claude or any MCP client: tools, in-chat widgets, permissions and activity.',
};

export default async function McpDashboardPage() {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get('x-forwarded-host')?.split(',')[0]?.trim() ??
    requestHeaders.get('host') ??
    'localhost:3000';
  const protocol =
    requestHeaders.get('x-forwarded-proto')?.split(',')[0]?.trim() ??
    (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https');
  const issuer = process.env.MCP_ISSUER_URL?.trim() || `${protocol}://${host}`;
  const endpoint = process.env.MCP_RESOURCE_URL?.trim() || new URL('/mcp', issuer).toString();

  return (
    <McpDashboardClient
      endpoint={endpoint}
      catalog={toolCatalog()}
      widgetPreviews={widgetPreviews()}
    />
  );
}
