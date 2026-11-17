import React, { useEffect, useState } from 'react';
import { ASSETS } from '../assetsMap';
import { usePanzira } from '../context/PanziraContext';
import { NewsroomView, PublicView } from '../types';

export const DemoPersonaSwitcher: React.FC<{
  darkTheme?: boolean;
}> = ({ darkTheme = false }) => {
  const { currentUser, quickDemoLogin, awaitingReviewCount, resetDemoData } = usePanzira();
  const [open, setOpen] = useState(false);

  const activePersona: 'guest' | 'citizen' | 'journalist' | 'admin' = !currentUser
    ? 'guest'
    : currentUser.role === 'citizen'
      ? 'citizen'
      : currentUser.role === 'admin'
        ? 'admin'
        : 'journalist';

  const handleConfirmReset = () => {
    const confirmed = window.confirm(
      'Reset local demo state to the initial baseline? Any custom demo reports in this browser will be cleared.'
    );
    if (confirmed) {
      resetDemoData();
      setOpen(false);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        data-testid="navbar-demo-switcher-btn"
        onClick={() => setOpen((prev) => !prev)}
        style={{
          background: darkTheme ? 'rgba(255, 255, 255, 0.1)' : '#f8fafc',
          border: darkTheme ? '1px solid rgba(255, 255, 255, 0.22)' : '1px solid #d9e1db',
          borderRadius: '6px',
          padding: '5px 10px',
          color: darkTheme ? '#f8fafc' : '#202a24',
          fontSize: '12.5px',
          fontWeight: 500,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
        }}
        title="Switch live demo persona (Guest, Citizen, Journalist, Admin)"
      >
        <span>Demo</span>
        <span style={{ fontSize: '10px', opacity: 0.75 }}>▾</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Live demo role switcher"
          data-testid="navbar-demo-switcher-menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '300px',
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            padding: '14px',
            boxShadow: '0 12px 28px rgba(15, 23, 42, 0.16)',
            zIndex: 200,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            color: '#0f172a',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span
              className="pz-mono"
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#145438',
                letterSpacing: '0.04em',
              }}
            >
              LIVE DEMO ROLE SWITCHER
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                fontSize: '16px',
                cursor: 'pointer',
              }}
              aria-label="Close demo menu"
            >
              ×
            </button>
          </div>

          <p style={{ fontSize: '12px', color: '#475569', lineHeight: 1.4, margin: 0 }}>
            Switch instantly between any persona from anywhere in the app ({awaitingReviewCount}{' '}
            reports in queue):
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {(
              [
                {
                  key: 'guest',
                  label: 'Guest (Public)',
                  sub: 'Unauthenticated public road safety view',
                },
                {
                  key: 'citizen',
                  label: 'Tariro Moyo (Citizen)',
                  sub: '@TariroOnTheRoad · Contributor Rights Vault',
                },
                {
                  key: 'journalist',
                  label: 'Nqobile Dube (Journalist)',
                  sub: 'The Chronicle · ZMC-2026-0418 · Newsroom',
                },
                {
                  key: 'admin',
                  label: 'Rudo Moyo (Admin)',
                  sub: 'Panzira Control Desk · Press & Royalties',
                },
              ] as const
            ).map((item) => {
              const isCurrent = activePersona === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  data-testid={`demo-switch-${item.key}`}
                  onClick={async () => {
                    setOpen(false);
                    await quickDemoLogin(item.key);
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: isCurrent ? '1.5px solid #059669' : '1px solid #e2e8f0',
                    background: isCurrent ? '#ecfdf5' : '#f8fafc',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: isCurrent ? '#065f46' : '#0f172a',
                    }}
                  >
                    <span>{item.label}</span>
                    {isCurrent && <span style={{ fontSize: '11px' }}>✓ Active</span>}
                  </div>
                  <span style={{ fontSize: '11.5px', color: '#64748b' }}>{item.sub}</span>
                </button>
              );
            })}
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '4px 0' }} />

          <button
            type="button"
            onClick={handleConfirmReset}
            style={{
              width: '100%',
              padding: '7px 10px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#475569',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Reset demo data to baseline
          </button>
        </div>
      )}
    </div>
  );
};

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    portal,
    newsroomView,
    publicView,
    currentUser,
    selectedInboxId,
    navigateNewsroom,
    navigatePublic,
    navigateAuth,
    navigateCitizen,
    navigateAdmin,
    logoutUser,
    toastMessage,
    dismissToast,
  } = usePanzira();

  const [mobileInboxDetailOpen, setMobileInboxDetailOpen] = useState(false);

  useEffect(() => {
    const onDetailState = (evt: Event) => {
      const customEvt = evt as CustomEvent<{ open?: boolean }>;
      setMobileInboxDetailOpen(Boolean(customEvt.detail?.open));
    };
    window.addEventListener('panzira:mobile-inbox-review-state', onDetailState);
    return () => window.removeEventListener('panzira:mobile-inbox-review-state', onDetailState);
  }, []);

  useEffect(() => {
    if (newsroomView !== 'inbox') {
      setMobileInboxDetailOpen(false);
    }
  }, [newsroomView]);

  const isAuthFallback =
    portal === 'auth' ||
    (portal === 'citizen' && !currentUser) ||
    (portal === 'admin' && (!currentUser || currentUser.role !== 'admin')) ||
    (portal === 'newsroom' && (!currentUser || currentUser.role === 'citizen'));

  if (isAuthFallback || portal === 'citizen' || portal === 'admin') {
    return (
      <div className="pz-app">
        {children}
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
  }

  const publicNavItems: Array<{ key: PublicView; label: string }> = [
    { key: 'overview', label: 'Home' },
    { key: 'map', label: 'Road conditions' },
    { key: 'report', label: 'Report a hazard' },
  ];

  const newsroomNavItems: Array<{ key: NewsroomView; label: string }> = [
    { key: 'inbox', label: 'Inbox' },
    { key: 'verify', label: 'Verification' },
    { key: 'sources', label: 'Sources' },
    { key: 'hotspots', label: 'Corridors' },
    { key: 'briefs', label: 'Briefs' },
  ];

  const roleBadgeLabel = currentUser
    ? currentUser.role === 'citizen'
      ? `${currentUser.full_name || 'Tariro Moyo'} · Citizen`
      : currentUser.role === 'admin'
        ? `${currentUser.full_name || 'Rudo Moyo'} · Admin`
        : `${currentUser.full_name || 'Nqobile Dube'} · Journalist`
    : null;

  return (
    <div className="pz-v3-shell">
      {/* =====================================================================
          V3 APPLICATION HEADER (Figma 75:372 / 75:495 / 75:716 / 75:892 / 75:1087)
          ===================================================================== */}
      <header className="pz-v3-header">
        {/* Brand Identity */}
        <button
          type="button"
          className="pz-v3-brand-btn"
          onClick={() =>
            portal === 'newsroom' ? navigateNewsroom('inbox') : navigatePublic('overview')
          }
          title="Panzira AI Home"
        >
          <img src={ASSETS.roadMark} alt="" style={{ width: '38px', height: '32px' }} />
          <span className="pz-v3-brand-wordmark">
            <span style={{ color: '#145438' }}>Panzira </span>
            <span style={{ color: '#785b0a' }}>AI</span>
          </span>
        </button>

        {/* Primary Desktop Navigation */}
        {portal === 'public' ? (
          <nav className="pz-v3-primary-nav" aria-label="Primary navigation">
            {publicNavItems.map((item) => {
              const isActive =
                publicView === item.key || (item.key === 'map' && publicView === 'alerts');
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => navigatePublic(item.key)}
                  className={`pz-v3-nav-link ${isActive ? 'is-active' : ''}`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        ) : (
          <nav className="pz-v3-primary-nav" aria-label="Newsroom navigation">
            {newsroomNavItems.map((item) => {
              const isActive = newsroomView === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => navigateNewsroom(item.key)}
                  className={`pz-v3-nav-link ${isActive ? 'is-active' : ''}`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        )}

        {/* Right Controls: Demo Switcher + Auth / Workspace Actions */}
        <div className="pz-v3-header-actions">
          <DemoPersonaSwitcher />

          {!currentUser ? (
            <>
              <button
                type="button"
                data-testid="navbar-signin-btn"
                onClick={() => navigateAuth('signin')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: '4px 6px',
                  color: '#5d6b63',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Sign in
              </button>

              <button
                type="button"
                data-testid="navbar-newsroom-btn"
                onClick={() => navigateNewsroom('inbox')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: '4px 0',
                  color: '#176b45',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Newsroom →
              </button>
            </>
          ) : (
            <div className="pz-v3-header-user-group">
              <span
                data-testid="navbar-user-role-pill"
                className="pz-v3-header-role-pill"
                style={{
                  background: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  borderRadius: '999px',
                  padding: '4px 10px',
                  color: '#065f46',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                {roleBadgeLabel}
              </span>

              {currentUser.role === 'citizen' && (
                <button
                  type="button"
                  data-testid="navbar-workspace-link"
                  onClick={() => navigateCitizen()}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: '4px 0',
                    color: '#176b45',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  My Rights Vault →
                </button>
              )}

              {(currentUser.role === 'journalist' || currentUser.role === 'editor') && (
                <button
                  type="button"
                  data-testid="navbar-workspace-link"
                  onClick={() =>
                    portal === 'newsroom'
                      ? navigatePublic('overview')
                      : navigateNewsroom('inbox')
                  }
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: '4px 0',
                    color: '#176b45',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {portal === 'newsroom' ? 'Public site →' : 'Newsroom →'}
                </button>
              )}

              {currentUser.role === 'admin' && (
                <>
                  <button
                    type="button"
                    data-testid="navbar-workspace-link"
                    onClick={() => navigateAdmin()}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      padding: '4px 0',
                      color: '#176b45',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Control Desk →
                  </button>
                  <button
                    type="button"
                    className="pz-v3-desktop-only-btn"
                    onClick={() =>
                      portal === 'newsroom'
                        ? navigatePublic('overview')
                        : navigateNewsroom('inbox')
                    }
                    style={{
                      background: 'transparent',
                      border: 'none',
                      padding: '4px 0',
                      color: '#5d6b63',
                      fontSize: '13.5px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {portal === 'newsroom' ? 'Public site' : 'Newsroom →'}
                  </button>
                </>
              )}

              <button
                type="button"
                data-testid="navbar-signout-btn"
                onClick={logoutUser}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  color: '#475569',
                  fontSize: '12.5px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      {/* =====================================================================
          MAIN CONTENT AREA
          ===================================================================== */}
      <main id="pz-main-content" className="pz-v3-main">
        {children}
      </main>

      {/* =====================================================================
          V3 APPLICATION FOOTER (Figma 75:428 / 75:596 / 75:1194)
          ===================================================================== */}
      <footer className="pz-v3-footer">
        <span style={{ fontSize: '14px', lineHeight: '20px', color: '#5d6b63' }}>
          {portal === 'newsroom'
            ? 'Panzira newsroom · Editorial review before publication'
            : 'Community road safety · Bulawayo, Zimbabwe'}
        </span>
        <button
          type="button"
          onClick={() => navigateAuth('signin')}
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            color: '#176b45',
            fontSize: '14px',
            lineHeight: '20px',
            fontWeight: 400,
            cursor: 'pointer',
          }}
        >
          Help &amp; accessibility
        </button>
      </footer>

      {/* =====================================================================
          V3 MOBILE BOTTOM NAVIGATION (Figma 75:471 / 75:699 / 75:1297)
          ===================================================================== */}
      {portal === 'public' ? (
        <nav className="pz-v3-mobile-bottom-nav" aria-label="Mobile public navigation">
          <button
            type="button"
            className={`pz-v3-mobile-tab ${publicView === 'overview' ? 'is-active' : ''}`}
            onClick={() => navigatePublic('overview')}
          >
            <img src={ASSETS.mobHome} alt="" style={{ width: '20px', height: '20px' }} />
            <span>Home</span>
          </button>
          <button
            type="button"
            className={`pz-v3-mobile-tab ${publicView === 'map' || publicView === 'alerts' ? 'is-active' : ''
              }`}
            onClick={() => navigatePublic('map')}
          >
            <img src={ASSETS.mobMap} alt="" style={{ width: '20px', height: '20px' }} />
            <span>Roads</span>
          </button>
          <button
            type="button"
            className={`pz-v3-mobile-tab ${publicView === 'report' ? 'is-active' : ''}`}
            onClick={() => navigatePublic('report')}
          >
            <img src={ASSETS.plus} alt="" style={{ width: '20px', height: '20px' }} />
            <span>Report</span>
          </button>
        </nav>
      ) : (
        <nav className="pz-v3-mobile-bottom-nav" aria-label="Mobile newsroom navigation">
          <button
            type="button"
            data-testid="mobile-nav-inbox-tab"
            className={`pz-v3-mobile-tab ${
              newsroomView === 'inbox' && !mobileInboxDetailOpen ? 'is-active' : ''
            }`}
            onClick={() => {
              window.dispatchEvent(new CustomEvent('panzira:mobile-inbox-list'));
              navigateNewsroom('inbox');
            }}
          >
            <img src={ASSETS.mobInbox} alt="" style={{ width: '20px', height: '20px' }} />
            <span>Inbox</span>
          </button>
          <button
            type="button"
            data-testid="mobile-nav-review-tab"
            className={`pz-v3-mobile-tab ${
              newsroomView === 'verify' || (newsroomView === 'inbox' && mobileInboxDetailOpen)
                ? 'is-active'
                : ''
            }`}
            onClick={() => navigateNewsroom('verify', selectedInboxId)}
          >
            <img src={ASSETS.mobVerify} alt="" style={{ width: '20px', height: '20px' }} />
            <span>Review</span>
          </button>
          <button
            type="button"
            className="pz-v3-mobile-tab"
            onClick={() => navigateAuth('signin')}
          >
            <img src={ASSETS.mobUser} alt="" style={{ width: '20px', height: '20px' }} />
            <span>Account</span>
          </button>
        </nav>
      )}

      {/* Toast Feedback */}
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
