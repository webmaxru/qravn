import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import App from '../App';
import type { Assessment, Finding, Verdict } from '../contracts/assessment';
import { MockSafetyEngine } from '../engine/mockSafetyEngine';
import { FindingsList } from './FindingsList';
import { InputForm } from './InputForm';
import { ResultPanel } from './ResultPanel';
import { VerdictBanner } from './VerdictBanner';

function assess(payload: string): Assessment {
  return new MockSafetyEngine().assess({ payload, nowMs: 1, locale: 'en' });
}

describe('safety UI', () => {
  it.each([
    ['known_malicious', 'Known malicious'],
    ['suspicious', 'Suspicious'],
    ['insufficient_evidence', 'Insufficient evidence'],
    ['no_known_threat_found', 'No known threat found'],
  ] satisfies Array<[Verdict, string]>)('renders verdict %s without saying safe', (verdict, label) => {
    render(<VerdictBanner verdict={verdict} summary="" locale="en" />);

    expect(screen.getByRole('heading', { name: label })).toBeInTheDocument();
    expect(screen.queryByText(/^safe$/i)).not.toBeInTheDocument();
  });

  it('renders no open affordance when open_blocked is recommended', () => {
    render(<ResultPanel assessment={assess('javascript:alert(1)')} locale="en" />);

    expect(screen.getByText(/Opening is blocked/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /open/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /prepare opening/i })).not.toBeInTheDocument();
  });

  it('visually calls out credentials before @ as not the destination', () => {
    render(<ResultPanel assessment={assess('https://dnb.no@evil.example/login')} locale="en" />);

    expect(screen.getByText(/The text before @ is not the destination/i)).toBeInTheDocument();
    expect(screen.getAllByText('evil.example').length).toBeGreaterThan(0);
  });

  it('sorts findings by severity descending', () => {
    const findings: Finding[] = [
      { code: 'low', severity: 'low', params: {}, title: 'Low item', detail: '' },
      { code: 'critical', severity: 'critical', params: {}, title: 'Critical item', detail: '' },
      { code: 'medium', severity: 'medium', params: {}, title: 'Medium item', detail: '' },
    ];

    render(<FindingsList findings={findings} locale="en" />);

    const items = screen.getAllByRole('listitem');
    expect(within(items[0]!).getByRole('heading', { name: 'Critical item' })).toBeInTheDocument();
    expect(within(items[1]!).getByRole('heading', { name: 'Medium item' })).toBeInTheDocument();
    expect(within(items[2]!).getByRole('heading', { name: 'Low item' })).toBeInTheDocument();
  });

  it('changes rendered text when switching language', async () => {
    const user = userEvent.setup();
    render(<App engineOverride={new MockSafetyEngine()} />);

    await user.type(screen.getByLabelText(/Paste a suspicious link/i), 'plain text');
    await user.click(screen.getByRole('button', { name: /check/i }));
    const englishTitle = screen.getByRole('heading', { name: /Not a web/i, level: 3 }).textContent;

    await user.click(screen.getByRole('radio', { name: /NB/i }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 3 }).textContent).not.toBe(englishTitle);
    });
  });

  it('renders HTML payload as inert text and does not execute it', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const user = userEvent.setup();
    render(<App engineOverride={new MockSafetyEngine()} />);

    await user.type(screen.getByLabelText(/Paste a suspicious link/i), '<script>alert(1)</script>');
    await user.click(screen.getByRole('button', { name: /check/i }));

    expect(screen.getAllByText('<script>alert(1)</script>').length).toBeGreaterThan(0);
    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  describe('InputForm keyboard parity', () => {
    it('submits on Enter when the analyser is ready', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      render(<InputForm onSubmit={onSubmit} />);

      await user.type(screen.getByLabelText(/Paste a suspicious link/i), 'https://example.com{Enter}');

      expect(onSubmit).toHaveBeenCalledWith('https://example.com');
    });

    // The submit button is disabled until the WebAssembly engine loads. The
    // Enter handler previously ignored that, so the keyboard path could start a
    // check with no engine while the pointer path could not. The check then
    // produced nothing at all, which is the worst possible outcome for a
    // keyboard user: silence that looks identical to a clean result.
    it('does not submit on Enter while the analyser is still loading', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      render(<InputForm onSubmit={onSubmit} disabled />);

      await user.type(screen.getByLabelText(/Paste a suspicious link/i), 'https://example.com{Enter}');

      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: /check/i })).toBeDisabled();
    });

    it('keeps Shift+Enter as a newline rather than a submit', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      render(<InputForm onSubmit={onSubmit} />);

      const field = screen.getByLabelText(/Paste a suspicious link/i);
      await user.type(field, 'line one{Shift>}{Enter}{/Shift}line two');

      expect(onSubmit).not.toHaveBeenCalled();
      expect(field).toHaveValue('line one\nline two');
    });
  });
});
