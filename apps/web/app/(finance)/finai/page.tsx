'use client';

import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { FinaiAssistantScreen } from '@finapp/ui/ai';
import { FinanceSignedOut } from '@/components/finance/FinanceSignedOut';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useFinaiAssistant } from '@/lib/finai/useFinaiAssistant';
import { useFinaiDecide } from '@/lib/finai/useFinaiDecide';

export default function FinaiPage() {
  const { userId, isConnected } = useBrowserSync();
  const live = Boolean(userId && isConnected);
  const assistant = useFinaiAssistant(live);
  const decide = useFinaiDecide();
  const finaiSettings = useQuery(api.ai.settings.get, live ? {} : 'skip');
  if (!userId)
    return (
      <FinanceSignedOut
        section="FINAI"
        title="Your money, answered."
        description="Sign in to ask FinAI about your spending, budgets, groups and balances."
      />
    );
  return (
    <FinaiAssistantScreen
      available={assistant.available && isConnected}
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
      error={isConnected ? assistant.error : 'You’re offline. Reconnect to chat with FinAI.'}
      onDecide={decide}
      showSteps={finaiSettings?.showSteps !== false}
    />
  );
}
