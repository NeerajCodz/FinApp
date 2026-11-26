import React from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  ArrowUpRight,
  Bug,
  Check,
  CircleCheck,
  CloudOff,
  Code2,
  Heart,
  RefreshCw,
  ScrollText,
  Share2,
  Shield,
  Sparkles,
  Tag,
} from 'lucide-react-native';
import { ArrowLeft } from '@finapp/ui/icons/native';
import { Text, useTheme } from '@finapp/ui/native';
import { withAlpha } from '../../tokens';
import { SettingsIconButton } from './SettingsKit';
import {
  DEVELOPER_URL,
  ISSUES_URL,
  OPEN_SOURCE_CREDITS,
  RELEASES_URL,
  SOURCE_URL,
  releaseUrl,
  type ReleaseNotes,
  type UpdateState,
  type VersionRow,
} from '../../version/model';

export type AboutScreenProps = {
  logo: React.ReactNode;
  productVersion: string;
  channel: string;
  rows: readonly VersionRow[];
  notes?: ReleaseNotes;
  update: UpdateState;
  /** Opens the store or release page for a newer version. */
  onUpdate?: () => void;
  onBack?: () => void;
  onOpenPrivacy?: () => void;
  /** Shares or copies the diagnostics text. */
  onShareDiagnostics: () => void;
  topInset?: number;
  bottomInset?: number;
};

function open(url: string) {
  void Linking.openURL(url).catch(() => undefined);
}

function Card({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        gap: 14,
        padding: 18,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: tokens.borderSubtle,
        backgroundColor: tokens.card,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {icon}
        <Text
          accessibilityRole="header"
          style={{
            flex: 1,
            color: tokens.foreground,
            fontSize: 17,
            fontFamily: 'SpaceGrotesk_600SemiBold',
          }}
        >
          {title}
        </Text>
        {action}
      </View>
      {children}
    </View>
  );
}

function LinkRow({
  icon,
  title,
  description,
  onPress,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onPress: () => void;
}) {
  const { tokens } = useTheme();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${title}. ${description}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 10,
        borderRadius: 14,
        backgroundColor: pressed ? tokens.surfaceSubtle : 'transparent',
      })}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: tokens.surfaceSubtle,
        }}
      >
        {icon}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{ color: tokens.foreground, fontSize: 14.5, fontFamily: 'Manrope_600SemiBold' }}
        >
          {title}
        </Text>
        <Text style={{ color: tokens.foregroundMuted, fontSize: 12.5 }}>{description}</Text>
      </View>
      <ArrowUpRight size={16} color={tokens.foregroundSubtle} />
    </Pressable>
  );
}

function UpdateStatus({ update, onUpdate }: { update: UpdateState; onUpdate?: () => void }) {
  const { tokens } = useTheme();
  const line = (icon: React.ReactNode, text: string, color: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {icon}
      <Text style={{ color, fontSize: 13, fontFamily: 'Manrope_600SemiBold' }}>{text}</Text>
    </View>
  );
  if (update.kind === 'checking')
    return line(
      <ActivityIndicator size="small" color={tokens.foregroundMuted} />,
      'Checking for updates…',
      tokens.foregroundMuted,
    );
  if (update.kind === 'offline')
    return line(
      <CloudOff size={14} color={tokens.foregroundMuted} />,
      'Offline — can’t check for updates',
      tokens.foregroundMuted,
    );
  if (update.kind === 'current')
    return line(
      <CircleCheck size={14} color={tokens.positive} />,
      'You’re on the latest version',
      tokens.positive,
    );
  const color = update.kind === 'required' ? tokens.warning : tokens.primary;
  return (
    <View style={{ alignItems: 'center', gap: 10 }}>
      {line(
        <Sparkles size={14} color={color} />,
        update.kind === 'required'
          ? `Update required — ${update.latest} is live`
          : `Finapp ${update.latest} is available`,
        color,
      )}
      {onUpdate ? (
        <Pressable
          accessibilityRole="button"
          onPress={onUpdate}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 16,
            minHeight: 40,
            borderRadius: 12,
            backgroundColor: tokens.primary,
          }}
        >
          <RefreshCw size={14} color={tokens.primaryForeground} />
          <Text style={{ color: tokens.primaryForeground, fontFamily: 'Manrope_700Bold' }}>
            Get the update
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function AboutScreen({
  logo,
  productVersion,
  channel,
  rows,
  notes,
  update,
  onUpdate,
  onBack,
  onOpenPrivacy,
  onShareDiagnostics,
  topInset = 0,
  bottomInset = 0,
}: AboutScreenProps) {
  const { tokens } = useTheme();
  const { width } = useWindowDimensions();
  const twoColumn = width >= 820;
  const pill = (text: string, strong?: boolean) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 11,
        paddingVertical: 5,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: strong ? tokens.primary : tokens.borderSubtle,
        backgroundColor: strong ? tokens.primary : tokens.surfaceSubtle,
      }}
    >
      {strong ? <Tag size={12} color={tokens.primaryForeground} /> : null}
      <Text
        style={{
          color: strong ? tokens.primaryForeground : tokens.foregroundMuted,
          fontSize: 12.5,
          fontFamily: 'Manrope_700Bold',
          textTransform: strong ? 'none' : 'capitalize',
        }}
      >
        {text}
      </Text>
    </View>
  );

  const cards = [
    notes ? (
      <Card
        key="new"
        title={`What’s new in ${notes.version}`}
        icon={<Sparkles size={16} color={tokens.primary} />}
        action={
          <Pressable
            accessibilityRole="link"
            onPress={() => open(releaseUrl(notes.version))}
            hitSlop={8}
          >
            <Text style={{ color: tokens.primary, fontSize: 12.5, fontFamily: 'Manrope_700Bold' }}>
              Notes
            </Text>
          </Pressable>
        }
      >
        <Text style={{ color: tokens.foregroundMuted, fontSize: 13.5, lineHeight: 20 }}>
          {notes.summary}
        </Text>
        <View style={{ gap: 12 }}>
          {notes.highlights.map((item) => (
            <View key={item.title} style={{ flexDirection: 'row', gap: 12 }}>
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 8,
                  marginTop: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: withAlpha(tokens.primary, 0.18),
                }}
              >
                <Check size={12} color={tokens.primary} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={{ color: tokens.foreground, fontSize: 14, fontFamily: 'Manrope_700Bold' }}
                >
                  {item.title}
                </Text>
                <Text style={{ color: tokens.foregroundMuted, fontSize: 12.5, lineHeight: 18 }}>
                  {item.detail}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </Card>
    ) : null,
    <Card
      key="versions"
      title="Version & build"
      icon={<ScrollText size={16} color={tokens.primary} />}
    >
      <View>
        {rows.map((row, index) => (
          <View
            key={row.label}
            accessible
            accessibilityLabel={`${row.label}: ${row.value}`}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              gap: 16,
              paddingVertical: 10,
              borderTopWidth: index === 0 ? 0 : 1,
              borderTopColor: tokens.borderSubtle,
            }}
          >
            <Text style={{ color: tokens.foregroundMuted, fontSize: 13.5 }}>{row.label}</Text>
            <Text
              selectable
              style={{
                flexShrink: 1,
                textAlign: 'right',
                color: tokens.foreground,
                fontSize: 13.5,
              }}
            >
              {row.value}
            </Text>
          </View>
        ))}
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={onShareDiagnostics}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignSelf: 'flex-start',
          alignItems: 'center',
          gap: 7,
          minHeight: 40,
          paddingHorizontal: 14,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: withAlpha(tokens.primary, 0.4),
          backgroundColor: withAlpha(tokens.primary, pressed ? 0.2 : 0.12),
        })}
      >
        <Share2 size={15} color={tokens.primary} />
        <Text style={{ color: tokens.primary, fontFamily: 'Manrope_700Bold' }}>
          Share diagnostics
        </Text>
      </Pressable>
      <Text style={{ color: tokens.foregroundMuted, fontSize: 12 }}>
        Include these details when you report a problem.
      </Text>
    </Card>,
    <Card key="links" title="Help & links">
      <View style={{ gap: 2, marginHorizontal: -6 }}>
        {onOpenPrivacy ? (
          <LinkRow
            icon={<Shield size={17} color={tokens.foreground} />}
            title="Privacy policy"
            description="What Finapp stores and why."
            onPress={onOpenPrivacy}
          />
        ) : null}
        <LinkRow
          icon={<Tag size={17} color={tokens.foreground} />}
          title="All releases"
          description="Changelogs and downloads on GitHub."
          onPress={() => open(RELEASES_URL)}
        />
        <LinkRow
          icon={<Bug size={17} color={tokens.foreground} />}
          title="Report a problem"
          description="Open an issue — include your diagnostics."
          onPress={() => open(ISSUES_URL)}
        />
        <LinkRow
          icon={<Code2 size={17} color={tokens.foreground} />}
          title="Source code"
          description="Finapp on GitHub."
          onPress={() => open(SOURCE_URL)}
        />
      </View>
    </Card>,
    <Card key="credits" title="Built with open source">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {OPEN_SOURCE_CREDITS.map((credit) => (
          <Pressable
            key={credit.name}
            accessibilityRole="link"
            accessibilityLabel={`${credit.name}, ${credit.license} licence`}
            onPress={() => open(credit.url)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: tokens.borderSubtle,
            }}
          >
            <Text
              style={{ color: tokens.foreground, fontSize: 13, fontFamily: 'Manrope_600SemiBold' }}
            >
              {credit.name}
            </Text>
            <Text style={{ color: tokens.foregroundMuted, fontSize: 11 }}>{credit.license}</Text>
          </Pressable>
        ))}
      </View>
    </Card>,
  ].filter(Boolean);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingTop: topInset + 10,
        paddingBottom: bottomInset + 32,
        gap: 16,
        width: '100%',
        maxWidth: twoColumn ? 1080 : 720,
        alignSelf: 'center',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {onBack ? (
          <SettingsIconButton label="Go back" onPress={onBack}>
            <ArrowLeft size={20} color={tokens.foreground} />
          </SettingsIconButton>
        ) : null}
        <Text
          accessibilityRole="header"
          style={{
            flex: 1,
            color: tokens.foreground,
            fontSize: 28,
            fontFamily: 'SpaceGrotesk_600SemiBold',
            letterSpacing: -0.8,
          }}
        >
          About
        </Text>
      </View>

      <View
        style={{
          alignItems: 'center',
          gap: 12,
          paddingVertical: 28,
          paddingHorizontal: 20,
          borderRadius: 28,
          borderWidth: 1,
          borderColor: withAlpha(tokens.primary, 0.3),
          backgroundColor: tokens.card,
          overflow: 'hidden',
        }}
      >
        <View
          accessible={false}
          style={{
            position: 'absolute',
            top: -80,
            width: 260,
            height: 260,
            borderRadius: 130,
            backgroundColor: withAlpha(tokens.primary, 0.12),
          }}
        />
        {logo}
        <Text
          style={{
            color: tokens.foregroundMuted,
            fontSize: 11.5,
            fontFamily: 'Manrope_700Bold',
            letterSpacing: 1.4,
            textTransform: 'uppercase',
          }}
        >
          Personal finance & bill splitting
        </Text>
        <Text
          accessibilityRole="header"
          style={{
            color: tokens.foreground,
            fontSize: 40,
            fontFamily: 'SpaceGrotesk_700Bold',
            letterSpacing: -2,
          }}
        >
          Finapp
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
          {pill(`v${productVersion}`, true)}
          {pill(channel)}
        </View>
        <UpdateStatus update={update} onUpdate={onUpdate} />
      </View>

      {twoColumn ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
          {cards.map((card, index) => (
            <View key={index} style={{ flexBasis: '48%', flexGrow: 1 }}>
              {card}
            </View>
          ))}
        </View>
      ) : (
        cards
      )}

      <Pressable
        accessibilityRole="link"
        onPress={() => open(DEVELOPER_URL)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 5,
          paddingVertical: 8,
        }}
      >
        <Text style={{ color: tokens.foregroundMuted }}>Made with</Text>
        <Heart size={14} color={tokens.primary} />
        <Text style={{ color: tokens.foregroundMuted }}>by</Text>
        <Text style={{ color: tokens.primary, fontFamily: 'Manrope_700Bold' }}>Neeraj</Text>
      </Pressable>
    </ScrollView>
  );
}
