import React, { useState } from 'react';
import { ASSETS } from '../assetsMap';
import { usePanzira } from '../context/PanziraContext';
import { NewsroomView, PublicView } from '../types';

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    portal,
    newsroomView,
    publicView,
    navigateNewsroom,
    navigatePublic,
    newsroomSearch,
    setNewsroomSearch,
    publicSearch,
    setPublicSearch,
    signals,
    awaitingReviewCount,
    toastMessage,
    dismissToast,
    resetDemoData,
    backendMode,
    backendHealth,
  } = usePanzira();

  const [bellOpen, setBellOpen] = useState(false);
  const [compactSearchOpen, setCompactSearchOpen] = useState(false);

  const userReportsCount = signals.filter((s) => s.isUserSubmitted).length;

  const sidebarItems: Array<{
    key: NewsroomView;
    label: string;
    icon: string;
    matchFleet?: boolean;
  }> = [
    { key: 'monitor', label: 'Monitor', icon: ASSETS.navHouse },
    { key: 'inbox', label: 'Signal Inbox', icon: ASSETS.navInbox },
    { key: 'verify', label: 'Verify Reports', icon: ASSETS.navCircleCheck },
    { key: 'hotspots', label: 'Hotspots', icon: ASSETS.navMapPin, matchFleet: true },
    { key: 'briefs', label: 'Investigative Briefs', icon: ASSETS.navFileText },
    { key: 'sources', label: 'Sources & Channels', icon: ASSETS.navInbox },
  ];

  const publicNavItems: Array<{ key: PublicView; label: string }> = [
    { key: 'overview', label: 'Overview' },
    { key: 'map', label: 'Road Map' },
    { key: 'alerts', label: 'Verified Alerts' },
    {
      key: 'my-reports',
      label: userReportsCount > 0 ? `My Reports (${userReportsCount + 1})` : 'My Reports',
    },
  ];

  const activeSearch = portal === 'newsroom' ? newsroomSearch : publicSearch;
  const setActiveSearch = portal === 'newsroom' ? setNewsroomSearch : setPublicSearch;

  const handleConfirmReset = () => {
    const confirmed = window.confirm(
      'Reset local demo state to the initial baseline? Any custom demo reports in this browser will be cleared.'
    );
    if (confirmed) {
      resetDemoData();
      setBellOpen(false);
    }
  };

  return (
    <div className="pz-app">
      {/* Demonstration Banner */}
      <aside className="pz-demo-banner" role="status" aria-label="Demonstration environment notice">
        <div className="pz-demo-banner-content">
          <strong>Demonstration scenario</strong>
          <span>
            {backendMode === 'demo'
              ? 'Local demo only. Changes stay in this browser and are not submitted or published.'
              : backendHealth.status === 'online'
                ? 'Server-backed mode. Success appears only after backend acknowledgement.'
                : `Server mode unavailable. ${backendHealth.message}`}
          </span>
        </div>
        <span style={{ fontSize: '11px', opacity: 0.85, whiteSpace: 'nowrap' }}>
          Africa/Harare (CAT)
        </span>
      </aside>

      {/* =====================================================================
          DESKTOP MASTHEAD (> 1020px: 1024px, 1440px, etc.)
          ===================================================================== */}
      {portal === 'newsroom' ? (
        <header className="pz-masthead">
          <button
            type="button"
            className="pz-brand-btn"
            onClick={() => navigateNewsroom('monitor')}
            title="Panzira AI Signal Monitor"
          >
            <img src={ASSETS.roadMark} alt="" className="pz-brand-mark" />
            <span className="pz-brand-wordmark">
              Panzira <span className="pz-brand-wordmark-ai">AI</span>
            </span>
          </button>

          <span className="pz-edition-label">
            {newsroomView === 'fleet' ? 'Fleet desk' : 'Newsroom'}
          </span>

          <span className="pz-demo-pill">
            {backendMode === 'demo' ? 'Local demo' : backendHealth.status === 'online' ? 'Server' : 'Offline'}
          </span>

          <div className="pz-masthead-search">
            <img src={ASSETS.search} alt="" style={{ width: '16px', height: '16px' }} />
            <input
              type="search"
              value={newsroomSearch}
              onChange={(e) => setNewsroomSearch(e.target.value)}
              placeholder="Search reports, roads, landmarks, or IDs..."
              aria-label="Search newsroom signals and corridors"
            />
            {newsroomSearch && (
              <button
                type="button"
                className="pz-search-clear"
                onClick={() => setNewsroomSearch('')}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>

          <div className="pz-portal-switch-group">
            <button
              type="button"
              className="pz-portal-link-btn"
              onClick={() => navigatePublic('overview')}
            >
              Public Dashboard
            </button>
            <button
              type="button"
              className="pz-portal-link-btn"
              onClick={() => navigatePublic('report')}
            >
              + Report Hazard
            </button>
          </div>

          <div className="pz-bell-wrapper">
            <button
              type="button"
              className="pz-icon-btn"
              onClick={() => setBellOpen((prev) => !prev)}
              aria-label="Editorial desk notifications and demo controls"
              aria-expanded={bellOpen}
            >
              <img src={ASSETS.bell} alt="" style={{ width: '20px', height: '20px' }} />
              {awaitingReviewCount > 0 && <span className="pz-bell-dot" />}
            </button>

            {bellOpen && (
              <div className="pz-popover" role="dialog" aria-label="Editorial desk status">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px',
                  }}
                >
                  <strong style={{ fontSize: '13.5px' }}>Editorial desk · Demo status</strong>
                  <button
                    type="button"
                    onClick={() => setBellOpen(false)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      fontSize: '18px',
                      color: 'var(--pz-muted)',
                    }}
                    aria-label="Close notifications"
                  >
                    ×
                  </button>
                </div>
                <p style={{ fontSize: '12.5px', color: 'var(--pz-muted)', lineHeight: 1.5 }}>
                  • <strong>{awaitingReviewCount}</strong> submissions awaiting human corroboration.
                  <br />• <strong>0</strong> alerts auto-published by AI (human gate enforced).
                  <br />• {backendHealth.message}
                </p>
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <button
                    type="button"
                    className="pz-btn-secondary"
                    style={{ minHeight: '36px', fontSize: '12px', padding: '4px 10px', width: '100%' }}
                    onClick={handleConfirmReset}
                  >
                    Reset demo data to baseline…
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="pz-editor-identity">
            <span className="pz-editor-name">Rudo Moyo</span>
            <span className="pz-editor-role">Editor</span>
          </div>
        </header>
      ) : (
        <header className="pz-masthead">
          <button
            type="button"
            className="pz-brand-btn"
            onClick={() => navigatePublic('overview')}
            title="Panzira AI Public Road Safety Overview"
          >
            <img src={ASSETS.roadMark} alt="" className="pz-brand-mark" />
            <span className="pz-brand-wordmark">
              Panzira <span className="pz-brand-wordmark-ai">AI</span>
            </span>
          </button>

          <nav className="pz-public-nav" aria-label="Public road safety navigation">
            {publicNavItems.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`pz-public-nav-item ${publicView === item.key ? 'is-active' : ''}`}
                onClick={() => navigatePublic(item.key)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <span className="pz-demo-pill">Demo</span>

          <button
            type="button"
            className="pz-portal-link-btn"
            onClick={() => navigateNewsroom('monitor')}
          >
            Newsroom →
          </button>

          <button
            type="button"
            className="pz-btn-primary"
            onClick={() => navigatePublic('report')}
          >
            Report a Hazard
          </button>
        </header>
      )}

      {/* =====================================================================
          COMPACT TABLET & MOBILE HEADER (<= 1020px: covers 879px, 768px, 390px, 375px, 320px)
          ===================================================================== */}
      <header className="pz-compact-masthead">
        <div className="pz-compact-top-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <button
              type="button"
              className="pz-brand-btn"
              onClick={() =>
                portal === 'newsroom' ? navigateNewsroom('monitor') : navigatePublic('overview')
              }
            >
              <img
                src={ASSETS.roadMark}
                alt=""
                style={{ width: '26px', height: '22px', display: 'block', flexShrink: 0 }}
              />
              <span className="pz-brand-wordmark" style={{ fontSize: '18.5px' }}>
                Panzira <span className="pz-brand-wordmark-ai">AI</span>
              </span>
            </button>

            <span className="pz-demo-pill" style={{ fontSize: '11px', padding: '3px 6px' }}>
              {portal === 'newsroom'
                ? newsroomView === 'fleet'
                  ? 'Fleet'
                  : 'Newsroom'
                : 'Demo'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <button
              type="button"
              className="pz-portal-link-btn"
              style={{ height: '36px', padding: '0 9px', fontSize: '12px' }}
              onClick={() =>
                portal === 'newsroom' ? navigatePublic('overview') : navigateNewsroom('monitor')
              }
            >
              {portal === 'newsroom' ? 'Public View' : 'Newsroom'}
            </button>

            <button
              type="button"
              className="pz-icon-btn"
              style={{ width: '36px', height: '36px' }}
              onClick={() => setCompactSearchOpen((s) => !s)}
              aria-label="Toggle search"
              aria-expanded={compactSearchOpen}
            >
              <img src={ASSETS.search} alt="" style={{ width: '17px', height: '17px' }} />
            </button>
          </div>
        </div>

        {/* Tablet Sub-Navigation Strip (visible 681px–1020px: covers 768px & 879px cleanly) */}
        {portal === 'newsroom' ? (
          <nav className="pz-compact-nav-strip" aria-label="Newsroom navigation">
            {sidebarItems.map((item) => {
              const isActive =
                newsroomView === item.key ||
                (Boolean(item.matchFleet) && newsroomView === 'fleet');
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`pz-compact-nav-btn ${isActive ? 'is-active' : ''}`}
                  onClick={() => navigateNewsroom(item.key)}
                >
                  <img src={item.icon} alt="" style={{ width: '15px', height: '15px' }} />
                  <span>{item.label}</span>
                </button>
              );
            })}
            <button
              type="button"
              className="pz-compact-nav-btn"
              style={{ marginLeft: 'auto', color: 'var(--pz-primary-green)', fontWeight: 600 }}
              onClick={() => navigatePublic('report')}
            >
              + Report Hazard
            </button>
          </nav>
        ) : (
          <nav className="pz-compact-nav-strip" aria-label="Public navigation">
            {publicNavItems.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`pz-compact-nav-btn ${publicView === item.key ? 'is-active' : ''}`}
                onClick={() => navigatePublic(item.key)}
              >
                <span>{item.label}</span>
              </button>
            ))}
            <button
              type="button"
              className="pz-btn-primary"
              style={{ marginLeft: 'auto', minHeight: '36px', padding: '5px 12px', fontSize: '13px' }}
              onClick={() => navigatePublic('report')}
            >
              Report a Hazard
            </button>
          </nav>
        )}

        {compactSearchOpen && (
          <div className="pz-compact-search-bar">
            <div className="pz-masthead-search" style={{ width: '100%' }}>
              <img src={ASSETS.search} alt="" style={{ width: '15px', height: '15px' }} />
              <input
                type="search"
                value={activeSearch}
                onChange={(e) => setActiveSearch(e.target.value)}
                placeholder={
                  portal === 'newsroom'
                    ? 'Search signals, roads, Shona/English text...'
                    : 'Search Bulawayo roads or verified alerts...'
                }
              />
              {activeSearch && (
                <button
                  type="button"
                  className="pz-search-clear"
                  onClick={() => setActiveSearch('')}
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* =====================================================================
          WORKSPACE SHELL (NEWSROOM SIDEBAR + MAIN, OR PUBLIC MAIN)
          ===================================================================== */}
      {portal === 'newsroom' ? (
        <div className="pz-newsroom-shell">
          <aside className="pz-sidebar" aria-label="Newsroom workspace navigation">
            <div className="pz-sidebar-section-label">Editorial desk</div>
            {sidebarItems.map((item) => {
              const isActive =
                newsroomView === item.key ||
                (Boolean(item.matchFleet) && newsroomView === 'fleet');
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`pz-sidebar-item ${isActive ? 'is-active' : ''}`}
                  onClick={() => navigateNewsroom(item.key)}
                >
                  <img src={item.icon} alt="" style={{ width: '16px', height: '16px' }} />
                  <span>{item.label}</span>
                </button>
              );
            })}

            <div className="pz-sidebar-divider" />

            <div className="pz-sidebar-section-label">Citizen portal</div>

            <button
              type="button"
              className="pz-sidebar-item"
              onClick={() => navigatePublic('overview')}
            >
              <img src={ASSETS.mobHome} alt="" style={{ width: '15px', height: '15px' }} />
              <span>Public Dashboard</span>
            </button>

            <button
              type="button"
              className="pz-sidebar-item"
              onClick={() => navigatePublic('report')}
            >
              <img
                src={ASSETS.triangleAlertGreen}
                alt=""
                style={{ width: '15px', height: '15px' }}
              />
              <span>Report a Hazard</span>
            </button>
          </aside>

          <main className="pz-workspace-main">{children}</main>
        </div>
      ) : (
        <main className="pz-public-main">{children}</main>
      )}

      {/* =====================================================================
          MOBILE STICKY "REPORT A HAZARD" BAR (<= 680px PUBLIC VIEWS EXCEPT FORM)
          ===================================================================== */}
      {portal === 'public' && publicView !== 'report' && (
        <div className="pz-mobile-sticky-cta">
          <button
            type="button"
            className="pz-btn-primary"
            style={{ width: '100%', minHeight: '44px' }}
            onClick={() => navigatePublic('report')}
          >
            <img src={ASSETS.triangleAlertWhite} alt="" style={{ width: '16px', height: '16px' }} />
            <span>Report a Hazard</span>
          </button>
        </div>
      )}

      {/* =====================================================================
          MOBILE 5-ITEM BOTTOM NAVIGATION BAR (<= 680px)
          ===================================================================== */}
      {portal === 'newsroom' ? (
        <nav className="pz-mobile-bottom-nav" aria-label="Mobile newsroom navigation">
          <button
            type="button"
            className={`pz-mobile-nav-btn ${newsroomView === 'monitor' ? 'is-active' : ''}`}
            onClick={() => navigateNewsroom('monitor')}
          >
            <img src={ASSETS.navHouse} alt="" style={{ width: '18px', height: '18px' }} />
            <span>Monitor</span>
          </button>
          <button
            type="button"
            className={`pz-mobile-nav-btn ${newsroomView === 'inbox' ? 'is-active' : ''}`}
            onClick={() => navigateNewsroom('inbox')}
          >
            <img src={ASSETS.mobInbox} alt="" style={{ width: '18px', height: '18px' }} />
            <span>Inbox</span>
          </button>
          <button
            type="button"
            className={`pz-mobile-nav-btn ${newsroomView === 'verify' ? 'is-active' : ''}`}
            onClick={() => navigateNewsroom('verify')}
          >
            <img src={ASSETS.mobVerify} alt="" style={{ width: '18px', height: '18px' }} />
            <span>Verify</span>
          </button>
          <button
            type="button"
            className={`pz-mobile-nav-btn ${
              newsroomView === 'hotspots' || newsroomView === 'fleet' ? 'is-active' : ''
            }`}
            onClick={() => navigateNewsroom('hotspots')}
          >
            <img src={ASSETS.mobMap} alt="" style={{ width: '18px', height: '18px' }} />
            <span>Hotspots</span>
          </button>
          <button
            type="button"
            className={`pz-mobile-nav-btn ${newsroomView === 'briefs' ? 'is-active' : ''}`}
            onClick={() => navigateNewsroom('briefs')}
          >
            <img src={ASSETS.mobBriefs} alt="" style={{ width: '18px', height: '18px' }} />
            <span>Briefs</span>
          </button>
        </nav>
      ) : (
        <nav className="pz-mobile-bottom-nav" aria-label="Mobile public navigation">
          <button
            type="button"
            className={`pz-mobile-nav-btn ${publicView === 'overview' ? 'is-active' : ''}`}
            onClick={() => navigatePublic('overview')}
          >
            <img src={ASSETS.mobHome} alt="" style={{ width: '18px', height: '18px' }} />
            <span>Home</span>
          </button>
          <button
            type="button"
            className={`pz-mobile-nav-btn ${publicView === 'map' ? 'is-active' : ''}`}
            onClick={() => navigatePublic('map')}
          >
            <img src={ASSETS.mobMap} alt="" style={{ width: '18px', height: '18px' }} />
            <span>Map</span>
          </button>
          <button
            type="button"
            className={`pz-mobile-nav-btn ${publicView === 'alerts' ? 'is-active' : ''}`}
            onClick={() => navigatePublic('alerts')}
          >
            <img src={ASSETS.mobAlerts} alt="" style={{ width: '18px', height: '18px' }} />
            <span>Alerts</span>
          </button>
          <button
            type="button"
            className={`pz-mobile-nav-btn ${publicView === 'my-reports' ? 'is-active' : ''}`}
            onClick={() => navigatePublic('my-reports')}
          >
            <img src={ASSETS.mobUser} alt="" style={{ width: '18px', height: '18px' }} />
            <span>Reports</span>
          </button>
          <button
            type="button"
            className="pz-mobile-nav-btn"
            onClick={() => navigateNewsroom('monitor')}
          >
            <img src={ASSETS.mobVerify} alt="" style={{ width: '18px', height: '18px' }} />
            <span>Newsroom</span>
          </button>
        </nav>
      )}

      {/* =====================================================================
          TOAST BANNER
          ===================================================================== */}
      {toastMessage && (
        <div className="pz-toast" role="status" aria-live="polite">
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={dismissToast}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ffffff',
              fontSize: '18px',
              lineHeight: 1,
              padding: '0 4px',
            }}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
};
