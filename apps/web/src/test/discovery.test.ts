import { describe, expect, it, beforeAll } from 'vitest';
import { readFile, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

/**
 * Discovery metadata is the one part of the app nobody looks at. It is read by
 * crawlers and by agents, both of which fail silently: a canonical pointing at
 * the wrong origin, a social image that 404s, or a JSON-LD block with a
 * trailing comma all look exactly like working code from here.
 *
 * So these assertions stand in for the reader we never hear from.
 */

const ORIGIN = 'https://qravn.isainative.dev';
// Vitest runs with apps/web as the working directory.
const webRoot = process.cwd();
const repoRoot = join(webRoot, '..', '..');
const publicDir = join(webRoot, 'public');

let indexHtml = '';
let privacyHtml = '';

beforeAll(async () => {
  indexHtml = await readText(join(webRoot, 'index.html'));
  privacyHtml = await readText(join(publicDir, 'privacy.html'));
});

function jsonLdBlocks(html: string): string[] {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
    (m) => m[1],
  );
}

function meta(html: string, attr: 'name' | 'property', key: string): string | null {
  // Attribute order varies, and the formatter breaks long tags across lines.
  const tag = html.match(new RegExp(`<meta[^>]*\\b${attr}="${key}"[^>]*>`, 's'));
  if (!tag) return null;
  return tag[0].match(/content="([^"]*)"/s)?.[1] ?? null;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Line endings differ between a Windows working copy and CI, and none of these
 * assertions are about that.
 */
async function readText(path: string): Promise<string> {
  return (await readFile(path, 'utf8')).replace(/\r\n/g, '\n');
}

describe('structured data', () => {
  it('parses as JSON on every page that emits it', () => {
    for (const [name, html] of [
      ['index.html', indexHtml],
      ['privacy.html', privacyHtml],
    ] as const) {
      const blocks = jsonLdBlocks(html);
      expect(blocks.length, `${name} has no JSON-LD`).toBeGreaterThan(0);
      for (const block of blocks) {
        // The placeholder is substituted at build time; parsing has to happen
        // against something numeric, and the value itself is checked elsewhere.
        expect(() => JSON.parse(block.replaceAll(/%CHECK_COUNT[_A-Z]*%/g, '1'))).not.toThrow();
      }
    }
  });

  it('cannot break out of its own script element', () => {
    for (const block of [...jsonLdBlocks(indexHtml), ...jsonLdBlocks(privacyHtml)]) {
      expect(block).not.toMatch(/<\/script/i);
      expect(block).not.toContain('<');
    }
  });

  it('cross-links its entities by resolvable @id', () => {
    const graph = JSON.parse(
      jsonLdBlocks(indexHtml)[0].replaceAll(/%CHECK_COUNT[_A-Z]*%/g, '1'),
    )['@graph'];
    const ids = new Set(graph.map((node: { '@id': string }) => node['@id']));

    const references: string[] = [];
    JSON.stringify(graph, (key, value) => {
      if (key === '@id' && typeof value === 'string') references.push(value);
      return value;
    });

    // Every @id used as a reference is either defined here or on the privacy
    // page, which reuses #author and points at #website and #app.
    for (const id of references) {
      expect(id.startsWith(ORIGIN), `${id} is not an absolute id on this origin`).toBe(true);
    }
    expect(ids.has(`${ORIGIN}/#website`)).toBe(true);
    expect(ids.has(`${ORIGIN}/#author`)).toBe(true);
    expect(ids.has(`${ORIGIN}/#app`)).toBe(true);
  });

  it('does not claim a verdict the product refuses to give', () => {
    // "Safe" is the one word QRavn will not say. Structured data is read out
    // loud by assistants, so it is the easiest place for it to creep back in.
    const app = JSON.parse(
      jsonLdBlocks(indexHtml)[0].replaceAll(/%CHECK_COUNT[_A-Z]*%/g, '1'),
    )['@graph'].find((n: { '@id': string }) => n['@id'] === `${ORIGIN}/#app`);
    expect(JSON.stringify(app).toLowerCase()).not.toMatch(/\bis safe\b|\btells you if.{0,20}safe/);
  });
});

describe('per-page metadata', () => {
  const pages = () =>
    [
      { name: 'index.html', html: indexHtml, canonical: `${ORIGIN}/` },
      { name: 'privacy.html', html: privacyHtml, canonical: `${ORIGIN}/privacy` },
    ] as const;

  it('declares an absolute canonical that matches og:url', () => {
    for (const { name, html, canonical } of pages()) {
      const link = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
      expect(link, `${name} has no canonical`).toBe(canonical);
      expect(meta(html, 'property', 'og:url'), `${name} og:url`).toBe(canonical);
    }
  });

  it('asks to be indexed, with the same answer for googlebot', () => {
    for (const { name, html } of pages()) {
      const robots = meta(html, 'name', 'robots');
      expect(robots, `${name} robots`).toContain('index, follow');
      expect(robots).toContain('max-image-preview:large');
      expect(meta(html, 'name', 'googlebot'), `${name} googlebot`).toBe(robots);
    }
  });

  it('carries a complete social card pointing at an image that exists', async () => {
    for (const { name, html } of pages()) {
      for (const key of [
        'og:type',
        'og:site_name',
        'og:locale',
        'og:title',
        'og:description',
        'og:image:type',
        'og:image:width',
        'og:image:height',
        'og:image:alt',
      ]) {
        expect(meta(html, 'property', key), `${name} is missing ${key}`).toBeTruthy();
      }
      for (const key of [
        'twitter:card',
        'twitter:title',
        'twitter:description',
        'twitter:image',
        'twitter:image:alt',
      ]) {
        expect(meta(html, 'name', key), `${name} is missing ${key}`).toBeTruthy();
      }

      const image = meta(html, 'property', 'og:image');
      expect(image, `${name} og:image`).toMatch(new RegExp(`^${ORIGIN}/`));
      expect(await exists(join(publicDir, image!.slice(`${ORIGIN}/`.length)))).toBe(true);
    }
  });

  it('never invents a social account', () => {
    // twitter:site and twitter:creator are omitted deliberately: no verified
    // account for the project exists, and a guessed handle credits a stranger.
    for (const { html } of pages()) {
      expect(meta(html, 'name', 'twitter:site')).toBeNull();
      expect(meta(html, 'name', 'twitter:creator')).toBeNull();
    }
  });

  it('states a description within the length search results will show', () => {
    for (const { name, html } of pages()) {
      const description = meta(html, 'name', 'description');
      expect(description, `${name} description`).toBeTruthy();
      expect(description!.length, `${name} description length`).toBeGreaterThan(70);
      expect(description!.length, `${name} description length`).toBeLessThan(230);
    }
  });
});

describe('icons', () => {
  it('ships every icon the markup and the manifest reference', async () => {
    for (const file of [
      'favicon.ico',
      'favicon.svg',
      'apple-touch-icon.png',
      'icon-192.png',
      'icon-512.png',
      'maskable-512.png',
      'og.png',
    ]) {
      expect(await exists(join(publicDir, file)), `${file} is missing`).toBe(true);
    }
  });

  it('writes favicon.ico as a real icon container', async () => {
    const ico = await readFile(join(publicDir, 'favicon.ico'));
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);

    const count = ico.readUInt16LE(4);
    expect(count).toBeGreaterThanOrEqual(3);

    const sizes: number[] = [];
    for (let i = 0; i < count; i += 1) {
      const at = 6 + i * 16;
      sizes.push(ico.readUInt8(at) || 256);
      const length = ico.readUInt32LE(at + 8);
      const offset = ico.readUInt32LE(at + 12);
      expect(offset + length, 'entry runs past the end of the file').toBeLessThanOrEqual(ico.length);
      // PNG-in-ICO. Every browser that matters has read it since Vista.
      expect(ico.subarray(offset, offset + 8).toString('hex')).toBe('89504e470d0a1a0a');
    }
    expect(sizes).toEqual(expect.arrayContaining([16, 32, 48]));
  });

  it('keeps the Apple icon opaque, because iOS renders transparency as black', async () => {
    const png = await readFile(join(publicDir, 'apple-touch-icon.png'));
    // IHDR colour type sits at byte 25: 2 is truecolour, 6 is truecolour+alpha.
    expect(png.subarray(12, 16).toString('ascii')).toBe('IHDR');
    expect(png.readUInt8(25), 'apple-touch-icon.png carries an alpha channel').toBe(2);
  });
});

describe('crawl directives', () => {
  it('points robots.txt at a sitemap that exists, using an absolute URL', async () => {
    const robots = await readText(join(publicDir, 'robots.txt'));
    const sitemap = robots.match(/^Sitemap:\s*(\S+)$/m)?.[1];
    expect(sitemap).toBe(`${ORIGIN}/sitemap.xml`);
    expect(await exists(join(publicDir, 'sitemap.xml'))).toBe(true);
  });

  it('answers the AI crawlers by name rather than leaving them to the wildcard', async () => {
    const robots = await readText(join(publicDir, 'robots.txt'));
    for (const agent of [
      'GPTBot',
      'OAI-SearchBot',
      'ChatGPT-User',
      'ClaudeBot',
      'Claude-User',
      'anthropic-ai',
      'PerplexityBot',
      'Perplexity-User',
      'Google-Extended',
      'Applebot-Extended',
      'CCBot',
      'cohere-ai',
      'Amazonbot',
      'meta-externalagent',
    ]) {
      expect(robots, `${agent} has no group`).toContain(`User-agent: ${agent}\nAllow: /`);
    }
  });

  it('blocks nothing, so the canonical tag is the thing that dedupes ?url=', async () => {
    const robots = await readText(join(publicDir, 'robots.txt'));
    // A Disallow would stop a crawler reading the canonical, which is what
    // collapses every ?url= address into the one real page. See robots.txt.
    expect(robots).not.toMatch(/^Disallow:\s*\S/m);
  });

  it('lists every canonical URL in the sitemap and nothing that is not one', async () => {
    const sitemap = await readText(join(publicDir, 'sitemap.xml'));
    const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

    expect(locations).toEqual([`${ORIGIN}/`, `${ORIGIN}/privacy`]);
    // /personvern rewrites to the same document, so listing it would ask for
    // the duplicate the canonical tag exists to prevent.
    expect(locations.some((l) => l.includes('personvern'))).toBe(false);

    for (const [, lastmod] of sitemap.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)) {
      expect(lastmod).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect(sitemap.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(sitemap).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
  });

  it('keeps the new files out of the SPA fallback on both servers', async () => {
    const swa = JSON.parse(await readText(join(publicDir, 'staticwebapp.config.json')));
    const pattern = swa.navigationFallback.exclude.find((p: string) => p.startsWith('/*.'));
    for (const extension of ['txt', 'xml', 'webmanifest', 'ico']) {
      expect(pattern, `Azure would rewrite .${extension} to the app shell`).toContain(extension);
    }

    const config = await readText(join(webRoot, 'vite.config.ts'));
    const denylist = config.match(/navigateFallbackDenylist: \[([\s\S]*?)\]/)?.[1] ?? '';
    for (const file of ['robots', 'sitemap', 'llms']) {
      expect(denylist, `the service worker would answer /${file} with the app shell`).toContain(
        file,
      );
    }
  });
});

describe('agent discovery', () => {
  it('writes llms.txt in the format agents expect', async () => {
    const llms = await readText(join(publicDir, 'llms.txt'));
    const lines = llms.split('\n');

    expect(lines[0]).toBe('# QRavn');
    expect(lines.find((l) => l.startsWith('> ')), 'no blockquote summary').toBeTruthy();
    expect(llms).toMatch(/^## /m);

    // Every link has to be absolute: an agent reading this file has no base.
    for (const [, , href] of llms.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)) {
      expect(href, `${href} is not absolute`).toMatch(/^https:\/\//);
    }
  });

  it('keeps llms-full.txt identical to what the contract generates', () => {
    // Run the generator rather than importing it: it reads sibling files by
    // path, and the module transform under jsdom does not leave it a real one.
    expect(() =>
      execFileSync(
        process.execPath,
        [join(repoRoot, 'tools', 'generate-llms-full.mjs'), '--check'],
        { cwd: repoRoot, stdio: 'pipe' },
      ),
    ).not.toThrow();
  });

  it('states what the product refuses to say, so a summary cannot soften it', async () => {
    for (const file of ['llms.txt', 'llms-full.txt']) {
      const text = await readText(join(publicDir, file));
      expect(text.toLowerCase(), `${file} does not mention the missing verdict`).toContain('safe');
      expect(text).toMatch(/never contacts|never touches|no .{0,20}contact/i);
    }
  });
});

describe('the page a crawler sees without JavaScript', () => {
  it('says what QRavn is, rather than shipping an empty div', () => {
    const noscript = indexHtml.match(/<noscript>\s*<div class="noscript-shell">([\s\S]*?)<\/noscript>/);
    expect(noscript, 'index.html has no no-JavaScript fallback').toBeTruthy();

    const text = noscript![1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    expect(text.length, 'the fallback is too thin to describe the product').toBeGreaterThan(300);
    expect(text).toContain('%CHECK_COUNT%');
    expect(text).toMatch(/never contacts/i);
    expect(noscript![1]).toContain('href="/privacy"');
    expect(noscript![1]).toContain('href="/llms.txt"');
  });

  it('has exactly one h1 in that fallback', () => {
    expect([...indexHtml.matchAll(/<h1[\s>]/g)]).toHaveLength(1);
  });
});
