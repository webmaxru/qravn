import { useEffect, useRef, useState } from 'react';
import './App.css';
import { InputForm } from './components/InputForm';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { QrScanner } from './components/QrScanner';
import { ResultPanel } from './components/ResultPanel';
import type { Assessment } from './contracts/assessment';
import { createEngine } from './engine/createEngine';
import { normaliseLocale, type Locale } from './engine/catalog';
import type { EngineInstance, SafetyEngine } from './engine/types';

declare global {
  interface Window {
    __QRRRGH_TEST_NOW_MS__?: number;
  }
}

interface AppProps {
  engineOverride?: SafetyEngine;
}

function App({ engineOverride }: AppProps) {
  const [locale, setLocale] = useState<Locale>('en');
  const [engineInstance, setEngineInstance] = useState<EngineInstance | null>(
    engineOverride ? { engine: engineOverride, mode: 'mock' } : null,
  );
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [lastPayload, setLastPayload] = useState('');
  const [engineError, setEngineError] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

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

  function assess(payload: string, nextLocale = locale) {
    if (!engineInstance) return;
    setLastPayload(payload);
    try {
      setAssessment(engineInstance.engine.assess({ payload, nowMs: window.__QRRRGH_TEST_NOW_MS__ ?? Date.now(), locale: nextLocale }));
      setEngineError(null);
    } catch (error) {
      console.error('Safety analyser assessment failed', error);
      setAssessment(null);
      setEngineError('The WebAssembly safety analyser failed while checking this payload. No assessment can be given.');
    }
  }

  useEffect(() => {
    if (assessment) resultRef.current?.focus();
  }, [assessment]);

  function changeLocale(nextLocale: Locale) {
    const normalized = normaliseLocale(nextLocale);
    setLocale(normalized);
    if (lastPayload && engineInstance) assess(lastPayload, normalized);
  }

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

      <QrScanner onDecode={assess} disabled={!engineInstance || Boolean(engineError)} />
      <InputForm onSubmit={assess} disabled={!engineInstance || Boolean(engineError)} />

      {assessment ? (
        <ResultPanel assessment={assessment} locale={locale} ref={resultRef} />
      ) : (
        <section className="panel empty-state" aria-live="polite">
          <h2>Ready when you paste</h2>
          <p>The destination is never fetched, previewed, or opened during analysis.</p>
        </section>
      )}

      <section className="panel privacy" aria-labelledby="privacy-heading">
        <h2 id="privacy-heading">About / privacy</h2>
        <p>Everything in this prototype runs locally in the browser. There is no analytics, telemetry, tracking pixel, link preview, favicon lookup, or backend API call.</p>
      </section>
    </main>
  );
}

export default App;
