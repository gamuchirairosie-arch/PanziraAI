import React, { useEffect, useMemo, useState } from 'react';
import { ASSETS } from '../assetsMap';
import { CorridorContextMap } from '../components/BulawayoMap';
import { EvidencePhotoFrame } from '../components/CroppedFigmaMedia';
import { CompactReportPicker } from '../components/CompactReportPicker';
import { usePanzira } from '../context/PanziraContext';
import { useCardFocus } from '../context/CardFocusContext';
import { VerificationChecklist } from '../types';

type InboxFilter = 'all' | 'lead' | 'verifying' | 'verified';

export const SignalInboxView: React.FC = () => {
  const {
    signals,
    newsroomSearch,
    setNewsroomSearch,
    totalSignalsCount,
    awaitingReviewCount,
    autoPublishedByAiCount,
    selectedInboxId,
    setSelectedInboxId,
    navigateNewsroom,
    requestEvidence,
    revealedGraphicIds,
    toggleGraphicReveal,
  } = usePanzira();

  const [statusFilter, setStatusFilter] = useState<InboxFilter>('all');
  const [channelFilter, setChannelFilter] = useState<'all' | 'web' | 'whatsapp' | 'ussd'>('all');
  const { focusCard } = useCardFocus();

  const filteredSignals = useMemo(() => {
    const q = newsroomSearch.trim().toLowerCase();
    return signals.filter((sig) => {
      if (statusFilter !== 'all' && sig.workflowStatus !== statusFilter) return false;
      const ch = (sig.sourceChannelLabel || '').toLowerCase();
      if (channelFilter === 'web' && !ch.includes('web')) return false;
      if (channelFilter === 'whatsapp' && !ch.includes('whatsapp')) return false;
      if (channelFilter === 'ussd' && !ch.includes('ussd')) return false;
      if (!q) return true;
      return (
        sig.title.toLowerCase().includes(q) ||
        (sig.inboxTitle || '').toLowerCase().includes(q) ||
        sig.corridor.toLowerCase().includes(q) ||
        sig.roadArea.toLowerCase().includes(q) ||
        sig.originalQuote.toLowerCase().includes(q) ||
        (sig.draftEnglishTranslation || '').toLowerCase().includes(q) ||
        sig.id.toLowerCase().includes(q)
      );
    });
  }, [signals, statusFilter, channelFilter, newsroomSearch]);

  // Bug 5 fix: keep selectedInboxId synchronized with filteredSignals so excluded items never linger
  useEffect(() => {
    if (filteredSignals.length > 0 && !filteredSignals.some((s) => s.id === selectedInboxId)) {
      setSelectedInboxId(filteredSignals[0].id);
    }
  }, [filteredSignals, selectedInboxId, setSelectedInboxId]);

  const selectedLead = useMemo(() => {
    if (filteredSignals.length === 0) return null;
    return filteredSignals.find((s) => s.id === selectedInboxId) || filteredSignals[0];
  }, [filteredSignals, selectedInboxId]);

  const graphicRestrictedCount = useMemo(
    () => signals.filter((s) => s.isGraphicImage).length,
    [signals]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Header */}
      <div>
        <h1 className="pz-page-title">Signal inbox</h1>
        <p className="pz-page-subtitle">
          Journalist triage queue for incoming citizen reports, Shona and Ndebele tips, and public
          corridor leads
        </p>
      </div>

      {/* 4 KPI Cards */}
      <section className="pz-metrics-grid-4" aria-label="Signal inbox metrics">
        <button
          type="button"
          className="pz-metric-card"
          style={{ textAlign: 'left' }}
          onClick={() => navigateNewsroom('monitor')}
        >
          <span className="pz-metric-value">{String(totalSignalsCount).padStart(2, '0')}</span>
          <span className="pz-metric-label">Signals in intake</span>
          <span style={{ fontSize: '12px', color: 'var(--pz-primary-green)', fontWeight: 600 }}>
            ← View signal monitor
          </span>
        </button>

        <div className="pz-metric-card">
          <span className="pz-metric-value" style={{ color: 'var(--pz-amber-text)' }}>
            {String(awaitingReviewCount).padStart(2, '0')}
          </span>
          <span className="pz-metric-label">Awaiting verification</span>
          <span style={{ fontSize: '12px', color: 'var(--pz-muted)' }}>
            4-point check required
          </span>
        </div>

        <div className="pz-metric-card">
          <span className="pz-metric-value" style={{ color: 'var(--pz-red)' }}>
            {String(graphicRestrictedCount).padStart(2, '0')}
          </span>
          <span className="pz-metric-label">Graphic-restricted media</span>
          <span style={{ fontSize: '12px', color: 'var(--pz-muted)' }}>
            Blurred & withheld from public
          </span>
        </div>

        <div className="pz-metric-card">
          <span className="pz-metric-value">
            {String(autoPublishedByAiCount).padStart(2, '0')}
          </span>
          <span className="pz-metric-label">Auto-published by AI</span>
          <span style={{ fontSize: '12px', color: 'var(--pz-primary-green)', fontWeight: 600 }}>
            Editor gate enforced
          </span>
        </div>
      </section>

      {/* Filter Bar with Status & Channel Tabs */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
          borderBottom: '1px solid var(--pz-border)',
          paddingBottom: '12px',
        }}
      >
        <div className="pz-filter-pill-row" role="tablist" aria-label="Filter inbox by review status">
          {(
            [
              { key: 'all', label: 'All' },
              { key: 'lead', label: 'Leads' },
              { key: 'verifying', label: 'Verifying' },
              { key: 'verified', label: 'Verified' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              data-testid={`inbox-filter-${tab.key}`}
              aria-selected={statusFilter === tab.key}
              className={`pz-filter-btn ${statusFilter === tab.key ? 'is-active' : ''}`}
              onClick={() => setStatusFilter(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: 'var(--pz-muted)', fontWeight: 600 }}>Channel:</span>
          {(
            [
              { key: 'all', label: 'All' },
              { key: 'web', label: 'Web' },
              { key: 'whatsapp', label: 'WhatsApp' },
              { key: 'ussd', label: 'USSD' },
            ] as const
          ).map((ch) => (
            <button
              key={ch.key}
              type="button"
              className={`pz-filter-btn ${channelFilter === ch.key ? 'is-active' : ''}`}
              style={{ padding: '3px 8px', fontSize: '11.5px' }}
              onClick={() => setChannelFilter(ch.key)}
            >
              {ch.label}
            </button>
          ))}
        </div>
      </div>

      {/* Focus-first inbox queue */}
      <div className="pz-inbox-split pz-inbox-split-focus">
        {/* Left: Queue */}
        <div className="pz-inbox-queue">
          {filteredSignals.length === 0 ? (
            <div className="pz-card-panel" data-testid="inbox-queue-empty">
              <p style={{ fontSize: '13.5px', color: 'var(--pz-muted)' }}>
                {statusFilter === 'verified' && !newsroomSearch.trim()
                  ? 'No inbox submissions have completed 4-point editorial verification yet.'
                  : 'No inbox submissions match this status filter or search query.'}
              </p>
            </div>
          ) : (
            filteredSignals.map((sig) => {
              const isSelected = selectedLead?.id === sig.id;
              const metCount = Object.values(sig.checklist).filter(Boolean).length;
              return (
                <button
                  key={sig.id}
                  type="button"
                  data-testid={`inbox-card-${sig.id}`}
                  className={`pz-signal-card ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => {
                    setSelectedInboxId(sig.id);
                    focusCard({
                      type: 'signal',
                      signalId: sig.id,
                      title: sig.inboxTitle || sig.title,
                      subtitle: `${sig.roadArea} · ${sig.landmark}`,
                      categoryLabel: 'INCOMING CITIZEN REPORT',
                      badge: sig.inboxStatusLine,
                      badgeColor:
                        sig.workflowStatus === 'verified'
                          ? 'green'
                          : sig.isGraphicImage || sig.workflowStatus === 'rejected'
                            ? 'red'
                            : 'amber',
                    });
                  }}
                >
                  <div className="pz-signal-meta-row pz-inbox-card-meta">
                    <span
                      className={`pz-source-tag ${
                        sig.workflowStatus === 'verified'
                          ? 'pz-color-green'
                          : sig.isGraphicImage || sig.workflowStatus === 'rejected'
                            ? 'pz-color-red'
                            : 'pz-color-gold'
                      }`}
                    >
                      {sig.inboxStatusLine}
                    </span>
                    <span className="pz-inbox-card-time">{sig.timeShort}</span>
                  </div>

                  <div className="pz-signal-card-title">{sig.inboxTitle || sig.title}</div>
                  <div className="pz-signal-card-sub">
                    {sig.corridor} · {sig.landmark}
                  </div>

                  <div
                      className="pz-inbox-card-footer"
                  >
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <span className="pz-badge pz-badge-neutral">{sig.id}</span>
                      {sig.sourceChannelLabel?.toLowerCase().includes('whatsapp') ? (
                        <span className="pz-badge pz-badge-whatsapp">WhatsApp</span>
                      ) : sig.sourceChannelLabel?.toLowerCase().includes('ussd') ? (
                        <span className="pz-badge pz-badge-ussd">USSD</span>
                      ) : (
                        <span className="pz-badge pz-badge-web">Web</span>
                      )}
                      {sig.originalLanguage !== 'English' && (
                        <span className="pz-badge pz-badge-amber">
                          {sig.originalLanguage} → EN draft
                        </span>
                      )}
                      {sig.isGraphicImage && (
                        <span className="pz-badge pz-badge-critical">Graphic blurred</span>
                      )}
                    </div>
                    <span className="pz-inbox-card-checks">
                      {metCount}/4 checks
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Right: Selected Lead Detail or Synchronized Empty State */}
        {selectedLead ? (
          <section
            className="pz-card-panel"
            style={{ padding: '22px', gap: '16px' }}
            data-testid="inbox-detail-panel"
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className="pz-badge pz-badge-neutral" data-testid="inbox-selected-id">
                    {selectedLead.id}
                  </span>
                  <span className="pz-badge pz-badge-neutral">
                    Desk file: {selectedLead.investigationCode}
                  </span>
                  <span
                    className={`pz-badge ${
                      selectedLead.workflowStatus === 'verified'
                        ? 'pz-badge-panzira-verified'
                        : selectedLead.isCritical || selectedLead.isGraphicImage
                          ? 'pz-badge-critical'
                          : 'pz-badge-amber'
                    }`}
                    title={
                      selectedLead.workflowStatus === 'verified'
                        ? 'Panzira Verified · Independent newsroom check (Municipal integration pending authorization)'
                        : undefined
                    }
                  >
                    {selectedLead.workflowStatus === 'verified'
                      ? 'PANZIRA VERIFIED · Approved'
                      : `Severity: ${selectedLead.severityLabel}`}
                  </span>
                </div>
                <h2 className="pz-section-heading" style={{ marginTop: '8px' }}>
                  {selectedLead.inboxTitle || selectedLead.title}
                </h2>
                <p style={{ fontSize: '13.5px', color: 'var(--pz-muted)', marginTop: '2px' }}>
                  {selectedLead.roadArea} · {selectedLead.landmark} · {selectedLead.reportedDateTime}
                </p>
              </div>

              <button
                type="button"
                className="pz-btn-primary"
                onClick={() => navigateNewsroom('verify', selectedLead.id)}
              >
                Open verification →
              </button>
            </div>

            {/* Raw Report + Shona/Ndebele Translation */}
            <div className="pz-raw-message-card">
              <div className="pz-field-label" style={{ color: 'var(--pz-primary-green)' }}>
                Original submission ({selectedLead.originalLanguage}) ·{' '}
                {selectedLead.sourceChannelShort}
              </div>
              <p className="pz-raw-quote">{selectedLead.originalQuote}</p>

              {selectedLead.draftEnglishTranslation && (
                <div className="pz-translation-box">
                  <span className="pz-field-label" style={{ color: 'var(--pz-demo-text)' }}>
                    Draft English translation (AI-assisted · fluent editor check required)
                  </span>
                  <p style={{ fontSize: '14px', color: 'var(--pz-text)', fontStyle: 'italic' }}>
                    {selectedLead.draftEnglishTranslation}
                  </p>
                </div>
              )}

              <div style={{ fontSize: '12.5px', color: 'var(--pz-muted)' }}>
                {selectedLead.sourceProvenanceNote}
              </div>
            </div>

            {/* Photo / Restricted Graphic Evidence */}
            {selectedLead.photoType !== 'none' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div className="pz-field-label">
                  {selectedLead.isGraphicImage
                    ? 'Submitted attachment · Graphic safety restriction active'
                    : 'Submitted citizen photograph · Uncorroborated'}
                </div>
                <EvidencePhotoFrame
                  photoType={selectedLead.photoType}
                  customPhotoDataUrl={selectedLead.customPhotoDataUrl}
                  isGraphic={selectedLead.isGraphicImage}
                  isRevealed={Boolean(revealedGraphicIds[selectedLead.id])}
                  allowEditorReveal={true}
                  onToggleReveal={() => toggleGraphicReveal(selectedLead.id)}
                  graphicReason={selectedLead.graphicSafetyReason}
                  height={200}
                />
                {selectedLead.photoCaption && (
                  <p style={{ fontSize: '12.5px', color: 'var(--pz-muted)' }}>
                    {selectedLead.photoCaption}
                  </p>
                )}
              </div>
            )}

            {/* AI Structuring 2-Col */}
            <div
              style={{
                borderTop: '1px solid var(--pz-border)',
                borderBottom: '1px solid var(--pz-border)',
                padding: '14px 0',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div className="pz-field-label" style={{ color: 'var(--pz-amber-text)' }}>
                AI structuring · Suggestions, not proof
              </div>
              <div className="pz-extract-2col">
                <div>
                  <div className="pz-field-label">Classification</div>
                  <div className="pz-field-value">{selectedLead.aiHazardType}</div>
                </div>
                <div>
                  <div className="pz-field-label">Suggested corridor</div>
                  <div className="pz-field-value">{selectedLead.aiLikelyCorridor}</div>
                </div>
                <div>
                  <div className="pz-field-label">Location precision</div>
                  <div className="pz-field-value" style={{ color: 'var(--pz-amber-text)' }}>
                    {selectedLead.aiLocationPrecision}
                  </div>
                </div>
                <div>
                  <div className="pz-field-label">Confidence indicator</div>
                  <div className="pz-field-value" style={{ color: 'var(--pz-amber-text)' }}>
                    {selectedLead.aiConfidenceNote}
                  </div>
                </div>
              </div>
            </div>

            {/* Duplicate Cluster Box */}
            {selectedLead.duplicateCandidates.length > 0 && (
              <div className="pz-cream-panel">
                <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--pz-text)' }}>
                  {selectedLead.duplicateClusterTitle || 'Possible duplicate cluster'}
                </div>
                <p style={{ fontSize: '13px', color: 'var(--pz-muted)' }}>
                  {selectedLead.duplicateClusterSummary}
                </p>
              </div>
            )}

            {/* Actions */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '10px',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                <button
                  type="button"
                  className="pz-btn-secondary"
                  onClick={() => requestEvidence(selectedLead.id)}
                >
                  <img
                    src={ASSETS.messageSquare}
                    alt=""
                    style={{ width: '15px', height: '15px' }}
                  />
                  <span>Request evidence</span>
                </button>
                <button
                  type="button"
                  className="pz-btn-secondary"
                  onClick={() => navigateNewsroom('briefs')}
                >
                  Open working brief ({selectedLead.investigationCode})
                </button>
              </div>

              <button
                type="button"
                className="pz-btn-primary"
                onClick={() => navigateNewsroom('verify', selectedLead.id)}
              >
                Proceed to verification gate →
              </button>
            </div>
          </section>
        ) : (
          <section
            className="pz-card-panel"
            style={{ padding: '24px', gap: '12px' }}
            data-testid="inbox-empty-selection"
          >
            <span className="pz-badge pz-badge-neutral" style={{ alignSelf: 'flex-start' }}>
              No matching report selected
            </span>
            <h2 className="pz-section-heading">
              {statusFilter === 'verified' && !newsroomSearch.trim()
                ? 'No verified submissions in the inbox yet'
                : 'No submissions match the active filter'}
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--pz-muted)', maxWidth: '58ch' }}>
              {statusFilter === 'verified' && !newsroomSearch.trim()
                ? 'Unverified leads are held at the editorial gate and are never shown under the Verified filter. Select a report in All submissions or Verifying and complete all four corroboration checks to approve it.'
                : 'Adjust your status filter or search query to inspect incoming citizen and corridor reports.'}
            </p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '4px' }}>
              <button
                type="button"
                className="pz-btn-secondary"
                onClick={() => {
                  setStatusFilter('all');
                  if (newsroomSearch.trim()) {
                    setNewsroomSearch('');
                  }
                }}
              >
                Show all submissions
              </button>
              {statusFilter === 'verified' && (
                <button
                  type="button"
                  className="pz-btn-primary"
                  onClick={() => navigateNewsroom('verify')}
                >
                  Open verification gate →
                </button>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

// ===========================================================================
// D7 INCIDENT VERIFICATION & EDITOR APPROVAL GATE
// ===========================================================================

const CHECKLIST_LABELS: Array<{
  key: keyof VerificationChecklist;
  title: string;
  helper: string;
}> = [
  {
    key: 'locationAndTime',
    title: 'Confirm exact location or landmark and reported time',
    helper: 'Cross-check corridor segment, junction name, or kilometre peg with reporter or map.',
  },
  {
    key: 'mediaAndDate',
    title: 'Verify media provenance and capture date (or text-only witness)',
    helper: 'Ensure any submitted photo was not recycled from an older incident.',
  },
  {
    key: 'independentSource',
    title: 'Corroborate with at least one independent source',
    helper: 'Similar reposts do not count; confirm via separate eyewitness, reporter, or council.',
  },
  {
    key: 'hazardStillPresent',
    title: 'Confirm hazard is still active and affects road users',
    helper: 'Verify obstruction or surface defect has not already been cleared.',
  },
];

export const IncidentVerificationView: React.FC = () => {
  const {
    signals,
    selectedVerifyId,
    setSelectedVerifyId,
    navigateNewsroom,
    navigatePublic,
    toggleChecklist,
    updateEditorialNotes,
    requestEvidence,
    rejectSignal,
    verifySignal,
    openWorkingBriefForSignal,
    revealedGraphicIds,
    toggleGraphicReveal,
    backendMode,
  } = usePanzira();

  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [followUpInputOpen, setFollowUpInputOpen] = useState(false);
  const [followUpPrompt, setFollowUpPrompt] = useState('');
  const [showAdvancedAi, setShowAdvancedAi] = useState(false);
  const [editorialNotesDraft, setEditorialNotesDraft] = useState('');

  const signal = useMemo(() => {
    return signals.find((s) => s.id === selectedVerifyId) || signals[0];
  }, [signals, selectedVerifyId]);

  const metCount = useMemo(
    () => Object.values(signal.checklist).filter(Boolean).length,
    [signal.checklist]
  );
  const allChecksComplete = metCount === 4;

  useEffect(() => {
    setEditorialNotesDraft(signal.editorialNotes);
  }, [signal.editorialNotes, signal.id]);

  const handleSendFollowUp = async () => {
    if (await requestEvidence(signal.id, followUpPrompt)) {
      setFollowUpPrompt('');
      setFollowUpInputOpen(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Breadcrumb & Quick Signal Switcher */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
          <button
            type="button"
            onClick={() => navigateNewsroom('inbox', signal.id)}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              color: 'var(--pz-primary-green)',
              fontWeight: 600,
            }}
          >
            ← Signal inbox
          </button>
          <span style={{ color: 'var(--pz-muted)' }}>/</span>
          <span style={{ color: 'var(--pz-muted)' }}>Incident verification</span>
          <span style={{ color: 'var(--pz-muted)' }}>/</span>
          <strong>{signal.id}</strong>
        </div>

        {/* Quick compact report switcher with search & keyboard navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <label
            id="pz-verify-select-label"
            style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--pz-muted)' }}
          >
            Inspect submission:
          </label>
          <CompactReportPicker
            signals={signals}
            selectedId={signal.id}
            onSelect={(id) => setSelectedVerifyId(id)}
          />
        </div>
      </div>

      {/* Title & Status Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
            <span
              className={`pz-badge ${
                signal.workflowStatus === 'verified'
                  ? 'pz-badge-panzira-verified'
                  : signal.workflowStatus === 'rejected'
                    ? 'pz-badge-critical'
                    : 'pz-badge-amber'
              }`}
              title={
                signal.workflowStatus === 'verified'
                  ? 'Panzira Verified · Independent newsroom check (Municipal integration pending authorization)'
                  : undefined
              }
            >
              {signal.workflowStatus === 'verified'
                ? 'PANZIRA VERIFIED · Approved for public map'
                : signal.workflowStatus === 'rejected'
                  ? 'Rejected · Withheld from public'
                  : 'Unverified · Held at editor gate'}
            </span>
            <span
              className={`pz-badge ${
                signal.isCritical || signal.severityLabel === 'High'
                  ? 'pz-badge-critical'
                  : 'pz-badge-neutral'
              }`}
            >
              Severity: {signal.severityLabel}
            </span>
            <span className="pz-badge pz-badge-neutral">{signal.sourceChannelShort}</span>
            {signal.isGraphicImage && (
              <span className="pz-badge pz-badge-critical">
                Graphic media restricted (never public)
              </span>
            )}
          </div>

          <h1 className="pz-page-title">{signal.inboxTitle || signal.title}</h1>
          <p className="pz-page-subtitle">
            {signal.roadArea} · {signal.landmark} · Observed {signal.reportedDateTime}
          </p>
        </div>

        {signal.workflowStatus === 'verified' && (
          <button
            type="button"
            className="pz-btn-secondary"
            onClick={() => navigatePublic('overview')}
          >
            View live on Public Dashboard →
          </button>
        )}
      </div>

      {/* Main Verification Two-Column Split */}
      <div className="pz-verify-split">
        {/* =================================================================
            LEFT COLUMN: SOURCE EVIDENCE, GRAPHIC GATE, AI & DUPLICATES
            ================================================================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Original Report + Shona Translation */}
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
              <span className="pz-field-label" style={{ color: 'var(--pz-primary-green)' }}>
                Submitted report · {signal.originalLanguage}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--pz-muted)' }}>{signal.id}</span>
            </div>

            <p className="pz-raw-quote">{signal.originalQuote}</p>

            {signal.draftEnglishTranslation && (
              <div className="pz-translation-box">
                <span className="pz-field-label" style={{ color: 'var(--pz-demo-text)' }}>
                  Draft English translation · Verify Shona or Ndebele nuance before approval
                </span>
                <p style={{ fontSize: '14px', color: 'var(--pz-text)', fontStyle: 'italic' }}>
                  {signal.draftEnglishTranslation}
                </p>
              </div>
            )}

            <p style={{ fontSize: '13px', color: 'var(--pz-muted)' }}>
              {signal.sourceProvenanceNote}
            </p>

            {signal.evidenceLink && (
              <div
                style={{
                  fontSize: '13px',
                  color: 'var(--pz-primary-green)',
                  wordBreak: 'break-all',
                }}
              >
                Submitted URL: {signal.evidenceLink}
              </div>
            )}
          </div>

          {/* Visual Evidence & Mandatory Graphic-Image Safety Gate */}
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
              <h2 className="pz-subsection-heading">Submitted visual evidence</h2>
              {signal.isGraphicImage ? (
                <span className="pz-badge pz-badge-critical">Graphic safety gate active</span>
              ) : signal.photoType !== 'none' ? (
                <span className="pz-badge pz-badge-amber">Uncorroborated capture time</span>
              ) : (
                <span className="pz-badge pz-badge-neutral">Text-only submission</span>
              )}
            </div>

            {signal.photoType !== 'none' ? (
              <>
                <EvidencePhotoFrame
                  photoType={signal.photoType}
                  customPhotoDataUrl={signal.customPhotoDataUrl}
                  isGraphic={signal.isGraphicImage}
                  isRevealed={Boolean(revealedGraphicIds[signal.id])}
                  allowEditorReveal={true}
                  onToggleReveal={() => toggleGraphicReveal(signal.id)}
                  graphicReason={signal.graphicSafetyReason}
                  height={220}
                />
                {signal.photoCaption && (
                  <p style={{ fontSize: '12.5px', color: 'var(--pz-muted)' }}>
                    {signal.photoCaption}
                  </p>
                )}
              </>
            ) : (
              /* Bug 7 fix: single clear message without duplicating aiImageHeading */
              <div
                className="pz-notice-box"
                style={{ borderRadius: '4px' }}
                data-testid="verify-no-photo-notice"
              >
                <p style={{ fontSize: '13.5px', color: 'var(--pz-muted)' }}>
                  No photograph attached — submitted as a low-bandwidth text report. Editors must
                  corroborate via independent witnesses, local reporters, or municipal road logs.
                </p>
              </div>
            )}
          </div>

          {/* AI Analysis · Suggestions, not proof with Progressive Disclosure */}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 className="pz-subsection-heading">AI pre-triage analysis</h2>
                <span className="pz-badge pz-badge-amber">Suggestions, not proof</span>
              </div>
              <button
                type="button"
                className="pz-btn-secondary"
                style={{ padding: '3px 8px', fontSize: '11.5px', height: '28px' }}
                onClick={() => setShowAdvancedAi(!showAdvancedAi)}
              >
                {showAdvancedAi ? 'Hide details ▴' : 'Show advanced metrics ▾'}
              </button>
            </div>

            <div className="pz-extract-2col">
              <div>
                <div className="pz-field-label">Suggested classification</div>
                <div className="pz-field-value">{signal.aiHazardType}</div>
              </div>
              <div>
                <div className="pz-field-label">Corridor match</div>
                <div className="pz-field-value">{signal.aiLikelyCorridor}</div>
              </div>
            </div>

            {showAdvancedAi && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  paddingTop: '12px',
                  borderTop: '1px solid var(--pz-border)',
                }}
              >
                <div className="pz-extract-2col">
                  <div>
                    <div className="pz-field-label">Location precision</div>
                    <div className="pz-field-value" style={{ color: 'var(--pz-amber-text)' }}>
                      {signal.aiLocationPrecision}
                    </div>
                  </div>
                  <div>
                    <div className="pz-field-label">Confidence indicator</div>
                    <div className="pz-field-value" style={{ color: 'var(--pz-amber-text)' }}>
                      {signal.aiConfidenceNote}
                    </div>
                    <div
                      style={{
                        height: '6px',
                        background: 'var(--pz-pale)',
                        borderRadius: '3px',
                        marginTop: '6px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${signal.aiConfidencePercent}%`,
                          height: '100%',
                          background: 'var(--pz-gold)',
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--pz-muted)',
                    background: 'var(--pz-cream)',
                    padding: '8px 10px',
                    borderRadius: '4px',
                    lineHeight: 1.45,
                  }}
                >
                  <strong>Audit notice:</strong> AI model proposals are purely advisory. Autonomous
                  publishing is disabled by design. All public road safety alerts require unanimous
                  4-point human verification.
                </div>
              </div>
            )}
          </div>

          {/* Duplicate Cluster & Source Comparison */}
          {signal.duplicateCandidates.length > 0 && (
            <div className="pz-cream-panel" style={{ gap: '10px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '10px',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <span className="pz-field-label" style={{ color: 'var(--pz-demo-text)' }}>
                    Duplicate cluster & source independence
                  </span>
                  <div style={{ fontWeight: 600, fontSize: '15px', marginTop: '2px' }}>
                    {signal.duplicateClusterTitle || 'Related submissions on same corridor'}
                  </div>
                </div>

                <button
                  type="button"
                  className="pz-btn-secondary"
                  style={{ height: '36px', fontSize: '12.5px', padding: '0 12px' }}
                  onClick={() => setCompareModalOpen(true)}
                >
                  Compare {1 + signal.duplicateCandidates.length} source reports
                </button>
              </div>

              <p style={{ fontSize: '13px', color: 'var(--pz-muted)' }}>
                {signal.duplicateClusterSummary}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {signal.duplicateCandidates.map((cand) => (
                  <div
                    key={cand.id}
                    style={{
                      background: 'var(--pz-white)',
                      border: '1px solid var(--pz-border)',
                      borderRadius: '4px',
                      padding: '10px 12px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '12px',
                        fontWeight: 600,
                      }}
                    >
                      <span>
                        {cand.id} · {cand.sourceLabel}
                      </span>
                      <span style={{ color: 'var(--pz-muted)' }}>{cand.timestamp}</span>
                    </div>
                    <p style={{ fontSize: '12.5px', color: 'var(--pz-muted)', marginTop: '4px' }}>
                      {cand.summary}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Corridor Location Context Map */}
          <div className="pz-card-panel">
            <h2 className="pz-subsection-heading">Location context</h2>
            <p style={{ fontSize: '13px', color: 'var(--pz-muted)' }}>
              Approximate corridor placement based on reporter text ({signal.landmark}). Exact GPS
              coordinates remain unconfirmed until checked.
            </p>
            <CorridorContextMap
              mode="verification"
              landmarkLabel={`${signal.id} · ${signal.corridor}`}
              markerCoords={signal.mapCoords}
              isVerifiedMarker={signal.workflowStatus === 'verified'}
              height={235}
            />
          </div>
        </div>

        {/* =================================================================
            RIGHT COLUMN: 4-POINT CHECKLIST, EDITOR NOTES, APPROVAL GATE
            ================================================================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Corroboration Checklist */}
          <div className="pz-card-panel" style={{ padding: '20px', gap: '14px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap',
              }}
            >
              <h2 className="pz-section-heading">Independent verification checklist</h2>
              <span
                className={`pz-badge ${
                  allChecksComplete ? 'pz-badge-verified' : 'pz-badge-amber'
                }`}
              >
                {metCount} of 4 requirements met
              </span>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--pz-muted)' }}>
              Complete all four human editorial checks before approving a public road alert. AI
              cannot mark these checks or publish warnings automatically.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {CHECKLIST_LABELS.map((item) => {
                const isChecked = signal.checklist[item.key];
                return (
                  <div
                    key={item.key}
                    role="checkbox"
                    data-testid={`verify-check-${item.key}`}
                    aria-checked={isChecked}
                    tabIndex={0}
                    className="pz-checklist-row"
                    onClick={() => void toggleChecklist(signal.id, item.key)}
                    onKeyDown={(e) => {
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        void toggleChecklist(signal.id, item.key);
                      }
                    }}
                  >
                    <span className={`pz-checkbox-box ${isChecked ? 'is-checked' : ''}`}>
                      {isChecked && (
                        <img
                          src={ASSETS.checkWhite}
                          alt=""
                          style={{ width: '13px', height: '13px' }}
                        />
                      )}
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--pz-text)' }}>
                        {item.title}
                      </span>
                      <span style={{ fontSize: '12.5px', color: 'var(--pz-muted)' }}>
                        {item.helper}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pz-divider" />

            {/* Editorial Notes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label htmlFor="pz-editor-notes" style={{ fontWeight: 600, fontSize: '13px' }}>
                Editorial verification notes (Rudo Moyo)
              </label>
              <textarea
                id="pz-editor-notes"
                className="pz-textarea"
                value={editorialNotesDraft}
                onChange={(e) => setEditorialNotesDraft(e.target.value)}
                onBlur={() => void updateEditorialNotes(signal.id, editorialNotesDraft)}
                placeholder="Record witness calls, road authority responses, kilometre markers, or translation checks..."
              />
              <span style={{ fontSize: '12px', color: 'var(--pz-muted)' }}>
                {backendMode === 'demo'
                  ? 'Demo only: notes stay in this browser.'
                  : 'Notes are saved only after the server acknowledges them when this field loses focus.'}
              </span>
            </div>

            {/* Optional Follow-Up Evidence Prompt */}
            {followUpInputOpen && (
              <div
                className="pz-notice-box"
                style={{ border: '1px solid var(--pz-border)', borderRadius: '4px', gap: '8px' }}
              >
                <label
                  htmlFor="pz-followup-note"
                  style={{ fontSize: '12.5px', fontWeight: 600 }}
                >
                  Log evidence request or clarification question:
                </label>
                <input
                  id="pz-followup-note"
                  className="pz-input"
                  type="text"
                  value={followUpPrompt}
                  onChange={(e) => setFollowUpPrompt(e.target.value)}
                  placeholder="e.g. Requested exact km peg and original timestamped photo from contributor"
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="pz-btn-primary"
                    style={{ height: '36px', fontSize: '12.5px' }}
                    onClick={handleSendFollowUp}
                  >
                    Log request
                  </button>
                  <button
                    type="button"
                    className="pz-btn-secondary"
                    style={{ height: '36px', fontSize: '12.5px' }}
                    onClick={() => setFollowUpInputOpen(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Approval Gate Buttons */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '10px',
                marginTop: '4px',
              }}
            >
              <button
                type="button"
                className="pz-btn-secondary"
                onClick={() => setFollowUpInputOpen((o) => !o)}
              >
                Request evidence
              </button>

              <button
                type="button"
                className="pz-btn-secondary"
                style={{ color: 'var(--pz-red)', borderColor: 'var(--pz-border)' }}
                onClick={() => void rejectSignal(signal.id)}
              >
                Reject
              </button>

              <button
                type="button"
                data-testid="verify-approve-btn"
                className="pz-btn-primary"
                style={{ flex: 1, minWidth: '180px' }}
                disabled={!allChecksComplete || signal.workflowStatus === 'verified'}
                onClick={() => void verifySignal(signal.id)}
                title={
                  allChecksComplete
                    ? backendMode === 'demo'
                      ? 'Simulate approval locally; nothing will be published'
                      : 'Request server-confirmed approval and public alert persistence'
                    : 'Complete all 4 verification checklist items to unlock Verify'
                }
              >
                {signal.workflowStatus === 'verified'
                  ? backendMode === 'demo'
                    ? 'Demo approval simulated'
                    : 'Server verified & published'
                  : allChecksComplete
                    ? backendMode === 'demo'
                      ? 'Simulate approval locally'
                      : 'Verify & approve alert'
                    : `Verify (${4 - metCount} check${4 - metCount === 1 ? '' : 's'} remaining)`}
              </button>
            </div>

            {!allChecksComplete && signal.workflowStatus !== 'verified' && (
              <p style={{ fontSize: '12.5px', color: 'var(--pz-muted)' }}>
                <strong>Editor approval gate locked:</strong> Check all 4 corroboration items above
                to enable the Verify button.
              </p>
            )}

            <button
              type="button"
              className="pz-btn-tonal"
              style={{ width: '100%' }}
              onClick={() => openWorkingBriefForSignal(signal.id)}
            >
              <span>Generate / open working investigative brief ({signal.investigationCode}) →</span>
            </button>
          </div>

          {/* Audit / Review History */}
          <div className="pz-card-panel">
            <h2 className="pz-subsection-heading">Review history & provenance log</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {signal.timeline.map((evt, idx) => (
                <div
                  key={idx}
                  style={{
                    borderLeft: '2px solid var(--pz-primary-green)',
                    paddingLeft: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--pz-muted)' }}>
                    {evt.time}
                  </span>
                  <span style={{ fontSize: '13.5px', color: 'var(--pz-text)' }}>
                    {evt.description}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
           MODAL: COMPARE SOURCE REPORTS IN CLUSTER
           ===================================================================== */}
      {compareModalOpen && (
        <div
          className="pz-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Compare cluster source reports"
          onClick={() => setCompareModalOpen(false)}
        >
          <div className="pz-modal-panel" onClick={(e) => e.stopPropagation()}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div>
                <span className="pz-field-label" style={{ color: 'var(--pz-amber-text)' }}>
                  Deduplication & source independence check
                </span>
                <h2 className="pz-section-heading" style={{ marginTop: '4px' }}>
                  Compare {1 + signal.duplicateCandidates.length} related corridor submissions
                </h2>
              </div>
              <button
                type="button"
                className="pz-btn-secondary"
                style={{ height: '36px', padding: '0 12px' }}
                onClick={() => setCompareModalOpen(false)}
              >
                Close
              </button>
            </div>

            <p style={{ fontSize: '13.5px', color: 'var(--pz-muted)' }}>
              Multiple submissions describing the same stretch of road may originate from a single
              forwarded post. Editors must establish independent eyewitnesses before counting them as
              corroboration.
            </p>

            <div style={{ display: 'grid', gap: '12px' }}>
              {/* Primary report */}
              <div className="pz-raw-message-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <strong>
                    Primary lead: {signal.id} ({signal.sourceChannelShort})
                  </strong>
                  <span>{signal.reportedDateTime}</span>
                </div>
                <p style={{ fontSize: '14px', fontWeight: 600 }}>{signal.originalQuote}</p>
                <span style={{ fontSize: '12.5px', color: 'var(--pz-muted)' }}>
                  Location wording: {signal.landmark}
                </span>
              </div>

              {/* Candidate reports */}
              {signal.duplicateCandidates.map((cand) => (
                <div key={cand.id} className="pz-card-panel">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    <span>
                      Candidate: {cand.id} ({cand.sourceLabel})
                    </span>
                    <span style={{ color: 'var(--pz-muted)' }}>{cand.timestamp}</span>
                  </div>
                  <p style={{ fontSize: '14px', fontWeight: 500 }}>{cand.quote}</p>
                  <div style={{ fontSize: '12.5px', color: 'var(--pz-muted)' }}>
                    {cand.locationNote} — {cand.summary}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
