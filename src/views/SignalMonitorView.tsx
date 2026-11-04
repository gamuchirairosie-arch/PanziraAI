import React, { useMemo, useState } from 'react';
import { usePanzira } from '../context/PanziraContext';
import { useCardFocus, FocusedCardData } from '../context/CardFocusContext';
import { SignalReport } from '../types';

type MonitorFilter = 'all' | 'public' | 'opt-in';

const OPEN_PAGE_SIZE = 10;

const toneClass = (c: 'green' | 'gold' | 'red') =>
  c === 'green' ? 'is-green' : c === 'red' ? 'is-red' : 'is-gold';

export const SignalMonitorView: React.FC = () => {
  const {
    signals,
    newsroomSearch,
    setNewsroomSearch,
    totalSignalsCount,
    publicSignalsCount,
    optInSignalsCount,
    awaitingReviewCount,
    autoPublishedByAiCount,
    setSelectedMonitorId,
    navigateNewsroom,
  } = usePanzira();

  const { focusCard } = useCardFocus();

  const [visibilityFilter, setVisibilityFilter] = useState<MonitorFilter>('all');
  const [showAllOpen, setShowAllOpen] = useState(false);
  const [showClosed, setShowClosed] = useState(false);

  const filteredSignals = useMemo(() => {
    const q = newsroomSearch.trim().toLowerCase();
    return signals.filter((sig) => {
      if (visibilityFilter === 'public' && sig.visibility !== 'public') return false;
      if (visibilityFilter === 'opt-in' && sig.visibility !== 'opt-in') return false;
      if (!q) return true;
      return (
        sig.title.toLowerCase().includes(q) ||
        sig.subtitle.toLowerCase().includes(q) ||
        sig.corridor.toLowerCase().includes(q) ||
        sig.roadArea.toLowerCase().includes(q) ||
        sig.originalQuote.toLowerCase().includes(q) ||
        (sig.draftEnglishTranslation || '').toLowerCase().includes(q) ||
        sig.sourceChannelLabel.toLowerCase().includes(q) ||
        sig.id.toLowerCase().includes(q)
      );
    });
  }, [signals, visibilityFilter, newsroomSearch]);

  // Work that still needs a person first; finished items are tucked away
  const openSignals = useMemo(
    () => filteredSignals.filter((s) => s.workflowStatus === 'lead' || s.workflowStatus === 'verifying'),
    [filteredSignals]
  );
  const closedSignals = useMemo(
    () => filteredSignals.filter((s) => s.workflowStatus === 'verified' || s.workflowStatus === 'rejected'),
    [filteredSignals]
  );
  const visibleOpen = showAllOpen ? openSignals : openSignals.slice(0, OPEN_PAGE_SIZE);

  const openSignal = (sig: SignalReport) => {
    setSelectedMonitorId(sig.id);
    focusCard({
      type: 'signal',
      signalId: sig.id,
      title: sig.title,
      subtitle: sig.subtitle,
      categoryLabel: 'INCOMING SIGNAL LEAD',
      badge: sig.monitorStatusLabel,
      badgeColor:
        sig.monitorStatusColor === 'green' ? 'green' : sig.monitorStatusColor === 'red' ? 'red' : 'amber',
    });
  };

  const stats: Array<{
    key: string;
    value: string;
    label: string;
    tone?: 'amber' | 'green';
    focus: FocusedCardData;
  }> = [
    {
      key: 'received',
      value: String(totalSignalsCount).padStart(2, '0'),
      label: 'Signals received',
      focus: {
        type: 'metric',
        title: 'Signals Received in Intake',
        subtitle: 'All monitored incoming public feeds, authorized posts, and citizen reports',
        categoryLabel: 'MONITORING METRIC',
        metricValue: String(totalSignalsCount).padStart(2, '0'),
        metricDescription: `${publicSignalsCount} public feed items • ${optInSignalsCount} citizen opt-in submissions`,
        description:
          'Total number of incoming road safety leads structured for journalistic inspection across Bulawayo arterial corridors. Includes both authorized public feeds and direct citizen submissions.',
        metadata: [
          { label: 'Public Feed Leads', value: `${publicSignalsCount} items` },
          { label: 'Citizen Opt-in Tips', value: `${optInSignalsCount} items` },
          { label: 'Corridors Monitored', value: 'Harare Rd (A5), Khami Rd, Esigodini Rd' },
          { label: 'Autonomous AI Publishing', value: 'Disabled (Human gate required)', color: 'var(--pz-primary-green)' },
        ],
        actions: [{ label: 'Open Signal Inbox →', onClick: () => navigateNewsroom('inbox'), variant: 'primary' }],
      },
    },
    {
      key: 'awaiting',
      value: String(awaitingReviewCount).padStart(2, '0'),
      label: 'Awaiting corroboration',
      tone: 'amber',
      focus: {
        type: 'metric',
        title: 'Awaiting Editorial Corroboration',
        subtitle: 'Unverified hazard leads currently queued for independent verification',
        categoryLabel: 'EDITORIAL QUEUE',
        metricValue: String(awaitingReviewCount).padStart(2, '0'),
        metricDescription: 'Submissions held until all 4 verification criteria are satisfied',
        description:
          'These signals contain reported collisions, road surface damages, or flooding that have not yet achieved independent confirmation. Journalists must cross-reference at least one separate eyewitness, municipal log, or field reporter before publication.',
        metadata: [
          { label: '4-Point Check Status', value: 'In Progress' },
          { label: 'Graphic Content Safety', value: 'Restricted from public display' },
          { label: 'Vernacular Translation', value: 'English drafts prepared for Shona/Ndebele tips' },
        ],
        actions: [{ label: 'Open Signal Inbox Queue →', onClick: () => navigateNewsroom('inbox'), variant: 'primary' }],
      },
    },
    {
      key: 'patterns',
      value: '03',
      label: 'Corridor patterns',
      focus: {
        type: 'metric',
        title: 'Possible Corridor Patterns',
        subtitle: 'Clustered hazard reports along monitored Bulawayo transit routes',
        categoryLabel: 'HOTSPOT SCREENING',
        metricValue: '03',
        metricDescription: 'Harare Road (A5), Khami Road, Esigodini Road',
        description:
          'Corridor screening scores derived from clustered citizen reports. These patterns serve as investigative leads for newsroom field teams and transport dispatchers, rather than automated crash forecasts.',
        metadata: [
          { label: 'Corridor 1', value: 'Harare Road (A5) · High Priority Watch' },
          { label: 'Corridor 2', value: 'Khami Road · Moderate Priority Watch' },
          { label: 'Corridor 3', value: 'Esigodini Road · Moderate Priority Watch' },
        ],
        actions: [{ label: 'Open Hotspot Intelligence →', onClick: () => navigateNewsroom('hotspots'), variant: 'primary' }],
      },
    },
    {
      key: 'autopub',
      value: String(autoPublishedByAiCount).padStart(2, '0'),
      label: 'Auto-published',
      tone: 'green',
      focus: {
        type: 'metric',
        title: 'Zero Autonomous AI Publications',
        subtitle: 'Strict safety invariant: AI cannot publish road safety alerts directly',
        categoryLabel: 'EDITORIAL SAFEGUARD',
        metricValue: String(autoPublishedByAiCount).padStart(2, '0'),
        metricDescription: '100% human editor sign-off enforced',
        description:
          'Panzira AI adheres to an uncompromised human-in-the-loop architecture. While AI models generate candidate categories, geo-corridor suggestions, and translations, public safety alerts cannot reach the live map without an accredited editor signing off on all 4 corroboration points.',
        metadata: [
          { label: 'Autonomous Releases', value: '0 (Strictly Blocked)', color: 'var(--pz-primary-green)' },
          { label: 'Editor Verification Gate', value: 'Mandatory 4-Point Corroboration' },
          { label: 'Accountability Audit', value: 'Logged with Africa/Harare timestamp & editor ID' },
        ],
      },
    },
  ];

  const renderRow = (sig: SignalReport) => (
    <li key={sig.id}>
      <button
        type="button"
        className={`pz-row pz-expandable-card ${sig.workflowStatus === 'verified' || sig.workflowStatus === 'rejected' ? 'is-closed' : ''}`}
        onClick={() => openSignal(sig)}
        title={`${sig.id} · open details`}
      >
        <span className={`pz-row-dot ${toneClass(sig.monitorStatusColor)}`} aria-hidden="true" />
        <span className="pz-row-main">
          <span className="pz-row-title">{sig.title}</span>
          <span className="pz-row-meta">
            {sig.sourceChannelLabel}
            {sig.landmark ? ` · ${sig.landmark}` : ''}
          </span>
        </span>
        <span className={`pz-row-status ${toneClass(sig.monitorStatusColor)}`}>{sig.monitorStatusLabel}</span>
        <span className="pz-row-time">{sig.timeShort}</span>
        <span className="pz-row-chev" aria-hidden="true">›</span>
      </button>
    </li>
  );

  return (
    <div className="pz-monitor">
      <div>
        <h1 className="pz-page-title">Signal monitor</h1>
        <p className="pz-page-subtitle">Incoming reports waiting for editorial review.</p>
      </div>

      {/* One slim line instead of four cards */}
      <section className="pz-stat-strip" aria-label="Signal monitor summary">
        {stats.map((s) => (
          <button
            key={s.key}
            type="button"
            className="pz-stat"
            onClick={() => focusCard(s.focus)}
            title="Click for details"
          >
            <span className={`pz-stat-value ${s.tone ? `is-${s.tone}` : ''}`}>{s.value}</span>
            <span className="pz-stat-label">{s.label}</span>
          </button>
        ))}
      </section>

      <section aria-label="Incoming signals">
        <div className="pz-list-head">
          <h2 className="pz-subsection-heading">
            Needs review <span className="pz-count">{openSignals.length}</span>
          </h2>

          <div className="pz-filter-tabs-inline" role="tablist" aria-label="Filter intake channel">
            {(['all', 'public', 'opt-in'] as MonitorFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={visibilityFilter === f}
                className={`pz-filter-tab-text ${visibilityFilter === f ? 'is-active' : ''}`}
                onClick={() => setVisibilityFilter(f)}
              >
                {f === 'all' ? 'All' : f === 'public' ? 'Public' : 'Opt-in'}
              </button>
            ))}
          </div>
        </div>

        {filteredSignals.length === 0 ? (
          <div className="pz-card-panel">
            <p style={{ color: 'var(--pz-muted)', fontSize: '13.5px', margin: 0 }}>
              No signals match your current filter or search.
            </p>
            <button
              type="button"
              className="pz-btn-secondary"
              style={{ minHeight: '36px', fontSize: '12.5px', alignSelf: 'flex-start', marginTop: '10px' }}
              onClick={() => {
                setVisibilityFilter('all');
                setNewsroomSearch('');
              }}
            >
              Reset filter & search
            </button>
          </div>
        ) : (
          <>
            {openSignals.length === 0 ? (
              <p className="pz-list-empty">Nothing is waiting for review.</p>
            ) : (
              <ul className="pz-row-list">{visibleOpen.map(renderRow)}</ul>
            )}

            {openSignals.length > OPEN_PAGE_SIZE && (
              <button type="button" className="pz-link-btn" onClick={() => setShowAllOpen((v) => !v)}>
                {showAllOpen ? 'Show fewer' : `Show all ${openSignals.length}`}
              </button>
            )}

            {closedSignals.length > 0 && (
              <div className="pz-closed-group">
                <button
                  type="button"
                  className="pz-link-btn"
                  aria-expanded={showClosed}
                  onClick={() => setShowClosed((v) => !v)}
                >
                  {showClosed ? '▾' : '▸'} Verified & archived ({closedSignals.length})
                </button>
                {showClosed && <ul className="pz-row-list">{closedSignals.map(renderRow)}</ul>}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
};
