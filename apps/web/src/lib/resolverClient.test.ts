import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RedirectResolution } from '../contracts/assessment';
import {
  isOnlineModeAvailable,
  resolveRedirect,
  resolverBaseUrl,
  ResolverUnavailableError,
} from './resolverClient';

const BASE = 'https://resolver.example';
const SCANNED = 'https://bit.ly/hostile';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function textResponse(status: number, body: string): Response {
  return new Response(body, { status, headers: { 'content-type': 'application/json' } });
}

function resolvedBody(finalUrl: string): RedirectResolution {
  return {
    chain: [{ url: SCANNED, status: 301, via: 'http_status' }, { url: finalUrl, status: 200 }],
    finalUrl,
    outcome: 'resolved',
    resolver: 'qrrrgh-resolver-test',
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('resolverBaseUrl / isOnlineModeAvailable', () => {
  it('is unavailable when VITE_RESOLVER_URL is unset or blank', () => {
    vi.stubEnv('VITE_RESOLVER_URL', '');
    expect(resolverBaseUrl()).toBeUndefined();
    expect(isOnlineModeAvailable()).toBe(false);
  });

  it('strips a trailing slash and reports availability', () => {
    vi.stubEnv('VITE_RESOLVER_URL', 'https://resolver.example/');
    expect(resolverBaseUrl()).toBe('https://resolver.example');
    expect(isOnlineModeAvailable()).toBe(true);
  });

  it('rejects junk and non-http(s) schemes', () => {
    vi.stubEnv('VITE_RESOLVER_URL', 'not a url');
    expect(resolverBaseUrl()).toBeUndefined();

    vi.stubEnv('VITE_RESOLVER_URL', 'ftp://resolver.example');
    expect(resolverBaseUrl()).toBeUndefined();

    vi.stubEnv('VITE_RESOLVER_URL', 'javascript:alert(1)');
    expect(resolverBaseUrl()).toBeUndefined();
    expect(isOnlineModeAvailable()).toBe(false);
  });
});

describe('resolveRedirect', () => {
  it('throws ResolverUnavailableError when no resolver is configured', async () => {
    await expect(resolveRedirect(SCANNED, { fetchImpl: vi.fn() as unknown as typeof fetch })).rejects.toBeInstanceOf(
      ResolverUnavailableError,
    );
  });

  it('calls only the configured resolver origin, never the scanned host', async () => {
    let calledUrl = '';
    let sentBody: unknown;
    const fetchImpl = vi.fn((url: string | URL | Request, init?: RequestInit) => {
      calledUrl = String(url);
      sentBody = init?.body ? JSON.parse(String(init.body)) : undefined;
      return Promise.resolve(jsonResponse(200, resolvedBody('https://evil.example/login')));
    }) as unknown as typeof fetch;

    await resolveRedirect(SCANNED, { baseUrl: BASE, fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(calledUrl).toBe(`${BASE}/v1/resolve`);
    expect(calledUrl.startsWith(BASE)).toBe(true);
    // The scanned host only ever appears inside the POST body we hand to OUR
    // resolver — never as the request target.
    expect(calledUrl).not.toContain('bit.ly');
    expect(calledUrl).not.toContain('evil.example');
    expect(sentBody).toEqual({ url: SCANNED });
  });

  it.each([200, 422, 504])('passes a valid %s body through unchanged', async (status) => {
    const body = { ...resolvedBody('https://evil.example/login'), outcome: status === 200 ? 'resolved' : status === 422 ? 'blocked' : 'timeout' };
    const fetchImpl = (() => Promise.resolve(jsonResponse(status, body))) as unknown as typeof fetch;

    const result = await resolveRedirect(SCANNED, { baseUrl: BASE, fetchImpl });

    expect(result).toEqual(body);
  });

  it.each([
    [200, 'network_error'],
    [422, 'blocked'],
    [504, 'timeout'],
  ] as const)('degrades a malformed %s body to a %s failure (never a clean destination)', async (status, outcome) => {
    const fetchImpl = (() => Promise.resolve(textResponse(status, 'garbage{not-json'))) as unknown as typeof fetch;

    const result = await resolveRedirect(SCANNED, { baseUrl: BASE, fetchImpl });

    expect(result.outcome).toBe(outcome);
    expect(result.finalUrl).toBeUndefined();
    expect(result.chain).toEqual([{ url: SCANNED }]);
  });

  it('degrades a hostile 200 body (right shape, wrong types) to network_error', async () => {
    const fetchImpl = (() => Promise.resolve(jsonResponse(200, { chain: 'not-an-array', outcome: 'resolved' }))) as unknown as typeof fetch;

    const result = await resolveRedirect(SCANNED, { baseUrl: BASE, fetchImpl });

    expect(result.outcome).toBe('network_error');
    expect(result.chain).toEqual([{ url: SCANNED }]);
  });

  it.each([400, 413, 429, 500])('degrades status %s to network_error without reading the body', async (status) => {
    const json = vi.fn();
    const response = { status, json } as unknown as Response;
    const fetchImpl = (() => Promise.resolve(response)) as unknown as typeof fetch;

    const result = await resolveRedirect(SCANNED, { baseUrl: BASE, fetchImpl });

    expect(result.outcome).toBe('network_error');
    expect(json).not.toHaveBeenCalled();
  });

  it('degrades a transport (network) failure to network_error', async () => {
    const fetchImpl = (() => Promise.reject(new TypeError('Failed to fetch'))) as unknown as typeof fetch;

    const result = await resolveRedirect(SCANNED, { baseUrl: BASE, fetchImpl });

    expect(result.outcome).toBe('network_error');
  });

  it('degrades the hard client timeout to a timeout outcome', async () => {
    vi.useFakeTimers();
    // A fetch that never settles on its own, but rejects the moment the client's
    // AbortController fires — exactly how the real hard timeout unwinds.
    const fetchImpl = ((_url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')));
      })) as unknown as typeof fetch;

    const promise = resolveRedirect(SCANNED, { baseUrl: BASE, fetchImpl, timeoutMs: 12_000 });
    await vi.advanceTimersByTimeAsync(12_000);
    const result = await promise;

    expect(result.outcome).toBe('timeout');
    expect(result.chain).toEqual([{ url: SCANNED }]);
  });
});
