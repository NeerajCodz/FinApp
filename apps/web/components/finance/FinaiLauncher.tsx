'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { FinaiAssistantScreen } from '@finapp/ui/ai';
import { ThinkingOrb } from '@finapp/ui/web';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useFinaiAssistant } from '@/lib/finai/useFinaiAssistant';
import { useFinaiDecide } from '@/lib/finai/useFinaiDecide';

/**
 * FinAI everywhere: a floating orb button above the + button that opens the chat as a panel
 * (desktop) or a full-screen sheet (phones). Hidden on the dedicated /finai page.
 */
export function FinaiLauncher() {
  const pathname = usePathname();
  const { userId, isConnected } = useBrowserSync();
  const [open, setOpen] = React.useState(false);
  const live = Boolean(userId && isConnected && open);
  const assistant = useFinaiAssistant(live);
  const decide = useFinaiDecide();

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!userId || pathname === '/finai' || pathname.startsWith('/finai/')) return null;
  return (
    <>
      {open ? (
        <div className="finai-launcher-panel" role="dialog" aria-label="FinAI">
          <FinaiAssistantScreen
            variant="panel"
            onClose={() => setOpen(false)}
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
          />
        </div>
      ) : null}
      <button
        type="button"
        className="finai-launcher"
        aria-label={open ? 'Close FinAI' : 'Ask FinAI'}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <ThinkingOrb state={assistant.sending ? 'working' : 'idle'} size={26} paused={!open} />
      </button>
    </>
  );
}
