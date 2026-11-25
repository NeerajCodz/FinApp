import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../../native/ThemeProvider';
import { fontFamilies } from '../../tokens';
import { parseMarkdown, type MdBlock, type MdInline } from '../markdown';

function inline(nodes: readonly MdInline[], codeBackground: string, key = ''): React.ReactNode[] {
  return nodes.map((node, index) => {
    const k = `${key}${index}`;
    switch (node.type) {
      case 'text':
        return node.text;
      case 'strong':
        return (
          <Text key={k} style={{ fontFamily: fontFamilies.ai.semibold }}>
            {inline(node.children, codeBackground, `${k}-`)}
          </Text>
        );
      case 'em':
        return (
          <Text key={k} style={{ fontFamily: fontFamilies.ai.italic }}>
            {inline(node.children, codeBackground, `${k}-`)}
          </Text>
        );
      case 'code':
        return (
          <Text
            key={k}
            style={{ fontFamily: 'monospace', fontSize: 13, backgroundColor: codeBackground }}
          >
            {node.text}
          </Text>
        );
    }
  });
}

/** A FinAI reply in its reading face, with safe Markdown rendered as native text. */
export function FinaiMarkdown({ text, streaming }: { text: string; streaming?: boolean }) {
  const { tokens } = useTheme();
  const blocks = React.useMemo(() => parseMarkdown(text), [text]);
  const body = {
    color: tokens.foreground,
    fontFamily: fontFamilies.ai.regular,
    fontSize: 15.5,
    lineHeight: 24,
  } as const;
  const caret = streaming ? <Text style={{ color: tokens.primary }}> ▍</Text> : null;
  const render = (block: MdBlock, index: number, last: boolean) => {
    const tail = last ? caret : null;
    switch (block.type) {
      case 'paragraph':
        return (
          <Text key={index} style={body} selectable>
            {inline(block.children, tokens.surfaceSubtle)}
            {tail}
          </Text>
        );
      case 'heading':
        return (
          <Text
            key={index}
            style={{
              ...body,
              fontFamily: fontFamilies.text.bold,
              fontSize: block.level === 1 ? 17 : 15.5,
              marginTop: 4,
            }}
          >
            {inline(block.children, tokens.surfaceSubtle)}
            {tail}
          </Text>
        );
      case 'list':
        return (
          <View key={index} style={{ gap: 4 }}>
            {block.items.map((item, itemIndex) => (
              <View key={itemIndex} style={{ flexDirection: 'row', gap: 8 }}>
                <Text style={{ ...body, color: tokens.foregroundMuted, minWidth: 14 }}>
                  {block.ordered ? `${block.start + itemIndex}.` : '•'}
                </Text>
                <Text style={{ ...body, flex: 1 }} selectable>
                  {inline(item, tokens.surfaceSubtle)}
                  {last && itemIndex === block.items.length - 1 ? caret : null}
                </Text>
              </View>
            ))}
          </View>
        );
      case 'quote':
        return (
          <View
            key={index}
            style={{ borderLeftWidth: 3, borderLeftColor: tokens.borderSubtle, paddingLeft: 10 }}
          >
            <Text style={{ ...body, color: tokens.foregroundMuted }}>
              {inline(block.children, tokens.surfaceSubtle)}
              {tail}
            </Text>
          </View>
        );
      case 'code':
        return (
          <View
            key={index}
            style={{ padding: 10, borderRadius: 10, backgroundColor: tokens.surfaceSubtle }}
          >
            <Text style={{ color: tokens.foreground, fontFamily: 'monospace', fontSize: 13 }}>
              {block.text}
            </Text>
          </View>
        );
    }
  };
  if (!blocks.length) return caret;
  return (
    <View style={{ gap: 8 }}>
      {blocks.map((block, index) => render(block, index, index === blocks.length - 1))}
    </View>
  );
}
