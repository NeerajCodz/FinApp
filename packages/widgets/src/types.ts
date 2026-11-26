import type { Kit } from './kit';

export type WidgetDomain =
  | 'core'
  | 'balances'
  | 'accounts'
  | 'transactions'
  | 'spending'
  | 'income'
  | 'cashflow'
  | 'categories'
  | 'goals'
  | 'recurring'
  | 'groups'
  | 'people'
  | 'chats'
  | 'notifications'
  | 'trash'
  | 'insights'
  | 'finai'
  | 'settings'
  | 'security';

export type WidgetUri = `ui://finapp/${string}`;

/** Render a tool result to an HTML fragment. Must reference only `data` and `k` (it is serialized). */
export type WidgetRender<D> = (data: D, k: Kit) => string;

export type WidgetDefinition<D = any> = {
  /** `<domain>.<name>` (the five original widgets keep their short ids). */
  id: string;
  domain: WidgetDomain;
  /** Template version: bump on breaking changes so hosts that cache by URI refetch. */
  version: number;
  uri: WidgetUri;
  title: string;
  description: string;
  /** Host status text while the linked tool runs / once it finished. */
  invoking: string;
  invoked: string;
  /** Realistic sample results (the first one feeds the gallery and dashboard previews). */
  examples: D[];
  /** The data for the empty state (also used when a tool returns null). */
  empty: D;
  render: WidgetRender<D>;
  /** Other widget ids whose renders ship with this one (for in-place actions such as settle-up). */
  views?: string[];
};

export type WidgetInput<D> = Omit<
  WidgetDefinition<D>,
  'id' | 'uri' | 'version' | 'invoking' | 'invoked'
> & {
  name: string;
  version?: number;
  /** Override for widgets whose URI predates the naming scheme. */
  id?: string;
  uri?: WidgetUri;
  invoking?: string;
  invoked?: string;
};

export function defineWidget<D>(input: WidgetInput<D>): WidgetDefinition<D> {
  const version = input.version ?? 1;
  const id = input.id ?? `${input.domain}.${input.name}`;
  const { name: _name, ...rest } = input;
  return {
    ...rest,
    id,
    version,
    uri: input.uri ?? `ui://finapp/${id}.v${version}.html`,
    invoking: input.invoking ?? `Loading ${input.title.toLowerCase()}…`,
    invoked: input.invoked ?? `${input.title} ready`,
  };
}

/** Money as integer minor units (string from the server, number in samples). */
export type Minor = string | number;
