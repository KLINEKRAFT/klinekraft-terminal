import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { SourceLink } from "./Briefing";
const plugins = [remarkGfm];
export function AnswerMarkdown({ text }: { text: string }) {
  return (
    <Markdown
      remarkPlugins={plugins}
      skipHtml
      components={{
        a: ({ href, children }) => (
          <SourceLink url={href}>{children}</SourceLink>
        ),
        img: ({ alt }) => <span>{alt}</span>,
        table: ({ children }) => (
          <div className="answer-table">
            <table>{children}</table>
          </div>
        ),
      }}
    >
      {text}
    </Markdown>
  );
}
