import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { FinaiAssistantScreen } from '@finapp/ui/ai';
import { useFinaiAssistant } from '@/hooks/useFinaiAssistant';
import { useFinaiDecide } from '@/hooks/useFinaiDecide';
import { useLocalSync } from '@/providers/LocalSyncProvider';

export default function FinaiScreen() {
  const insets = useSafeAreaInsets();
  const { userId, isConnected } = useLocalSync();
  const live = Boolean(userId && isConnected);
  // "Open" on a FinAI toast links here with the chat to show.
  const { c: requested } = useLocalSearchParams<{ c?: string }>();
  const assistant = useFinaiAssistant(live, requested ?? null);
  const { select } = assistant;
  React.useEffect(() => {
    if (requested) select(requested);
  }, [requested, select]);
  const decide = useFinaiDecide();
  const finaiSettings = useQuery(api.ai.settings.get, live ? {} : 'skip');
  return (
    <FinaiAssistantScreen
      available={assistant.available && live}
      conversations={assistant.conversations}
      activeId={assistant.activeId}
      onSelect={assistant.select}
      onDelete={(id) => void assistant.remove(id)}
      messages={assistant.messages}
      loading={assistant.loading}
      canLoadOlder={assistant.canLoadOlder}
      onLoadOlder={assistant.loadOlder}
      draft={assistant.draft}
      onDraftChange={assistant.setDraft}
      onSend={(text) => void assistant.send(text)}
      sending={assistant.sending}
      error={
        !userId
          ? 'Sign in to chat with FinAI.'
          : isConnected
            ? assistant.error
            : 'You’re offline. Reconnect to chat with FinAI.'
      }
      onDecide={decide}
      showSteps={finaiSettings?.showSteps !== false}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      topInset={insets.top}
      bottomInset={insets.bottom}
    />
  );
}
