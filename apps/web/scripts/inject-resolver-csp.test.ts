import { describe, expect, it } from 'vitest';
// The build script is plain ESM JS so `node` can run it directly; its pure
// origin-injection helpers are imported here and exercised in isolation.
import { cspForResolver, injectConnectSrc, resolverOrigin } from './inject-resolver-csp.mjs';

// A miniature policy that mirrors the real one: connect-src sits between other
// directives so the byte-identical-rest assertions are meaningful.
const BASE_CSP =
  "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; object-src 'none'; base-uri 'none'";

describe('resolverOrigin', () => {
  it('returns undefined when the value is unset or blank', () => {
    expect(resolverOrigin(undefined)).toBeUndefined();
    expect(resolverOrigin(null)).toBeUndefined();
    expect(resolverOrigin('')).toBeUndefined();
    expect(resolverOrigin('   ')).toBeUndefined();
  });

  it('returns the origin of a plain https URL', () => {
    expect(resolverOrigin('https://resolver.example')).toBe('https://resolver.example');
  });

  it('emits the ORIGIN ONLY for a URL carrying a path or trailing slash', () => {
    expect(resolverOrigin('https://resolver.example/v1/resolve')).toBe('https://resolver.example');
    expect(resolverOrigin('https://resolver.example/')).toBe('https://resolver.example');
    expect(resolverOrigin('https://resolver.example/v1/resolve?x=1#frag')).toBe('https://resolver.example');
  });

  it('preserves an explicit non-default port', () => {
    expect(resolverOrigin('https://resolver.example:8443/x')).toBe('https://resolver.example:8443');
  });

  it('rejects non-http(s) schemes and junk', () => {
    expect(resolverOrigin('ftp://resolver.example')).toBeUndefined();
    expect(resolverOrigin('javascript:alert(1)')).toBeUndefined();
    expect(resolverOrigin('data:text/plain,hi')).toBeUndefined();
    expect(resolverOrigin('not a url')).toBeUndefined();
    expect(resolverOrigin('*')).toBeUndefined();
    expect(resolverOrigin('https:')).toBeUndefined();
  });
});

describe('injectConnectSrc / cspForResolver', () => {
  it("leaves connect-src 'self' untouched for an unset or junk resolver URL", () => {
    expect(cspForResolver(BASE_CSP, undefined)).toBe(BASE_CSP);
    expect(cspForResolver(BASE_CSP, '')).toBe(BASE_CSP);
    expect(cspForResolver(BASE_CSP, 'not a url')).toBe(BASE_CSP);
    expect(cspForResolver(BASE_CSP, 'ftp://resolver.example')).toBe(BASE_CSP);
  });

  it('adds exactly one origin to connect-src (origin only, no path)', () => {
    expect(cspForResolver(BASE_CSP, 'https://resolver.example/v1/resolve')).toBe(
      "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self' https://resolver.example; object-src 'none'; base-uri 'none'",
    );
  });

  it('never widens to * or to a bare scheme', () => {
    const out = cspForResolver(BASE_CSP, 'https://resolver.example');
    expect(out).not.toContain('*');
    // No bare `https:` token inside connect-src (the real value is https://...).
    const connectSrc = out.split(';').find((part) => part.includes('connect-src')) ?? '';
    expect(connectSrc).not.toMatch(/\bhttps:(?!\/\/)/);
  });

  it('keeps every other byte of the policy identical', () => {
    const out = cspForResolver(BASE_CSP, 'https://resolver.example');
    expect(out.replace(' https://resolver.example', '')).toBe(BASE_CSP);
  });

  it('is idempotent when applied twice', () => {
    const once = cspForResolver(BASE_CSP, 'https://resolver.example');
    expect(cspForResolver(once, 'https://resolver.example')).toBe(once);
  });

  it('does nothing when the directive is absent', () => {
    const noConnect = "default-src 'self'; object-src 'none'";
    expect(injectConnectSrc(noConnect, 'https://resolver.example')).toBe(noConnect);
  });
});
