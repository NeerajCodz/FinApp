import { getWidget, widgetForTool } from '@finapp/widgets';
import { presentMoney } from './money';
import { widgetHtml } from './widgets';

/**
 * Dashboard previews: one per widget linked to a tool, fed with the widget's own fictional
 * example (no user data). The full catalog of widgets is in the package gallery.
 */
export function widgetPreviews() {
  const seen = new Set<string>();
  const previews = [];
  for (const [toolName, id] of Object.entries(widgetForTool)) {
    const widget = getWidget(id);
    if (!widget || seen.has(id)) continue;
    seen.add(id);
    previews.push({
      id,
      title: widget.title,
      description: widget.description,
      toolName,
      html: widgetHtml(id),
      sample: presentMoney(widget.examples[0] ?? widget.empty),
    });
  }
  return previews;
}
