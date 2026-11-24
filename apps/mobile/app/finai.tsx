import React from 'react';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FinaiAssistantScreen } from '@finapp/ui/ai';
import { useFinaiAssistant } from '@/hooks/useFinaiAssistant';
import { useFinaiDecide } from '@/hooks/useFinaiDecide';
import { useLocalSync } from '@/providers/LocalSyncProvider';

export default function FinaiScreen() {
  const insets = useSafeAreaInsets();
  const { userId, isConnected } = useLocalSync();
  const live = Boolean(userId && isConnected);
  const assistant = useFinaiAssistant(live);
  const decide = useFinaiDecide();
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
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      topInset={insets.top}
      bottomInset={insets.bottom}
    />
  );
}
