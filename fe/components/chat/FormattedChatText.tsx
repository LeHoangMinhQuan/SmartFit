/**
 * Renders the small subset of inline markdown the chatbot's model actually
 * produces — **bold** and *italic* — as real <strong>/<em>, plus line
 * breaks. Not a full markdown parser (no headers, lists, links, code
 * blocks, tables): the model only ever emits inline emphasis in a plain
 * chat reply, and pulling in a dependency (react-markdown etc.) for that
 * narrow a need isn't worth it here.
 *
 * Previously ChatMessageBubble rendered `part.text` as a raw string, so a
 * reply like "**Demo Shirt** – 299,000 VND" showed the literal asterisks
 * instead of bold text.
 */
export default function FormattedChatText({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, lineIdx, lines) => (
        <span key={lineIdx}>
          {renderInline(line)}
          {lineIdx < lines.length - 1 && <br />}
        </span>
      ))}
    </>
  );
}

// Matches **bold**, *italic*, or _italic_ — single-character delimiters
// last so **bold** is consumed before the pass would otherwise treat one
// of its own asterisks as an italic marker.
const INLINE_PATTERN = /(\*\*.+?\*\*|\*.+?\*|_.+?_)/g;

function renderInline(line: string): React.ReactNode[] {
  const segments = line.split(INLINE_PATTERN).filter((s) => s !== "");
  return segments.map((segment, i) => {
    if (segment.startsWith("**") && segment.endsWith("**")) {
      return <strong key={i}>{segment.slice(2, -2)}</strong>;
    }
    if (
      (segment.startsWith("*") && segment.endsWith("*")) ||
      (segment.startsWith("_") && segment.endsWith("_"))
    ) {
      return <em key={i}>{segment.slice(1, -1)}</em>;
    }
    return segment;
  });
}
