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

// Allow inline data: URIs (used for our own trusted SVG Venn-diagram options).
// react-markdown's defaultUrlTransform strips `data:` URIs, so pass them through.
const allowDataUri = (url: string) => url;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const imgRenderer = ({ src, alt }: any) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img src={src} alt={alt || ''} style={{ display: 'inline-block', verticalAlign: 'middle', maxWidth: '100%' }} />
);

export default function MathText({ children, inline = false, className }: MathTextProps) {
  if (!children) return null;
  if (inline) {
    return (
      <span className={className}>
        <ReactMarkdown
          remarkPlugins={[remarkMath]}
          rehypePlugins={[rehypeKatex]}
          urlTransform={allowDataUri}
          components={{
            p: ({ children }) => <>{children}</>,
            img: imgRenderer,
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
        urlTransform={allowDataUri}
        components={{
          p: ({ children }) => <p style={{ margin: 0 }}>{children}</p>,
          img: imgRenderer,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
