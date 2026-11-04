import React, { useMemo } from 'react';
import { ASSETS } from '../assetsMap';
import { CorridorContextMap } from '../components/BulawayoMap';
import { usePanzira } from '../context/PanziraContext';
import { useCardFocus } from '../context/CardFocusContext';

export const HotspotIntelligenceView: React.FC = () => {
  const {
    corridors,
    selectedCorridorId,
    setSelectedCorridorId,
    navigateNewsroom,
  } = usePanzira();

  const { focusCard } = useCardFocus();

  const selectedCorridor = useMemo(() => {
    return corridors.find((c) => c.id === selectedCorridorId) || corridors[0];
  }, [corridors, selectedCorridorId]);

  const jumpSignalId =
    selectedCorridor.id === 'A5'
      ? 'PZ-DEMO-0427'
      : selectedCorridor.id === 'KHAMI'
        ? 'PZ-SIG-0046'
        : 'PZ-SIG-0045';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Header */}
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
          <h1 className="pz-page-title">Hotspot intelligence</h1>
          <p className="pz-page-subtitle">
            Geographic concentrations of reported Bulawayo road hazards surfaced as possible
            editorial screening patterns
          </p>
        </div>

        <button
          type="button"
          className="pz-btn-secondary"
          onClick={() => navigateNewsroom('fleet')}
        >
          Preview fleet corridor advisory →
        </button>
      </div>

      {/* 4 Screening Metrics */}
      <section className="pz-metrics-grid-4" aria-label="Hotspot screening metrics">
        <button
          type="button"
          className="pz-metric-card pz-expandable-card"
          style={{ textAlign: 'left', cursor: 'pointer' }}
          onClick={() =>
            focusCard({
              type: 'metric',
              title: 'Corridors on Active Watchlist',
              subtitle: 'A5 Harare Rd, Khami Rd, Esigodini Rd',
              categoryLabel: 'SURVEILLANCE WATCHLIST',
              metricValue: '03',
              metricDescription: 'Primary commercial transit arteries in Bulawayo',
              description:
                'Corridors are continuously screened for cluster density of pothole damage, flash flooding, and bottleneck collisions reported by citizens and fleet drivers.',
              metadata: [
                { label: 'Harare Rd (A5)', value: 'High priority · Severe washouts' },
                { label: 'Khami Rd', value: 'Medium priority · Heavy vehicle congestion' },
                { label: 'Esigodini Rd', value: 'Watch priority · Incomplete repairs' },
              ],
            })
          }
          title="Click to view corridors watchlist metric details"
        >
          <span className="pz-expand-hint-pill">Expand ⤢</span>
          <span className="pz-metric-value">03</span>
          <span className="pz-metric-label">Corridors on watchlist</span>
          <span style={{ fontSize: '12px', color: 'var(--pz-muted)' }}>
            A5, Khami Rd, Esigodini Rd
          </span>
        </button>

        <button
          type="button"
          className="pz-metric-card pz-expandable-card"
          style={{ textAlign: 'left', cursor: 'pointer' }}
          onClick={() =>
            focusCard({
              type: 'metric',
              title: 'Clustered Corridor Mentions',
              subtitle: '06 candidate duplicate signals grouped by corridor location',
              categoryLabel: 'CLUSTER TRIAGE',
              metricValue: '06',
              metricDescription: 'Deduplication and signal corroboration grouping',
              description:
                'AI matches incoming tips mentioning similar landmarks or road intersections along the same corridor to prevent multiple conflicting alert reports.',
              metadata: [
                { label: 'A5 Mentions', value: '4 reports clustered near Cement Siding' },
                { label: 'Khami Rd Mentions', value: '2 reports near flyover' },
                { label: 'Deduplication Method', value: 'Temporal + Geo-corridor clustering' },
              ],
            })
          }
          title="Click to view clustered mentions metric details"
        >
          <span className="pz-expand-hint-pill">Expand ⤢</span>
          <span className="pz-metric-value" style={{ color: 'var(--pz-amber-text)' }}>
            06
          </span>
          <span className="pz-metric-label">Clustered corridor mentions</span>
          <span style={{ fontSize: '12px', color: 'var(--pz-muted)' }}>
            Includes duplicate candidates
          </span>
        </button>

        <button
          type="button"
          className="pz-metric-card pz-expandable-card"
          style={{ textAlign: 'left', cursor: 'pointer' }}
          onClick={() =>
            focusCard({
              type: 'metric',
              title: 'Screening Confidence Ceiling',
              subtitle: 'Low · Field verification pending',
              categoryLabel: 'STATISTICAL HONESTY',
              metricValue: 'Low',
              metricDescription: 'No autonomous high-confidence claims before human check',
              description:
                'Panzira AI explicitly caps confidence levels on unverified incoming tips. We never claim high certainty or predictive certainty without verified eyewitness corroboration.',
              metadata: [
                { label: 'Confidence Ceiling', value: 'Low / Provisional' },
                { label: 'Autonomous Claims', value: 'Prohibited by system policy' },
                { label: 'Required Action', value: 'Editorial confirmation needed' },
              ],
            })
          }
          title="Click to view screening confidence metric details"
        >
          <span className="pz-expand-hint-pill">Expand ⤢</span>
          <span className="pz-metric-value" style={{ color: 'var(--pz-amber-text)' }}>
            Low
          </span>
          <span className="pz-metric-label">Screening confidence ceiling</span>
          <span style={{ fontSize: '12px', color: 'var(--pz-muted)' }}>
            Field verification pending
          </span>
        </button>

        <button
          type="button"
          className="pz-metric-card pz-expandable-card"
          style={{ textAlign: 'left', cursor: 'pointer' }}
          onClick={() =>
            focusCard({
              type: 'metric',
              title: 'Zero Predictive Crash Claims',
              subtitle: 'Editorial leads only · Ethical AI invariant',
              categoryLabel: 'ETHICAL SAFEGUARD',
              metricValue: '00',
              metricDescription: 'We do not claim to forecast vehicle accidents',
              description:
                'Panzira AI avoids false predictive certainty. Algorithms highlight active hazard concentrations, but do not pretend to predict vehicle crashes.',
              metadata: [
                { label: 'Predictive Claims', value: '0 (Strictly Blocked)', color: 'var(--pz-primary-green)' },
                { label: 'Ethics Standard', value: 'Responsible AI Journalism' },
              ],
            })
          }
          title="Click to view predictive crash claims safeguard"
        >
          <span className="pz-expand-hint-pill">Expand ⤢</span>
          <span className="pz-metric-value">00</span>
          <span className="pz-metric-label">Predictive crash claims</span>
          <span style={{ fontSize: '12px', color: 'var(--pz-primary-green)', fontWeight: 600 }}>
            Editorial leads only
          </span>
        </button>
      </section>

      {/* Main Split: Watchlist + Corridor Map & Explainability */}
      <div className="pz-hotspot-split">
        {/* Left: Corridor Watchlist */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h2 className="pz-section-heading">Corridor watchlist</h2>

          {corridors.map((corr) => {
            const isSelected = corr.id === selectedCorridor.id;
            return (
              <button
                key={corr.id}
                type="button"
                className={`pz-signal-card pz-expandable-card ${isSelected ? 'is-selected' : ''}`}
                style={{ padding: '16px', gap: '8px' }}
                onClick={() => {
                  setSelectedCorridorId(corr.id);
                  focusCard({
                    type: 'corridor',
                    corridorId: corr.id,
                    title: corr.name,
                    subtitle: corr.hazardSummary,
                    categoryLabel: 'CORRIDOR WATCHLIST ITEM',
                    badge: corr.badge,
                    badgeColor: corr.badgeColor === 'red' ? 'red' : 'amber',
                  });
                }}
                title="Click to open corridor intelligence in reader overlay"
              >
                <span className="pz-expand-hint-pill">Expand ⤢</span>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '8px',
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: '12px', color: 'var(--pz-muted)' }}>
                    Corridor {corr.rank}
                  </span>
                  <span
                    className={`pz-badge ${
                      corr.badgeColor === 'red' ? 'pz-badge-critical' : 'pz-badge-amber'
                    }`}
                  >
                    {corr.badge}
                  </span>
                </div>

                <div className="pz-card-title">{corr.name}</div>

                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--pz-primary-green)' }}>
                  {corr.submissionsSummary}
                </div>

                <div style={{ fontSize: '13.5px', color: 'var(--pz-text)' }}>
                  {corr.hazardSummary}
                </div>

                <p style={{ fontSize: '12.5px', color: 'var(--pz-muted)' }}>{corr.patternNote}</p>
              </button>
            );
          })}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '4px' }}>
            <button
              type="button"
              className="pz-btn-primary"
              onClick={() => navigateNewsroom('verify', jumpSignalId)}
            >
              Verify {selectedCorridor.id} corridor lead ({jumpSignalId}) →
            </button>
            <button
              type="button"
              className="pz-btn-secondary"
              onClick={() => navigateNewsroom('briefs')}
            >
              Open A5 investigative brief →
            </button>
          </div>
        </section>

        {/* Right: Map + Why Corridor Was Flagged */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <CorridorContextMap
            mode="hotspots"
            activeCorridorId={selectedCorridor.id}
            onSelectCorridor={setSelectedCorridorId}
            height={320}
          />

          {/* Explainable Screening Score Card */}
          <div className="pz-card-panel" style={{ gap: '12px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <span className="pz-field-label" style={{ color: 'var(--pz-primary-green)' }}>
                Why {selectedCorridor.name} was flagged
              </span>
              <span className="pz-badge pz-badge-amber">Possible pattern · Unconfirmed</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
              <span className="pz-metric-value" style={{ fontSize: '28px' }}>
                {selectedCorridor.scoreDisplay}
              </span>
              <span style={{ fontSize: '13px', color: 'var(--pz-muted)', fontWeight: 500 }}>
                {selectedCorridor.confidenceLabel}
              </span>
            </div>

            <div className="pz-divider" />

            <div className="pz-extract-2col">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div className="pz-field-label">Signals raising priority</div>
                {selectedCorridor.positiveFactors.map((f, i) => (
                  <div key={i} style={{ fontSize: '13px', color: 'var(--pz-primary-green)' }}>
                    {f}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div className="pz-field-label">Uncertainty & evidence gaps</div>
                {selectedCorridor.negativeFactors.map((f, i) => (
                  <div key={i} style={{ fontSize: '13px', color: 'var(--pz-red)' }}>
                    {f}
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              className="pz-btn-tonal"
              style={{ width: '100%', marginTop: '4px' }}
              onClick={() => navigateNewsroom('fleet')}
            >
              Preview Fleet Corridor Risk Desk & JSON schema →
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

// ===========================================================================
// D10 FLEET CORRIDOR RISK DESK
// ===========================================================================

export const FleetCorridorDeskView: React.FC = () => {
  const {
    corridors,
    selectedCorridorId,
    setSelectedCorridorId,
    navigateNewsroom,
    verifiedAlerts,
  } = usePanzira();

  const selectedCorridor = useMemo(() => {
    return corridors.find((c) => c.id === selectedCorridorId) || corridors[0];
  }, [corridors, selectedCorridorId]);

  const samplePayload = useMemo(() => {
    return JSON.stringify(
      {
        corridor_id: selectedCorridor.id,
        corridor_name: selectedCorridor.fleetName,
        advisory_state: selectedCorridor.fleetBadge,
        screening_priority_score: selectedCorridor.scoreNumeric,
        confidence: selectedCorridor.scoreNumeric === null ? 'insufficient' : 'low',
        is_statistically_validated_prediction: false,
        auto_published_by_ai: false,
        clustered_lead_count: selectedCorridor.clusterCount,
        approved_verified_alerts_in_region: verifiedAlerts.length,
        recommended_action: selectedCorridor.fleetRecommendation,
        provenance_note:
          'Demo screening feed derived from public/authorized posts and citizen opt-in reports; requires human editorial sign-off.',
      },
      null,
      2
    );
  }, [selectedCorridor, verifiedAlerts.length]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div>
        <button
          type="button"
          onClick={() => navigateNewsroom('hotspots')}
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            color: 'var(--pz-primary-green)',
            fontWeight: 600,
            fontSize: '13px',
            marginBottom: '6px',
          }}
        >
          ← Back to hotspot intelligence
        </button>
        <h1 className="pz-page-title">Corridor risk desk · Logistics & fleet preview</h1>
        <p className="pz-page-subtitle">
          Transparent corridor screening advisories with explicit uncertainty labels for Bulawayo
          transport operators
        </p>
      </div>

      <div className="pz-notice-box-bordered">
        <p style={{ fontSize: '13px', color: 'var(--pz-text)' }}>
          <strong>Demo advisory contract:</strong> Unverified screening signals never trigger
          automated fleet rerouting. Transport dispatchers receive explicit confidence flags and
          human-verified hazard counts separately.
        </p>
      </div>

      <div className="pz-hotspot-split">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {corridors.map((corr) => {
            const active = corr.id === selectedCorridor.id;
            return (
              <button
                key={corr.id}
                type="button"
                className={`pz-signal-card ${active ? 'is-selected' : ''}`}
                style={{ padding: '16px', gap: '8px' }}
                onClick={() => setSelectedCorridorId(corr.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                  <span className="pz-card-title" style={{ fontSize: '16px' }}>
                    {corr.fleetName}
                  </span>
                  <span
                    className={`pz-badge ${
                      corr.badgeColor === 'red' ? 'pz-badge-critical' : 'pz-badge-amber'
                    }`}
                  >
                    {corr.fleetBadge}
                  </span>
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--pz-amber-text)', fontWeight: 600 }}>
                  {corr.fleetConfidenceLine}
                </div>
                <div style={{ fontSize: '13.5px', color: 'var(--pz-text)' }}>
                  {corr.fleetRecommendation}
                </div>
              </button>
            );
          })}
        </div>

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
              Simulated API contract · {selectedCorridor.apiEndpoint}
            </span>
            <span className="pz-badge pz-badge-neutral">Read-only demo JSON</span>
          </div>

          <pre
            style={{
              margin: 0,
              padding: '14px',
              background: 'var(--pz-pale)',
              border: '1px solid var(--pz-border)',
              borderRadius: '4px',
              fontSize: '12.5px',
              lineHeight: 1.5,
              overflowX: 'auto',
              color: 'var(--pz-text)',
            }}
          >
            {samplePayload}
          </pre>
        </div>
      </div>
    </div>
  );
};

// ===========================================================================
// D8 INVESTIGATIVE BRIEF — WORKING DRAFT
// ===========================================================================

export const InvestigativeBriefView: React.FC = () => {
  const {
    briefDraft,
    signals,
    updateBriefField,
    saveBriefDraft,
    navigateNewsroom,
  } = usePanzira();

  const a5PrimarySignal = useMemo(
    () => signals.find((s) => s.id === 'PZ-DEMO-0427'),
    [signals]
  );
  const a5ShonaSignal = useMemo(
    () => signals.find((s) => s.id === 'PZ-SIG-0042'),
    [signals]
  );

  const verifiedA5Signals = useMemo(
    () =>
      signals.filter(
        (s) =>
          s.workflowStatus === 'verified' &&
          (s.corridor.toLowerCase().includes('a5') || s.roadArea.toLowerCase().includes('a5'))
      ),
    [signals]
  );

  const handleExportMarkdown = () => {
    const md = [
      `# [Working draft — Not for automatic publication] ${briefDraft.title}`,
      ``,
      `- **Investigation ID:** ${briefDraft.investigationId}`,
      `- **Assigned Editor:** ${briefDraft.editorName}`,
      `- **Date:** ${briefDraft.dateLabel}`,
      `- **Verification Status:** ${
        verifiedA5Signals.length > 0
          ? `${verifiedA5Signals.length} corroborated item(s); broader corridor pattern still under inquiry`
          : 'Unverified investigative leads — awaiting independent field corroboration'
      }`,
      ``,
      `## Summary (Dek)`,
      briefDraft.dek,
      ``,
      `## Working Lead`,
      briefDraft.lead,
      ``,
      `## Reported Pattern & Uncertainty`,
      briefDraft.reportedPattern,
      ``,
      `## Field Reporting & Verification Plan`,
      briefDraft.reportingPlan,
      ``,
      `## Questions for Road Authorities`,
      ...briefDraft.questionsForAuthorities.map((q, idx) => `${idx + 1}. ${q}`),
      ``,
      `## Editorial Safeguard Notes`,
      briefDraft.editorNotes,
      ``,
      `## Traceable Evidence Ledger`,
      `- [1] PZ-DEMO-0427 (Citizen Web, 27 Jan 08:14) — Status: ${a5PrimarySignal?.workflowStatus || 'verifying'}`,
      `- [2] PZ-DEMO-0428 (Citizen Web, 27 Jan 09:02) — Duplicate candidate (independence unconfirmed)`,
      `- [3] PZ-DEMO-0429 (Submitted Link, 27 Jan 09:35) — Duplicate candidate (provenance unconfirmed)`,
      `- [4] PZ-SIG-0042 (Opt-in Shona WhatsApp, 27 Jan 09:31) — Status: ${a5ShonaSignal?.workflowStatus || 'lead'}`,
      ``,
      `---`,
      `Generated from Panzira AI Hackathon Demo (fictional seeded data; human editorial gate enforced).`,
    ].join('\n');

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `panzira-working-brief-${briefDraft.investigationId}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleQuestionChange = (index: number, nextVal: string) => {
    const updated = briefDraft.questionsForAuthorities.map((q, i) =>
      i === index ? nextVal : q
    );
    updateBriefField('questionsForAuthorities', updated);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Top Action Header */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span className="pz-badge pz-badge-amber">Working draft</span>
            <span className="pz-badge pz-badge-neutral">
              Desk file: {briefDraft.investigationId}
            </span>
            <span style={{ fontSize: '12.5px', color: 'var(--pz-muted)' }}>
              {briefDraft.editorName} · {briefDraft.dateLabel}
            </span>
            {briefDraft.lastSavedAt && (
              <span style={{ fontSize: '12px', color: 'var(--pz-primary-green)', fontWeight: 600 }}>
                • {briefDraft.lastSavedAt}
              </span>
            )}
          </div>
          <h1 className="pz-page-title" style={{ marginTop: '8px' }}>
            Investigative brief · Evidence & inquiry dossier
          </h1>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button type="button" className="pz-btn-secondary" onClick={saveBriefDraft}>
            Save draft
          </button>
          <button type="button" className="pz-btn-primary" onClick={handleExportMarkdown}>
            <img
              src={ASSETS.fileTextWhite}
              alt=""
              style={{ width: '16px', height: '16px' }}
            />
            <span>Export draft (.md)</span>
          </button>
        </div>
      </div>

      {/* Mandatory Not-For-Publication Uncertainty Banner */}
      <div className="pz-missing-panel" style={{ borderColor: 'var(--pz-gold)' }}>
        <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--pz-red)' }}>
          Demo draft dossier — Not for automatic publication
        </div>
        <p style={{ fontSize: '13px', color: 'var(--pz-text)' }}>
          Separates independently corroborated facts from unconfirmed citizen leads and right-of-reply
          questions for road maintenance authorities.
        </p>
      </div>

      {/* Main Two-Column Brief Layout */}
      <div className="pz-brief-split">
        {/* Left: Editable Brief Manuscript */}
        <section className="pz-card-panel" style={{ padding: '22px', gap: '16px' }}>
          <div>
            <label htmlFor="pz-brief-title" className="pz-field-label">
              Working headline
            </label>
            <textarea
              id="pz-brief-title"
              className="pz-textarea"
              rows={2}
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '18px',
                fontWeight: 600,
                lineHeight: 1.35,
                minHeight: '64px',
                marginTop: '6px',
              }}
              value={briefDraft.title}
              onChange={(e) => updateBriefField('title', e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="pz-brief-dek" className="pz-field-label">
              Summary / dek (explicitly note what remains unverified)
            </label>
            <textarea
              id="pz-brief-dek"
              className="pz-textarea"
              style={{ marginTop: '6px', minHeight: '78px' }}
              value={briefDraft.dek}
              onChange={(e) => updateBriefField('dek', e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="pz-brief-lead" className="pz-field-label">
              Lead paragraph (with traceable source citations [1–4])
            </label>
            <textarea
              id="pz-brief-lead"
              className="pz-textarea"
              style={{ marginTop: '6px' }}
              value={briefDraft.lead}
              onChange={(e) => updateBriefField('lead', e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="pz-brief-pattern" className="pz-field-label">
              Reported corridor pattern & uncertainty limits
            </label>
            <textarea
              id="pz-brief-pattern"
              className="pz-textarea"
              style={{ marginTop: '6px' }}
              value={briefDraft.reportedPattern}
              onChange={(e) => updateBriefField('reportedPattern', e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="pz-brief-plan" className="pz-field-label">
              Field reporting & corroboration plan
            </label>
            <textarea
              id="pz-brief-plan"
              className="pz-textarea"
              style={{ marginTop: '6px' }}
              value={briefDraft.reportingPlan}
              onChange={(e) => updateBriefField('reportingPlan', e.target.value)}
            />
          </div>

          <div>
            <div className="pz-field-label" style={{ marginBottom: '8px' }}>
              Right-of-reply questions for road authorities
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {briefDraft.questionsForAuthorities.map((q, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: '12px',
                      color: 'var(--pz-primary-green)',
                      width: '22px',
                    }}
                  >
                    Q{idx + 1}
                  </span>
                  <input
                    className="pz-input"
                    value={q}
                    onChange={(e) => handleQuestionChange(idx, e.target.value)}
                    aria-label={`Authority question ${idx + 1}`}
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="pz-brief-notes" className="pz-field-label">
              Editorial desk safeguards
            </label>
            <textarea
              id="pz-brief-notes"
              className="pz-textarea"
              style={{ marginTop: '6px', minHeight: '72px' }}
              value={briefDraft.editorNotes}
              onChange={(e) => updateBriefField('editorNotes', e.target.value)}
            />
          </div>
        </section>

        {/* Right: Traceable Evidence Ledger */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Independently Verified Evidence Ledger */}
          <div className="pz-card-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="pz-subsection-heading">Independently verified evidence</h2>
              <span
                className={`pz-badge ${
                  verifiedA5Signals.length > 0 ? 'pz-badge-verified' : 'pz-badge-amber'
                }`}
              >
                {verifiedA5Signals.length} verified
              </span>
            </div>

            {verifiedA5Signals.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--pz-muted)' }}>
                <strong>0 items independently verified on this segment yet.</strong> Complete all 4
                checks in{' '}
                <button
                  type="button"
                  onClick={() => navigateNewsroom('verify', 'PZ-DEMO-0427')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    color: 'var(--pz-primary-green)',
                    fontWeight: 600,
                    textDecoration: 'underline',
                  }}
                >
                  Verify reports (PZ-DEMO-0427)
                </button>{' '}
                before citing any A5 submission as established fact.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {verifiedA5Signals.map((vs) => (
                  <div
                    key={vs.id}
                    style={{
                      background: 'var(--pz-active-surface)',
                      border: '1px solid var(--pz-primary-green)',
                      borderRadius: '4px',
                      padding: '10px',
                      fontSize: '13px',
                    }}
                  >
                    <strong>{vs.id} · Verified (4/4 checks):</strong> {vs.title} ({vs.landmark})
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Traceable Citations [1–4] */}
          <div className="pz-card-panel">
            <h2 className="pz-subsection-heading">Traceable source ledger</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div
                style={{
                  borderLeft: '3px solid var(--pz-primary-green)',
                  paddingLeft: '10px',
                  fontSize: '13px',
                }}
              >
                <div style={{ fontWeight: 600 }}>
                  [1] PZ-DEMO-0427 · Citizen web (27 Jan, 08:14)
                </div>
                <div style={{ color: 'var(--pz-muted)' }}>
                  Primary report + photo IMG-01. Status:{' '}
                  <strong>{a5PrimarySignal?.workflowStatus || 'verifying'}</strong>.{' '}
                  <button
                    type="button"
                    onClick={() => navigateNewsroom('verify', 'PZ-DEMO-0427')}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      color: 'var(--pz-primary-green)',
                      fontWeight: 600,
                    }}
                  >
                    Inspect →
                  </button>
                </div>
              </div>

              <div
                style={{
                  borderLeft: '3px solid var(--pz-gold)',
                  paddingLeft: '10px',
                  fontSize: '13px',
                }}
              >
                <div style={{ fontWeight: 600 }}>
                  [2] PZ-DEMO-0428 · Citizen web (27 Jan, 09:02)
                </div>
                <div style={{ color: 'var(--pz-muted)' }}>
                  Duplicate candidate — similar wording; source independence unresolved.
                </div>
              </div>

              <div
                style={{
                  borderLeft: '3px solid var(--pz-gold)',
                  paddingLeft: '10px',
                  fontSize: '13px',
                }}
              >
                <div style={{ fontWeight: 600 }}>
                  [3] PZ-DEMO-0429 · Submitted link (27 Jan, 09:35)
                </div>
                <div style={{ color: 'var(--pz-muted)' }}>
                  Duplicate candidate — potentially reposted warning; capture time unconfirmed.
                </div>
              </div>

              <div
                style={{
                  borderLeft: '3px solid var(--pz-primary-green)',
                  paddingLeft: '10px',
                  fontSize: '13px',
                }}
              >
                <div style={{ fontWeight: 600 }}>
                  [4] PZ-SIG-0042 · Opt-in Shona WhatsApp (27 Jan, 09:31)
                </div>
                <div style={{ color: 'var(--pz-muted)' }}>
                  “Pane gomba paA5 pedyo nePlumtree turn-off.” Status:{' '}
                  <strong>{a5ShonaSignal?.workflowStatus || 'lead'}</strong>.{' '}
                  <button
                    type="button"
                    onClick={() => navigateNewsroom('verify', 'PZ-SIG-0042')}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      color: 'var(--pz-primary-green)',
                      fontWeight: 600,
                    }}
                  >
                    Inspect →
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Open Evidence Gaps */}
          <div className="pz-cream-panel">
            <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--pz-text)' }}>
              Open evidence gaps before publication
            </div>
            <ul
              style={{
                margin: 0,
                paddingLeft: '18px',
                fontSize: '13px',
                color: 'var(--pz-muted)',
                display: 'grid',
                gap: '6px',
              }}
            >
              <li>Exact kilometre marker along A5 Bulawayo–Plumtree stretch</li>
              <li>Original uncropped file & capture timestamp for photo IMG-01</li>
              <li>On-the-record inspection response from responsible road authority</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
};
