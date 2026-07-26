import type { UrlBreakdown } from '../contracts/assessment';

interface UrlBreakdownViewProps {
  url: UrlBreakdown;
}

export function UrlBreakdownView({ url }: UrlBreakdownViewProps) {
  return (
    <section className="panel" aria-labelledby="breakdown-heading">
      <h2 id="breakdown-heading">Payload breakdown</h2>
      {url.hasCredentials ? (
        <div className="credential-warning" role="note">
          <strong>The text before @ is not the destination.</strong>
          <span> Browsers connect to <b>{url.host}</b>, not to <code>{url.username}</code>.</span>
        </div>
      ) : null}
      <dl className="breakdown-grid">
        <div>
          <dt>Scheme</dt>
          <dd>{url.scheme}</dd>
        </div>
        <div className="destination-host">
          <dt>Real host</dt>
          <dd>{url.host}</dd>
        </div>
        <div className="destination-domain">
          <dt>Registered domain</dt>
          <dd>{url.registrableDomain ?? 'Unknown'}</dd>
        </div>
        <div>
          <dt>Subdomains</dt>
          <dd>{url.subdomains.length ? url.subdomains.join(' · ') : 'None'}</dd>
        </div>
        <div>
          <dt>Path</dt>
          <dd>{url.path || '/'}</dd>
        </div>
        <div>
          <dt>Query</dt>
          <dd>{url.query || 'None'}</dd>
        </div>
      </dl>
    </section>
  );
}
