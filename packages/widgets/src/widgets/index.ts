import type { WidgetDefinition } from '../types';
import { accountWidgets } from './accounts';
import { balanceWidgets } from './balances';
import { cashflowWidgets } from './cashflow';
import { categoryWidgets } from './categories';
import { coreWidgets } from './core';
import { goalWidgets } from './goals';
import { groupWidgets } from './groups';
import { incomeWidgets } from './income';
import { recurringWidgets } from './recurring';
import { spendingWidgets } from './spending';
import { transactionWidgets } from './transactions';

/** Every widget in catalog order. Add new domain modules here. */
export const allWidgets: WidgetDefinition[] = [
  ...coreWidgets,
  ...balanceWidgets,
  ...accountWidgets,
  ...transactionWidgets,
  ...spendingWidgets,
  ...incomeWidgets,
  ...cashflowWidgets,
  ...categoryWidgets,
  ...goalWidgets,
  ...recurringWidgets,
  ...groupWidgets,
];
