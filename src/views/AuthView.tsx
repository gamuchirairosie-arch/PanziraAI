import React, { useEffect, useRef, useState } from 'react';
import { ASSETS } from '../assetsMap';
import { DemoPersonaSwitcher } from '../components/AppShell';
import { usePanzira } from '../context/PanziraContext';
import { apiService } from '../services/api';
import { AuthTab, AuthUser } from '../types';

function parseClaimInput(raw: string): { reference?: string; pin?: string } {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  const refMatch = /#?(PZ-[A-Z0-9-]+|ROADS-\d+)/i.exec(trimmed);
  const remaining = refMatch ? trimmed.replace(refMatch[0], ' ') : trimmed;
  const explicitPinMatch = /PIN[:\s-]*(\d{4})\b/i.exec(remaining) || /\b(\d{4})\b/.exec(remaining);
  return {
    reference: refMatch ? refMatch[1].toUpperCase() : undefined,
    pin: explicitPinMatch ? explicitPinMatch[1] : undefined,
  };
}

export const AuthView: React.FC = () => {
  const {
    authTab,
    setAuthTab,
    setCurrentUser,
    authPromptMessage,
    setAuthPromptMessage,
    quickDemoLogin,
    navigatePublic,
    navigateCitizen,
    navigateNewsroom,
    navigateAdmin,
    showToast,
    pendingClaimPrefill,
    royaltyBalanceUsd,
    claimReportInSession,
  } = usePanzira();

  // Sign In form state
  const [signInIdentifier, setSignInIdentifier] = useState('nqobile@chronicle.co.zw');
  const [signInPassword, setSignInPassword] = useState('panzira2026');
  const [signInLoading, setSignInLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccessBanner, setAuthSuccessBanner] = useState<string | null>(null);

  // Citizen Sign-Up & Claim state
  const [citizenHandle, setCitizenHandle] = useState('@TariroOnTheRoad');
  const [citizenContact, setCitizenContact] = useState('tariro.moyo@citizen.co.zw');
  const [citizenPassword, setCitizenPassword] = useState('panzira_citizen_2026');
  const [citizenClaimPinInput, setCitizenClaimPinInput] = useState(() => {
    if (pendingClaimPrefill) {
      const refStr = pendingClaimPrefill.reference.startsWith('#')
        ? pendingClaimPrefill.reference
        : `#${pendingClaimPrefill.reference}`;
      return `${refStr}  —  PIN ${pendingClaimPrefill.pin}`;
    }
    return '#PZ-8492  —  PIN 4920';
  });
  const [citizenLoading, setCitizenLoading] = useState(false);

  useEffect(() => {
    if (pendingClaimPrefill) {
      const refStr = pendingClaimPrefill.reference.startsWith('#')
        ? pendingClaimPrefill.reference
        : `#${pendingClaimPrefill.reference}`;
      setCitizenClaimPinInput(`${refStr}  —  PIN ${pendingClaimPrefill.pin}`);
    }
  }, [pendingClaimPrefill]);

  // Journalist Press Application state
  const [pressFullName, setPressFullName] = useState('');
  const [pressMediaHouse, setPressMediaHouse] = useState('');
  const [pressWorkEmail, setPressWorkEmail] = useState('');
  const [pressZmcNumber, setPressZmcNumber] = useState('ZMC-2026-02814');
  const [pressCardFileName, setPressCardFileName] = useState<string | null>(null);
  const [pressLoading, setPressLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const switchTab = (tab: AuthTab) => {
    setAuthError(null);
    setAuthSuccessBanner(null);
    setAuthTab(tab);
  };

  const routeByUserRole = (user: AuthUser) => {
    setAuthPromptMessage(null);
    setCurrentUser(user);
    if (user.role === 'admin') {
      showToast(`Signed in as ${user.full_name} (Editorial Admin) → Control Desk`);
      navigateAdmin();
    } else if (user.role === 'editor' || user.role === 'journalist') {
      showToast(`Signed in as ${user.full_name} (${user.role}) → Newsroom Inbox`);
      navigateNewsroom('inbox');
    } else {
      showToast(`Signed in as ${user.handle || user.full_name} → Contributor Rights Vault`);
      navigateCitizen();
    }
  };

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccessBanner(null);
    if (!signInIdentifier.trim() || !signInPassword.trim()) {
      setAuthError('Please enter your email or phone number and password.');
      return;
    }

    setSignInLoading(true);
    try {
      const res = await apiService.login(signInIdentifier.trim(), signInPassword);
      routeByUserRole(res.user);
    } catch (err: any) {
      const msg = err?.message || 'Authentication failed';
      if (msg.toLowerCase().includes('pending editorial admin verification')) {
        setAuthError(msg);
      } else {
        // Fallback for built-in demo personas when backend is offline or unseeded
        const lower = signInIdentifier.trim().toLowerCase();
        if (lower.includes('tariro') || lower.includes('citizen') || lower.startsWith('+263')) {
          const fallbackCitizen: AuthUser = {
            id: 101,
            email: lower.includes('@') ? lower : 'tariro@citizen.co.zw',
            full_name: 'Tariro Moyo',
            role: 'citizen',
            handle: '@TariroOnTheRoad',
            phone: '+263 77 412 8901',
            verification_status: 'verified',
            royalty_balance_usd: 16.0,
          };
          routeByUserRole(fallbackCitizen);
        } else if (lower.includes('rudo') || lower.includes('admin')) {
          const fallbackAdmin: AuthUser = {
            id: 1,
            email: 'rudo@panzira.zw',
            full_name: 'Rudo Moyo',
            role: 'admin',
            media_house: 'Panzira Control Desk',
            verification_status: 'verified',
          };
          routeByUserRole(fallbackAdmin);
        } else if (
          lower.includes('nqobile') ||
          lower.includes('chronicle') ||
          lower.includes('dumisani') ||
          lower.includes('cite') ||
          lower.includes('journalist')
        ) {
          const fallbackJournalist: AuthUser = {
            id: 102,
            email: lower,
            full_name: lower.includes('dumisani') ? 'Dumisani Sibanda' : 'Nqobile Dube',
            role: 'journalist',
            media_house: lower.includes('dumisani') ? 'CITE Bulawayo' : 'The Chronicle',
            zmc_number: lower.includes('dumisani') ? 'ZMC-2026-01942' : 'ZMC-2026-0418',
            verification_status: 'verified',
          };
          routeByUserRole(fallbackJournalist);
        } else {
          setAuthError(msg);
        }
      }
    } finally {
      setSignInLoading(false);
    }
  };

  const handleCitizenSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccessBanner(null);

    const cleanHandle = citizenHandle.trim() || '@TariroOnTheRoad';
    const cleanContact = citizenContact.trim();
    if (!cleanContact || !citizenPassword.trim()) {
      setAuthError('Please enter your phone or email and create a password.');
      return;
    }

    const isEmail = cleanContact.includes('@');
    const parsedClaim = parseClaimInput(citizenClaimPinInput);
    const derivedName = cleanHandle.startsWith('@')
      ? cleanHandle.slice(1).replace(/([A-Z])/g, ' $1').trim() || 'Tariro Moyo'
      : cleanHandle;

    const formattedHandle = cleanHandle.startsWith('@') ? cleanHandle : `@${cleanHandle}`;
    setCitizenLoading(true);
    try {
      const res = await apiService.registerCitizen({
        full_name: derivedName,
        handle: formattedHandle,
        email: isEmail ? cleanContact : undefined,
        phone: !isEmail ? cleanContact : '+263 77 412 8901',
        password: citizenPassword,
        claim_reference: parsedClaim.reference,
        claim_pin: parsedClaim.pin,
      });
      const claimedRef =
        res.claimed_report_reference ||
        res.claimed_report ||
        res.claimedReport ||
        parsedClaim.reference;
      if (claimedRef && parsedClaim.pin) {
        claimReportInSession({
          reference: claimedRef,
          claimPin: parsedClaim.pin,
          contributorId: res.user?.id,
          contributorHandle: res.user?.handle || formattedHandle,
        });
      }
      setCurrentUser({
        ...res.user,
        royalty_balance_usd:
          typeof res.user.royalty_balance_usd === 'number' && res.user.royalty_balance_usd > 0
            ? res.user.royalty_balance_usd
            : royaltyBalanceUsd,
      });
      showToast(
        claimedRef
          ? `Account created & Guest Report #${claimedRef.replace(/^#/, '')} linked to your Rights Vault.`
          : 'Citizen account created. Welcome to your Contributor Rights Vault.'
      );
      navigateCitizen();
    } catch {
      // Fallback for demo mode or duplicate email
      const fallbackUser: AuthUser = {
        id: Date.now(),
        email: isEmail ? cleanContact : `${cleanHandle.replace(/[^a-z0-9]/gi, '').toLowerCase()}@citizen.co.zw`,
        full_name: derivedName,
        role: 'citizen',
        handle: formattedHandle,
        phone: !isEmail ? cleanContact : '+263 77 412 8901',
        verification_status: 'verified',
        royalty_balance_usd: royaltyBalanceUsd,
      };
      if (parsedClaim.reference) {
        claimReportInSession({
          reference: parsedClaim.reference,
          claimPin: parsedClaim.pin || '4920',
          contributorId: fallbackUser.id,
          contributorHandle: fallbackUser.handle || formattedHandle,
        });
      }
      setCurrentUser(fallbackUser);
      showToast(
        parsedClaim.reference
          ? `Citizen account active · Report #${parsedClaim.reference} linked to your Rights Vault.`
          : 'Citizen account active · Welcome to your Contributor Rights Vault.'
      );
      navigateCitizen();
    } finally {
      setCitizenLoading(false);
    }
  };

  const handlePressApplicationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccessBanner(null);

    const full_name = pressFullName.trim() || 'Lindiwe Ncube';
    const media_house = pressMediaHouse.trim() || 'CITE';
    const email = pressWorkEmail.trim() || `lindiwe.${Date.now().toString().slice(-4)}@cite.org.zw`;
    const zmc_number = pressZmcNumber.trim() || 'ZMC-2026-02814';

    setPressLoading(true);
    try {
      const res = await apiService.registerJournalist({
        full_name,
        email,
        media_house,
        zmc_number,
        press_card_url: pressCardFileName
          ? `/uploads/press-cards/${pressCardFileName}`
          : `/uploads/press-cards/${zmc_number.toLowerCase()}.pdf`,
      });
      setAuthSuccessBanner(
        res.message ||
          `Press application submitted for ${full_name} (${media_house} · ${zmc_number}). Editorial Admin verification is required before Newsroom access is unlocked.`
      );
      showToast('Press accreditation application submitted for Editorial Admin review.');
    } catch (err: any) {
      setAuthSuccessBanner(
        `Press application recorded for ${full_name} (${media_house} · ${zmc_number}). Pending Editorial Admin review in the Control Desk.`
      );
      showToast('Press application queued for Editorial Admin verification.');
    } finally {
      setPressLoading(false);
    }
  };

  return (
    <div className="pz-v3-auth-page" data-node-id="105:49">
      {/* =====================================================================
          TOP BRAND HEADER (Matches Figma 105:58 Desktop & 105:207 Mobile)
          ===================================================================== */}
      <header className="pz-v3-auth-header">
        <div className="pz-v3-auth-header-left">
          <button
            type="button"
            className="pz-v3-brand-btn"
            onClick={() => navigatePublic('overview')}
          >
            <img src={ASSETS.roadMark} alt="" className="pz-v3-brand-mark" />
            <span className="pz-v3-brand-wordmark">
              Panzira <span className="pz-v3-brand-wordmark-ai">AI</span>
            </span>
          </button>
          <span className="pz-v3-auth-header-tagline">
            Road safety intelligence · Zimbabwe
          </span>
        </div>

        <div className="pz-v3-auth-header-actions">
          <DemoPersonaSwitcher />
          <button
            type="button"
            className="pz-v3-return-map-link"
            onClick={() => navigatePublic('overview')}
          >
            <span className="pz-hide-mobile">← Return to Home</span>
            <span className="pz-show-mobile">Home →</span>
          </button>
          <button
            type="button"
            className="pz-v3-return-map-link"
            onClick={() => navigatePublic('map')}
          >
            <span className="pz-hide-mobile">Live map →</span>
            <span className="pz-show-mobile">Map →</span>
          </button>
        </div>
      </header>

      {/* =====================================================================
          SPLIT SCREEN BODY (Left Deep Editorial Slate #0F172A + Right White Card)
          ===================================================================== */}
      <div className="pz-v3-auth-split">
        {/* LEFT PANEL: Deep Editorial Slate (#0F172A) */}
        <aside className="pz-v3-auth-slate-panel" aria-label="Trust, rights and access pledge">
          <div className="pz-v3-auth-slate-inner">
            <div className="pz-v3-auth-pill">CITIZEN POWERED. HUMAN VERIFIED.</div>

            <h1 className="pz-v3-auth-hero-title">
              <span>Safer roads.</span>
              <span>Your voice.</span>
              <span>Your rights.</span>
            </h1>

            <p className="pz-v3-auth-hero-subtitle">
              Civic road-safety intelligence for the journeys that connect Zimbabwe.
            </p>

            <div className="pz-v3-auth-stats-card">
              <div className="pz-v3-auth-stat-col">
                <div className="pz-v3-auth-stat-num">24</div>
                <div className="pz-v3-auth-stat-desc">verified alerts</div>
              </div>
              <div className="pz-v3-auth-stat-col">
                <div className="pz-v3-auth-stat-mono">R1 / R2</div>
                <div className="pz-v3-auth-stat-desc">corridors monitored</div>
              </div>
            </div>

            <div className="pz-v3-auth-pledge-block">
              <div className="pz-v3-auth-pledge-heading">TRUST &nbsp;•&nbsp; RIGHTS &nbsp;•&nbsp; ACCESS</div>
              <p className="pz-v3-auth-pledge-copy">
                Human review before public alerts.
                <br />
                You own your media. Reporting stays free.
              </p>
            </div>

            <div className="pz-v3-auth-demo-footnote">
              DEMO SNAPSHOT · NOT A LIVE SAFETY FEED
            </div>
          </div>
        </aside>

        {/* RIGHT PANEL: Authentication Card */}
        <section className="pz-v3-auth-card-wrap">
          <div className="pz-v3-auth-card">
            <div className="pz-v3-auth-eyebrow">
              <span className="pz-hide-mobile">ONE ACCOUNT. THE RIGHT ACCESS.</span>
              <span className="pz-show-mobile">TRUST • RIGHTS • ACCESS</span>
            </div>

            {/* 3-Tab Switcher */}
            <div className="pz-v3-auth-tabs" role="tablist" aria-label="Account access modes">
              <button
                type="button"
                role="tab"
                aria-selected={authTab === 'signin'}
                className={`pz-v3-auth-tab ${authTab === 'signin' ? 'is-active' : ''}`}
                onClick={() => switchTab('signin')}
              >
                <span className="pz-hide-mobile">Sign In</span>
                <span className="pz-show-mobile">Sign in</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={authTab === 'citizen-signup'}
                className={`pz-v3-auth-tab ${authTab === 'citizen-signup' ? 'is-active' : ''}`}
                onClick={() => switchTab('citizen-signup')}
              >
                <span className="pz-hide-mobile">Citizen Sign-Up &amp; Claim</span>
                <span className="pz-show-mobile">Citizen claim</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={authTab === 'journalist-apply'}
                className={`pz-v3-auth-tab ${authTab === 'journalist-apply' ? 'is-active' : ''}`}
                onClick={() => switchTab('journalist-apply')}
              >
                <span className="pz-hide-mobile">Journalist Press Application</span>
                <span className="pz-show-mobile">Press apply</span>
              </button>
            </div>

            {authPromptMessage && authTab === 'signin' && (
              <div
                data-testid="auth-protected-route-banner"
                role="status"
                style={{
                  background: '#fffbeb',
                  border: '1px solid #d97706',
                  borderRadius: '6px',
                  padding: '12px 14px',
                  color: '#92400e',
                  fontSize: '13.5px',
                  fontWeight: 500,
                  lineHeight: 1.45,
                  marginBottom: '12px',
                }}
              >
                {authPromptMessage}
              </div>
            )}

            {authError && (
              <div className="pz-v3-auth-alert is-error" role="alert">
                {authError}
              </div>
            )}

            {authSuccessBanner && (
              <div className="pz-v3-auth-alert is-success" role="status">
                <div>{authSuccessBanner}</div>
                <div style={{ marginTop: '8px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="pz-v3-inline-action-link"
                    onClick={() => navigateAdmin()}
                  >
                    Open Editorial Admin Control Desk to review &amp; approve →
                  </button>
                </div>
              </div>
            )}

            {/* ===============================================================
                TAB 1: SIGN IN
                =============================================================== */}
            {authTab === 'signin' && (
              <form onSubmit={handleSignInSubmit} className="pz-v3-auth-form">
                <h2 className="pz-v3-auth-card-title">Welcome back.</h2>
                <p className="pz-v3-auth-card-subtitle">
                  Sign in to follow reports and manage your media.
                </p>

                <div className="pz-v3-field">
                  <label htmlFor="pz-signin-email" className="pz-v3-label">
                    Email or phone
                  </label>
                  <input
                    id="pz-signin-email"
                    type="text"
                    className="pz-v3-input"
                    value={signInIdentifier}
                    onChange={(e) => setSignInIdentifier(e.target.value)}
                    placeholder="you@example.com or +263…"
                  />
                </div>

                <div className="pz-v3-field">
                  <label htmlFor="pz-signin-password" className="pz-v3-label">
                    Password
                  </label>
                  <input
                    id="pz-signin-password"
                    type="password"
                    className="pz-v3-input"
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    placeholder="Enter your password"
                  />
                  <div className="pz-v3-forgot-row">
                    <button
                      type="button"
                      className="pz-v3-forgot-link"
                      onClick={() =>
                        showToast(
                          'Sample accounts: Tariro Moyo (tariro@citizen.co.zw), Nqobile Dube (nqobile@chronicle.co.zw), Rudo Moyo (rudo@panzira.zw).'
                        )
                      }
                    >
                      Forgot password?
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="pz-v3-submit-btn"
                  disabled={signInLoading}
                >
                  {signInLoading ? 'Signing in securely…' : 'Sign in securely'}
                </button>

                <div className="pz-v3-routing-box" data-testid="live-demo-quickfill-box">
                  <div className="pz-v3-routing-title">The right workspace, automatically.</div>
                  <div className="pz-v3-routing-copy">
                    Citizens → Rights Vault &nbsp;•&nbsp; Approved press → Newsroom &nbsp;•&nbsp; Editorial admins → Control desk
                  </div>

                  <div
                    style={{
                      marginTop: '12px',
                      paddingTop: '10px',
                      borderTop: '1px solid #e2e8f0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 500,
                        color: '#475569',
                      }}
                    >
                      Sample accounts
                    </span>

                    <div
                      style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        overflow: 'hidden',
                      }}
                    >
                      {(
                        [
                          {
                            key: 'citizen',
                            testId: 'demo-login-citizen-btn',
                            name: 'Tariro Moyo',
                            roleLabel: 'Citizen contributor',
                            email: 'tariro@citizen.co.zw',
                          },
                          {
                            key: 'journalist',
                            testId: 'demo-login-journalist-btn',
                            name: 'Nqobile Dube',
                            roleLabel: 'The Chronicle',
                            email: 'nqobile@chronicle.co.zw',
                          },
                          {
                            key: 'admin',
                            testId: 'demo-login-admin-btn',
                            name: 'Rudo Moyo',
                            roleLabel: 'Editorial desk',
                            email: 'rudo@panzira.zw',
                          },
                        ] as const
                      ).map((acct, idx) => (
                        <button
                          key={acct.key}
                          type="button"
                          data-testid={acct.testId}
                          onClick={async () => {
                            setSignInIdentifier(acct.email);
                            setSignInPassword('panzira2026');
                            await quickDemoLogin(acct.key);
                          }}
                          style={{
                            width: '100%',
                            background: 'transparent',
                            border: 'none',
                            borderTop: idx > 0 ? '1px solid #e2e8f0' : 'none',
                            padding: '9px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '8px',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontFamily: 'var(--font-sans)',
                          }}
                        >
                          <span style={{ fontSize: '13px', color: '#0f172a', fontWeight: 500 }}>
                            {acct.name}{' '}
                            <span style={{ color: '#475569', fontWeight: 400 }}>
                              · {acct.roleLabel}
                            </span>
                          </span>
                          <span style={{ fontSize: '12.5px', color: '#176b45', fontWeight: 500 }}>
                            Sign in →
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="pz-v3-no-account-link"
                  onClick={() => navigatePublic('report')}
                >
                  No account needed to report a hazard →
                </button>
              </form>
            )}

            {/* ===============================================================
                TAB 2: CITIZEN SIGN-UP & CLAIM
                =============================================================== */}
            {authTab === 'citizen-signup' && (
              <form onSubmit={handleCitizenSignUp} className="pz-v3-auth-form">
                <h2 className="pz-v3-auth-card-title">Your reports. Your rights.</h2>
                <p className="pz-v3-auth-card-subtitle">
                  Track verification and keep control of your media.
                </p>

                <div className="pz-v3-field">
                  <label htmlFor="pz-citizen-handle" className="pz-v3-label">
                    Name / handle
                  </label>
                  <input
                    id="pz-citizen-handle"
                    type="text"
                    className="pz-v3-input"
                    value={citizenHandle}
                    onChange={(e) => setCitizenHandle(e.target.value)}
                    placeholder="e.g. @TariroOnTheRoad"
                  />
                </div>

                <div className="pz-v3-field">
                  <label htmlFor="pz-citizen-contact" className="pz-v3-label">
                    Phone or email
                  </label>
                  <input
                    id="pz-citizen-contact"
                    type="text"
                    className="pz-v3-input"
                    value={citizenContact}
                    onChange={(e) => setCitizenContact(e.target.value)}
                    placeholder="+263 77… or you@example.com"
                  />
                </div>

                <div className="pz-v3-field">
                  <label htmlFor="pz-citizen-pass" className="pz-v3-label">
                    Password
                  </label>
                  <input
                    id="pz-citizen-pass"
                    type="password"
                    className="pz-v3-input"
                    value={citizenPassword}
                    onChange={(e) => setCitizenPassword(e.target.value)}
                    placeholder="Create a secure password"
                  />
                </div>

                {/* Amber-bordered Guest Report Claim PIN highlight box */}
                <div className="pz-v3-claim-pin-box">
                  <div className="pz-v3-claim-pin-title">Have a Guest Report Claim PIN?</div>
                  <div className="pz-v3-claim-pin-sub">
                    Link it here to track verification &amp; claim photo royalties.
                  </div>
                  <input
                    type="text"
                    className="pz-v3-claim-pin-input"
                    value={citizenClaimPinInput}
                    onChange={(e) => setCitizenClaimPinInput(e.target.value)}
                    placeholder="#PZ-8492  —  PIN 4920"
                    aria-label="Guest Report Reference and 4-digit Claim PIN"
                  />
                </div>

                <button
                  type="submit"
                  className="pz-v3-submit-btn"
                  disabled={citizenLoading}
                >
                  {citizenLoading ? 'Creating citizen account…' : 'Create citizen account'}
                </button>

                <p className="pz-v3-auth-foot-note">
                  Your photo rights remain yours. No transfer of ownership.
                </p>
              </form>
            )}

            {/* ===============================================================
                TAB 3: JOURNALIST PRESS APPLICATION
                =============================================================== */}
            {authTab === 'journalist-apply' && (
              <form onSubmit={handlePressApplicationSubmit} className="pz-v3-auth-form">
                <h2 className="pz-v3-auth-card-title">Apply for newsroom access.</h2>
                <p className="pz-v3-auth-card-subtitle">
                  For accredited journalists and editorial teams.
                </p>

                <div className="pz-v3-field-row-2col">
                  <div className="pz-v3-field">
                    <label htmlFor="pz-press-name" className="pz-v3-label">
                      Full Name
                    </label>
                    <input
                      id="pz-press-name"
                      type="text"
                      className="pz-v3-input"
                      value={pressFullName}
                      onChange={(e) => setPressFullName(e.target.value)}
                      placeholder="As shown on press card"
                    />
                  </div>

                  <div className="pz-v3-field">
                    <label htmlFor="pz-press-house" className="pz-v3-label">
                      Media House
                    </label>
                    <input
                      id="pz-press-house"
                      type="text"
                      className="pz-v3-input"
                      value={pressMediaHouse}
                      onChange={(e) => setPressMediaHouse(e.target.value)}
                      placeholder="Zimpapers, CITE, AMH, StarFM"
                    />
                  </div>
                </div>

                <div className="pz-v3-field">
                  <label htmlFor="pz-press-email" className="pz-v3-label">
                    Official Work Email
                  </label>
                  <input
                    id="pz-press-email"
                    type="email"
                    className="pz-v3-input"
                    value={pressWorkEmail}
                    onChange={(e) => setPressWorkEmail(e.target.value)}
                    placeholder="name@newsroom.co.zw"
                  />
                </div>

                <div className="pz-v3-field">
                  <label htmlFor="pz-press-zmc" className="pz-v3-label">
                    ZMC Accreditation / Press Card Number
                  </label>
                  <input
                    id="pz-press-zmc"
                    type="text"
                    className="pz-v3-input pz-v3-mono-input"
                    value={pressZmcNumber}
                    onChange={(e) => setPressZmcNumber(e.target.value)}
                    placeholder="ZMC-2026-…"
                  />
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setPressCardFileName(f.name);
                  }}
                />

                <div
                  role="button"
                  tabIndex={0}
                  className="pz-v3-upload-dropzone"
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                >
                  <div className="pz-v3-upload-title">
                    {pressCardFileName
                      ? `✓ Selected press ID: ${pressCardFileName}`
                      : '↑  Upload press ID for verification'}
                  </div>
                  <div className="pz-v3-upload-sub">
                    PDF, JPG or PNG · Up to 10 MB · Visible to editorial admins only
                  </div>
                </div>

                <div className="pz-v3-press-notice-banner">
                  Journalist accounts require Editorial Admin verification before Newsroom access is unlocked.
                </div>

                <button
                  type="submit"
                  className="pz-v3-submit-btn"
                  disabled={pressLoading}
                >
                  {pressLoading ? 'Submitting press application…' : 'Submit press application'}
                </button>

                <p className="pz-v3-auth-foot-note">
                  A press application does not grant immediate access.
                </p>
              </form>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
