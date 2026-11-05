import React, { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  CollectionRunRecord,
  IntegrationStatusRecord,
  NewsSourceRecord,
} from '../services/api';
import { apiService } from '../services/api';

const cardStyle: React.CSSProperties = {
  background: '#fff', border: '1px solid var(--pz-border)', borderRadius: 8,
  padding: 18, display: 'flex', flexDirection: 'column', gap: 12,
};

export const NewsSourceMonitorView: React.FC = () => {
  const [sources, setSources] = useState<NewsSourceRecord[]>([]);
  const [runs, setRuns] = useState<CollectionRunRecord[]>([]);
  const [channels, setChannels] = useState<IntegrationStatusRecord | null>(null);
  const [name, setName] = useState('');
  const [feedUrl, setFeedUrl] = useState('');
  const [basis, setBasis] = useState('Publisher-provided public RSS feed');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const [nextSources, nextRuns, nextChannels] = await Promise.all([
        apiService.fetchNewsSources(), apiService.fetchCollectionRuns(), apiService.fetchIntegrationStatus(),
      ]);
      setSources(nextSources);
      setRuns(nextRuns);
      setChannels(nextChannels);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect to the newsroom API.');
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const addSource = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setNotice(''); setError('');
    try {
      await apiService.addNewsSource({ name, feedUrl, basis, pollIntervalMinutes: 15 });
      setName(''); setFeedUrl('');
      setNotice('RSS source added. It remains a source of unverified leads.');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add source.');
    } finally { setBusy(false); }
  };

  const collect = async (id?: number) => {
    setBusy(true); setNotice(''); setError('');
    try {
      await apiService.collectNewsSources(id);
      setNotice('Collection queued. This page refreshes source status and run results every five seconds.');
      window.setTimeout(() => void refresh(), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start collection.');
    } finally { setBusy(false); }
  };

  const toggle = async (source: NewsSourceRecord) => {
    setBusy(true); setError('');
    try { await apiService.setNewsSourceActive(source.id, !source.active); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not update source.'); }
    finally { setBusy(false); }
  };

  const channelRows = channels ? [
    ['WhatsApp Cloud API', channels.whatsapp.configured, channels.whatsapp.webhookPath,
      'Needs Meta app secret, access token, phone number ID, and verify token.'],
    ['Telegram Bot API', channels.telegram.configured, channels.telegram.webhookPath,
      channels.telegram.publicAlertsConfigured ? 'Inbound reports and approved alert broadcast configured.' : 'Inbound requires a bot token and webhook secret; public alert broadcast also needs a destination chat ID.'],
    ['Africa’s Talking USSD/SMS', channels.ussd.configured, channels.ussd.webhookPath,
      'Needs provider credentials and a provisioned service code/callback URL.'],
  ] as const : [];

  return (
    <main className="pz-workspace-main" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <header>
        <h1 className="pz-page-title">Sources &amp; channels</h1>
        <p className="pz-page-subtitle">Manage permitted public feeds and check whether reporting channels have server credentials.</p>
      </header>

      {error && <div role="alert" style={{ ...cardStyle, borderColor: '#b53d38', color: '#8e2e29' }}>{error}</div>}
      {notice && <div role="status" style={{ ...cardStyle, color: '#145438' }}>{notice}</div>}

      <section style={cardStyle} aria-labelledby="channel-status-heading">
        <h2 id="channel-status-heading" className="pz-section-heading">Channel connection status</h2>
        {!channels ? <p>Checking backend configuration…</p> : channelRows.map(([label, configured, path, help]) => (
          <div key={label} style={{ borderTop: '1px solid var(--pz-border)', paddingTop: 12,
            display: 'grid', gridTemplateColumns: 'minmax(150px, 1fr) auto', gap: 8, alignItems: 'center' }}>
            <strong>{label}</strong>
            <span aria-label={configured ? 'Configured' : 'Not configured'} style={{ color: configured ? '#145438' : '#94680a', fontWeight: 700 }}>
              {configured ? 'Configured' : 'Needs setup'}
            </span>
            <small style={{ color: 'var(--pz-muted)', gridColumn: '1 / -1' }}>{help}</small>
            <code style={{ gridColumn: '1 / -1', overflowWrap: 'anywhere' }}>{path}</code>
          </div>
        ))}
      </section>

      <section style={cardStyle} aria-labelledby="rss-heading">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <h2 id="rss-heading" className="pz-section-heading">Zimbabwe publisher RSS feeds</h2>
            <p className="pz-page-subtitle">Free feed collection; no article-page crawling. Entries are filtered for road-safety leads and stay unverified.</p>
          </div>
          <button className="pz-btn-primary" type="button" disabled={busy || !sources.some((s) => s.active)} onClick={() => void collect()}>
            Collect active feeds
          </button>
        </div>

        <form onSubmit={addSource} style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <label style={{ display: 'grid', gap: 5 }}>Publisher name
            <input className="pz-input" required minLength={2} maxLength={160} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bulawayo24" />
          </label>
          <label style={{ display: 'grid', gap: 5 }}>Publisher RSS/Atom URL
            <input className="pz-input" required type="url" value={feedUrl} onChange={(e) => setFeedUrl(e.target.value)} placeholder="https://publisher.co.zw/feed/" />
          </label>
          <label style={{ display: 'grid', gap: 5 }}>Collection permission/basis
            <input className="pz-input" required minLength={8} maxLength={500} value={basis} onChange={(e) => setBasis(e.target.value)} />
          </label>
          <div style={{ display: 'flex', alignItems: 'end' }}>
            <button className="pz-btn-secondary" type="submit" disabled={busy}>Add source</button>
          </div>
        </form>
        <p className="pz-page-subtitle">Accepted feed domains: Bulawayo24, NewsDay, Chronicle, The Herald, New Zimbabwe, ZimEye, Zimbabwe Independent, and Daily News. Feed URLs must be HTTPS and publicly reachable.</p>

        {sources.length === 0 ? <p>No sources registered yet. Editors can add a publisher-provided feed above.</p> : (
          <div style={{ display: 'grid', gap: 10 }}>
            {sources.map((source) => (
              <article key={source.id} style={{ border: '1px solid var(--pz-border)', borderRadius: 6, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div><strong>{source.name}</strong> <small>({source.publisherDomain}) · {source.active ? 'Active' : 'Paused'}</small>
                    <div><a href={source.feedUrl} target="_blank" rel="noreferrer">Open registered feed</a></div>
                    <small>{source.lastPolledAt ? `Last checked ${new Date(source.lastPolledAt).toLocaleString()}` : 'Not checked yet'}{source.lastError ? ` · ${source.lastError}` : ''}</small>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button className="pz-btn-secondary" type="button" disabled={busy || !source.active} onClick={() => void collect(source.id)}>Collect now</button>
                    <button className="pz-btn-secondary" type="button" disabled={busy} onClick={() => void toggle(source)}>{source.active ? 'Pause' : 'Activate'}</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section style={cardStyle} aria-labelledby="collection-history-heading">
        <h2 id="collection-history-heading" className="pz-section-heading">Collection history</h2>
        {runs.length === 0 ? <p>No collection attempts yet.</p> : (
          <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead><tr>{['Time', 'Source', 'Status', 'Fetched', 'New leads', 'Duplicates', 'Skipped'].map((x) => <th key={x} style={{ padding: 8, borderBottom: '1px solid var(--pz-border)' }}>{x}</th>)}</tr></thead>
            <tbody>{runs.map((run) => <tr key={run.id}>
              <td style={{ padding: 8 }}>{new Date(run.startedAt).toLocaleString()}</td><td>{run.source}</td><td>{run.status}{run.error ? ` · ${run.error}` : ''}</td>
              <td>{run.fetched}</td><td>{run.created}</td><td>{run.duplicates}</td><td>{run.skipped}</td>
            </tr>)}</tbody>
          </table></div>
        )}
      </section>
    </main>
  );
};
