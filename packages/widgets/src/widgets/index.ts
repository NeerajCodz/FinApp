import type { WidgetDefinition } from '../types';
import { coreWidgets } from './core';
import { groupWidgets } from './groups';

/** Every widget in catalog order. Add new domain modules here. */
export const allWidgets: WidgetDefinition[] = [...coreWidgets, ...groupWidgets];
