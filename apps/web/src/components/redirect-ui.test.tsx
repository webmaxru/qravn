import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Assessment, RedirectResolution } from '../contracts/assessment';
import { MockSafetyEngine } from '../engine/mockSafetyEngine';
import { RedirectPanel, type OnlineExpansion } from './RedirectPanel';

const SHORTENER = 'https://bit.ly/abc';

// Build a real Assessment through the mock engine (its redirect analysis mirrors
// the Rust core), optionally feeding a resolver result the way App does.
function assessOnline(payload: string, resolution?: RedirectResolution): Assessment {
  return new MockSafetyEngine().assess({ payload, nowMs: 1, locale: 'en', redirectResolution: resolution });
}

function online(overrides: Partial<OnlineExpansion> = {}): OnlineExpansion {
  return { available: true, state: 'idle', onExpand: vi.fn(), ...overrides };
}

describe('RedirectPanel opt-in', () => {
  it('offers explicit expansion with a plain-language privacy disclosure', async () => {
    const user = userEvent.setup();
    const onExpand = vi.fn();
    render(
      <RedirectPanel assessment={assessOnline(SHORTENER)} resolution={null} locale="en" online={online({ onExpand })} />,
    );

    expect(screen.getByRole('heading', { name: /Expand this shortened link/i })).toBeInTheDocument();
    expect(screen.getByText(/this link's address is sent to our resolver/i)).toBeInTheDocument();
    expect(screen.getByText(/Your device never contacts the link/i)).toBeInTheDocument();

    // Nothing happens until the user actively chooses to expand.
    expect(onExpand).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /Expand this link safely/i }));
    expect(onExpand).toHaveBeenCalledTimes(1);
  });

  it('is cleanly unavailable (renders nothing) when no resolver is configured', () => {
    const { container } = render(
      <RedirectPanel
        assessment={assessOnline(SHORTENER)}
        resolution={null}
        locale="en"
        online={online({ available: false })}
      />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('button', { name: /Expand this link safely/i })).not.toBeInTheDocument();
  });

  it('renders nothing when the offline check found no shortener cue', () => {
    const { container } = render(
      <RedirectPanel assessment={assessOnline('https://example.com/login')} resolution={null} locale="en" online={online()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('disables the expand control while a request is in flight', () => {
    render(
      <RedirectPanel assessment={assessOnline(SHORTENER)} resolution={null} locale="en" online={online({ state: 'resolving' })} />,
    );
    expect(screen.getByRole('button', { name: /Expand this link safely/i })).toBeDisabled();
    expect(screen.getByText(/Contacting our resolver/i)).toBeInTheDocument();
  });

  it('shows an error state that never reassures, with a retry that re-requests', async () => {
    const user = userEvent.setup();
    const onExpand = vi.fn();
    render(
      <RedirectPanel
        assessment={assessOnline(SHORTENER)}
        resolution={null}
        locale="en"
        online={online({ state: 'error', onExpand })}
      />,
    );
    expect(screen.getByText(/The link could not be expanded/i)).toBeInTheDocument();
    expect(screen.getByText(/Your device did not contact the link/i)).toBeInTheDocument();
    expect(screen.queryByText(/Followed to the final destination/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Try expanding again/i }));
    expect(onExpand).toHaveBeenCalledTimes(1);
  });
});

describe('RedirectPanel expanded result', () => {
  const resolvedResolution: RedirectResolution = {
    chain: [
      { url: 'https://bit.ly/abc', status: 301, via: 'http_status' },
      { url: 'https://dnb.no@evil.example/login', status: 200 },
    ],
    finalUrl: 'https://dnb.no@evil.example/login',
    outcome: 'resolved',
    resolver: 'test',
  };

  it('renders the final destination prominently without calling it safe or linking to it', () => {
    render(
      <RedirectPanel
        assessment={assessOnline(SHORTENER, resolvedResolution)}
        resolution={resolvedResolution}
        locale="en"
        online={online()}
      />,
    );

    expect(screen.getByRole('heading', { name: /Where this link leads/i })).toBeInTheDocument();
    expect(screen.getByText(/Followed to the final destination/i)).toBeInTheDocument();
    expect(screen.getByText(/does not mean the destination is safe/i)).toBeInTheDocument();
    expect(document.querySelector('.redirect-final-host__value')?.textContent).toMatch(/evil\.example/);
    // Never an unguarded anchor to the destination.
    expect(screen.queryByRole('link', { name: /evil\.example/i })).not.toBeInTheDocument();
  });

  it('shows the path it followed as a hop chain', () => {
    render(
      <RedirectPanel
        assessment={assessOnline(SHORTENER, resolvedResolution)}
        resolution={resolvedResolution}
        locale="en"
        online={online()}
      />,
    );
    const chain = document.querySelector('.hop-chain');
    expect(chain).not.toBeNull();
    const text = within(chain as HTMLElement)
      .getAllByRole('listitem')
      .map((li) => li.textContent)
      .join(' ');
    expect(text).toMatch(/bit\.ly/);
    expect(text).toMatch(/evil\.example/);
  });

  it('keeps findings about the final destination in a separate, badged section', () => {
    render(
      <RedirectPanel
        assessment={assessOnline(SHORTENER, resolvedResolution)}
        resolution={resolvedResolution}
        locale="en"
        online={online()}
      />,
    );
    const section = document.querySelector('.redirect-final-findings');
    expect(section).not.toBeNull();
    const region = within(section as HTMLElement);
    expect(region.getByRole('heading', { name: /Warnings about the final destination/i })).toBeInTheDocument();
    expect(region.getAllByText(/Final destination/i).length).toBeGreaterThan(0);
    // The credential-in-authority claim is about the FINAL page, not the scanned code.
    expect(region.getByText('url.credentials_in_authority')).toBeInTheDocument();
  });

  it('explains WHY a max_hops chain is untrusted, not just a changed verdict', () => {
    const maxHops: RedirectResolution = {
      chain: [
        { url: 'https://bit.ly/x' },
        { url: 'https://a.example/1' },
        { url: 'https://b.example/2' },
        { url: 'https://c.example/3' },
        { url: 'https://d.example/4' },
        { url: 'https://e.example/5' },
        { url: 'https://f.example/6' },
      ],
      outcome: 'max_hops',
      resolver: 'test',
    };
    render(
      <RedirectPanel assessment={assessOnline(SHORTENER, maxHops)} resolution={maxHops} locale="en" online={online()} />,
    );

    expect(screen.getByText(/Stopped: too many redirects/i)).toBeInTheDocument();
    expect(screen.getByText(/kept redirecting past the safe limit of 5 hops/i)).toBeInTheDocument();
    expect(document.querySelector('.redirect-outcome--untrusted')).not.toBeNull();
    // A partial resolution shows no destination and never reads as resolved.
    expect(screen.queryByText(/Followed to the final destination/i)).not.toBeInTheDocument();
    expect(document.querySelector('.redirect-final-host__value')).toBeNull();
  });

  it.each(['timeout', 'network_error', 'blocked', 'loop'] as const)(
    'frames a %s outcome as incomplete and never as reassurance',
    (outcome) => {
      const failed: RedirectResolution = { chain: [{ url: 'https://bit.ly/abc' }], outcome, resolver: 'test' };
      render(
        <RedirectPanel assessment={assessOnline(SHORTENER, failed)} resolution={failed} locale="en" online={online()} />,
      );

      expect(screen.getByText(/Could not finish expanding this link/i)).toBeInTheDocument();
      expect(document.querySelector('.redirect-outcome--incomplete')).not.toBeNull();
      expect(screen.queryByText(/Followed to the final destination/i)).not.toBeInTheDocument();
      expect(document.querySelector('.redirect-final-host__value')).toBeNull();
    },
  );
});
