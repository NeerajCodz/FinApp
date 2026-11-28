import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GroupChatScreen } from '../../packages/ui/src/finance/web/GroupChatScreen';
import { ThemeProvider } from '@finapp/ui/web';

describe('embedded group chat voice messages', () => {
  it('renders playable voice clips instead of the missing-bill fallback', () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(GroupChatScreen, {
          embedded: true,
          items: [
            {
              id: 'voice-1',
              kind: 'message',
              date: 'Mar 1, 2026',
              accessibleLabel: 'Maya sent a voice message',
              sender: 'Maya',
              audioUrl: 'https://example.test/clip.webm',
              durationMs: 4_200,
            },
          ],
          loading: false,
          canSend: false,
          connected: true,
          draft: '',
          pending: false,
          onDraftChange: () => {},
        }),
      ),
    );

    expect(markup).toContain('<audio');
    expect(markup).toContain('https://example.test/clip.webm');
    expect(markup).not.toContain('Bill image is no longer available');
  });
});
