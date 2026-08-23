import type { UrlBreakdown } from '../contracts/assessment';
import { type Locale } from '../engine/catalog';
import { t, td } from '../lib/uiText';

interface UrlBreakdownViewProps {
  url: UrlBreakdown;
  locale: Locale;
}

export function UrlBreakdownView({ url, locale }: UrlBreakdownViewProps) {
  const none = t('ui.field_none', locale);
  const credential = td('ui.credential_note', locale);

  return (
    <section id="address-details" className="panel destination" aria-labelledby="destination-heading">
      <h2 id="destination-heading">{t('ui.field_host', locale)}</h2>
      {url.hasCredentials ? (
        <div className="credential-warning" role="note">
          <strong>{credential.title}</strong> {credential.detail}
        </div>
      ) : null}
      {/* One line answers the question almost everyone actually has. The rest of
          the anatomy is evidence for the few who want it, so it sits behind a
          disclosure instead of in front of everyone. */}
      <p className="destination-value">{url.host}</p>
      <details className="breakdown">
        <summary>{t('ui.breakdown_heading', locale)}</summary>
        <dl className="breakdown-grid">
          <div className="destination-domain">
            <dt>{t('ui.field_domain', locale)}</dt>
            <dd>{url.registrableDomain ?? none}</dd>
          </div>
          <div>
            <dt>{t('ui.field_subdomains', locale)}</dt>
            <dd>{url.subdomains.length ? url.subdomains.join(' · ') : none}</dd>
          </div>
          <div>
            <dt>{t('ui.field_scheme', locale)}</dt>
            <dd>{url.scheme}</dd>
          </div>
          <div>
            <dt>{t('ui.field_path', locale)}</dt>
            <dd>{url.path || '/'}</dd>
          </div>
          <div>
            <dt>{t('ui.field_query', locale)}</dt>
            <dd>{url.query || none}</dd>
          </div>
        </dl>
      </details>
    </section>
  );
}
