'use client';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface MathTextProps {
  children: string;
  inline?: boolean;
  className?: string;
}

export default function MathText({ children, inline = false, className }: MathTextProps) {
  if (!children) return null;
  if (inline) {
    return (
      <span className={className}>
        <ReactMarkdown
          remarkPlugins={[remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={{
            p: ({ children }) => <>{children}</>,
          }}
        >
          {children}
        </ReactMarkdown>
      </span>
    );
  }
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({ children }) => <p style={{ margin: 0 }}>{children}</p>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
