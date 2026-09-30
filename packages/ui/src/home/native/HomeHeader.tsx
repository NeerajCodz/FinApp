import React, { useState } from 'react';
import { View } from 'react-native';
import {
  Bell,
  CalendarDays,
  ClockCounterClockwise,
  MagnifyingGlass,
} from '@finapp/ui/icons/native';
import { Button, IconButton, Input, Sheet, Text, Typography, useTheme } from '@finapp/ui/native';
import type { HomeAccountOption } from '../types';

export function HomeHeader({
  accounts,
  selectedAccountId,
  search,
  dateLabel,
  onSearchChange,
  onAccountChange,
  onChooseDate,
  onOpenSync,
  syncLabel,
  syncIcon,
  notificationCount = 0,
  onOpenNotifications,
}: {
  accounts: readonly HomeAccountOption[];
  selectedAccountId: string;
  search: string;
  dateLabel: string;
  onSearchChange: (value: string) => void;
  onAccountChange: (id: string) => void;
  onChooseDate: () => void;
  onOpenSync: () => void;
  syncLabel?: string;
  syncIcon?: React.ReactNode;
  notificationCount?: number;
  onOpenNotifications?: () => void;
}) {
  const { tokens } = useTheme();
  const [accountOpen, setAccountOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const selectedAccount = accounts.find((account) => account.id === selectedAccountId);
  return (
    <View style={{ gap: 13 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <View style={{ gap: 4, flex: 1 }}>
          <Typography variant="title" style={{ fontSize: 28, lineHeight: 32 }}>
            Home
          </Typography>
          <Typography variant="small">Your money, clearly in view.</Typography>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <IconButton label={syncLabel ?? 'Open sync status'} variant="ghost" onPress={onOpenSync}>
            {syncIcon ?? <ClockCounterClockwise size={19} color={tokens.foregroundMuted} />}
          </IconButton>
          {onOpenNotifications && (
            <IconButton
              label={
                notificationCount > 0
                  ? `Notifications, ${notificationCount} unread`
                  : 'Notifications'
              }
              variant="outline"
              onPress={onOpenNotifications}
              style={{ borderRadius: 22 }}
            >
              <Bell
                size={18}
                color={notificationCount > 0 ? tokens.primary : tokens.foregroundMuted}
              />
            </IconButton>
          )}
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 7, alignItems: 'center' }}>
        <Button
          variant="outline"
          size="sm"
          onPress={onChooseDate}
          style={{ flex: 1, justifyContent: 'flex-start', paddingHorizontal: 10 }}
        >
          <CalendarDays size={15} color={tokens.foregroundMuted} /> {dateLabel}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onPress={() => setAccountOpen(true)}
          style={{ flex: 1, justifyContent: 'flex-start', paddingHorizontal: 10 }}
        >
          {selectedAccount?.name ?? 'All accounts'}
        </Button>
        <IconButton
          label={searchOpen ? 'Hide transaction search' : 'Search transactions'}
          variant="outline"
          onPress={() => setSearchOpen((open) => !open)}
        >
          <MagnifyingGlass size={17} color={tokens.foreground} />
        </IconButton>
      </View>
      {searchOpen && (
        <Input
          accessibilityLabel="Search transactions"
          placeholder="Search transactions"
          value={search}
          onChangeText={onSearchChange}
          autoFocus
        />
      )}
      <Sheet visible={accountOpen} onClose={() => setAccountOpen(false)} title="Choose account">
        <View style={{ gap: 6 }}>
          <Button
            variant={selectedAccountId ? 'ghost' : 'primary'}
            onPress={() => {
              onAccountChange('');
              setAccountOpen(false);
            }}
            style={{ justifyContent: 'flex-start' }}
          >
            All accounts
          </Button>
          {accounts.map((account) => (
            <Button
              key={account.id}
              variant={account.id === selectedAccountId ? 'primary' : 'ghost'}
              onPress={() => {
                onAccountChange(account.id);
                setAccountOpen(false);
              }}
              style={{ justifyContent: 'flex-start' }}
            >
              {account.name} · {account.currency}
            </Button>
          ))}
          {!accounts.length && (
            <Text style={{ color: tokens.foregroundMuted }}>No active accounts.</Text>
          )}
        </View>
      </Sheet>
    </View>
  );
}
