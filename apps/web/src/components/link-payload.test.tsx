import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { MockSafetyEngine } from '../engine/mockSafetyEngine';

function renderAt(url: string) {
  window.history.replaceState(null, '', url);
  return render(<App engineOverride={new MockSafetyEngine()} />);
}

afterEach(() => {
  window.history.replaceState(null, '', '/');
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('a payload arriving in a link', () => {
  it('is checked on arrival, from the query string', async () => {
    renderAt('/?url=https%3A%2F%2Fbankid.no.verify-login.example%2Fstart');

    const result = await screen.findByTestId('result-region');
    expect(result.textContent).toContain('verify-login.example');
  });

  it('is checked on arrival, from the fragment', async () => {
    renderAt('/#url=https%3A%2F%2Fbankid.no.verify-login.example%2Fstart');

    const result = await screen.findByTestId('result-region');
    expect(result.textContent).toContain('verify-login.example');
  });

  it('leaves nothing behind in the address bar', async () => {
    renderAt('/?url=https%3A%2F%2Fevil.example%2Fphishing');

    await screen.findByTestId('result-region');
    await waitFor(() => expect(window.location.search).toBe(''));
    expect(window.location.href).not.toContain('evil.example');
  });

  it('never opens the link by itself', async () => {
    // The product invariant. A link that opened its own payload would turn this
    // app into the delivery mechanism it exists to prevent.
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderAt('/?url=https%3A%2F%2Fexample.com%2F');

    await screen.findByTestId('result-region');
    expect(open).not.toHaveBeenCalled();
    // Opening still costs a deliberate second action, exactly as it does for a
    // pasted payload: no anchor exists until the reader asks for one.
    expect(screen.queryByRole('link', { name: /open/i })).toBeNull();
  });

  it('renders a hostile scheme inertly and offers no way to follow it', async () => {
    renderAt('/?url=javascript%3Aalert(1)');

    await screen.findByTestId('result-region');
    expect(document.querySelector('a[href^="javascript:"]')).toBeNull();
    expect(screen.queryByRole('link', { name: /open/i })).toBeNull();
  });

  it('shows the scanner instead of guessing when the parameter is repeated', async () => {
    renderAt('/?url=https%3A%2F%2Fa.example&url=https%3A%2F%2Fb.example');

    expect(await screen.findByRole('button', { name: /^Check$/ })).toBeInTheDocument();
    expect(screen.queryByTestId('result-region')).toBeNull();
  });

  it('shows the scanner instead of checking an implausibly long payload', async () => {
    renderAt(`/?url=https%3A%2F%2Fexample.com%2F${'a'.repeat(5000)}`);

    expect(await screen.findByRole('button', { name: /^Check$/ })).toBeInTheDocument();
    expect(screen.queryByTestId('result-region')).toBeNull();
  });

  it('shows the scanner when no payload is attached', async () => {
    renderAt('/');

    expect(await screen.findByRole('button', { name: /^Check$/ })).toBeInTheDocument();
    expect(screen.queryByTestId('result-region')).toBeNull();
  });
});
