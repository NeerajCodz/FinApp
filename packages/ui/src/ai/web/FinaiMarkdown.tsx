'use client';

import React from 'react';
import { parseMarkdown, type MdBlock, type MdInline } from '../markdown';
import styles from './FinaiMarkdown.module.css';
import { useStreamedText } from '../streamedText';

function Inline({ nodes }: { nodes: readonly MdInline[] }) {
  return (
    <>
      {nodes.map((node, index) => {
        switch (node.type) {
          case 'text':
            return <React.Fragment key={index}>{node.text}</React.Fragment>;
          case 'strong':
            return (
              <strong key={index}>
                <Inline nodes={node.children} />
              </strong>
            );
          case 'em':
            return (
              <em key={index}>
                <Inline nodes={node.children} />
              </em>
            );
          case 'code':
            return <code key={index}>{node.text}</code>;
        }
      })}
    </>
  );
}

function Block({ block }: { block: MdBlock }) {
  switch (block.type) {
    case 'paragraph':
      return (
        <p>
          <Inline nodes={block.children} />
        </p>
      );
    case 'heading': {
      const Tag = block.level === 1 ? 'h3' : block.level === 2 ? 'h4' : 'h5';
      return (
        <Tag>
          <Inline nodes={block.children} />
        </Tag>
      );
    }
    case 'list': {
      const items = block.items.map((item, index) => (
        <li key={index}>
          <Inline nodes={item} />
        </li>
      ));
      return block.ordered ? <ol start={block.start}>{items}</ol> : <ul>{items}</ul>;
    }
    case 'quote':
      return (
        <blockquote>
          <Inline nodes={block.children} />
        </blockquote>
      );
    case 'code':
      return (
        <pre>
          <code>{block.text}</code>
        </pre>
      );
  }
}

/** A FinAI reply in its reading face, with safe Markdown (no HTML is ever injected). */
export function FinaiMarkdown({ text, streaming }: { text: string; streaming?: boolean }) {
  // Grows smoothly frame by frame while the reply streams in.
  const shown = useStreamedText(text, Boolean(streaming));
  const blocks = React.useMemo(() => parseMarkdown(shown), [shown]);
  return (
    <div className={styles.markdown}>
      {blocks.map((block, index) => (
        <Block key={index} block={block} />
      ))}
      {streaming ? <span className={styles.caret} aria-hidden /> : null}
    </div>
  );
}
