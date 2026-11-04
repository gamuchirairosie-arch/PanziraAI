import React, { useEffect, useMemo, useState } from 'react';
import { ASSETS } from '../assetsMap';
import { PublicBulawayoMap } from '../components/BulawayoMap';
import { WhatsAppSimulatorModal } from '../components/WhatsAppSimulatorModal';
import { UssdSimulatorModal } from '../components/UssdSimulatorModal';
import { usePanzira } from '../context/PanziraContext';
import { useCardFocus } from '../context/CardFocusContext';
import { VerifiedPublicAlert } from '../types';

type PublicCategoryFilter = 'all' | 'collisions' | 'potholes' | 'flooding';

export const PublicDashboardView: React.FC = () => {
  const {
    publicView,
    navigatePublic,
    navigateNewsroom,
    verifiedAlerts,
    signals,
    approvedAlertsCount,
    lastEditorialUpdateTime,
    lastEditorialUpdateDateLabel,
    publicSearch,
    setPublicSearch,
  } = usePanzira();

  const { focusCard } = useCardFocus();

  const [categoryFilter, setCategoryFilter] = useState<PublicCategoryFilter>('all');
  const [severityOnlyCritical, setSeverityOnlyCritical] = useState(false);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>('PZ-PUB-102');
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [showUssdModal, setShowUssdModal] = useState(false);
  const [mobileTab, setMobileTab] = useState<'map' | 'alerts'>('map');

  const filteredAlerts = useMemo(() => {
    const q = publicSearch.trim().toLowerCase();
    return verifiedAlerts.filter((alert) => {
      if (categoryFilter !== 'all' && alert.categoryKey !== categoryFilter) return false;
      if (severityOnlyCritical && !alert.isCritical) return false;
      if (!q) return true;
      return (
        alert.title.toLowerCase().includes(q) ||
        alert.location.toLowerCase().includes(q) ||
        alert.corridor.toLowerCase().includes(q) ||
        alert.description.toLowerCase().includes(q) ||
        alert.categoryLabel.toLowerCase().includes(q)
      );
    });
  }, [verifiedAlerts, categoryFilter, severityOnlyCritical, publicSearch]);

  // Keep selectedAlertId synced with filteredAlerts so hidden alerts don't stay open
  useEffect(() => {
    if (!selectedAlertId) return;
    if (!filteredAlerts.some((a) => a.id === selectedAlertId)) {
      setSelectedAlertId(filteredAlerts[0]?.id ?? null);
    }
  }, [filteredAlerts, selectedAlertId]);

  const selectedAlert: VerifiedPublicAlert | null = useMemo(() => {
    if (!selectedAlertId) return null;
    return filteredAlerts.find((a) => a.id === selectedAlertId) || null;
  }, [filteredAlerts, selectedAlertId]);

  const citizenSubmissions = useMemo(() => {
    return signals.filter((s) => s.isUserSubmitted || s.id === 'PZ-DEMO-0427');
  }, [signals]);

  const renderCategoryIcon = (cat: VerifiedPublicAlert['categoryKey']) => {
    if (cat === 'flooding') return ASSETS.wavesList;
    if (cat === 'collisions') return ASSETS.carFrontGreen;
    return ASSETS.triangleAlertList;
  };

  const renderFilterBar = () => (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '14px',
        flexWrap: 'wrap',
      }}
    >
      <div
        className="pz-filter-pill-row"
        role="group"
        aria-label="Filter verified alerts by hazard type"
      >
        <button
          type="button"
          className={`pz-filter-btn ${categoryFilter === 'all' ? 'is-active' : ''}`}
          onClick={() => setCategoryFilter('all')}
        >
          <img
            src={categoryFilter === 'all' ? ASSETS.triangleAlertWhite : ASSETS.triangleAlertGreen}
            alt=""
            style={{ width: '14px', height: '14px' }}
          />
          <span>All</span>
        </button>

        <button
          type="button"
          className={`pz-filter-btn ${categoryFilter === 'collisions' ? 'is-active' : ''}`}
          onClick={() => setCategoryFilter('collisions')}
        >
          <img src={ASSETS.carFrontGreen} alt="" style={{ width: '14px', height: '14px' }} />
          <span>Collisions</span>
        </button>

        <button
          type="button"
          className={`pz-filter-btn ${categoryFilter === 'potholes' ? 'is-active' : ''}`}
          onClick={() => setCategoryFilter('potholes')}
        >
          <img src={ASSETS.triangleAlertGreen} alt="" style={{ width: '14px', height: '14px' }} />
          <span>Potholes</span>
        </button>

        <button
          type="button"
          className={`pz-filter-btn ${categoryFilter === 'flooding' ? 'is-active' : ''}`}
          onClick={() => setCategoryFilter('flooding')}
        >
          <img src={ASSETS.wavesGreen} alt="" style={{ width: '14px', height: '14px' }} />
          <span>Flooding</span>
        </button>
      </div>

      <div className="pz-masthead-search" style={{ maxWidth: '360px', flex: '1 1 220px' }}>
        <img src={ASSETS.search} alt="" style={{ width: '15px', height: '15px' }} />
        <input
          type="search"
          value={publicSearch}
          onChange={(e) => setPublicSearch(e.target.value)}
          placeholder="Search road, suburb, or hazard..."
          aria-label="Search verified Bulawayo road alerts"
        />
        {publicSearch && (
          <button
            type="button"
            className="pz-search-clear"
            onClick={() => setPublicSearch('')}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );

  const renderSelectedAlertSheet = (alert: VerifiedPublicAlert) => (
    <div
      className="pz-card-panel"
      style={{
        borderLeft: `4px solid ${alert.isCritical ? 'var(--pz-red)' : 'var(--pz-primary-green)'}`,
        background: 'var(--pz-white)',
      }}
      aria-live="polite"
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          <span
            className="pz-badge-panzira-verified"
            title="Panzira Verified · Independent newsroom check (Municipal integration pending authorization)"
          >
            PANZIRA VERIFIED
          </span>
          <span
            className={`pz-badge ${alert.isCritical ? 'pz-badge-critical' : 'pz-badge-neutral'
              }`}
          >
            {alert.severity}
          </span>
          <span style={{ fontSize: '12.5px', color: 'var(--pz-muted)' }}>
            {alert.updatedAgo}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setSelectedAlertId(null)}
          style={{
            background: 'transparent',
            border: 'none',
            padding: '2px',
            display: 'inline-flex',
          }}
          aria-label="Dismiss selected incident card"
        >
          <img src={ASSETS.closeX} alt="" style={{ width: '18px', height: '18px' }} />
        </button>
      </div>

      <div>
        <h3 className="pz-card-title" style={{ fontSize: '18px' }}>
          {alert.title}
        </h3>
        <p style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--pz-muted)', marginTop: '2px' }}>
          {alert.location} · {alert.corridor}
        </p>
      </div>

      <p style={{ fontSize: '14.5px', color: 'var(--pz-text)' }}>{alert.description}</p>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
          borderTop: '1px solid var(--pz-border)',
          paddingTop: '10px',
        }}
      >
        <div style={{ fontSize: '12.5px', color: 'var(--pz-muted)' }}>
          <strong>Verification provenance:</strong> {alert.sourceAttribution}
        </div>

        <button
          type="button"
          className="pz-btn-secondary"
          style={{ minHeight: '34px', fontSize: '12.5px', padding: '4px 12px' }}
          onClick={() =>
            focusCard({
              type: 'alert',
              alertId: alert.id,
              title: alert.title,
              subtitle: `${alert.location} · ${alert.corridor}`,
              categoryLabel: 'VERIFIED ROAD ALERT',
              badge: alert.isCritical ? 'Critical' : 'Panzira Verified',
              badgeColor: alert.isCritical ? 'red' : 'green',
            })
          }
        >
          Read Full Advisory ⤢
        </button>
      </div>
    </div>
  );

  // =========================================================================
  // SUB-VIEW 1: MY REPORTS (Citizen Receipt & Live Status Tracker)
  // =========================================================================
  if (publicView === 'my-reports') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
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
            <h1 className="pz-page-title">My submitted reports</h1>
            <p className="pz-page-subtitle">
              Track citizen road-hazard submissions stored in this browser demo session and their
              human verification status.
            </p>
          </div>

          <button
            type="button"
            className="pz-btn-primary"
            onClick={() => navigatePublic('report')}
          >
            + Submit a new hazard report
          </button>
        </div>

        <div className="pz-notice-box-bordered">
          <p style={{ fontSize: '13.5px', color: 'var(--pz-text)' }}>
            <strong>Editorial verification rule:</strong> Citizen reports are never published
            automatically by AI. Each submission enters the newsroom Signal Monitor and requires 4
            independent verification checks by a human editor before appearing on the public map.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {citizenSubmissions.map((item) => {
            const metChecks = Object.values(item.checklist).filter(Boolean).length;
            return (
              <div
                key={item.id}
                className="pz-card-panel pz-expandable-card"
                onClick={() =>
                  focusCard({
                    type: 'signal',
                    signalId: item.id,
                    title: item.title,
                    subtitle: `${item.roadArea} · ${item.landmark}`,
                    categoryLabel: 'MY SUBMITTED CITIZEN REPORT',
                    badge: item.monitorStatusLabel,
                  })
                }
                title="Click to view full report in reader overlay"
              >
                <span className="pz-expand-hint-pill">Expand ⤢</span>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '10px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: '13px',
                        color: 'var(--pz-primary-green)',
                      }}
                    >
                      {item.id}
                    </span>
                    <span
                      className={`pz-badge ${item.workflowStatus === 'verified'
                        ? 'pz-badge-panzira-verified'
                        : item.workflowStatus === 'rejected'
                          ? 'pz-badge-critical'
                          : 'pz-badge-amber'
                        }`}
                      title={
                        item.workflowStatus === 'verified'
                          ? 'Panzira Verified · Independent newsroom check (Municipal integration pending authorization)'
                          : undefined
                      }
                    >
                      {item.workflowStatus === 'verified'
                        ? 'Panzira Verified · Published'
                        : item.workflowStatus === 'rejected'
                          ? 'Not corroborated · Archived'
                          : item.monitorStatusLabel.toLowerCase().includes('evidence requested')
                            ? 'Follow-up evidence requested'
                            : 'Pending editorial verification'}
                    </span>
                    {item.isGraphicImage && (
                      <span className="pz-badge pz-badge-critical">
                        Flagged imagery withheld from public display
                      </span>
                    )}
                  </div>

                  <span style={{ fontSize: '12.5px', color: 'var(--pz-muted)' }}>
                    Observed: {item.reportedDateTime}
                  </span>
                </div>

                <div>
                  <h2 className="pz-card-title">{item.title}</h2>
                  <p style={{ fontSize: '13.5px', color: 'var(--pz-muted)', marginTop: '2px' }}>
                    {item.roadArea} · {item.landmark}
                  </p>
                </div>

                <p style={{ fontSize: '14.5px', color: 'var(--pz-text)' }}>{item.originalQuote}</p>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                    flexWrap: 'wrap',
                    borderTop: '1px solid var(--pz-border)',
                    paddingTop: '10px',
                  }}
                >
                  <span style={{ fontSize: '13px', color: 'var(--pz-muted)' }}>
                    Editorial gate progress: <strong>{metChecks} of 4</strong> verification checks
                    completed
                  </span>

                  <button
                    type="button"
                    className="pz-btn-secondary"
                    style={{ minHeight: '38px', fontSize: '12.5px', padding: '6px 12px' }}
                    onClick={() => navigateNewsroom('verify', item.id)}
                  >
                    Open in demo newsroom →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // =========================================================================
  // SUB-VIEW 2: VERIFIED ALERTS (Low-bandwidth accessible text directory)
  // =========================================================================
  if (publicView === 'alerts') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
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
            <h1 className="pz-page-title">Verified road alerts · Bulawayo</h1>
            <p className="pz-page-subtitle">
              Low-bandwidth text feed of human-verified road hazards, source provenance, and
              severity status.
            </p>
          </div>

          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              background: 'var(--pz-pale)',
              padding: '8px 12px',
              borderRadius: '4px',
              border: '1px solid var(--pz-border)',
            }}
          >
            <input
              type="checkbox"
              checked={severityOnlyCritical}
              onChange={(e) => setSeverityOnlyCritical(e.target.checked)}
            />
            <span>Critical / high severity only</span>
          </label>
        </div>

        {renderFilterBar()}

        {filteredAlerts.length === 0 ? (
          <div className="pz-card-panel">
            <p style={{ color: 'var(--pz-muted)' }}>
              No approved verified alerts match your current search or filter.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredAlerts.map((alert) => (
              <article
                key={alert.id}
                className="pz-card-panel pz-expandable-card"
                onClick={() =>
                  focusCard({
                    type: 'alert',
                    alertId: alert.id,
                    title: alert.title,
                    subtitle: `${alert.location} · ${alert.corridor}`,
                    categoryLabel: 'VERIFIED ROAD ALERT',
                    badge: alert.isCritical ? 'Critical' : 'Panzira Verified',
                    badgeColor: alert.isCritical ? 'red' : 'green',
                  })
                }
                title="Click to open full alert in reader overlay"
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <img
                      src={renderCategoryIcon(alert.categoryKey)}
                      alt=""
                      style={{ width: '18px', height: '18px' }}
                    />
                    <span
                      className="pz-badge-panzira-verified"
                      title="Panzira Verified · Independent newsroom check (Municipal integration pending authorization)"
                    >
                      PANZIRA VERIFIED
                    </span>
                    <span
                      className={`pz-badge ${alert.isCritical ? 'pz-badge-critical' : 'pz-badge-neutral'
                        }`}
                    >
                      {alert.severity}
                    </span>
                    <span style={{ fontSize: '12.5px', color: 'var(--pz-muted)' }}>
                      {alert.categoryLabel} · {alert.corridor}
                    </span>
                  </div>
                  <span style={{ fontSize: '12.5px', color: 'var(--pz-muted)' }}>
                    {alert.updatedAgo}
                  </span>
                </div>

                <div>
                  <h2 className="pz-card-title">{alert.title}</h2>
                  <p style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--pz-muted)' }}>
                    {alert.location}
                  </p>
                </div>

                <p style={{ fontSize: '14.5px', color: 'var(--pz-text)' }}>{alert.description}</p>

                <div style={{ fontSize: '12.5px', color: 'var(--pz-muted)' }}>
                  <strong>Source & review:</strong> {alert.sourceAttribution}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // SUB-VIEW 3: ROAD MAP (Full-screen focused map exploration)
  // =========================================================================
  if (publicView === 'map') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h1 className="pz-page-title">Bulawayo verified hazard map</h1>
            <p className="pz-page-subtitle">
              Select a verified map marker to inspect corridor details, severity, and editorial
              corroboration.
            </p>
          </div>
          <button
            type="button"
            className="pz-btn-secondary"
            onClick={() => navigatePublic('alerts')}
          >
            Switch to low-data text list →
          </button>
        </div>

        {renderFilterBar()}

        <PublicBulawayoMap
          alerts={filteredAlerts}
          selectedAlertId={selectedAlertId}
          onSelectAlert={(a) => setSelectedAlertId(a.id)}
          height={540}
        />

        {selectedAlert && renderSelectedAlertSheet(selectedAlert)}
      </div>
    );
  }

  // =========================================================================
  // DEFAULT PUBLIC VIEW: OVERVIEW
  // =========================================================================
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header & Direct Reporting Actions */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap',
          borderBottom: '1px solid var(--pz-border)',
          paddingBottom: '16px',
        }}
      >
        <div>
          <h1 className="pz-page-title" style={{ fontSize: '28px' }}>
            Bulawayo Road Safety Dashboard
          </h1>
          <p className="pz-page-subtitle" style={{ fontSize: '15px', marginTop: '2px' }}>
            Live verified hazard alerts and road surface conditions across Bulawayo corridors.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="pz-btn-primary"
            style={{ minHeight: '40px', padding: '0 18px', fontSize: '14px' }}
            onClick={() => navigatePublic('report')}
          >
            + Report a Hazard
          </button>
          <button
            type="button"
            className="pz-btn-channel-whatsapp"
            style={{ minHeight: '40px', padding: '0 14px', fontSize: '13.5px' }}
            onClick={() => setShowWhatsAppModal(true)}
            title="Open interactive WhatsApp bot demo"
          >
            WhatsApp Demo 💬
          </button>
          <button
            type="button"
            className="pz-btn-channel-ussd"
            style={{ minHeight: '40px', padding: '0 14px', fontSize: '13.5px' }}
            onClick={() => setShowUssdModal(true)}
            title="Open interactive USSD *140# demo"
          >
            USSD (*140#) 📟
          </button>
        </div>
      </div>

      {/* 3-Metric Summary Strip */}
      <section className="pz-public-summary-strip" aria-label="Bulawayo summary metrics">
        <button
          type="button"
          className="pz-summary-metric-btn pz-expandable-card"
          onClick={() =>
            focusCard({
              type: 'metric',
              title: 'Approved Verified Alerts in Bulawayo',
              subtitle: 'Live road safety hazard alerts published on the public map',
              categoryLabel: 'PUBLIC SAFETY METRIC',
              metricValue: String(approvedAlertsCount),
              metricDescription: 'Every alert verified by accredited human newsroom editors',
              description:
                'Panzira AI publishes verified road hazards only after independent corroboration across eyewitness reports, municipal logs, or field reporters. Unverified leads and graphic imagery remain strictly protected from the public view.',
              metadata: [
                { label: 'Active Corridors', value: 'Harare Rd (A5), Khami Rd, Esigodini Rd' },
                { label: 'Corroboration Standard', value: '4-Point Independent Check' },
                { label: 'Autonomous AI Releases', value: '0 (Strictly Blocked)', color: 'var(--pz-primary-green)' },
              ],
            })
          }
          title="Click to view verified alerts metric details"
        >
          <div className="pz-summary-metric-value">{approvedAlertsCount}</div>
          <div style={{ fontSize: '13px', color: 'var(--pz-muted)', marginTop: '2px' }}>
            Approved verified alerts in Bulawayo ⤢
          </div>
        </button>

        <button
          type="button"
          className="pz-summary-metric-btn pz-expandable-card"
          onClick={() =>
            focusCard({
              type: 'metric',
              title: 'Active Arterial Road Corridors',
              subtitle: 'High-density highways connecting Bulawayo metro and industrial hubs',
              categoryLabel: 'CORRIDOR SURVEILLANCE',
              metricValue: '03',
              metricDescription: 'Harare Road (A5), Khami Road, Esigodini Road',
              description:
                'These arterial corridors experience high heavy-vehicle traffic and public transport volume. Panzira maintains priority watchlists and early hazard triage for commuters.',
              metadata: [
                { label: 'A5 (Harare Rd)', value: 'High-speed corridor · Potholes & surface washouts' },
                { label: 'Khami Rd', value: 'Industrial artery · Drainage flooding & truck collisions' },
                { label: 'Esigodini Rd', value: 'Suburban artery · Sharp drop-offs & construction' },
              ],
            })
          }
          title="Click to view monitored corridors details"
        >
          <div className="pz-summary-metric-value">3</div>
          <div style={{ fontSize: '13px', color: 'var(--pz-muted)', marginTop: '2px' }}>
            Active corridors (A5, Khami Rd, Esigodini Rd) ⤢
          </div>
        </button>

        <button
          type="button"
          data-testid="editorial-last-updated"
          className="pz-summary-metric-btn pz-expandable-card"
          onClick={() =>
            focusCard({
              type: 'metric',
              title: 'Editorial Gate Last Synchronized',
              subtitle: `${lastEditorialUpdateTime} · ${lastEditorialUpdateDateLabel}`,
              categoryLabel: 'EDITORIAL AUDIT LOG',
              metricValue: lastEditorialUpdateTime,
              metricDescription: 'Latest verified incident sign-off timestamp',
              description:
                'All updates reflect Africa/Harare time. Every published alert is attributable to an authenticated journalist or editor who completed the 4 verification gates.',
              metadata: [
                { label: 'Timestamp (CAT)', value: `${lastEditorialUpdateTime} (Africa/Harare)` },
                { label: 'Date', value: lastEditorialUpdateDateLabel },
                { label: 'Audit Accountability', value: 'Preserved in panzira.db sqlite log' },
              ],
            })
          }
          title="Click to view editorial audit timestamp details"
        >
          <div
            className="pz-summary-metric-value"
            style={{ color: 'var(--pz-primary-green)' }}
          >
            {lastEditorialUpdateTime}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--pz-muted)', marginTop: '2px' }}>
            {lastEditorialUpdateDateLabel} ⤢
          </div>
        </button>
      </section>

      {/* Filter Pills + Search */}
      {renderFilterBar()}

      {/* Mobile View Toggle Switch */}
      <div
        className="pz-mobile-view-tabs"
        role="tablist"
        aria-label="Toggle map or alert list view on mobile"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === 'map'}
          className={`pz-mobile-tab-btn ${mobileTab === 'map' ? 'is-active' : ''}`}
          onClick={() => setMobileTab('map')}
        >
          🗺️ Map View
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === 'alerts'}
          className={`pz-mobile-tab-btn ${mobileTab === 'alerts' ? 'is-active' : ''}`}
          onClick={() => setMobileTab('alerts')}
        >
          📋 Verified Alerts ({filteredAlerts.length})
        </button>
      </div>

      {/* Main Split: Left 62% Map + Incident Sheet, Right 38% Verified Road Alerts */}
      <div className="pz-public-split">
        <div
          id="pz-public-map-anchor"
          style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}
        >
          <PublicBulawayoMap
            alerts={filteredAlerts}
            selectedAlertId={selectedAlertId}
            onSelectAlert={(alert) => setSelectedAlertId(alert.id)}
            height={600}
          />

          {selectedAlert && renderSelectedAlertSheet(selectedAlert)}
        </div>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              borderBottom: '1px solid var(--pz-border)',
              paddingBottom: '10px',
            }}
          >
            <h2 className="pz-section-heading">Verified road alerts</h2>
            <span style={{ fontSize: '12.5px', color: 'var(--pz-muted)' }}>
              {filteredAlerts.length} shown
            </span>
          </div>

          <div className="pz-public-alerts-list">
            {filteredAlerts.length === 0 ? (
              <div style={{ padding: '16px 0', color: 'var(--pz-muted)', fontSize: '13.5px' }}>
                No verified hazards match this filter. Try selecting “All” or clearing search.
              </div>
            ) : (
              filteredAlerts.map((alert) => {
                const isSelected = selectedAlert?.id === alert.id;
                return (
                  <button
                    key={alert.id}
                    type="button"
                    className={`pz-alert-row-card pz-expandable-card ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => {
                      setSelectedAlertId(alert.id);
                      focusCard({
                        type: 'alert',
                        alertId: alert.id,
                        title: alert.title,
                        subtitle: `${alert.location} · ${alert.corridor}`,
                        categoryLabel: 'VERIFIED ROAD ALERT',
                        badge: alert.isCritical ? 'Critical' : 'Panzira Verified',
                        badgeColor: alert.isCritical ? 'red' : 'green',
                      });
                    }}
                    title="Click to view full alert in reader overlay"
                  >
                    <span className="pz-expand-hint-pill">Expand ⤢</span>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        width: '100%',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <img
                          src={renderCategoryIcon(alert.categoryKey)}
                          alt=""
                          style={{ width: '16px', height: '16px', flexShrink: 0 }}
                        />
                        <span style={{ fontWeight: 600, fontSize: '15px', color: 'var(--pz-text)' }}>
                          {alert.title}
                        </span>
                      </div>

                      {alert.isCritical && (
                        <span className="pz-badge pz-badge-critical">Critical</span>
                      )}
                    </div>

                    <div style={{ fontSize: '13px', color: 'var(--pz-muted)' }}>
                      {alert.location} · {alert.corridor}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        width: '100%',
                        gap: '8px',
                        marginTop: '2px',
                      }}
                    >
                      <span
                        className="pz-badge-panzira-verified"
                        title="Panzira Verified · Independent newsroom check"
                      >
                        PANZIRA VERIFIED
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--pz-muted)' }}>
                        {alert.updatedAgo}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>
      </div>

      {/* Multichannel Simulation Modals */}
      <WhatsAppSimulatorModal
        isOpen={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
      />
      <UssdSimulatorModal
        isOpen={showUssdModal}
        onClose={() => setShowUssdModal(false)}
      />
    </div>
  );
};
