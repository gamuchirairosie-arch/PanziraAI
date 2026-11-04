import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
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

  const {
    focusedCard,
    isFocused,
    closeFocus,
    setFocusedSignalId,
    setFocusedAlertId,
    setFocusedCorridorId,
  } = useCardFocus();

  // Navigation crossfade transition state (matching triciaaa.vercel.app navigating animation)
  const [isNavigating, setIsNavigating] = useState(false);

  const handleNavigate = useCallback((action: () => void) => {
    setIsNavigating(true);
    window.setTimeout(() => {
      action();
      setIsNavigating(false);
    }, 120);
  }, []);

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

  // Alert navigation: Next / Previous alert
  const alertNav = useMemo(() => {
    if (!currentAlert) return null;
    const idx = verifiedAlerts.findIndex((a) => a.id === currentAlert.id);
    const prevAlert = idx > 0 ? verifiedAlerts[idx - 1] : null;
    const nextAlert = idx >= 0 && idx < verifiedAlerts.length - 1 ? verifiedAlerts[idx + 1] : null;
    return {
      index: idx + 1,
      total: verifiedAlerts.length,
      prevAlert,
      nextAlert,
    };
  }, [currentAlert, verifiedAlerts]);

  // Corridor navigation: Next / Previous corridor
  const corridorNav = useMemo(() => {
    if (!currentCorridor) return null;
    const idx = corridors.findIndex((c) => c.id === currentCorridor.id);
    const prevCorridor = idx > 0 ? corridors[idx - 1] : null;
    const nextCorridor = idx >= 0 && idx < corridors.length - 1 ? corridors[idx + 1] : null;
    return {
      index: idx + 1,
      total: corridors.length,
      prevCorridor,
      nextCorridor,
    };
  }, [currentCorridor, corridors]);

  const handleSelectSignal = useCallback(
    (sig: SignalReport) => {
      setSelectedMonitorId(sig.id);
      setSelectedInboxId(sig.id);
      setSelectedVerifyId(sig.id);
      setFocusedSignalId(sig.id);
    },
    [setSelectedMonitorId, setSelectedInboxId, setSelectedVerifyId, setFocusedSignalId]
  );

  const handleSelectAlert = useCallback(
    (alt: VerifiedPublicAlert) => {
      setFocusedAlertId(alt.id);
    },
    [setFocusedAlertId]
  );

  const handleSelectCorridor = useCallback(
    (cor: CorridorWatchItem) => {
      setSelectedCorridorId(cor.id as 'A5' | 'KHAMI' | 'ESIGODINI');
      setFocusedCorridorId(cor.id);
    },
    [setSelectedCorridorId, setFocusedCorridorId]
  );

  // Active navigation items for ALLISMIND top bar (prev / next)
  const activeNav = useMemo(() => {
    if (currentSignal && signalNav) {
      return {
        label: `Signal ${signalNav.index} of ${signalNav.total}`,
        hasPrev: Boolean(signalNav.prevSignal),
        hasNext: Boolean(signalNav.nextSignal),
        onPrev: () => {
          if (signalNav.prevSignal) {
            handleNavigate(() => handleSelectSignal(signalNav.prevSignal!));
          }
        },
        onNext: () => {
          if (signalNav.nextSignal) {
            handleNavigate(() => handleSelectSignal(signalNav.nextSignal!));
          }
        },
      };
    }
    if (currentAlert && alertNav) {
      return {
        label: `Alert ${alertNav.index} of ${alertNav.total}`,
        hasPrev: Boolean(alertNav.prevAlert),
        hasNext: Boolean(alertNav.nextAlert),
        onPrev: () => {
          if (alertNav.prevAlert) {
            handleNavigate(() => handleSelectAlert(alertNav.prevAlert!));
          }
        },
        onNext: () => {
          if (alertNav.nextAlert) {
            handleNavigate(() => handleSelectAlert(alertNav.nextAlert!));
          }
        },
      };
    }
    if (currentCorridor && corridorNav) {
      return {
        label: `Corridor ${corridorNav.index} of ${corridorNav.total}`,
        hasPrev: Boolean(corridorNav.prevCorridor),
        hasNext: Boolean(corridorNav.nextCorridor),
        onPrev: () => {
          if (corridorNav.prevCorridor) {
            handleNavigate(() => handleSelectCorridor(corridorNav.prevCorridor!));
          }
        },
        onNext: () => {
          if (corridorNav.nextCorridor) {
            handleNavigate(() => handleSelectCorridor(corridorNav.nextCorridor!));
          }
        },
      };
    }
    return null;
  }, [
    currentSignal,
    signalNav,
    currentAlert,
    alertNav,
    currentCorridor,
    corridorNav,
    handleNavigate,
    handleSelectSignal,
    handleSelectAlert,
    handleSelectCorridor,
  ]);

  // Keyboard navigation listener (Escape = Close, ArrowLeft = Prev, ArrowRight = Next)
  useEffect(() => {
    if (!isFocused) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        closeFocus();
      } else if (e.key === 'ArrowLeft') {
        if (activeNav && activeNav.hasPrev) {
          e.preventDefault();
          activeNav.onPrev();
        }
      } else if (e.key === 'ArrowRight') {
        if (activeNav && activeNav.hasNext) {
          e.preventDefault();
          activeNav.onNext();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFocused, closeFocus, activeNav]);

  // Touch gesture listeners (Swipe left = next, swipe right = prev, swipe down = close)
  const touchStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0 && activeNav?.hasNext) {
        activeNav.onNext();
      } else if (dx > 0 && activeNav?.hasPrev) {
        activeNav.onPrev();
      }
    } else if (dy > 90 && Math.abs(dy) > Math.abs(dx)) {
      closeFocus();
    }
  };

  if (!isFocused || !focusedCard) return null;

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
      <div
        className={`pz-focus-modal-dialog ${isNavigating ? 'navigating is-navigating' : ''}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* ===================================================================
            READER BAR (ALLISMIND — Library Navigation Pattern)
            =================================================================== */}
        <div className="pz-reader-bar">
          <button
            type="button"
            className="pz-reader-btn pz-reader-close-btn"
            onClick={closeFocus}
            aria-label="Close reader overlay"
          >
            <span>✕ Close</span>
            <span className="pz-kbd-badge">Esc</span>
          </button>

          <div className="pz-reader-counter">
            <span className="pz-focus-category-tag">
              {focusedCard.categoryLabel || focusedCard.type.toUpperCase()}
            </span>
            {activeNav ? (
              <span className="pz-reader-counter-text">{activeNav.label}</span>
            ) : focusedCard.badge ? (
              renderBadge(focusedCard.badge, focusedCard.badgeColor)
            ) : null}
          </div>

          <div className="pz-reader-nav">
            <button
              type="button"
              className="pz-reader-btn"
              disabled={!activeNav || !activeNav.hasPrev}
              onClick={activeNav?.onPrev}
              title="Previous item (Left Arrow key)"
            >
              <span>← Previous</span>
              <span className="pz-kbd-badge">←</span>
            </button>
            <button
              type="button"
              className="pz-reader-btn"
              disabled={!activeNav || !activeNav.hasNext}
              onClick={activeNav?.onNext}
              title="Next item (Right Arrow key)"
            >
              <span>Next →</span>
              <span className="pz-kbd-badge">→</span>
            </button>
          </div>
        </div>

        {/* ===================================================================
            READER BODY: Focused Content with Inter Typography Scale
            =================================================================== */}
        <div className="pz-focus-modal-body">
          {/* Header Area inside scrollable reader */}
          <div className="pz-reader-header-area">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {focusedCard.badge && renderBadge(focusedCard.badge, focusedCard.badgeColor)}
              {currentSignal && (
                <span className="pz-badge pz-badge-neutral" style={{ fontWeight: 600 }}>
                  {currentSignal.id}
                </span>
              )}
              {currentAlert && currentAlert.isCritical && (
                <span className="pz-badge pz-badge-critical">Critical Severity</span>
              )}
            </div>

            <h2 className="pz-reader-title">
              {currentSignal?.title || currentAlert?.title || currentCorridor?.name || focusedCard.title}
            </h2>

            {(focusedCard.subtitle || currentSignal?.subtitle || currentAlert?.location) && (
              <p className="pz-reader-meta">
                {currentSignal?.subtitle ||
                  (currentAlert && `${currentAlert.location} · ${currentAlert.corridor} · Updated ${currentAlert.updatedAgo}`) ||
                  focusedCard.subtitle}
              </p>
            )}
          </div>
          {/* 1. SIGNAL TYPE (Incoming signals, inbox leads, selected signal) */}
          {focusedCard.type === 'signal' && currentSignal && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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

