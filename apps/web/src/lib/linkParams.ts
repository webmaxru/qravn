/**
 * Reading a payload out of the address bar.
 *
 * Anyone can mail a victim a link to this app with a payload already attached,
 * so a value arriving this way is treated exactly like a scan: assessed on this
 * device, never fetched, never opened, and never trusted. Nothing here
 * sanitizes the payload — hidden characters and hostile schemes are precisely
 * what the checks look for, so the value reaches the engine byte for byte.
 *
 * Two channels are accepted:
 *
 *   ?url=...  what every link builder and integration produces. The cost is
 *             that a query string travels to the server in the request line,
 *             so the scanned link can land in host access logs.
 *   #url=...  identical behaviour, but a fragment is never sent to any server.
 *             This is the private channel, and it wins when both are present.
 *
 * Either way the value is stripped from the address bar the moment it is read,
 * so someone else's link does not linger in history, in a screenshot, or in an
 * address copied out of the bar and shared onward.
 */

const PARAM = 'url';

/**
 * Longest payload accepted from a link. A QR code tops out near 4 296
 * alphanumeric characters, so anything longer did not come from a scan and is
 * refused rather than handed to the engine and the DOM.
 */
export const MAX_LINK_PAYLOAD_LENGTH = 4096;

function readParam(raw: string): string | null {
  if (!raw) return null;

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(raw);
  } catch {
    return null;
  }

  // A repeated parameter is a tampering signal, and picking one of them would
  // make the assessed payload depend on parser order — the reader would be
  // shown a verdict for a string they cannot identify. Refuse instead.
  const values = params.getAll(PARAM);
  if (values.length !== 1) return null;

  const value = values[0];
  if (value.trim() === '') return null;
  if (value.length > MAX_LINK_PAYLOAD_LENGTH) return null;

  return value;
}

/**
 * Whether this channel carries the parameter at all, regardless of how many
 * times or whether the value is usable.
 */
function hasParam(raw: string): boolean {
  if (!raw) return false;
  try {
    return new URLSearchParams(raw).has(PARAM);
  } catch {
    return false;
  }
}

/** The payload carried by this address, or null when there is none to act on. */
export function readLinkPayload(search: string, hash: string): string | null {
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash;
  const query = search.startsWith('?') ? search.slice(1) : search;
  // The fragment is the private channel, so if it carries the parameter at all
  // it is the one being answered. Falling back to the query when the fragment
  // turns out to be unusable would be choosing between two different payloads.
  return hasParam(fragment) ? readParam(fragment) : readParam(query);
}

/**
 * Remove the payload from the address bar, keeping anything else that was
 * there. Uses replaceState rather than pushState so no history entry is left
 * holding the link.
 */
export function stripLinkPayload(): void {
  try {
    const { pathname, search, hash } = window.location;

    const query = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    query.delete(PARAM);

    // Only rewrite the fragment when it actually carried the payload; parsing
    // and re-serialising an unrelated fragment would mangle it.
    let nextHash = hash;
    const fragment = hash.startsWith('#') ? hash.slice(1) : hash;
    if (fragment) {
      const fragmentParams = new URLSearchParams(fragment);
      if (fragmentParams.has(PARAM)) {
        fragmentParams.delete(PARAM);
        const rest = fragmentParams.toString();
        nextHash = rest ? `#${rest}` : '';
      }
    }

    const nextQuery = query.toString();
    window.history.replaceState(
      window.history.state,
      '',
      `${pathname}${nextQuery ? `?${nextQuery}` : ''}${nextHash}`,
    );
  } catch {
    // Tidying the address bar is best effort. The check itself is unaffected.
  }
}
