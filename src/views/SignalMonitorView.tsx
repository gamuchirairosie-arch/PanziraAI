import React, { useEffect, useMemo, useState } from 'react';
import { EvidencePhotoFrame } from '../components/CroppedFigmaMedia';
import { usePanzira } from '../context/PanziraContext';
import { useCardFocus } from '../context/CardFocusContext';

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

  const { focusCard } = useCardFocus();

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
        <button
          type="button"
          className="pz-metric-card pz-expandable-card"
          style={{ textAlign: 'left', cursor: 'pointer' }}
          onClick={() =>
            focusCard({
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
              actions: [
                { label: 'Open Signal Inbox →', onClick: () => navigateNewsroom('inbox'), variant: 'primary' },
              ],
            })
          }
          title="Click to view metric details"
        >
          <span className="pz-expand-hint-pill">Expand ⤢</span>
          <span className="pz-metric-value">{String(totalSignalsCount).padStart(2, '0')}</span>
          <span className="pz-metric-label">Signals received</span>
          <span style={{ fontSize: '12.5px', color: 'var(--pz-muted)' }}>
            {publicSignalsCount} public • {optInSignalsCount} opt-in
          </span>
        </button>

        <button
          type="button"
          className="pz-metric-card pz-expandable-card"
          style={{ textAlign: 'left', cursor: 'pointer' }}
          onClick={() =>
            focusCard({
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
              actions: [
                { label: 'Open Signal Inbox Queue →', onClick: () => navigateNewsroom('inbox'), variant: 'primary' },
              ],
            })
          }
          title="Click to view awaiting review details"
        >
          <span className="pz-expand-hint-pill">Expand ⤢</span>
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
          className="pz-metric-card pz-expandable-card"
          style={{ textAlign: 'left', cursor: 'pointer' }}
          onClick={() =>
            focusCard({
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
              actions: [
                { label: 'Open Hotspot Intelligence →', onClick: () => navigateNewsroom('hotspots'), variant: 'primary' },
              ],
            })
          }
          title="Click to view corridor pattern intelligence"
        >
          <span className="pz-expand-hint-pill">Expand ⤢</span>
          <span className="pz-metric-value">03</span>
          <span className="pz-metric-label">Possible corridor patterns</span>
          <span style={{ fontSize: '12.5px', color: 'var(--pz-muted)' }}>
            Leads, not confirmed
          </span>
        </button>

        <button
          type="button"
          className="pz-metric-card pz-expandable-card"
          style={{ textAlign: 'left', cursor: 'pointer' }}
          onClick={() =>
            focusCard({
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
            })
          }
          title="Click to view AI publishing safeguard details"
        >
          <span className="pz-expand-hint-pill">Expand ⤢</span>
          <span className="pz-metric-value">
            {String(autoPublishedByAiCount).padStart(2, '0')}
          </span>
          <span className="pz-metric-label">Auto-published by AI</span>
          <span style={{ fontSize: '12.5px', color: 'var(--pz-primary-green)', fontWeight: 600 }}>
            Human gate required
          </span>
        </button>
      </section>

      {/* 3-Column Triage Workspace: Left Signals Queue, Right Unified Inspection Workbench */}
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
                    className={`pz-signal-card pz-expandable-card ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => {
                      setSelectedMonitorId(sig.id);
                      focusCard({
                        type: 'signal',
                        signalId: sig.id,
                        title: sig.title,
                        subtitle: sig.subtitle,
                        categoryLabel: 'INCOMING SIGNAL LEAD',
                        badge: sig.monitorStatusLabel,
                        badgeColor:
                          sig.monitorStatusColor === 'green'
                            ? 'green'
                            : sig.monitorStatusColor === 'red'
                              ? 'red'
                              : 'amber',
                      });
                    }}
                    aria-pressed={isSelected}
                    title="Click to select and view full expanded card"
                  >
                    <span className="pz-expand-hint-pill">Expand ⤢</span>
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
            COLUMN 02 & 03: UNIFIED INSPECTION WORKBENCH (CLEAR & UNCLUTTERED)
            ================================================================= */}
        {!selectedSignal ? (
          <section
            className="pz-card-panel"
            style={{ gridColumn: 'span 2', padding: '24px' }}
            aria-live="polite"
          >
            <h2 className="pz-subsection-heading">No matching signal to display</h2>
            <p style={{ fontSize: '14px', color: 'var(--pz-muted)' }}>
              Adjust the intake channel filter or clear search to inspect incoming submissions.
            </p>
          </section>
        ) : (
          <section
            style={{
              gridColumn: 'span 2',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
            aria-label="Selected signal inspection workbench"
          >
            {/* Header & Quick Actions Banner */}
            <div
              className="pz-card-panel"
              style={{
                padding: '18px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '16px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span className="pz-badge pz-badge-neutral">{selectedSignal.id}</span>
                  <span className="pz-badge pz-badge-neutral">{selectedSignal.sourceChannelLabel}</span>
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
                      ? 'Verified & Approved'
                      : selectedSignal.workflowStatus === 'rejected'
                        ? 'Archived'
                        : 'Unverified Lead'}
                  </span>
                </div>

                <h2 className="pz-card-title" style={{ fontSize: '20px', margin: 0 }}>
                  {selectedSignal.title}
                </h2>
                <p style={{ fontSize: '13.5px', color: 'var(--pz-muted)', margin: 0 }}>
                  {selectedSignal.corridor} · {selectedSignal.landmark} · Reported {selectedSignal.reportedDateTime}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="pz-btn-secondary"
                  style={{ minHeight: '38px', fontSize: '13px' }}
                  onClick={() => navigateNewsroom('inbox', selectedSignal.id)}
                >
                  View in Inbox →
                </button>
                <button
                  type="button"
                  className="pz-btn-primary"
                  style={{ minHeight: '38px', fontSize: '13.5px' }}
                  onClick={() => navigateNewsroom('verify', selectedSignal.id)}
                >
                  Open Verification Checklist →
                </button>
              </div>
            </div>

            {/* 2-Column Split: Left Citizen Evidence, Right AI Triage & Verification Gaps */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '14px' }}>
              {/* Left Column: Citizen Evidence & Translation */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div
                  className="pz-raw-message-card pz-expandable-card"
                  onClick={() =>
                    focusCard({
                      type: 'signal',
                      signalId: selectedSignal.id,
                      title: selectedSignal.title,
                      categoryLabel: 'ORIGINAL CITIZEN MESSAGE',
                    })
                  }
                  title="Click to expand message"
                >
                  <span className="pz-expand-hint-pill">Expand ⤢</span>
                  <div className="pz-field-label" style={{ color: 'var(--pz-primary-green)' }}>
                    Original message · {selectedSignal.originalLanguage}
                  </div>
                  <p className="pz-raw-quote" style={{ fontSize: '14.5px', margin: '8px 0' }}>
                    "{selectedSignal.originalQuote}"
                  </p>

                  {selectedSignal.draftEnglishTranslation && (
                    <div className="pz-translation-box" style={{ marginTop: '10px' }}>
                      <span className="pz-field-label" style={{ color: 'var(--pz-demo-text)' }}>
                        Draft English translation (review nuance)
                      </span>
                      <p style={{ fontSize: '13.5px', color: 'var(--pz-text)', fontStyle: 'italic', margin: '4px 0 0' }}>
                        {selectedSignal.draftEnglishTranslation}
                      </p>
                    </div>
                  )}

                  <div style={{ fontSize: '12px', color: 'var(--pz-muted)', marginTop: '8px' }}>
                    {selectedSignal.sourceProvenanceNote}
                  </div>
                </div>

                {/* Photo Evidence if attached */}
                {selectedSignal.photoType !== 'none' && (
                  <div
                    className="pz-card-panel pz-expandable-card"
                    onClick={() =>
                      focusCard({
                        type: 'signal',
                        signalId: selectedSignal.id,
                        title: `Visual Evidence · ${selectedSignal.id}`,
                        categoryLabel: 'VISUAL EVIDENCE',
                      })
                    }
                    title="Click to expand image evidence"
                  >
                    <span className="pz-expand-hint-pill">Expand ⤢</span>
                    <div className="pz-field-label">Submitted photo evidence</div>
                    <EvidencePhotoFrame
                      photoType={selectedSignal.photoType}
                      customPhotoDataUrl={selectedSignal.customPhotoDataUrl}
                      isGraphic={selectedSignal.isGraphicImage}
                      isRevealed={Boolean(revealedGraphicIds[selectedSignal.id])}
                      onToggleReveal={() => toggleGraphicReveal(selectedSignal.id)}
                      graphicReason={selectedSignal.graphicSafetyReason}
                      height={180}
                      allowEditorReveal={true}
                    />
                    {selectedSignal.photoCaption && (
                      <p style={{ fontSize: '12px', color: 'var(--pz-muted)', marginTop: '6px' }}>
                        {selectedSignal.photoCaption}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Right Column: AI Pre-Triage & Missing Gaps */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* AI Structured Summary */}
                <div
                  className="pz-card-panel pz-expandable-card"
                  onClick={() =>
                    focusCard({
                      type: 'ai-evidence',
                      signalId: selectedSignal.id,
                      title: `AI Pre-Triage · ${selectedSignal.id}`,
                      categoryLabel: 'AI EXTRACTIONS',
                    })
                  }
                  title="Click to expand AI triage details"
                >
                  <span className="pz-expand-hint-pill">Expand ⤢</span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 className="pz-card-title" style={{ fontSize: '15px' }}>AI Pre-Triage Analysis</h3>
                    <span className="pz-badge pz-badge-amber">Suggestions, not proof</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="pz-field-label">Suggested Hazard:</span>
                      <span style={{ fontSize: '13.5px', fontWeight: 600 }}>{selectedSignal.aiHazardType}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="pz-field-label">Corridor Match:</span>
                      <span style={{ fontSize: '13.5px', fontWeight: 600 }}>{selectedSignal.aiLikelyCorridor}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="pz-field-label">Precision:</span>
                      <span style={{ fontSize: '13.5px', color: 'var(--pz-amber-text)', fontWeight: 500 }}>
                        {selectedSignal.aiLocationPrecision}
                      </span>
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                        <span className="pz-field-label">Intake Confidence:</span>
                        <span>{selectedSignal.aiConfidenceNote}</span>
                      </div>
                      <div style={{ height: '6px', background: 'var(--pz-pale)', borderRadius: '3px', marginTop: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${selectedSignal.aiConfidencePercent}%`, height: '100%', background: 'var(--pz-gold)' }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Missing Requirements Panel */}
                {selectedSignal.workflowStatus === 'verified' ? (
                  <div
                    className="pz-card-panel"
                    style={{ background: 'var(--pz-active-surface)', borderColor: 'var(--pz-primary-green)' }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--pz-primary-green)' }}>
                      All 4 Verification Checks Completed
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--pz-text)', margin: '4px 0 0' }}>
                      Approved by Editor Rudo Moyo and broadcast to the public map.
                    </p>
                  </div>
                ) : (
                  <div
                    className="pz-missing-panel pz-expandable-card"
                    onClick={() =>
                      focusCard({
                        type: 'missing-info',
                        signalId: selectedSignal.id,
                        title: `Evidence Gaps · ${selectedSignal.id}`,
                        categoryLabel: 'MISSING REQUIREMENTS',
                      })
                    }
                    title="Click to view evidence gaps"
                  >
                    <span className="pz-expand-hint-pill">Expand ⤢</span>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--pz-red)' }}>
                      What is missing before publishing?
                    </div>
                    <ul style={{ margin: '8px 0 0 18px', padding: 0, display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px' }}>
                      {selectedSignal.missingItems.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
