import React, { Children, isValidElement, memo, type ReactElement, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function splitStreamingMarkdown(content: string): { markdown: string; plain: string } {
  const fencePattern = /(^|\n)(```|~~~)/g;
  let match: RegExpExecArray | null;
  let openFence: { index: number; marker: string } | null = null;

  while ((match = fencePattern.exec(content)) !== null) {
    const marker = match[2];
    const markerIndex = match.index + match[1].length;
    if (!openFence) {
      openFence = { index: markerIndex, marker };
    } else if (openFence.marker === marker) {
      openFence = null;
    }
  }

  if (!openFence) {
    return { markdown: content, plain: "" };
  }

  return {
    markdown: content.slice(0, openFence.index).trimEnd(),
    plain: content.slice(openFence.index),
  };
}

function safeLink(href: string | undefined): string | undefined {
  if (!href || href.startsWith("/") || href.startsWith("#")) return href;
  try {
    const url = new URL(href);
    return ["http:", "https:", "mailto:"].includes(url.protocol) ? href : undefined;
  } catch {
    return undefined;
  }
}

const components = {
  h1: ({ children }: { children?: ReactNode }) => <h1 className="mb-2 mt-3 text-base font-semibold first:mt-0">{children}</h1>,
  h2: ({ children }: { children?: ReactNode }) => <h2 className="mb-2 mt-3 text-sm font-semibold first:mt-0">{children}</h2>,
  h3: ({ children }: { children?: ReactNode }) => <h3 className="mb-1 mt-2 text-sm font-semibold first:mt-0">{children}</h3>,
  p: ({ children }: { children?: ReactNode }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  strong: ({ children }: { children?: ReactNode }) => <strong className="font-semibold">{children}</strong>,
  ul: ({ children }: { children?: ReactNode }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }: { children?: ReactNode }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
  blockquote: ({ children }: { children?: ReactNode }) => <blockquote className="my-2 border-l-2 border-current/30 pl-3 italic opacity-90">{children}</blockquote>,
  hr: () => <hr className="my-3 border-current/20" />,
  table: ({ children }: { children?: ReactNode }) => <div className="my-3 max-w-full overflow-x-auto"><table className="w-full border-collapse text-left text-xs">{children}</table></div>,
  th: ({ children }: { children?: ReactNode }) => <th className="border border-current/20 bg-black/5 px-2 py-1.5 font-semibold">{children}</th>,
  td: ({ children }: { children?: ReactNode }) => <td className="border border-current/20 px-2 py-1.5">{children}</td>,
  pre: ({ children }: { children?: ReactNode }) => {
    const child = Children.only(children) as ReactElement<{ className?: string }>;
    const language = isValidElement(child) ? /language-([^\s]+)/.exec(child.props.className ?? "")?.[1] : undefined;
    return (
      <div className="my-3 max-w-full overflow-hidden rounded-md bg-slate-950 text-slate-100">
        {language ? <div className="border-b border-white/10 px-3 py-1.5 font-mono text-[10px] uppercase text-slate-400">{language}</div> : null}
        <pre className="max-w-full overflow-x-auto p-3 text-xs leading-relaxed">{children}</pre>
      </div>
    );
  },
  code: ({ className, children }: { className?: string; children?: ReactNode }) => {
    const language = /language-([^\s]+)/.exec(className ?? "")?.[1];
    return language
      ? <code className={className} data-language={language}>{children}</code>
      : <code className="rounded bg-black/10 px-1 py-0.5 font-mono text-[0.9em]">{children}</code>;
  },
  a: ({ href, children }: { href?: string; children?: ReactNode }) => {
    const safeHref = safeLink(href);
    const external = safeHref?.startsWith("http://") || safeHref?.startsWith("https://");
    return safeHref ? <a className="underline underline-offset-2" href={safeHref} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>{children}</a> : <span>{children}</span>;
  },
  img: () => null,
};

export const MarkdownMessage = memo(function MarkdownMessage({
  content,
  streaming = false,
}: {
  content: string;
  tone: "user" | "assistant";
  streaming?: boolean;
}) {
  const parts = streaming ? splitStreamingMarkdown(content) : { markdown: content, plain: "" };
  return (
    <>
      {parts.markdown ? <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} skipHtml>{parts.markdown}</ReactMarkdown> : null}
      {parts.plain ? <span className="whitespace-pre-wrap">{parts.plain}</span> : null}
    </>
  );
});
