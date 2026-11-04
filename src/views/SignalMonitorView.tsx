import React, { useEffect, useMemo, useState } from 'react';
import { EvidencePhotoFrame } from '../components/CroppedFigmaMedia';
import { usePanzira } from '../context/PanziraContext';

type MonitorFilter = 'all' | 'public' | 'opt-in';

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
    selectedMonitorId,
    setSelectedMonitorId,
    navigateNewsroom,
    revealedGraphicIds,
    toggleGraphicReveal,
  } = usePanzira();

  const [visibilityFilter, setVisibilityFilter] = useState<MonitorFilter>('all');

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

  // Keep selectedMonitorId synchronized with the active filtered list
  useEffect(() => {
    if (filteredSignals.length === 0) return;
    const existsInFiltered = filteredSignals.some((s) => s.id === selectedMonitorId);
    if (!existsInFiltered) {
      setSelectedMonitorId(filteredSignals[0].id);
    }
  }, [filteredSignals, selectedMonitorId, setSelectedMonitorId]);

  const selectedSignal = useMemo(() => {
    if (filteredSignals.length === 0) return null;
    return filteredSignals.find((s) => s.id === selectedMonitorId) || filteredSignals[0];
  }, [filteredSignals, selectedMonitorId]);

  const colorClass = (c: 'green' | 'gold' | 'red') =>
    c === 'green' ? 'pz-color-green' : c === 'red' ? 'pz-color-red' : 'pz-color-gold';

  const pipelineSteps = [
    {
      num: '01',
      stage: 1,
      title: 'Received',
      desc: 'Captured with source channel and intake timestamp',
    },
    {
      num: '02',
      stage: 2,
      title: 'AI extracted',
      desc: 'Draft translation, category suggestion, and deduplication',
    },
    {
      num: '03',
      stage: 3,
      title: 'Corroboration',
      desc: 'Requires independent evidence and exact landmark check',
    },
    {
      num: '04',
      stage: 4,
      title: 'Editor gate',
      desc: 'Only a human editor can verify or publish a warning',
    },
  ] as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Page Title */}
      <div>
        <h1 className="pz-page-title">Signal monitor</h1>
        <p className="pz-page-subtitle">
          Public road-hazard posts and opt-in citizen submissions structured for editorial
          verification
        </p>
      </div>

      {/* 4 Metric Cards */}
      <section className="pz-metrics-grid-4" aria-label="Signal monitor summary metrics">
        <div className="pz-metric-card">
          <span className="pz-metric-value">
            {String(totalSignalsCount).padStart(2, '0')}
          </span>
          <span className="pz-metric-label">Signals received</span>
          <span style={{ fontSize: '12.5px', color: 'var(--pz-muted)' }}>
            {publicSignalsCount} public • {optInSignalsCount} opt-in
          </span>
        </div>

        <button
          type="button"
          className="pz-metric-card"
          style={{ textAlign: 'left', cursor: 'pointer' }}
          onClick={() => navigateNewsroom('inbox')}
          title="Open Journalist Signal Inbox"
        >
          <span className="pz-metric-value" style={{ color: 'var(--pz-amber-text)' }}>
            {String(awaitingReviewCount).padStart(2, '0')}
          </span>
          <span className="pz-metric-label">Awaiting corroboration</span>
          <span style={{ fontSize: '12.5px', color: 'var(--pz-muted)' }}>
            Requires human check
          </span>
        </button>

        <button
          type="button"
          className="pz-metric-card"
          style={{ textAlign: 'left', cursor: 'pointer' }}
          onClick={() => navigateNewsroom('hotspots')}
          title="View Hotspot Intelligence"
        >
          <span className="pz-metric-value">03</span>
          <span className="pz-metric-label">Possible corridor patterns</span>
          <span style={{ fontSize: '12.5px', color: 'var(--pz-muted)' }}>
            Leads, not confirmed
          </span>
        </button>

        <div className="pz-metric-card">
          <span className="pz-metric-value">
            {String(autoPublishedByAiCount).padStart(2, '0')}
          </span>
          <span className="pz-metric-label">Auto-published by AI</span>
          <span style={{ fontSize: '12.5px', color: 'var(--pz-primary-green)', fontWeight: 600 }}>
            Human gate required
          </span>
        </div>
      </section>

      {/* Verification & Source Provenance Notice */}
      <div className="pz-notice-box" style={{ borderRadius: '6px' }}>
        <p style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--pz-text)' }}>
          Demo data · All posts begin as unverified leads
        </p>
        <p style={{ fontSize: '13px', color: 'var(--pz-muted)' }}>
          Publicly shared Facebook/Instagram links, authorized pages and user-submitted
          WhatsApp/web reports are structured to assist journalists, then held for human
          verification. Private WhatsApp groups are never scraped; no live social feeds or scraping
          services are connected in this demo.
        </p>
      </div>

      {/* 3-Column Triage Workspace */}
      <div className="pz-triage-grid">
        {/* =================================================================
            COLUMN 01: INCOMING SIGNALS
            ================================================================= */}
        <section className="pz-triage-col" aria-label="Incoming signals list">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap',
            }}
          >
            <h2 className="pz-subsection-heading">Incoming signals</h2>

            <div className="pz-filter-tabs-inline" role="tablist" aria-label="Filter intake channel">
              <button
                type="button"
                role="tab"
                aria-selected={visibilityFilter === 'all'}
                className={`pz-filter-tab-text ${visibilityFilter === 'all' ? 'is-active' : ''}`}
                onClick={() => setVisibilityFilter('all')}
              >
                All
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={visibilityFilter === 'public'}
                className={`pz-filter-tab-text ${visibilityFilter === 'public' ? 'is-active' : ''}`}
                onClick={() => setVisibilityFilter('public')}
              >
                Public
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={visibilityFilter === 'opt-in'}
                className={`pz-filter-tab-text ${visibilityFilter === 'opt-in' ? 'is-active' : ''}`}
                onClick={() => setVisibilityFilter('opt-in')}
              >
                Opt-in
              </button>
            </div>
          </div>

          {filteredSignals.length === 0 ? (
            <div className="pz-card-panel">
              <p style={{ color: 'var(--pz-muted)', fontSize: '13.5px' }}>
                No incoming demo signals match your current filter or search query.
              </p>
              <button
                type="button"
                className="pz-btn-secondary"
                style={{ minHeight: '36px', fontSize: '12.5px', alignSelf: 'flex-start' }}
                onClick={() => {
                  setVisibilityFilter('all');
                  setNewsroomSearch('');
                }}
              >
                Reset filter & search
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredSignals.map((sig) => {
                const isSelected = selectedSignal?.id === sig.id;
                return (
                  <button
                    key={sig.id}
                    type="button"
                    className={`pz-signal-card ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => setSelectedMonitorId(sig.id)}
                    aria-pressed={isSelected}
                  >
                    <div className="pz-signal-meta-row">
                      <span
                        className={`pz-source-tag ${
                          sig.workflowStatus === 'verified'
                            ? 'pz-color-green'
                            : colorClass(sig.sourceBadgeColor)
                        }`}
                      >
                        {sig.sourceChannelLabel}
                      </span>
                      <span style={{ color: 'var(--pz-muted)', fontWeight: 500 }}>
                        {sig.timeShort}
                      </span>
                    </div>

                    <div className="pz-signal-card-title">{sig.title}</div>
                    <div className="pz-signal-card-sub">{sig.subtitle}</div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: '2px',
                      }}
                    >
                      <span
                        className={`pz-signal-status-dot ${colorClass(sig.monitorStatusColor)}`}
                      >
                        • {sig.monitorStatusLabel}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--pz-muted)' }}>{sig.id}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* =================================================================
            COLUMN 02 & 03: SELECTED SIGNAL OR EMPTY FILTER STATE
            ================================================================= */}
        {!selectedSignal ? (
          <section
            className="pz-card-panel"
            style={{ gridColumn: 'span 2', padding: '24px' }}
            aria-live="polite"
          >
            <h2 className="pz-subsection-heading">No matching signal to display</h2>
            <p style={{ fontSize: '14px', color: 'var(--pz-muted)' }}>
              Adjust the intake channel filter or clear the search input to inspect incoming
              submissions.
            </p>
          </section>
        ) : (
          <>
            {/* COLUMN 02: SELECTED SIGNAL */}
            <section className="pz-triage-col" aria-label="Selected signal details">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  minHeight: '34px',
                }}
              >
                <h2 className="pz-subsection-heading">Selected signal</h2>
                <span className="pz-badge pz-badge-neutral">{selectedSignal.id}</span>
              </div>

              {/* Raw Message + Optional Shona/Ndebele Draft Translation */}
              <div className="pz-raw-message-card">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '8px',
                    flexWrap: 'wrap',
                  }}
                >
                  <span className="pz-field-label" style={{ color: 'var(--pz-primary-green)' }}>
                    Original message · {selectedSignal.originalLanguage}
                  </span>
                  <span
                    className={`pz-badge ${
                      selectedSignal.visibility === 'opt-in'
                        ? 'pz-badge-verified'
                        : 'pz-badge-amber'
                    }`}
                  >
                    {selectedSignal.visibility === 'opt-in'
                      ? 'Opt-in submission'
                      : 'Public / authorized source'}
                  </span>
                </div>

                <p className="pz-raw-quote">{selectedSignal.originalQuote}</p>

                {selectedSignal.draftEnglishTranslation && (
                  <div className="pz-translation-box">
                    <span className="pz-field-label" style={{ color: 'var(--pz-demo-text)' }}>
                      Draft English translation · Human review required
                    </span>
                    <p style={{ fontSize: '13.5px', color: 'var(--pz-text)', fontStyle: 'italic' }}>
                      {selectedSignal.draftEnglishTranslation}
                    </p>
                  </div>
                )}

                <p style={{ fontSize: '12.5px', color: 'var(--pz-muted)' }}>
                  {selectedSignal.sourceProvenanceNote}
                </p>

                {selectedSignal.evidenceLink && (
                  <p
                    style={{
                      fontSize: '12.5px',
                      color: 'var(--pz-primary-green)',
                      wordBreak: 'break-all',
                    }}
                  >
                    Submitted reference URL: {selectedSignal.evidenceLink}
                  </p>
                )}
              </div>

              {/* AI-Structured Evidence Panel */}
              <div className="pz-card-panel">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '8px',
                    flexWrap: 'wrap',
                  }}
                >
                  <h3 className="pz-card-title">AI-structured evidence</h3>
                  <span className="pz-badge pz-badge-amber">Suggestions, not proof</span>
                </div>

                <div className="pz-divider" />

                <div>
                  <div className="pz-field-label">Hazard type</div>
                  <div className="pz-field-value">{selectedSignal.aiHazardType}</div>
                </div>

                <div>
                  <div className="pz-field-label">Likely corridor</div>
                  <div className="pz-field-value">{selectedSignal.aiLikelyCorridor}</div>
                </div>

                <div>
                  <div className="pz-field-label">Language</div>
                  <div className="pz-field-value">{selectedSignal.aiLanguageNote}</div>
                </div>

                <div>
                  <div className="pz-field-label">Location precision</div>
                  <div className="pz-field-value" style={{ color: 'var(--pz-amber-text)' }}>
                    {selectedSignal.aiLocationPrecision}
                  </div>
                </div>

                <div>
                  <div className="pz-field-label">Intake confidence</div>
                  <div
                    className="pz-field-value"
                    style={{
                      color:
                        selectedSignal.workflowStatus === 'verified'
                          ? 'var(--pz-primary-green)'
                          : 'var(--pz-amber-text)',
                    }}
                  >
                    {selectedSignal.workflowStatus === 'verified'
                      ? 'Verified by human editor (4/4 checks complete)'
                      : selectedSignal.aiConfidenceNote}
                  </div>
                </div>
              </div>

              {/* Image Analysis / Graphic Safety Preview Card */}
              <div className="pz-cream-panel">
                <span className="pz-field-label" style={{ color: 'var(--pz-amber-text)' }}>
                  Image analysis · When a photo is submitted
                </span>
                <div style={{ fontWeight: 600, fontSize: '14.5px', color: 'var(--pz-text)' }}>
                  {selectedSignal.aiImageHeading}
                </div>
                <p style={{ fontSize: '13px', color: 'var(--pz-muted)' }}>
                  {selectedSignal.aiImageSummary}
                </p>

                {selectedSignal.photoType !== 'none' && (
                  <div style={{ marginTop: '4px' }}>
                    <EvidencePhotoFrame
                      photoType={selectedSignal.photoType}
                      customPhotoDataUrl={selectedSignal.customPhotoDataUrl}
                      isGraphic={selectedSignal.isGraphicImage}
                      isRevealed={Boolean(revealedGraphicIds[selectedSignal.id])}
                      onToggleReveal={() => toggleGraphicReveal(selectedSignal.id)}
                      graphicReason={selectedSignal.graphicSafetyReason}
                      height={168}
                      allowEditorReveal={true}
                    />
                  </div>
                )}
              </div>
            </section>

            {/* COLUMN 03: REVIEW PIPELINE & EDITORIAL GATE */}
            <section className="pz-triage-col" aria-label="Editorial review pipeline">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  minHeight: '34px',
                }}
              >
                <h2 className="pz-subsection-heading">Review pipeline</h2>
                <span
                  className={`pz-badge ${
                    selectedSignal.workflowStatus === 'verified'
                      ? 'pz-badge-verified'
                      : selectedSignal.workflowStatus === 'rejected'
                        ? 'pz-badge-critical'
                        : 'pz-badge-amber'
                  }`}
                >
                  {selectedSignal.workflowStatus === 'verified'
                    ? 'Approved'
                    : selectedSignal.workflowStatus === 'rejected'
                      ? 'Archived'
                      : 'Held at gate'}
                </span>
              </div>

              <div className="pz-card-panel" style={{ gap: '14px' }}>
                {pipelineSteps.map((step) => {
                  const isVerified = selectedSignal.workflowStatus === 'verified';
                  const isDone = isVerified || step.stage < selectedSignal.pipelineStage;
                  const isCurrent = !isVerified && step.stage === selectedSignal.pipelineStage;

                  return (
                    <div key={step.num} className="pz-pipeline-step">
                      <div
                        className={`pz-pipeline-index ${
                          isDone ? 'is-done' : isCurrent ? 'is-current' : ''
                        }`}
                      >
                        {isDone ? '✓' : step.num}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span
                          style={{
                            fontSize: '13.5px',
                            fontWeight: 600,
                            color: isDone
                              ? 'var(--pz-primary-green)'
                              : isCurrent
                                ? 'var(--pz-amber-text)'
                                : 'var(--pz-text)',
                          }}
                        >
                          {step.title}
                        </span>
                        <span style={{ fontSize: '12.5px', color: 'var(--pz-muted)' }}>
                          {step.desc}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Missing Corroboration Requirements */}
              {selectedSignal.workflowStatus === 'verified' ? (
                <div
                  className="pz-card-panel"
                  style={{
                    background: 'var(--pz-active-surface)',
                    borderColor: 'var(--pz-primary-green)',
                  }}
                >
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: '14.5px',
                      color: 'var(--pz-primary-green)',
                    }}
                  >
                    All 4 editorial verification checks completed
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--pz-text)' }}>
                    Approved by Editor Rudo Moyo and published to the Bulawayo Public Dashboard
                    {selectedSignal.isGraphicImage
                      ? ' (graphic attachment permanently withheld from public view).'
                      : '.'}
                  </p>
                </div>
              ) : (
                <div className="pz-missing-panel">
                  <div style={{ fontWeight: 600, fontSize: '14.5px', color: 'var(--pz-red)' }}>
                    What is still missing?
                  </div>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: '18px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      fontSize: '13px',
                      color: 'var(--pz-text)',
                    }}
                  >
                    {selectedSignal.missingItems.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                type="button"
                className="pz-cta-full-green"
                onClick={() => navigateNewsroom('inbox', selectedSignal.id)}
              >
                <span>Open journalist inbox</span>
                <span aria-hidden="true">→</span>
              </button>

              <button
                type="button"
                className="pz-btn-secondary"
                style={{ width: '100%' }}
                onClick={() => navigateNewsroom('verify', selectedSignal.id)}
              >
                Open verification checklist ({selectedSignal.id}) →
              </button>
            </section>
          </>
        )}
      </div>
    </div>
  );
};
