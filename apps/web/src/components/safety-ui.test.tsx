import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import type { Assessment, Finding, Verdict } from '../contracts/assessment';
import { MockSafetyEngine } from '../engine/mockSafetyEngine';
import type { SafetyEngine } from '../engine/types';
import { FindingsList } from './FindingsList';
import { InputForm } from './InputForm';
import { ResultPanel } from './ResultPanel';
import { VerdictBanner } from './VerdictBanner';

function assess(payload: string): Assessment {
  return new MockSafetyEngine().assess({ payload, nowMs: 1, locale: 'en' });
}

function assessmentWithRedirectCue(payload = 'https://bit.ly/abc'): Assessment {
  return {
    schemaVersion: 1,
    payloadKind: 'url',
    rawPayload: payload,
    displayPayload: payload,
    findings: [
      {
        code: 'url.shortener',
        severity: 'low',
        params: { service: 'bit.ly' },
        title: 'Shortened link',
        detail: 'bit.ly hides the final destination.',
      },
    ],
    limitations: [{ code: 'limitation.redirect_not_expanded', params: { service: 'bit.ly' }, text: 'Redirect not checked' }],
    verdict: 'suspicious',
    confidence: 0.7,
    recommendedActions: ['copy', 'expand_redirect_online'],
    summary: 'Review redirect evidence.',
    engineVersion: 'test',
    rulesVersion: 'test',
    locale: 'en',
    evaluatedAtMs: 1,
  };
}

function assessmentWithoutRedirectCue(payload = 'https://example.com'): Assessment {
  return {
    ...assessmentWithRedirectCue(payload),
    findings: [],
    limitations: [],
    verdict: 'no_known_threat_found',
    recommendedActions: ['copy'],
    summary: 'No local redirect cue.',
  };
}

class FixedAssessmentEngine implements SafetyEngine {
  private readonly createAssessment: (payload: string) => Assessment;

  constructor(createAssessment: (payload: string) => Assessment) {
    this.createAssessment = createAssessment;
  }

  assess({ payload }: { payload: string }): Assessment {
    return this.createAssessment(payload);
  }

  version(): string {
    return 'test';
  }
}

afterEach(() => {
  window.localStorage.clear();
});

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

  describe('offline mode', () => {
    it('defaults to online-capable mode with offline mode off', () => {
      window.localStorage.clear();

      render(<App engineOverride={new FixedAssessmentEngine(assessmentWithRedirectCue)} />);

      expect(screen.getByRole('switch', { name: /Offline mode/i })).not.toBeChecked();
      expect(screen.queryByText(/Redirects cannot be followed in offline mode/i)).not.toBeInTheDocument();
    });

    it('persists the toggle across remounts', async () => {
      window.localStorage.clear();
      const user = userEvent.setup();
      const { unmount } = render(<App engineOverride={new FixedAssessmentEngine(assessmentWithoutRedirectCue)} />);

      await user.click(screen.getByRole('switch', { name: /Offline mode/i }));
      expect(screen.getByRole('switch', { name: /Offline mode/i })).toBeChecked();
      unmount();

      render(<App engineOverride={new FixedAssessmentEngine(assessmentWithoutRedirectCue)} />);
      expect(screen.getByRole('switch', { name: /Offline mode/i })).toBeChecked();
      expect(screen.getByText(/Redirects cannot be followed in offline mode/i)).toBeInTheDocument();
    });

    it('never calls the resolver while offline mode is on, including for a known shortener', async () => {
      window.localStorage.clear();
      const user = userEvent.setup();
      const resolve = vi.fn();
      render(
        <App
          engineOverride={new FixedAssessmentEngine(assessmentWithRedirectCue)}
          resolverOverride={{ available: true, resolve }}
        />,
      );

      await user.click(screen.getByRole('switch', { name: /Offline mode/i }));
      await user.type(screen.getByLabelText(/Paste a suspicious link/i), 'https://bit.ly/abc');
      await user.click(screen.getByRole('button', { name: /check/i }));

      expect(screen.queryByRole('button', { name: /Expand this link safely/i })).not.toBeInTheDocument();
      expect(resolve).not.toHaveBeenCalled();
    });

    it('does not lose the current result when switched on, but removes redirect expansion', async () => {
      window.localStorage.clear();
      const user = userEvent.setup();
      render(
        <App
          engineOverride={new FixedAssessmentEngine(assessmentWithRedirectCue)}
          resolverOverride={{ available: true, resolve: vi.fn() }}
        />,
      );

      await user.type(screen.getByLabelText(/Paste a suspicious link/i), 'https://bit.ly/abc');
      await user.click(screen.getByRole('button', { name: /check/i }));
      expect(screen.getByText(/Review redirect evidence/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Expand this link safely/i })).toBeInTheDocument();

      await user.click(screen.getByRole('switch', { name: /Offline mode/i }));

      expect(screen.getByText(/Review redirect evidence/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Expand this link safely/i })).not.toBeInTheDocument();
    });
  });

  describe('possible redirect warning', () => {
    it('appears in online-capable mode when the assessment carries a redirect cue', () => {
      render(<ResultPanel assessment={assessmentWithRedirectCue()} locale="en" online={{ available: true, state: 'idle', onExpand: vi.fn() }} />);

      expect(screen.getByRole('heading', { name: /Possibly a redirect/i })).toBeInTheDocument();
      expect(screen.getByText(/does not mean the link is safe or unsafe by itself/i)).toBeInTheDocument();
    });

    it('appears with the offline limitation while offline mode is on', () => {
      render(<ResultPanel assessment={assessmentWithRedirectCue()} locale="en" offlineMode />);

      expect(screen.getByRole('heading', { name: /Possibly a redirect/i })).toBeInTheDocument();
      expect(screen.getByText(/Redirects cannot be followed in offline mode/i)).toBeInTheDocument();
    });

    it('is absent when the assessment has no redirect cue', () => {
      render(<ResultPanel assessment={assessmentWithoutRedirectCue()} locale="en" />);

      expect(screen.queryByRole('heading', { name: /Possibly a redirect/i })).not.toBeInTheDocument();
    });
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
