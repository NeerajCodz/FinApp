import React from 'react';
import { UsersRound } from 'lucide-react';
import { Button, SectionHeader, Text, Typography, useTheme } from '@finapp/ui/web';
import { SettingsRow } from '@finapp/ui/finance';

export type DashboardGroup = { id: string; name: string; currency: string };

export function GroupsSection({
  groups,
  loading,
  currency,
  onSeeAll,
  onOpen,
  onCreate,
}: {
  groups: readonly DashboardGroup[];
  loading: boolean;
  currency: string;
  onSeeAll: () => void;
  onOpen: (id: string) => void;
  onCreate: () => void;
}) {
  const { tokens } = useTheme();
  return (
    <section style={{ display: 'grid', gap: 14 }}>
      <SectionHeader
        title="Groups"
        action={
          <Button variant="ghost" size="sm" onPress={onSeeAll}>
            See all
          </Button>
        }
      />
      {loading ? (
        <Typography variant="small">Loading groups…</Typography>
      ) : groups.length > 0 ? (
        groups.slice(0, 2).map((group) => (
          <SettingsRow
            key={group.id}
            label={group.name}
            value={group.currency || currency}
            onPress={() => onOpen(group.id)}
          />
        ))
      ) : (
        <div
          style={{
            display: 'grid',
            justifyItems: 'center',
            justifyContent: 'center',
            paddingBlock: 16,
            gap: 8,
          }}
        >
          <UsersRound size={22} color={tokens.foregroundMuted} strokeWidth={1.8} />
          <Text style={{ color: tokens.foregroundMuted, textAlign: 'center' }}>
            Create a group to split money with people you know.
          </Text>
          <Button size="sm" variant="outline" onPress={onCreate}>
            Create group
          </Button>
        </div>
      )}
    </section>
  );
}
