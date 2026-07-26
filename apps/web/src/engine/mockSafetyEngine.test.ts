import { describe, expect, it } from 'vitest';
import { MockSafetyEngine } from './mockSafetyEngine';

describe('MockSafetyEngine', () => {
  const engine = new MockSafetyEngine();

  it('blocks dangerous JavaScript payloads without opening them', () => {
    const assessment = engine.assess({ payload: 'javascript:alert(1)', nowMs: 1, locale: 'en' });

    expect(assessment.verdict).toBe('known_malicious');
    expect(assessment.recommendedActions).toContain('open_blocked');
    expect(assessment.findings.map((finding) => finding.code)).toContain('url.javascript_scheme');
  });

  it('calls out credentials in URL authority and the real host', () => {
    const assessment = engine.assess({ payload: 'https://dnb.no@evil.example/login', nowMs: 1, locale: 'en' });

    expect(assessment.verdict).toBe('suspicious');
    expect(assessment.url?.hasCredentials).toBe(true);
    expect(assessment.url?.host).toBe('evil.example');
    expect(assessment.findings.map((finding) => finding.code)).toContain('url.credentials_in_authority');
  });

  it('detects shorteners, punycode, IP literal hosts, and Norwegian brand impersonation patterns', () => {
    const bitly = engine.assess({ payload: 'https://bit.ly/example', nowMs: 1, locale: 'en' });
    const punycode = engine.assess({ payload: 'https://xn--dnb-5qa.example', nowMs: 1, locale: 'en' });
    const ip = engine.assess({ payload: 'http://192.0.2.10/login', nowMs: 1, locale: 'en' });
    const brand = engine.assess({ payload: 'https://dnb-login.example/', nowMs: 1, locale: 'en' });

    expect(bitly.findings.map((finding) => finding.code)).toContain('url.shortener');
    expect(punycode.findings.map((finding) => finding.code)).toContain('url.punycode_host');
    expect(ip.findings.map((finding) => finding.code)).toEqual(expect.arrayContaining(['url.ip_literal_host', 'url.insecure_scheme']));
    expect(brand.findings.map((finding) => finding.code)).toContain('url.hyphenated_brand_domain');
  });
});
