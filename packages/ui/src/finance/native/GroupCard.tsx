import React from 'react';
import { TouchableOpacity, View, type PressableProps } from 'react-native';
import { Button, Typography, useTheme } from '@finapp/ui/native';
import { GroupAvatar, GroupPanel, GroupTile } from './GroupPrimitives';

export function GroupCard({ name, meta, balance, meaning, icon, color, description, members, role, onPress, onOpenChat }: {
  name: string;
  meta: string;
  balance: string;
  meaning: string;
  icon?: string;
  color?: string;
  description?: string;
  members?: readonly { name: string; avatarId?: string; avatarUrl?: string }[];
  role?: string;
  onPress?: PressableProps['onPress'];
  onOpenChat?: PressableProps['onPress'];
}) {
  const { tokens } = useTheme();
  const balanceColor = /you owe|owes group/i.test(meaning) ? tokens.expense : /owed/i.test(meaning) ? tokens.income : tokens.foreground;
  return <GroupPanel>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${name}, ${meaning} ${balance}`} onPress={onPress ?? undefined} activeOpacity={0.78} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <GroupTile icon={icon} color={color} size={64} />
      <View style={{ flex: 1, gap: 4 }}><Typography variant="heading">{name}</Typography>{description && <Typography variant="caption">{description}</Typography>}<Typography variant="caption">{meta}</Typography></View>
    </TouchableOpacity>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {!!members?.length && <View style={{ flexDirection: 'row' }}>{members.slice(0, 4).map((member, index) => <View key={`${member.name}-${index}`} style={{ marginLeft: index ? -7 : 0 }}><GroupAvatar {...member} size={28} /></View>)}{members.length > 4 && <Typography variant="caption" style={{ alignSelf: 'center', marginLeft: 6 }}>+{members.length - 4}</Typography>}</View>}
      {role && <Typography variant="caption" style={{ color: tokens.primary }}>{role === 'admin' || role === 'owner' ? `You are an ${role}` : 'Group member'}</Typography>}
    </View>
    <View style={{ borderTopWidth: 1, borderColor: tokens.borderSubtle, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
      <View style={{ flex: 1, gap: 3 }}><Typography variant="caption" style={{ color: balanceColor }}>{meaning}</Typography><Typography variant="heading" style={{ color: balanceColor, fontVariant: ['tabular-nums'] }}>{balance}</Typography></View>
      <View style={{ gap: 8 }}>{onPress && <Button size="sm" variant="outline" onPress={onPress}>View group</Button>}{onOpenChat && <Button size="sm" variant="outline" onPress={onOpenChat}>Open chat</Button>}</View>
    </View>
  </GroupPanel>;
}
