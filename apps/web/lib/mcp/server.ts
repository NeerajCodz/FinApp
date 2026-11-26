import { api } from '@convex/_generated/api';
import type { ConvexHttpClient } from 'convex/browser';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { errorText, toToolError, type McpToolError } from './errors';
import { formatMinor } from './money';
import {
  READ_SCOPE,
  ToolInputError,
  domainOf,
  presentResult,
  type AnyToolSpec,
  type McpScope,
  type ToolDomain,
  type WidgetId,
} from './toolkit';
import { financeTools } from './tools/finance';
import { groupTools } from './tools/groups';
import { personalTools } from './tools/personal';
import { socialTools } from './tools/social';
import { registerWidgets, widgetToolMeta, widgets } from './widgets';

export const MCP_SERVER_VERSION = '2.0.0';

const domainDescriptions: Record<ToolDomain, string> = {
  finance:
    'Transactions (search, detail, line items), accounts, categories and their monthly limits (budgets), goals, recurring rules, Trash, overview and analytics.',
  groups:
    'Shared groups: settings, members and roles, ownership, invitations, expenses (create/edit/delete/history), balances, settle-up, settlements, reminders and chat (read, send, react, pin, mark read).',
  social:
    'Friends (list, add, remove), friend requests, people search, profiles and activity, the people inbox with unread counts, and direct messages (read, send, react, pin, mark read).',
  personal:
    'Profile, avatars, defaults, notifications (list, unread count, mark read, preferences), privacy, security status, signed-in devices and FinAI settings.',
};

const filterHints: Record<ToolDomain, string[]> = {
  finance: [
    'startAt',
    'endAt',
    'accountId',
    'categoryId',
    'type',
    'search',
    'minAmountMinor',
    'maxAmountMinor',
    'limit',
    'cursor',
  ],
  groups: ['groupId', 'startAt', 'endAt', 'limit', 'cursor'],
  social: ['direction', 'conversationId', 'startAt', 'endAt', 'limit', 'cursor'],
  personal: ['startAt', 'endAt', 'limit', 'cursor'],
};

function allTools(client: ConvexHttpClient): AnyToolSpec[] {
  return [
    ...financeTools(client),
    ...groupTools(client),
    ...socialTools(client),
    ...personalTools(client),
  ];
}

export type ToolCatalogEntry = {
  name: string;
  title: string;
  description: string;
  domain: ToolDomain;
  scope: McpScope;
  readOnly: boolean;
  destructive: boolean;
  widget?: { id: WidgetId; uri: string; title: string };
};

/** Static description of every tool (no backend access), used by catalog tools and the dashboard. */
export function toolCatalog(): ToolCatalogEntry[] {
  return allTools(null as unknown as ConvexHttpClient).map((tool) => ({
    name: tool.name,
    title: tool.title,
    description: tool.description,
    domain: domainOf(tool.name),
    scope: tool.scope,
    readOnly: tool.scope === READ_SCOPE,
    destructive: Boolean(tool.destructive),
    ...(tool.widget
      ? {
          widget: {
            id: tool.widget,
            uri: widgets[tool.widget].uri,
            title: widgets[tool.widget].title,
          },
        }
      : {}),
  }));
}

function catalogDocument(entries: ToolCatalogEntry[]) {
  const domains = (Object.keys(domainDescriptions) as ToolDomain[]).map((domain) => ({
    domain,
    parent: `finapp.${domain}.parent`,
    description: domainDescriptions[domain],
    children: entries.filter((entry) => entry.domain === domain).map((entry) => entry.name),
    filters: filterHints[domain],
  }));
  return {
    domains,
    tools: entries.map((entry) => ({
      name: entry.name,
      title: entry.title,
      scope: entry.scope,
      readOnly: entry.readOnly,
      widget: entry.widget?.uri,
    })),
    widgets: Object.values(widgets).map((widget) => ({
      uri: widget.uri,
      title: widget.title,
      description: widget.description,
    })),
    pagination: {
      defaultLimit: 25,
      maximumLimit: 100,
      cursor: 'Pass nextCursor from a previous result; isDone=true means no more pages.',
    },
    money:
      'Amounts are integer strings in minor units (e.g. amountMinor "12550" = 125.50) with a matching *Formatted display string. Send amounts back as minor-unit strings.',
    timestamps:
      'Unix epoch milliseconds; startAt inclusive, endAt exclusive; time-windowed reads cover at most 366 days.',
    scopes: {
      read: READ_SCOPE,
      write: [
        'finapp:write:finance',
        'finapp:write:groups',
        'finapp:write:social',
        'finapp:write:personal',
      ],
    },
  };
}

function textFor(data: unknown, summary?: string) {
  const json = JSON.stringify(data);
  return summary ? `${summary}\n\n${json}` : json;
}

export type McpAccessSettings = {
  enabled: boolean;
  readOnly: boolean;
  allowDestructive: boolean;
  blockedTools: readonly string[];
};

const OPEN_ACCESS: McpAccessSettings = {
  enabled: true,
  readOnly: false,
  allowDestructive: true,
  blockedTools: [],
};

/** Why the user's access-control settings hide a tool, or null when it's available. */
export function blockedReason(
  tool: { name: string; scope: string; destructive?: boolean },
  settings: McpAccessSettings,
): string | null {
  if (!settings.enabled) return 'MCP access is turned off in Finapp settings.';
  if (settings.blockedTools.includes(tool.name)) return 'This tool is blocked in Finapp settings.';
  if (settings.readOnly && tool.scope !== READ_SCOPE)
    return 'Finapp is in read-only mode for AI apps.';
  if (!settings.allowDestructive && tool.destructive)
    return 'Deletes are turned off for AI apps in Finapp settings.';
  return null;
}

export function createMcpServer(
  client: ConvexHttpClient,
  scopes: readonly string[],
  grantId: string,
  access: McpAccessSettings = OPEN_ACCESS,
) {
  const server = new McpServer(
    { name: 'finapp', version: MCP_SERVER_VERSION, title: 'FinApp' },
    {
      instructions: [
        'FinApp is a personal finance and bill-splitting app. Call finapp.catalog (or a finapp.<domain>.parent tool) to discover tools.',
        'Good starting points: finapp.finance.overview, finapp.finance.transactions.list, finapp.groups.list then finapp.groups.balances.',
        'Money is always integer minor units as strings (amountMinor) plus a *Formatted display string; never send floats.',
        'Fetch one bounded page at a time with explicit windows; use nextCursor to continue.',
        'Writes need the matching granted scope. Confirm with the user before any write. Destructive tools (archiving goals, categories or accounts; removing friends or group members; leaving a group or transferring its ownership; purging or emptying Trash) require confirm: true; deleted finance records go to the Trash and can be restored.',
      ].join(' '),
    },
  );
  // Discovery only describes tools this connection can actually see.
  const catalog = toolCatalog().filter((entry) => !blockedReason(entry, access));
  const recordActivity = async (toolName: string, succeeded: boolean) => {
    try {
      await client.mutation(api.mcpOAuth.recordToolInvocation, {
        grantId: grantId as never,
        toolName,
        succeeded,
      });
    } catch {
      // Activity failures must not change the tool result.
    }
  };
  const failure = (error: McpToolError) => {
    const data = presentResult(error.data) as Record<string, unknown> | undefined;
    const amount =
      error.code === 'OUTSTANDING_BALANCE' &&
      typeof error.data?.balanceMinor === 'string' &&
      typeof error.data.currency === 'string'
        ? ` Outstanding balance: ${formatMinor(error.data.balanceMinor, error.data.currency)}.`
        : '';
    const presented = { ...error, message: `${error.message}${amount}`, ...(data ? { data } : {}) };
    return {
      isError: true,
      content: [{ type: 'text' as const, text: errorText(presented) }],
      structuredContent: { error: presented },
    };
  };

  server.registerTool(
    'finapp.catalog',
    {
      title: 'Discover FinApp tools',
      description:
        'Start here. Lists every FinApp domain and tool, the in-chat widgets, money/time conventions and pagination rules. Reads no personal data.',
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const data = catalogDocument(catalog);
      await recordActivity('finapp.catalog', true);
      return {
        structuredContent: { data },
        content: [{ type: 'text', text: JSON.stringify(data) }],
      };
    },
  );

  server.registerResource(
    'FinApp capability catalog',
    'finapp://catalog',
    {
      mimeType: 'application/json',
      description: 'Every FinApp domain, tool, widget, and the money/time/pagination contract.',
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(catalogDocument(catalog)),
        },
      ],
    }),
  );

  for (const domain of Object.keys(domainDescriptions) as ToolDomain[]) {
    if (!catalog.some((entry) => entry.domain === domain)) continue;
    const name = `finapp.${domain}.parent`;
    server.registerTool(
      name,
      {
        title: `Discover ${domain} tools`,
        description: `Parent discovery for ${domain}: ${domainDescriptions[domain]} Returns child tool names and filters without reading personal records.`,
        inputSchema: {},
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async () => {
        if (!scopes.includes(READ_SCOPE)) {
          await recordActivity(name, false);
          return failure({
            code: 'MISSING_SCOPE',
            message: `Missing required scope: ${READ_SCOPE}.`,
          });
        }
        const entries = catalog.filter((entry) => entry.domain === domain);
        const data = {
          domain,
          description: domainDescriptions[domain],
          children: entries.map((entry) => entry.name),
          tools: entries.map((entry) => ({
            name: entry.name,
            title: entry.title,
            scope: entry.scope,
            widget: entry.widget?.uri,
          })),
          filters: filterHints[domain],
          pagination: { defaultLimit: 25, maximumLimit: 100 },
          timestamps:
            'Unix epoch milliseconds; startAt inclusive and endAt exclusive; max range 366 days.',
        };
        await recordActivity(name, true);
        return {
          structuredContent: { data },
          content: [{ type: 'text', text: JSON.stringify(data) }],
        };
      },
    );
  }

  for (const tool of allTools(client)) {
    // Tools the user turned off aren't offered at all.
    if (blockedReason(tool, access)) continue;
    const readOnly = tool.scope === READ_SCOPE;
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.input,
        annotations: {
          title: tool.title,
          readOnlyHint: readOnly,
          destructiveHint: Boolean(tool.destructive),
          idempotentHint: readOnly || Boolean(tool.idempotent),
          openWorldHint: false,
        },
        ...(tool.widget ? { _meta: widgetToolMeta(tool.widget) } : {}),
      },
      async (args: Record<string, unknown>) => {
        if (!scopes.includes(READ_SCOPE) || !scopes.includes(tool.scope)) {
          await recordActivity(tool.name, false);
          const missing = scopes.includes(READ_SCOPE) ? tool.scope : READ_SCOPE;
          return failure({
            code: 'MISSING_SCOPE',
            message: `Missing required scope: ${missing}. Reconnect FinApp and grant it to use this tool.`,
          });
        }
        try {
          const raw = await tool.run(args as never);
          const data = presentResult(raw ?? null);
          await recordActivity(tool.name, true);
          return {
            structuredContent: { data },
            content: [{ type: 'text', text: textFor(data, tool.summarize?.(raw)) }],
          };
        } catch (error) {
          await recordActivity(tool.name, false);
          return failure(
            error instanceof ToolInputError
              ? toToolError(new Error(`Uncaught Error: ${error.code}`))
              : toToolError(error),
          );
        }
      },
    );
  }

  registerWidgets(server);
  return server;
}
