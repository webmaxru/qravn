import { describe, expect, it, beforeEach } from 'vitest';
import { MAX_LINK_PAYLOAD_LENGTH, readLinkPayload, stripLinkPayload } from './linkParams';

describe('readLinkPayload', () => {
  it('reads a link from the query string', () => {
    expect(readLinkPayload('?url=https%3A%2F%2Fexample.com%2F', '')).toBe('https://example.com/');
  });

  it('reads a link from the fragment, which never reaches a server', () => {
    expect(readLinkPayload('', '#url=https%3A%2F%2Fexample.com%2F')).toBe('https://example.com/');
  });

  it('prefers the fragment over the query string, because it is the private channel', () => {
    expect(readLinkPayload('?url=https://query.example', '#url=https://fragment.example')).toBe(
      'https://fragment.example',
    );
  });

  it('returns null when there is no payload to act on', () => {
    expect(readLinkPayload('', '')).toBeNull();
    expect(readLinkPayload('?other=1', '#still=nothing')).toBeNull();
  });

  it('ignores an empty or whitespace-only value rather than checking nothing', () => {
    expect(readLinkPayload('?url=', '')).toBeNull();
    expect(readLinkPayload('?url=%20%20', '')).toBeNull();
  });

  describe('abuse cases', () => {
    it('refuses a repeated parameter instead of guessing which one was meant', () => {
      // Picking one would show a verdict for a string the reader cannot
      // identify, and which one wins would depend on parser order.
      expect(readLinkPayload('?url=https://a.example&url=https://b.example', '')).toBeNull();
    });

    it('does not fall back to the query when the fragment carries an unusable value', () => {
      // The fragment claimed the parameter, so it is the one being answered.
      // Silently answering the query instead would assess a payload the reader
      // has no reason to think was the one submitted.
      expect(readLinkPayload('?url=https://query.example', '#url=')).toBeNull();
      expect(readLinkPayload('?url=https://query.example', '#url=https://a&url=https://b')).toBeNull();
    });

    it('refuses a payload longer than any real QR code', () => {
      const tooLong = `https://example.com/${'a'.repeat(MAX_LINK_PAYLOAD_LENGTH)}`;
      expect(readLinkPayload(`?url=${tooLong}`, '')).toBeNull();
    });

    it('accepts a payload at the length limit', () => {
      const atLimit = 'a'.repeat(MAX_LINK_PAYLOAD_LENGTH);
      expect(readLinkPayload(`?url=${atLimit}`, '')).toBe(atLimit);
    });

    it('hands hostile schemes through untouched, because they are what the checks look for', () => {
      expect(readLinkPayload('?url=javascript%3Aalert(1)', '')).toBe('javascript:alert(1)');
      expect(readLinkPayload('?url=data%3Atext%2Fhtml%3Bbase64%2CPGgxPkhpPC9oMT4%3D', '')).toBe(
        'data:text/html;base64,PGgxPkhpPC9oMT4=',
      );
    });

    it('preserves markup and invisible characters rather than sanitizing them away', () => {
      // Stripping these would destroy the evidence the engine is looking for.
      expect(readLinkPayload('?url=%3Cscript%3Ealert(1)%3C%2Fscript%3E', '')).toBe(
        '<script>alert(1)</script>',
      );
      expect(readLinkPayload('?url=https%3A%2F%2Fex%E2%80%8Bample.com', '')).toBe(
        'https://ex\u200Bample.com',
      );
    });

    it('survives malformed percent-encoding without throwing', () => {
      expect(() => readLinkPayload('?url=%E0%A4%A', '')).not.toThrow();
      expect(() => readLinkPayload('?url=%', '')).not.toThrow();
    });
  });
});

describe('stripLinkPayload', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('removes the payload from the address bar', () => {
    window.history.replaceState(null, '', '/?url=https%3A%2F%2Fevil.example');
    stripLinkPayload();
    expect(window.location.search).toBe('');
    expect(window.location.href).not.toContain('evil.example');
  });

  it('removes a payload carried in the fragment', () => {
    window.history.replaceState(null, '', '/#url=https%3A%2F%2Fevil.example');
    stripLinkPayload();
    expect(window.location.hash).toBe('');
    expect(window.location.href).not.toContain('evil.example');
  });

  it('keeps other parameters and leaves an unrelated fragment alone', () => {
    window.history.replaceState(null, '', '/?lang=nb&url=https%3A%2F%2Fevil.example#section');
    stripLinkPayload();
    expect(window.location.search).toBe('?lang=nb');
    expect(window.location.hash).toBe('#section');
    expect(window.location.href).not.toContain('evil.example');
  });

  it('does nothing when there is no payload', () => {
    window.history.replaceState(null, '', '/?lang=nb');
    stripLinkPayload();
    expect(window.location.search).toBe('?lang=nb');
  });
});
