import React from 'react';
import { Bell, CalendarDays, Search, ShieldCheck } from 'lucide-react';
import type { HomeAccountOption } from '../types';
import { CustomSelect } from '@finapp/ui/web';

export function HomeHeader({
  accounts,
  selectedAccountId,
  search,
  dateLabel,
  onSearchChange,
  onAccountChange,
  onChooseDate,
  onOpenSync,
  onOpenNotifications,
  notificationCount = 0,
}: {
  accounts: readonly HomeAccountOption[];
  selectedAccountId: string;
  search: string;
  dateLabel: string;
  onSearchChange: (value: string) => void;
  onAccountChange: (id: string) => void;
  onChooseDate: () => void;
  onOpenSync: () => void;
  onOpenNotifications?: () => void;
  notificationCount?: number;
}) {
  return (
    <header className="finance-home-toolbar">
      <div className="finance-home-status-actions">
        {onOpenNotifications && (
          <button
            className="finance-home-sync"
            type="button"
            aria-label={
              notificationCount > 0 ? `Notifications, ${notificationCount} unread` : 'Notifications'
            }
            onClick={onOpenNotifications}
          >
            <Bell size={18} aria-hidden="true" />
          </button>
        )}
        <button
          className="finance-home-sync"
          type="button"
          aria-label="Open sync status"
          onClick={onOpenSync}
        >
          <ShieldCheck size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="finance-home-title">
        <span className="finance-eyebrow">PERSONAL FINANCE</span>
        <h1>Home</h1>
        <p>Your money, clearly in view.</p>
      </div>
      <div className="finance-home-controls">
        <button className="finance-home-filter" type="button" onClick={onChooseDate}>
          <CalendarDays size={16} aria-hidden="true" />
          <span>{dateLabel}</span>
        </button>
        <CustomSelect
          className="finance-home-account-filter"
          aria-label="Filter by account"
          value={selectedAccountId}
          onChange={(event) => onAccountChange(event.currentTarget.value)}
        >
          <option value="">All accounts</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </CustomSelect>
        <label className="finance-home-search">
          <Search size={16} aria-hidden="true" />
          <span className="finance-sr-only">Search transactions</span>
          <input
            aria-label="Search transactions"
            placeholder="Search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>
      </div>
    </header>
  );
}
