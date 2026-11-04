import React, { useEffect, useMemo } from 'react';
import { ASSETS } from '../assetsMap';
import { usePanzira } from '../context/PanziraContext';
import { useCardFocus } from '../context/CardFocusContext';
import { EvidencePhotoFrame } from './CroppedFigmaMedia';
import { SignalReport, VerifiedPublicAlert, CorridorWatchItem } from '../types';

export const GlobalCardFocusModal: React.FC = () => {
  const {
    signals,
    verifiedAlerts,
    corridors,
    navigateNewsroom,
    navigatePublic,
    setSelectedMonitorId,
    setSelectedInboxId,
    setSelectedVerifyId,
    setSelectedCorridorId,
    revealedGraphicIds,
    toggleGraphicReveal,
  } = usePanzira();

  const { focusedCard, isFocused, closeFocus, setFocusedSignalId } = useCardFocus();

  // Escape key listener to close
  useEffect(() => {
    if (!isFocused) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeFocus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFocused, closeFocus]);

  // Prevent body scroll while modal is focused
  useEffect(() => {
    if (isFocused) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isFocused]);

  // Lookup target signal if type is signal or signal-related
  const currentSignal: SignalReport | null = useMemo(() => {
    if (!focusedCard) return null;
    if (focusedCard.signalId) {
      return signals.find((s) => s.id === focusedCard.signalId) || signals[0];
    }
    return null;
  }, [focusedCard, signals]);

  // Lookup target alert
  const currentAlert: VerifiedPublicAlert | null = useMemo(() => {
    if (!focusedCard) return null;
    if (focusedCard.alertId) {
      return verifiedAlerts.find((a) => a.id === focusedCard.alertId) || verifiedAlerts[0];
    }
    return null;
  }, [focusedCard, verifiedAlerts]);

  // Lookup target corridor
  const currentCorridor: CorridorWatchItem | null = useMemo(() => {
    if (!focusedCard) return null;
    if (focusedCard.corridorId) {
      return corridors.find((c) => c.id === focusedCard.corridorId) || corridors[0];
    }
    return null;
  }, [focusedCard, corridors]);

  // Signal navigation: Next / Previous signal
  const signalNav = useMemo(() => {
    if (!currentSignal) return null;
    const idx = signals.findIndex((s) => s.id === currentSignal.id);
    const prevSignal = idx > 0 ? signals[idx - 1] : null;
    const nextSignal = idx >= 0 && idx < signals.length - 1 ? signals[idx + 1] : null;
    return {
      index: idx + 1,
      total: signals.length,
      prevSignal,
      nextSignal,
    };
  }, [currentSignal, signals]);

  if (!isFocused || !focusedCard) return null;

  const handleSelectSignal = (sig: SignalReport) => {
    setSelectedMonitorId(sig.id);
    setSelectedInboxId(sig.id);
    setSelectedVerifyId(sig.id);
    setFocusedSignalId(sig.id);
  };

  const renderBadge = (label?: string, color?: string) => {
    if (!label) return null;
    let cls = 'pz-badge pz-badge-neutral';
    if (color === 'green' || color === 'verified') cls = 'pz-badge pz-badge-verified';
    if (color === 'red' || color === 'critical') cls = 'pz-badge pz-badge-critical';
    if (color === 'amber' || color === 'gold') cls = 'pz-badge pz-badge-amber';
    return <span className={cls}>{label}</span>;
  };

  return (
    <div
      className="pz-focus-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={focusedCard.title}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          closeFocus();
        }
      }}
    >
      <div className="pz-focus-modal-dialog">
        {/* ===================================================================
            HEADER: Category Tag, Title, Subtitle, Close X Button
            =================================================================== */}
        <header className="pz-focus-modal-header">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span className="pz-focus-category-tag">
                {focusedCard.categoryLabel || focusedCard.type.toUpperCase()}
              </span>
              {focusedCard.badge && renderBadge(focusedCard.badge, focusedCard.badgeColor)}
              {currentSignal && (
                <span className="pz-badge pz-badge-neutral" style={{ fontWeight: 600 }}>
                  {currentSignal.id}
                </span>
              )}
            </div>

            <h2 className="pz-focus-modal-title">
              {currentSignal?.title || currentAlert?.title || currentCorridor?.name || focusedCard.title}
            </h2>

            {(focusedCard.subtitle || currentSignal?.subtitle || currentAlert?.location) && (
              <p className="pz-focus-modal-subtitle">
                {currentSignal?.subtitle ||
                  (currentAlert && `${currentAlert.location} · ${currentAlert.corridor}`) ||
                  focusedCard.subtitle}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="pz-focus-esc-hint" title="Press Escape to close">
              ESC
            </span>
            <button
              type="button"
              className="pz-focus-close-btn"
              onClick={closeFocus}
              aria-label="Close expanded card view"
            >
              <img src={ASSETS.closeX} alt="" style={{ width: '18px', height: '18px' }} />
            </button>
          </div>
        </header>

        {/* ===================================================================
            BODY CONTENT BASED ON FOCUSED CARD TYPE
            =================================================================== */}
        <div className="pz-focus-modal-body">
          {/* 1. SIGNAL TYPE (Incoming signals, inbox leads, selected signal) */}
          {focusedCard.type === 'signal' && currentSignal && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Signal Pager Bar */}
              {signalNav && (
                <div className="pz-focus-signal-pager">
                  <div style={{ fontSize: '13px', color: 'var(--pz-muted)', fontWeight: 500 }}>
                    Signal <strong>{signalNav.index}</strong> of <strong>{signalNav.total}</strong> in active intake
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="pz-btn-secondary"
                      style={{ height: '32px', fontSize: '12px', padding: '0 12px' }}
                      disabled={!signalNav.prevSignal}
                      onClick={() => signalNav.prevSignal && handleSelectSignal(signalNav.prevSignal)}
                    >
                      ← Previous
                    </button>
                    <button
                      type="button"
                      className="pz-btn-secondary"
                      style={{ height: '32px', fontSize: '12px', padding: '0 12px' }}
                      disabled={!signalNav.nextSignal}
                      onClick={() => signalNav.nextSignal && handleSelectSignal(signalNav.nextSignal)}
                    >
                      Next Signal →
                    </button>
                  </div>
                </div>
              )}

              {/* Status and Metadata Strip */}
              <div className="pz-focus-meta-strip">
                <div>
                  <span className="pz-field-label">Intake Channel</span>
                  <div style={{ fontWeight: 600, fontSize: '14px', marginTop: '2px' }}>
                    {currentSignal.sourceChannelLabel}
                  </div>
                </div>
                <div>
                  <span className="pz-field-label">Corridor & Landmark</span>
                  <div style={{ fontWeight: 600, fontSize: '14px', marginTop: '2px' }}>
                    {currentSignal.corridor} · {currentSignal.landmark}
                  </div>
                </div>
                <div>
                  <span className="pz-field-label">Recorded Time</span>
                  <div style={{ fontWeight: 600, fontSize: '14px', marginTop: '2px' }}>
                    {currentSignal.reportedDateTime}
                  </div>
                </div>
                <div>
                  <span className="pz-field-label">Workflow Gate</span>
                  <div style={{ fontWeight: 600, fontSize: '14px', marginTop: '2px' }}>
                    {currentSignal.workflowStatus === 'verified'
                      ? 'Approved by Human Editor'
                      : currentSignal.workflowStatus === 'rejected'
                        ? 'Archived / Withheld'
                        : 'Unverified · Awaiting Check'}
                  </div>
                </div>
              </div>

              {/* Original Quote Card */}
              <div className="pz-raw-message-card" style={{ padding: '18px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span className="pz-field-label" style={{ color: 'var(--pz-primary-green)' }}>
                    Original Citizen / Source Message ({currentSignal.originalLanguage})
                  </span>
                  <span className="pz-badge pz-badge-neutral">{currentSignal.visibility}</span>
                </div>

                <p className="pz-raw-quote" style={{ fontSize: '15.5px', lineHeight: 1.6, margin: '8px 0' }}>
                  "{currentSignal.originalQuote}"
                </p>

                {currentSignal.draftEnglishTranslation && (
                  <div className="pz-translation-box" style={{ marginTop: '12px' }}>
                    <span className="pz-field-label" style={{ color: 'var(--pz-demo-text)' }}>
                      Draft English Translation (Review Shona/Ndebele nuance before verification)
                    </span>
                    <p style={{ fontSize: '14px', color: 'var(--pz-text)', fontStyle: 'italic', marginTop: '4px' }}>
                      {currentSignal.draftEnglishTranslation}
                    </p>
                  </div>
                )}

                <div style={{ fontSize: '12.5px', color: 'var(--pz-muted)', marginTop: '8px' }}>
                  <strong>Provenance Note:</strong> {currentSignal.sourceProvenanceNote}
                </div>

                {currentSignal.evidenceLink && (
                  <div style={{ fontSize: '12.5px', color: 'var(--pz-primary-green)', marginTop: '4px', wordBreak: 'break-all' }}>
                    <strong>Reference URL:</strong> {currentSignal.evidenceLink}
                  </div>
                )}
              </div>

              {/* 2-Column Split: Left AI Extraction, Right Visual Evidence & Safety Gate */}
              <div className="pz-focus-split-2col">
                {/* Left: AI Structured Evidence */}
                <div className="pz-card-panel" style={{ padding: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 className="pz-subsection-heading" style={{ fontSize: '16px' }}>AI Pre-Triage Extractions</h3>
                    <span className="pz-badge pz-badge-amber">Suggestions, not proof</span>
                  </div>

                  <div className="pz-divider" />

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <div className="pz-field-label">Suggested Hazard Classification</div>
                      <div className="pz-field-value" style={{ fontSize: '14.5px' }}>{currentSignal.aiHazardType}</div>
                    </div>
                    <div>
                      <div className="pz-field-label">Corridor Geo-Match</div>
                      <div className="pz-field-value" style={{ fontSize: '14.5px' }}>{currentSignal.aiLikelyCorridor}</div>
                    </div>
                    <div>
                      <div className="pz-field-label">Language Processing</div>
                      <div className="pz-field-value" style={{ fontSize: '14.5px' }}>{currentSignal.aiLanguageNote}</div>
                    </div>
                    <div>
                      <div className="pz-field-label">Location Precision</div>
                      <div className="pz-field-value" style={{ color: 'var(--pz-amber-text)', fontSize: '14.5px' }}>
                        {currentSignal.aiLocationPrecision}
                      </div>
                    </div>
                    <div>
                      <div className="pz-field-label">Confidence Assessment</div>
                      <div className="pz-field-value" style={{ fontSize: '14.5px' }}>{currentSignal.aiConfidenceNote}</div>
                      <div style={{ height: '6px', background: 'var(--pz-pale)', borderRadius: '3px', marginTop: '6px', overflow: 'hidden' }}>
                        <div style={{ width: `${currentSignal.aiConfidencePercent}%`, height: '100%', background: 'var(--pz-gold)' }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Visual Evidence & Graphic Safety */}
                <div className="pz-card-panel" style={{ padding: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 className="pz-subsection-heading" style={{ fontSize: '16px' }}>Visual Evidence & Safety</h3>
                    {currentSignal.isGraphicImage ? (
                      <span className="pz-badge pz-badge-critical">Graphic safety active</span>
                    ) : (
                      <span className="pz-badge pz-badge-neutral">{currentSignal.photoType}</span>
                    )}
                  </div>

                  <div className="pz-divider" />

                  {currentSignal.photoType !== 'none' ? (
                    <div>
                      <EvidencePhotoFrame
                        photoType={currentSignal.photoType}
                        customPhotoDataUrl={currentSignal.customPhotoDataUrl}
                        isGraphic={currentSignal.isGraphicImage}
                        isRevealed={Boolean(revealedGraphicIds[currentSignal.id])}
                        onToggleReveal={() => toggleGraphicReveal(currentSignal.id)}
                        graphicReason={currentSignal.graphicSafetyReason}
                        height={180}
                        allowEditorReveal={true}
                      />
                      <div style={{ fontSize: '12.5px', color: 'var(--pz-muted)', marginTop: '8px' }}>
                        {currentSignal.photoCaption || currentSignal.aiImageSummary}
                      </div>
                    </div>
                  ) : (
                    <div className="pz-notice-box" style={{ borderRadius: '6px' }}>
                      <p style={{ fontSize: '13px', color: 'var(--pz-muted)' }}>
                        No photo attached. Low-bandwidth text report. Independent verification with local reporters or road witnesses is required before publication.
                      </p>
                    </div>
                  )}

                  {/* 4-Point Checklist Summary */}
                  <div style={{ marginTop: '14px', borderTop: '1px solid var(--pz-border)', paddingTop: '10px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--pz-muted)', marginBottom: '6px' }}>
                      Editorial Corroboration Status:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{currentSignal.checklist.locationAndTime ? '✅' : '⏳'}</span>
                        <span>Corridor & landmark placement</span>
                      </div>
                      <div style={{ fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{currentSignal.checklist.mediaAndDate ? '✅' : '⏳'}</span>
                        <span>Media provenance & capture date</span>
                      </div>
                      <div style={{ fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{currentSignal.checklist.independentSource ? '✅' : '⏳'}</span>
                        <span>Independent corroborating source</span>
                      </div>
                      <div style={{ fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{currentSignal.checklist.hazardStillPresent ? '✅' : '⏳'}</span>
                        <span>Hazard active & impacting motorists</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. VERIFIED ALERT TYPE */}
          {focusedCard.type === 'alert' && currentAlert && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div className="pz-focus-meta-strip">
                <div>
                  <span className="pz-field-label">Corridor & Suburb</span>
                  <div style={{ fontWeight: 600, fontSize: '15px', marginTop: '2px' }}>
                    {currentAlert.corridor} · {currentAlert.location}
                  </div>
                </div>
                <div>
                  <span className="pz-field-label">Hazard Category</span>
                  <div style={{ fontWeight: 600, fontSize: '15px', marginTop: '2px' }}>
                    {currentAlert.categoryLabel}
                  </div>
                </div>
                <div>
                  <span className="pz-field-label">Severity Level</span>
                  <div style={{ fontWeight: 600, fontSize: '15px', marginTop: '2px', color: currentAlert.isCritical ? 'var(--pz-red)' : 'var(--pz-primary-green)' }}>
                    {currentAlert.severity}
                  </div>
                </div>
                <div>
                  <span className="pz-field-label">Last Editorial Update</span>
                  <div style={{ fontWeight: 600, fontSize: '15px', marginTop: '2px' }}>
                    {currentAlert.updatedAgo}
                  </div>
                </div>
              </div>

              <div className="pz-card-panel" style={{ padding: '20px', gap: '12px' }}>
                <h3 className="pz-subsection-heading">Public Safety Advisory</h3>
                <p style={{ fontSize: '15.5px', color: 'var(--pz-text)', lineHeight: 1.6 }}>
                  {currentAlert.description}
                </p>

                <div className="pz-notice-box-bordered" style={{ marginTop: '8px' }}>
                  <p style={{ fontSize: '13px', color: 'var(--pz-text)' }}>
                    <strong>Verification Provenance:</strong> {currentAlert.sourceAttribution}
                  </p>
                </div>
              </div>

              <div className="pz-cream-panel" style={{ padding: '16px 20px', gap: '8px' }}>
                <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--pz-demo-text)' }}>
                  Motorist Guidance & Response
                </div>
                <p style={{ fontSize: '13.5px', color: 'var(--pz-muted)', margin: 0 }}>
                  Exercise caution along this corridor. Municipal road authorities have been notified through public safety channels. Please report any changes in road surface conditions.
                </p>
              </div>
            </div>
          )}

          {/* 3. CORRIDOR WATCHLIST / HOTSPOT TYPE */}
          {(focusedCard.type === 'corridor' || focusedCard.type === 'hotspot') && currentCorridor && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div className="pz-focus-meta-strip">
                <div>
                  <span className="pz-field-label">Watchlist Rank</span>
                  <div style={{ fontWeight: 600, fontSize: '15px', marginTop: '2px' }}>
                    Corridor #{currentCorridor.rank}
                  </div>
                </div>
                <div>
                  <span className="pz-field-label">Screening Priority Score</span>
                  <div style={{ fontWeight: 600, fontSize: '15px', marginTop: '2px', color: 'var(--pz-primary-green)' }}>
                    {currentCorridor.scoreDisplay}
                  </div>
                </div>
                <div>
                  <span className="pz-field-label">Confidence Ceiling</span>
                  <div style={{ fontWeight: 600, fontSize: '15px', marginTop: '2px', color: 'var(--pz-amber-text)' }}>
                    {currentCorridor.confidenceLabel}
                  </div>
                </div>
                <div>
                  <span className="pz-field-label">Clustered Submissions</span>
                  <div style={{ fontWeight: 600, fontSize: '15px', marginTop: '2px' }}>
                    {currentCorridor.submissionsSummary}
                  </div>
                </div>
              </div>

              <div className="pz-card-panel" style={{ padding: '20px' }}>
                <h3 className="pz-subsection-heading">Corridor Hazard Assessment</h3>
                <p style={{ fontSize: '15px', color: 'var(--pz-text)', lineHeight: 1.6, marginTop: '6px' }}>
                  {currentCorridor.hazardSummary}
                </p>
                <p style={{ fontSize: '13.5px', color: 'var(--pz-muted)', marginTop: '4px' }}>
                  {currentCorridor.patternNote}
                </p>
              </div>

              <div className="pz-focus-split-2col">
                <div className="pz-card-panel" style={{ padding: '18px' }}>
                  <div className="pz-field-label" style={{ color: 'var(--pz-primary-green)' }}>
                    Signals Raising Priority
                  </div>
                  <ul style={{ margin: '8px 0 0 16px', padding: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {currentCorridor.positiveFactors.map((f, i) => (
                      <li key={i} style={{ fontSize: '13.5px', color: 'var(--pz-primary-green)' }}>{f}</li>
                    ))}
                  </ul>
                </div>

                <div className="pz-card-panel" style={{ padding: '18px' }}>
                  <div className="pz-field-label" style={{ color: 'var(--pz-red)' }}>
                    Uncertainty & Evidence Gaps
                  </div>
                  <ul style={{ margin: '8px 0 0 16px', padding: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {currentCorridor.negativeFactors.map((f, i) => (
                      <li key={i} style={{ fontSize: '13.5px', color: 'var(--pz-red)' }}>{f}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pz-cream-panel" style={{ padding: '18px', gap: '8px' }}>
                <div style={{ fontWeight: 600, fontSize: '14.5px', color: 'var(--pz-demo-text)' }}>
                  Logistics & Fleet Advisory: {currentCorridor.fleetBadge}
                </div>
                <p style={{ fontSize: '13.5px', color: 'var(--pz-text)', margin: 0 }}>
                  {currentCorridor.fleetRecommendation}
                </p>
                <div style={{ fontSize: '12.5px', color: 'var(--pz-muted)', marginTop: '4px' }}>
                  Simulated API Endpoint: <code>{currentCorridor.apiEndpoint}</code>
                </div>
              </div>
            </div>
          )}

          {/* 4. KEY PERFORMANCE METRIC / STATISTIC TYPE */}
          {focusedCard.type === 'metric' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="pz-focus-metric-hero">
                <div className="pz-focus-metric-big-value">{focusedCard.metricValue ?? '—'}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--pz-text)' }}>
                    {focusedCard.title}
                  </div>
                  <div style={{ fontSize: '14px', color: 'var(--pz-muted)' }}>
                    {focusedCard.metricDescription || focusedCard.subtitle}
                  </div>
                </div>
              </div>

              <div className="pz-card-panel" style={{ padding: '20px', gap: '12px' }}>
                <h3 className="pz-subsection-heading">Metric Definition & Editorial Role</h3>
                <p style={{ fontSize: '14.5px', color: 'var(--pz-text)', lineHeight: 1.6 }}>
                  {focusedCard.description ||
                    'This metric tracks operational activity within the Bulawayo verification pipeline. Each data point is linked to an identifiable intake record and verified by our editorial desk.'}
                </p>
              </div>

              {focusedCard.metadata && focusedCard.metadata.length > 0 && (
                <div className="pz-card-panel" style={{ padding: '18px' }}>
                  <h4 className="pz-field-label" style={{ marginBottom: '10px' }}>Data Breakdown & Verification Criteria</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {focusedCard.metadata.map((m, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1px solid var(--pz-pale)', paddingBottom: '6px' }}>
                        <span style={{ fontSize: '13.5px', color: 'var(--pz-muted)' }}>{m.label}</span>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: m.color || 'var(--pz-text)' }}>{m.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 5. AI STRUCTURED EVIDENCE TYPE */}
          {focusedCard.type === 'ai-evidence' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div className="pz-notice-box-bordered">
                <p style={{ fontSize: '13.5px', color: 'var(--pz-text)' }}>
                  <strong>AI Pre-Triage Framework:</strong> AI extracts candidate hazard categories, matches arterial corridors from text, and translates vernacular Shona/Ndebele tips into draft English. All model outputs are advisory suggestions held for human corroboration.
                </p>
              </div>

              {currentSignal && (
                <div className="pz-card-panel" style={{ padding: '20px', gap: '14px' }}>
                  <h3 className="pz-subsection-heading">Extractions for {currentSignal.id}</h3>
                  <div className="pz-extract-2col">
                    <div>
                      <div className="pz-field-label">Hazard Category</div>
                      <div className="pz-field-value" style={{ fontSize: '15px' }}>{currentSignal.aiHazardType}</div>
                    </div>
                    <div>
                      <div className="pz-field-label">Corridor Geo-Match</div>
                      <div className="pz-field-value" style={{ fontSize: '15px' }}>{currentSignal.aiLikelyCorridor}</div>
                    </div>
                    <div>
                      <div className="pz-field-label">Language Detection</div>
                      <div className="pz-field-value" style={{ fontSize: '15px' }}>{currentSignal.aiLanguageNote}</div>
                    </div>
                    <div>
                      <div className="pz-field-label">Location Precision Score</div>
                      <div className="pz-field-value" style={{ color: 'var(--pz-amber-text)', fontSize: '15px' }}>
                        {currentSignal.aiLocationPrecision}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '12px', borderTop: '1px solid var(--pz-border)', paddingTop: '12px' }}>
                    <div className="pz-field-label">Confidence Assessment</div>
                    <div className="pz-field-value">{currentSignal.aiConfidenceNote}</div>
                    <div style={{ height: '8px', background: 'var(--pz-pale)', borderRadius: '4px', marginTop: '6px', overflow: 'hidden' }}>
                      <div style={{ width: `${currentSignal.aiConfidencePercent}%`, height: '100%', background: 'var(--pz-gold)' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 6. REVIEW PIPELINE TYPE */}
          {focusedCard.type === 'pipeline' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div className="pz-notice-box">
                <p style={{ fontSize: '13.5px', color: 'var(--pz-text)' }}>
                  <strong>Panzira 4-Stage Editorial Pipeline:</strong> Every citizen report progresses through four strict gates before public safety alerts are published to the Bulawayo map.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="pz-card-panel" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="pz-pipeline-index is-done">✓</div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Stage 01: Intake & Channel Ingestion</h4>
                      <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--pz-muted)' }}>
                        Captured from Web, WhatsApp Bot (+263 77 123 4567), or toll-free USSD (*140#) with timestamp and provenance metadata.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pz-card-panel" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="pz-pipeline-index is-done">✓</div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Stage 02: AI Extractions & Pre-Triage</h4>
                      <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--pz-muted)' }}>
                        Draft translation from Shona/Ndebele, corridor matching, and duplicate clustering without autonomous publishing.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pz-card-panel" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="pz-pipeline-index is-current">03</div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--pz-amber-text)' }}>Stage 03: Field Corroboration</h4>
                      <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--pz-muted)' }}>
                        Requires independent confirmation from local eyewitnesses, traffic reporters, or municipal road logs.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pz-card-panel" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="pz-pipeline-index">04</div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Stage 04: Human Editor Gate</h4>
                      <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--pz-muted)' }}>
                        Only an accredited journalist or editor can sign off on public release. Graphic photos are permanently withheld.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 7. MISSING INFORMATION TYPE */}
          {focusedCard.type === 'missing-info' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div className="pz-missing-panel" style={{ padding: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--pz-red)' }}>
                  What is still missing before publication?
                </h3>
                <p style={{ fontSize: '13.5px', color: 'var(--pz-text)', marginTop: '6px' }}>
                  Under our independent editorial standards, public safety alerts cannot be broadcast until all required corroborating details are gathered.
                </p>

                {currentSignal && (
                  <ul style={{ margin: '12px 0 0 20px', padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {currentSignal.missingItems.map((item, idx) => (
                      <li key={idx} style={{ fontSize: '14px', color: 'var(--pz-text)', fontWeight: 500 }}>
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="pz-card-panel" style={{ padding: '18px' }}>
                <h4 className="pz-field-label">How Journalists Complete These Checks</h4>
                <div style={{ fontSize: '13.5px', color: 'var(--pz-muted)', display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                  <div>1. Corroborate landmark with municipal road repair schedules or emergency dispatch logs.</div>
                  <div>2. Request high-resolution photo evidence or witness follow-up via opt-in WhatsApp chat.</div>
                  <div>3. Check with local transport operators (e.g. commuter omnibus associations) on the corridor.</div>
                </div>
              </div>
            </div>
          )}

          {/* 8. MULTICHANNEL REPORTING TYPE */}
          {focusedCard.type === 'multichannel' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div className="pz-card-panel" style={{ padding: '20px', gap: '12px' }}>
                <h3 className="pz-subsection-heading">{focusedCard.title}</h3>
                <p style={{ fontSize: '14.5px', color: 'var(--pz-text)', lineHeight: 1.6 }}>
                  {focusedCard.description}
                </p>

                {focusedCard.metadata && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                    {focusedCard.metadata.map((m, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--pz-pale)', paddingBottom: '6px' }}>
                        <span style={{ fontSize: '13px', color: 'var(--pz-muted)' }}>{m.label}</span>
                        <span style={{ fontSize: '13.5px', fontWeight: 600 }}>{m.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 9. CUSTOM CONTENT OR GENERIC FALLBACK */}
          {focusedCard.customContent && (
            <div style={{ marginTop: '12px' }}>{focusedCard.customContent}</div>
          )}
        </div>

        {/* ===================================================================
            FOOTER: Direct Navigation & Workflow Action Buttons
            =================================================================== */}
        <footer className="pz-focus-modal-footer">
          <div style={{ fontSize: '12.5px', color: 'var(--pz-muted)' }}>
            Press <strong>Esc</strong> or click outside to return to dashboard
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {focusedCard.actions && focusedCard.actions.length > 0 ? (
              focusedCard.actions.map((act, i) => (
                <button
                  key={i}
                  type="button"
                  className={
                    act.variant === 'primary'
                      ? 'pz-btn-primary'
                      : act.variant === 'channel-whatsapp'
                        ? 'pz-btn-channel-whatsapp'
                        : act.variant === 'channel-ussd'
                          ? 'pz-btn-channel-ussd'
                          : 'pz-btn-secondary'
                  }
                  onClick={() => {
                    act.onClick();
                    closeFocus();
                  }}
                >
                  {act.label}
                </button>
              ))
            ) : currentSignal ? (
              <>
                <button
                  type="button"
                  className="pz-btn-secondary"
                  onClick={() => {
                    handleSelectSignal(currentSignal);
                    navigateNewsroom('inbox', currentSignal.id);
                    closeFocus();
                  }}
                >
                  Open in Signal Inbox →
                </button>
                <button
                  type="button"
                  className="pz-btn-primary"
                  onClick={() => {
                    handleSelectSignal(currentSignal);
                    navigateNewsroom('verify', currentSignal.id);
                    closeFocus();
                  }}
                >
                  Open Verification Checklist →
                </button>
              </>
            ) : currentAlert ? (
              <button
                type="button"
                className="pz-btn-primary"
                onClick={() => {
                  navigatePublic('overview');
                  closeFocus();
                }}
              >
                View on Public Dashboard →
              </button>
            ) : currentCorridor ? (
              <button
                type="button"
                className="pz-btn-primary"
                onClick={() => {
                  setSelectedCorridorId(currentCorridor.id);
                  navigateNewsroom('verify');
                  closeFocus();
                }}
              >
                Inspect Corridor Submissions →
              </button>
            ) : (
              <button type="button" className="pz-btn-primary" onClick={closeFocus}>
                Done
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
};

