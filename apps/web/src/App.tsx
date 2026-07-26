import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { InputForm } from './components/InputForm';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { QrScanner } from './components/QrScanner';
import { ResultPanel } from './components/ResultPanel';
import type { ExpansionState, OnlineExpansion } from './components/RedirectPanel';
import type { Assessment, RedirectResolution } from './contracts/assessment';
import { createEngine } from './engine/createEngine';
import { normaliseLocale, type Locale } from './engine/catalog';
import type { EngineInstance, SafetyEngine } from './engine/types';
import { isOnlineModeAvailable, resolveRedirect } from './lib/resolverClient';

declare global {
  interface Window {
    __QRRRGH_TEST_NOW_MS__?: number;
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

function App({ engineOverride, resolverOverride }: AppProps) {
  const [locale, setLocale] = useState<Locale>('en');
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
  const resultRef = useRef<HTMLDivElement | null>(null);

  const resolver = useMemo<AppResolver>(
    () => resolverOverride ?? { available: isOnlineModeAvailable(), resolve: (url) => resolveRedirect(url) },
    [resolverOverride],
  );

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
        nowMs: window.__QRRRGH_TEST_NOW_MS__ ?? Date.now(),
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

  // The user explicitly asked to expand the scanned shortener. Send it to our
  // resolver, then re-run the check with the returned chain. Every documented
  // failure comes back as a resolution with a failure outcome, which the core
  // renders as a limitation, so it never reads as a clean result.
  async function handleExpand() {
    if (!assessment || !engineInstance) return;
    const target = assessment.rawPayload;
    setExpansionState('resolving');
    try {
      const resolution = await resolver.resolve(target);
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
    // Re-assess in the new locale, preserving any expanded chain so switching
    // language does not silently drop the online result.
    if (lastPayload && engineInstance) assessWith(lastPayload, normalized, redirectResolution);
  }

  const online: OnlineExpansion = {
    available: resolver.available,
    state: expansionState,
    onExpand: () => void handleExpand(),
  };

  return (
    <main className="app-shell">
      <header className="hero-header">
        <div>
          <p className="eyebrow">qrrrgh for Norway</p>
          <h1>Check a QR link without opening it</h1>
          <p>Paste a suspicious link or QR payload. The check runs locally in your browser and explains the evidence before any external action.</p>
        </div>
        <LanguageSwitcher locale={locale} onChange={changeLocale} />
      </header>

      {engineInstance?.message ? <div className="dev-banner" role="status">{engineInstance.message}</div> : null}
      {engineError ? (
        <section className="panel engine-error" role="alert" aria-labelledby="engine-error-heading">
          <h2 id="engine-error-heading">Analyser unavailable</h2>
          <p>{engineError}</p>
        </section>
      ) : null}

      <QrScanner onDecode={runCheck} disabled={!engineInstance || Boolean(engineError)} />
      <InputForm onSubmit={runCheck} disabled={!engineInstance || Boolean(engineError)} />

      {assessment ? (
        <ResultPanel assessment={assessment} locale={locale} redirectResolution={redirectResolution} online={online} ref={resultRef} />
      ) : (
        <section className="panel empty-state" aria-live="polite">
          <h2>Ready when you paste</h2>
          <p>The destination is never fetched, previewed, or opened during analysis.</p>
        </section>
      )}

      <section className="panel privacy" aria-labelledby="privacy-heading">
        <h2 id="privacy-heading">About / privacy</h2>
        <p>Everything in this prototype runs locally in the browser. There is no analytics, telemetry, tracking pixel, link preview, favicon lookup, or backend API call — unless you explicitly ask us to expand a shortened link, which sends only that link to our own resolver so your device never contacts it.</p>
      </section>
    </main>
  );
}

export default App;
