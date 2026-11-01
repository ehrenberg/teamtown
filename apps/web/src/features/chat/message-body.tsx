import { Fragment, useMemo } from 'react';
import { parseMarkdown, type Inline } from './markdown.ts';

function InlineNodes({ nodes }: { readonly nodes: readonly Inline[] }) {
  return nodes.map((node, index) => {
    switch (node.type) {
      case 'text':
        return <Fragment key={index}>{node.text}</Fragment>;
      case 'bold':
        return (
          <strong key={index}>
            <InlineNodes nodes={node.children} />
          </strong>
        );
      case 'italic':
        return (
          <em key={index}>
            <InlineNodes nodes={node.children} />
          </em>
        );
      case 'code':
        return (
          <code key={index} className="rounded-sm bg-neutral-100 px-1 font-mono text-[0.9em]">
            {node.text}
          </code>
        );
      case 'link':
        return (
          <a
            key={index}
            href={node.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-link underline"
          >
            <InlineNodes nodes={node.children} />
          </a>
        );
    }
  });
}

/** A message body in the Markdown subset (ADR-0033); everything is rendered as React elements, never as HTML. */
export function MessageBody({ body }: { readonly body: string }) {
  const blocks = useMemo(() => parseMarkdown(body), [body]);
  return blocks.map((block, index) => {
    switch (block.type) {
      case 'code':
        return (
          <pre key={index} className="my-1 overflow-x-auto rounded-sm bg-neutral-100 p-2 font-mono text-xs">
            <code>{block.text}</code>
          </pre>
        );
      case 'list': {
        const List = block.ordered ? 'ol' : 'ul';
        return (
          <List key={index} className={`my-1 pl-5 ${block.ordered ? 'list-decimal' : 'list-disc'}`}>
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>
                <InlineNodes nodes={item} />
              </li>
            ))}
          </List>
        );
      }
      case 'paragraph':
        return (
          <p key={index} className="whitespace-pre-wrap">
            {block.lines.map((line, lineIndex) => (
              <Fragment key={lineIndex}>
                {lineIndex > 0 && <br />}
                <InlineNodes nodes={line} />
              </Fragment>
            ))}
          </p>
        );
    }
  });
}
