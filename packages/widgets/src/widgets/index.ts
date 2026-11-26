import type { WidgetDefinition } from '../types';
import { accountWidgets } from './accounts';
import { balanceWidgets } from './balances';
import { coreWidgets } from './core';
import { groupWidgets } from './groups';
import { transactionWidgets } from './transactions';

/** Every widget in catalog order. Add new domain modules here. */
export const allWidgets: WidgetDefinition[] = [
  ...coreWidgets,
  ...balanceWidgets,
  ...accountWidgets,
  ...transactionWidgets,
  ...groupWidgets,
];
