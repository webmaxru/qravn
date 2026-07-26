/**
 * Detect `<meta http-equiv="refresh" content="N; url=...">` in an HTML fragment.
 *
 * We only ever read enough of the body to find this tag (see MAX_BODY_BYTES) and
 * the parser is deliberately tolerant of attribute order and quoting. It never
 * executes or returns page content.
 */

export interface MetaRefresh {
  delaySeconds: number;
  /** Absolute-or-relative target, or null for a same-page refresh. */
  url: string | null;
}

function getAttr(tag: string, name: string): string | null {
  const re = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i");
  const m = re.exec(tag);
  if (!m) return null;
  const value = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : (m[4] ?? "");
  return value.trim();
}

function parseContent(content: string): MetaRefresh | null {
  const semi = content.search(/[;,]/);
  const delayStr = (semi === -1 ? content : content.slice(0, semi)).trim();
  const rest = semi === -1 ? "" : content.slice(semi + 1).trim();

  const delay = Number(delayStr);
  if (!Number.isFinite(delay) || delay < 0) return null;

  let url: string | null = null;
  if (rest !== "") {
    const um = /^url\s*=\s*(.*)$/i.exec(rest);
    if (um && um[1] !== undefined) {
      let candidate = um[1].trim();
      if (
        candidate.length >= 2 &&
        ((candidate.startsWith('"') && candidate.endsWith('"')) ||
          (candidate.startsWith("'") && candidate.endsWith("'")))
      ) {
        candidate = candidate.slice(1, -1);
      }
      url = candidate.length > 0 ? candidate : null;
    }
  }
  return { delaySeconds: delay, url };
}

export function parseMetaRefresh(html: string): MetaRefresh | null {
  const metaTag = /<meta\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = metaTag.exec(html)) !== null) {
    const tag = match[0];
    const equiv = getAttr(tag, "http-equiv");
    if (equiv === null || equiv.toLowerCase() !== "refresh") continue;
    const content = getAttr(tag, "content");
    if (content === null) continue;
    const parsed = parseContent(content);
    if (parsed) return parsed;
  }
  return null;
}
