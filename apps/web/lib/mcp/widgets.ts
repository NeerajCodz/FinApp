import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  WIDGET_MIME_TYPE,
  getWidget,
  listWidgets,
  widgetHtml,
  widgetIdForTool,
  widgetResourceMeta,
  widgetToolMeta,
  type WidgetDefinition,
  type WidgetId,
} from '@finapp/widgets';

export { WIDGET_MIME_TYPE, listWidgets, widgetHtml, widgetToolMeta };

/** The widget for a tool: the package's tool→widget map first, then the tool's own `widget`. */
export function resolveToolWidget(tool: {
  name: string;
  widget?: WidgetId;
}): WidgetDefinition | undefined {
  const id = widgetIdForTool(tool.name) ?? tool.widget;
  return id ? getWidget(id) : undefined;
}

/** Registers every widget from `@finapp/widgets` as an MCP Apps UI resource. */
export function registerWidgets(server: McpServer) {
  for (const widget of listWidgets()) {
    const meta = widgetResourceMeta(widget);
    server.registerResource(
      `finapp-widget-${widget.id}`,
      widget.uri,
      {
        title: widget.title,
        description: widget.description,
        mimeType: WIDGET_MIME_TYPE,
        _meta: meta,
      },
      async (uri) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: WIDGET_MIME_TYPE,
            text: widgetHtml(widget.id),
            _meta: meta,
          },
        ],
      }),
    );
  }
}
