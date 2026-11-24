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
  const panelRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  // Phones show the chat full screen: that is a modal and must hold focus.
  const [fullScreen, setFullScreen] = React.useState(false);
  React.useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)');
    const update = () => setFullScreen(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const live = Boolean(userId && isConnected && open);
  const assistant = useFinaiAssistant(live);
  const decide = useFinaiDecide();

  React.useEffect(() => {
    if (!open) return;
    const button = buttonRef.current;
    const panel = panelRef.current;
    // Move focus into the chat (its message box) when it opens.
    requestAnimationFrame(() => (panel?.querySelector<HTMLElement>('textarea') ?? panel)?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !fullScreen || !panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!panel.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      // Back to the launcher (visible again once the panel closes).
      requestAnimationFrame(() => button?.focus());
    };
  }, [fullScreen, open]);

  if (!userId || pathname === '/finai' || pathname.startsWith('/finai/')) return null;
  return (
    <>
      {open ? (
        <div
          ref={panelRef}
          className="finai-launcher-panel"
          role="dialog"
          aria-label="FinAI"
          aria-modal={fullScreen ? true : undefined}
          tabIndex={-1}
        >
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
        ref={buttonRef}
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
