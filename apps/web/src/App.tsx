import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { AppBar } from './components/AppBar';
import { InputForm } from './components/InputForm';
import { QrScanner } from './components/QrScanner';
import { ResultPanel } from './components/ResultPanel';
import type { ExpansionState, OnlineExpansion } from './components/RedirectPanel';
import type { Assessment, RedirectResolution } from './contracts/assessment';
import { createEngine } from './engine/createEngine';
import { normaliseLocale, type Locale } from './engine/catalog';
import { CHECK_COUNT } from './checkCount';
import { detectLocale, storeLocale, t, td } from './lib/uiText';
import type { EngineInstance, SafetyEngine } from './engine/types';
import { isOnlineModeAvailable, resolveRedirect } from './lib/resolverClient';

declare global {
  interface Window {
    __QRAVN_TEST_NOW_MS__?: number;
  }
}

/** Injectable resolver seam, so tests can stub online expansion. */
export interface AppResolver {
  available: boolean;
  resolve: (url: string) => Promise<RedirectResolution>;
}

interface AppProps {
  engineOverride?: SafetyEngine;
  resolverOverride?: AppResolver;
}

const OFFLINE_MODE_STORAGE_KEY = 'qravn.offlineMode';

function readStoredOfflineMode(): boolean {
  try {
    return window.localStorage.getItem(OFFLINE_MODE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function App({ engineOverride, resolverOverride }: AppProps) {
  const [locale, setLocale] = useState<Locale>(detectLocale);
  const [engineInstance, setEngineInstance] = useState<EngineInstance | null>(
    engineOverride ? { engine: engineOverride, mode: 'mock' } : null,
  );
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [lastPayload, setLastPayload] = useState('');
  const [engineError, setEngineError] = useState<string | null>(null);
  // The chain resolved by our isolated resolver, kept so it survives a locale
  // change and so the individual hops can be rendered.
  const [redirectResolution, setRedirectResolution] = useState<RedirectResolution | null>(null);
  const [expansionState, setExpansionState] = useState<ExpansionState>('idle');
  const [offlineMode, setOfflineMode] = useState(readStoredOfflineMode);
  const resultRef = useRef<HTMLDivElement | null>(null);

  const resolver = useMemo<AppResolver>(
    () => resolverOverride ?? { available: isOnlineModeAvailable(), resolve: (url) => resolveRedirect(url) },
    [resolverOverride],
  );
  const effectiveResolver = useMemo<AppResolver>(
    () =>
      offlineMode
        ? {
            available: false,
            resolve: async () => {
              throw new Error('Redirect expansion is disabled in offline mode.');
            },
          }
        : resolver,
    [offlineMode, resolver],
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(OFFLINE_MODE_STORAGE_KEY, String(offlineMode));
    } catch {
      // Persistence is best-effort; the runtime choice still applies.
    }
    if (offlineMode) setExpansionState('idle');
  }, [offlineMode]);

  useEffect(() => {
    if (engineOverride) return;
    let alive = true;
    void createEngine({ locale })
      .then((instance) => {
        if (alive) {
          setEngineInstance(instance);
          setEngineError(null);
        }
      })
      .catch(() => {
        if (alive) {
          setEngineInstance(null);
          setEngineError('The real WebAssembly safety analyser could not start. No assessment can be given. Please reload or try again later.');
        }
      });
    return () => {
      alive = false;
    };
  }, [engineOverride, locale]);

  // Run the analyser for `payload`. `resolution` carries an expanded redirect
  // chain when one is available; the core folds it in and behaves exactly
  // offline when it is absent.
  function assessWith(payload: string, nextLocale: Locale, resolution: RedirectResolution | null): Assessment | null {
    if (!engineInstance) return null;
    try {
      const next = engineInstance.engine.assess({
        payload,
        nowMs: window.__QRAVN_TEST_NOW_MS__ ?? Date.now(),
        locale: nextLocale,
        ...(resolution ? { redirectResolution: resolution } : {}),
      });
      setAssessment(next);
      setEngineError(null);
      return next;
    } catch (error) {
      console.error('Safety analyser assessment failed', error);
      setAssessment(null);
      setEngineError('The WebAssembly safety analyser failed while checking this payload. No assessment can be given.');
      return null;
    }
  }

  // A fresh check from paste/scan always starts offline: discard any previously
  // expanded chain so one check's online result never bleeds into the next.
  function runCheck(payload: string) {
    if (!engineInstance) return;
    setLastPayload(payload);
    setRedirectResolution(null);
    setExpansionState('idle');
    assessWith(payload, locale, null);
  }

  // Back to the one thing this app is for. Nothing about the last check is kept.
  function scanAgain() {
    setAssessment(null);
    setLastPayload('');
    setRedirectResolution(null);
    setExpansionState('idle');
  }

  // The user explicitly asked to expand the scanned shortener. Send it to our
  // resolver, then re-run the check with the returned chain. Every documented
  // failure comes back as a resolution with a failure outcome, which the core
  // renders as a limitation, so it never reads as a clean result.
  async function handleExpand() {
    if (!assessment || !engineInstance || !effectiveResolver.available) return;
    const target = assessment.rawPayload;
    setExpansionState('resolving');
    try {
      const resolution = await effectiveResolver.resolve(target);
      setRedirectResolution(resolution);
      const next = assessWith(target, locale, resolution);
      setExpansionState(next ? 'idle' : 'error');
    } catch (error) {
      console.error('Redirect expansion failed', error);
      setExpansionState('error');
    }
  }

  useEffect(() => {
    if (assessment) resultRef.current?.focus();
  }, [assessment]);

  // Keep the document language in sync with the chosen locale. Norwegian copy
  // announced under lang="en" is a WCAG 3.1.1/3.1.2 failure that assistive tech
  // cannot recover from, and the static <html lang> only covers the default.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  function changeLocale(nextLocale: Locale) {
    const normalized = normaliseLocale(nextLocale);
    setLocale(normalized);
    storeLocale(normalized);
    // Re-assess in the new locale, preserving any expanded chain so switching
    // language does not silently drop the online result.
    if (lastPayload && engineInstance) assessWith(lastPayload, normalized, redirectResolution);
  }

  const online: OnlineExpansion = {
    available: effectiveResolver.available,
    state: expansionState,
    onExpand: () => void handleExpand(),
  };
  const busy = !engineInstance || Boolean(engineError);
  const reassurance = td('ui.reassurance', locale);
  const followLinks = td('ui.follow_links', locale);
  const privacy = td('ui.privacy_note', locale);
  const groups = ['ui.how_address', 'ui.how_content', 'ui.how_redirect'] as const;

  return (
    <div className="app">
      <AppBar locale={locale} onLocaleChange={changeLocale} />

      <main className="app-main">
        {engineInstance?.message ? <div className="dev-banner" role="status">{engineInstance.message}</div> : null}
        {engineError ? (
          <section className="panel engine-error" role="alert" aria-labelledby="engine-error-heading">
            <h2 id="engine-error-heading">{t('ui.engine_error', locale)}</h2>
            <p>{engineError}</p>
          </section>
        ) : null}

        {assessment ? (
          <>
            <h1 className="visually-hidden">{t('ui.result', locale)}</h1>
            <ResultPanel
              assessment={assessment}
              locale={locale}
              redirectResolution={redirectResolution}
              online={online}
              offlineMode={offlineMode}
              ref={resultRef}
            />
            <div className="scan-again">
              <button type="button" className="primary-action" onClick={scanAgain}>
                {t('ui.scan_again', locale)}
              </button>
            </div>
          </>
        ) : (
          <div className="task">
            <h1 className="tagline">{t('ui.tagline', locale)}</h1>
            <QrScanner onDecode={runCheck} locale={locale} disabled={busy} />
            <p className="reassurance">
              <strong>{reassurance.title}</strong>
              {reassurance.detail ? <span> {reassurance.detail}</span> : null}
            </p>
            <InputForm onSubmit={runCheck} locale={locale} disabled={busy} />
          </div>
        )}
      </main>

      <footer className="secondary" aria-label={t('ui.about', locale)}>
        {assessment ? null : (
          <section className="how" aria-labelledby="how-heading">
            {/* The number is the point of the product, so it is set as a number
                rather than buried in a sentence — and it reads the same in both
                languages. CHECK_COUNT is derived from the contract at build
                time, so this cannot drift from what the engine actually runs. */}
            <p className="how__tally" aria-hidden="true">
              {CHECK_COUNT}
            </p>
            <h2 id="how-heading">{t('ui.how_heading', locale)}</h2>
            <dl className="how__list">
              {groups.map((code) => {
                const group = td(code, locale);
                return (
                  <div key={code} className="how__item">
                    <dt>{group.title}</dt>
                    <dd>{group.detail}</dd>
                  </div>
                );
              })}
            </dl>
          </section>
        )}

        <details className="settings">
          <summary>{t('ui.settings', locale)}</summary>
          <div className="switch-row">
            <input
              id="follow-links-toggle"
              type="checkbox"
              role="switch"
              checked={!offlineMode}
              aria-checked={!offlineMode}
              aria-describedby="follow-links-description"
              onChange={(event) => setOfflineMode(!event.currentTarget.checked)}
            />
            <span className="switch-copy">
              <label className="switch-title" htmlFor="follow-links-toggle">
                {followLinks.title}
              </label>
              <span id="follow-links-description" className="switch-detail">
                {followLinks.detail}
              </span>
            </span>
          </div>
        </details>

        <p className="privacy-note">
          {privacy.detail} <a href="/privacy">{privacy.title}</a>
        </p>
      </footer>
    </div>
  );
}

export default App;
