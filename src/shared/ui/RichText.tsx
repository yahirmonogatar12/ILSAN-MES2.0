import { memo, type ReactNode } from "react";
import { DataTable } from "./table/DataTable";
import "./rich-text.css";
function safeLink(value: string): string | null {
  try {
    const url = new URL(value, window.location.origin);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}
function inline(source: string): ReactNode[] {
  const result: ReactNode[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^\s)]+\))/g;
  let start = 0;
  for (const match of source.matchAll(pattern)) {
    if (match.index > start) result.push(source.slice(start, match.index));
    const value = match[0],
      key = match.index;
    if (value.startsWith("`"))
      result.push(<code key={key}>{value.slice(1, -1)}</code>);
    else if (value.startsWith("**"))
      result.push(<strong key={key}>{value.slice(2, -2)}</strong>);
    else if (value.startsWith("*"))
      result.push(<em key={key}>{value.slice(1, -1)}</em>);
    else {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(value)!;
      const href = safeLink(link[2]);
      result.push(
        href ? (
          <a key={key} href={href} target="_blank" rel="noopener noreferrer">
            {link[1]}
          </a>
        ) : (
          <span key={key}>{value}</span>
        ),
      );
    }
    start = match.index + value.length;
  }
  result.push(source.slice(start));
  return result;
}
const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());
const separator = (line: string) =>
  cells(line).every((cell) => /^:?-{3,}:?$/.test(cell));
/** Text-only Markdown. Tables share the application's table owner and HTML is escaped by React. */
export const RichText = memo(function RichText({ text }: { text: string }) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n"),
    blocks: ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index],
      key = index;
    if (!line.trim()) {
      index++;
      continue;
    }
    if (line.startsWith("```")) {
      const language = line.slice(3).trim(),
        content: string[] = [];
      index++;
      while (index < lines.length && !lines[index].startsWith("```"))
        content.push(lines[index++]);
      if (index < lines.length) index++;
      blocks.push(
        <pre key={key}>
          <code data-language={language || undefined}>
            {content.join("\n")}
          </code>
        </pre>,
      );
      continue;
    }
    if (
      line.includes("|") &&
      index + 1 < lines.length &&
      separator(lines[index + 1])
    ) {
      const headers = cells(line),
        rows: string[][] = [];
      index += 2;
      while (
        index < lines.length &&
        lines[index].includes("|") &&
        lines[index].trim()
      )
        rows.push(cells(lines[index++]));
      blocks.push(
        <DataTable<string[]>
          key={key}
          label="Tabla de la respuesta"
          rows={rows}
          rowKey={(_, row) => row}
          minWidth={320}
          columns={headers.map((header, column) => ({
            id: String(column),
            header,
            cell: (row) => inline(row[column] ?? ""),
            textValue: (row) => row[column] ?? "",
          }))}
        />,
      );
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      blocks.push(
        heading[1].length === 1 ? (
          <h3 key={key}>{inline(heading[2])}</h3>
        ) : heading[1].length === 2 ? (
          <h4 key={key}>{inline(heading[2])}</h4>
        ) : (
          <h5 key={key}>{inline(heading[2])}</h5>
        ),
      );
      index++;
      continue;
    }
    const list = /^\s*(?:[-*]|\d+\.)\s+(.+)$/.exec(line);
    if (list) {
      const ordered = /^\s*\d+\./.test(line),
        items: ReactNode[] = [];
      while (index < lines.length) {
        const item = /^\s*(?:[-*]|\d+\.)\s+(.+)$/.exec(lines[index]);
        if (!item || /^\s*\d+\./.test(lines[index]) !== ordered) break;
        items.push(<li key={index}>{inline(item[1])}</li>);
        index++;
      }
      blocks.push(
        ordered ? <ol key={key}>{items}</ol> : <ul key={key}>{items}</ul>,
      );
      continue;
    }
    if (line.startsWith(">")) {
      blocks.push(
        <blockquote key={key}>{inline(line.replace(/^>\s?/, ""))}</blockquote>,
      );
      index++;
      continue;
    }
    blocks.push(<p key={key}>{inline(line)}</p>);
    index++;
  }
  return <div className="rich-text">{blocks}</div>;
});
