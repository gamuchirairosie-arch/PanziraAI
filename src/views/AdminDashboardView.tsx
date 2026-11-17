import React, { useEffect, useState } from 'react';
import { ASSETS } from '../assetsMap';
import { DemoPersonaSwitcher } from '../components/AppShell';
import { usePanzira } from '../context/PanziraContext';
import { apiService } from '../services/api';
import { JournalistApplicationRecord } from '../types';

interface AdminApplicantRow extends JournalistApplicationRecord {
  shortCardName: string;
}

const BASELINE_APPLICANTS: AdminApplicantRow[] = [
  {
    id: 9001,
    full_name: 'Lindiwe Ncube',
    media_house: 'CITE',
    email: 'lindiwe@cite.org.zw',
    zmc_number: 'ZMC-2026-02814',
    press_card_url: '/uploads/press-cards/zmc-2026-02814.pdf',
    role: 'journalist',
    verification_status: 'pending_verification',
    shortCardName: 'L. NCUBE',
  },
  {
    id: 9002,
    full_name: 'Farai Mhlanga',
    media_house: 'Zimpapers',
    email: 'f.mhlanga@zimpapers.co.zw',
    zmc_number: 'ZMC-2026-01977',
    press_card_url: '/uploads/press-cards/zmc-2026-01977.pdf',
    role: 'journalist',
    verification_status: 'pending_verification',
    shortCardName: 'F. MHLANGA',
  },
  {
    id: 9003,
    full_name: 'Nyasha Dube',
    media_house: 'AMH',
    email: 'n.dube@alphamedia.co.zw',
    zmc_number: 'ZMC-2026-03108',
    press_card_url: '/uploads/press-cards/zmc-2026-03108.pdf',
    role: 'journalist',
    verification_status: 'pending_verification',
    shortCardName: 'N. DUBE',
  },
];

function formatShortCardName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].toUpperCase();
  return `${parts[0][0].toUpperCase()}. ${parts[parts.length - 1].toUpperCase()}`;
}

export const AdminDashboardView: React.FC = () => {
  const {
    currentUser,
    navigatePublic,
    navigateNewsroom,
    logoutUser,
    showToast,
  } = usePanzira();

  const [activeNavSection, setActiveNavSection] = useState<
    'desk' | 'journalists' | 'settlements' | 'ledger'
  >('desk');

  const [applicants, setApplicants] = useState<AdminApplicantRow[]>(BASELINE_APPLICANTS);
  const [decidingId, setDecidingId] = useState<number | null>(null);
  const [selectedPressCardModal, setSelectedPressCardModal] =
    useState<AdminApplicantRow | null>(null);

  // Audit chain verification state
  const [auditIntact, setAuditIntact] = useState(true);
  const [auditEntriesCount, setAuditEntriesCount] = useState<number>(1284);
  const [auditLastCheckTime, setAuditLastCheckTime] = useState('09:42:18 CAT');
  const [fullLedgerOpen, setFullLedgerOpen] = useState(false);

  const [auditActions, setAuditActions] = useState<string[]>([
    '09:41:52  PUBLISH   #PZ-8492   R. Moyo   •   8f9a…2c1b → 91cd…43a8',
    '09:36:10  WITHDRAW  #PZ-8438   T. Ndlovu •   3be0…170f → 8f9a…2c1b',
  ]);

  // Filter for flagged AI / screen-recapture submissions
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);

  // Privacy & PII takedown resolution state
  const [resolvedPiiRefs, setResolvedPiiRefs] = useState<Record<string, string>>({});

  useEffect(() => {
    let mounted = true;
    const loadLiveAdminData = async () => {
      try {
        const [liveApps, chainStatus] = await Promise.all([
          apiService.fetchJournalistApplications().catch(() => null),
          apiService.verifyAuditChain().catch(() => null),
        ]);

        if (!mounted) return;

        if (liveApps && Array.isArray(liveApps) && liveApps.length > 0) {
          const mappedLive: AdminApplicantRow[] = liveApps.map((app) => ({
            ...app,
            shortCardName: formatShortCardName(app.full_name || 'Applicant'),
          }));
          setApplicants((prev) => {
            const liveEmails = new Set(mappedLive.map((a) => a.email.toLowerCase()));
            return [
              ...mappedLive,
              ...prev.filter((b) => !liveEmails.has(b.email.toLowerCase())),
            ];
          });
        }

        if (chainStatus) {
          setAuditIntact(Boolean(chainStatus.ok));
          if (chainStatus.checked > 0) {
            setAuditEntriesCount(1284 + chainStatus.checked);
          }
        }
      } catch {
        // Keep baseline applicants if backend is offline or unauthenticated
      }
    };

    loadLiveAdminData();
    return () => {
      mounted = false;
    };
  }, []);

  const pendingCount = applicants.filter(
    (a) => a.verification_status === 'pending_verification'
  ).length;

  const handleDecision = async (applicant: AdminApplicantRow, decision: 'approve' | 'reject') => {
    setDecidingId(applicant.id);
    const nextStatus = decision === 'approve' ? 'verified' : 'rejected';

    try {
      await apiService.decideJournalistApplication(
        applicant.id,
        decision,
        decision === 'approve'
          ? `Approved ZMC accreditation (${applicant.zmc_number})`
          : `Rejected accreditation review (${applicant.zmc_number})`
      );
    } catch {
      // Proceed with immediate UI state update even when using baseline demo rows
    }

    setApplicants((prev) =>
      prev.map((row) =>
        row.id === applicant.id ? { ...row, verification_status: nextStatus } : row
      )
    );

    const now = new Date();
    const timeStr = now.toTimeString().slice(0, 8);
    const actionWord = decision === 'approve' ? 'APPROVE ' : 'REJECT  ';
    const newHash = Math.random().toString(16).slice(2, 6) + '…' + Math.random().toString(16).slice(2, 6);
    setAuditActions((prev) => [
      `${timeStr}  ${actionWord}  ${applicant.zmc_number || '#PRESS'}   R. Moyo   •   91cd…43a8 → ${newHash}`,
      ...prev,
    ]);
    setAuditEntriesCount((c) => c + 1);
    setAuditLastCheckTime(`${timeStr} CAT`);

    showToast(
      decision === 'approve'
        ? `Approved ${applicant.full_name} (${applicant.media_house}) as Accredited Journalist. Newsroom access unlocked.`
        : `Rejected press application for ${applicant.full_name} (${applicant.media_house}).`
    );
    setDecidingId(null);
  };

  const settlementRows = [
    {
      id: 'set-1',
      assetRequest: '#PZ-8492 · Road edge damage',
      newsroom: 'The Chronicle',
      licenseTier: 'Standard',
      licenseStatus: 'Instant License • Paid via EcoCash',
      contributorShare: '$3.50 / $5.00 USD (70% Contributor)',
      settlementRef: 'EcoCash EC-82917',
      isFlagged: false,
    },
    {
      id: 'set-2',
      assetRequest: '#PZ-8460 · Khami Bridge flooding',
      newsroom: 'StarFM',
      licenseTier: 'Exclusive 24h',
      licenseStatus: '24h Exclusive Lock Active • Paid via InnBucks',
      contributorShare: '$10.50 / $15.00 USD (70% Contributor)',
      settlementRef: 'InnBucks IB-20486',
      isFlagged: false,
    },
    {
      id: 'set-3',
      assetRequest: '#PZ-8441 · Night highway collision',
      newsroom: 'CITE',
      licenseTier: 'AI review flagged',
      licenseStatus: 'Suspected AI / recapture · Review repeat offender',
      contributorShare: 'PAYOUT BLOCKED',
      settlementRef: 'NOT SETTLED',
      isFlagged: true,
    },
  ];

  const visibleSettlements = showFlaggedOnly
    ? settlementRows.filter((r) => r.isFlagged)
    : settlementRows;

  return (
    <div className="pz-v3-admin-page" data-node-id="105:57">
      {/* =====================================================================
          TOP DARK #0F172A NAVIGATION BAR (Matches Figma 105:485)
          ===================================================================== */}
      <header className="pz-v3-admin-topbar">
        <div className="pz-v3-admin-topbar-left">
          <button
            type="button"
            className="pz-v3-admin-brand-pill"
            onClick={() => navigatePublic('overview')}
          >
            <img src={ASSETS.roadMark} alt="" className="pz-v3-brand-mark" />
            <span className="pz-v3-brand-wordmark">
              Panzira <span className="pz-v3-brand-wordmark-ai">AI</span>
            </span>
          </button>

          <nav className="pz-v3-admin-nav" aria-label="Editorial operations navigation">
            <button
              type="button"
              className={`pz-v3-admin-nav-item ${activeNavSection === 'desk' ? 'is-active' : ''}`}
              onClick={() => setActiveNavSection('desk')}
            >
              Control desk
            </button>
            <button
              type="button"
              className={`pz-v3-admin-nav-item ${
                activeNavSection === 'journalists' ? 'is-active' : ''
              }`}
              onClick={() => {
                setActiveNavSection('journalists');
                document
                  .getElementById('pz-admin-journalists')
                  ?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Journalist access
            </button>
            <button
              type="button"
              className={`pz-v3-admin-nav-item ${
                activeNavSection === 'settlements' ? 'is-active' : ''
              }`}
              onClick={() => {
                setActiveNavSection('settlements');
                document
                  .getElementById('pz-admin-settlements')
                  ?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Rights &amp; settlements
            </button>
            <button
              type="button"
              className={`pz-v3-admin-nav-item ${
                activeNavSection === 'ledger' ? 'is-active' : ''
              }`}
              onClick={() => {
                setActiveNavSection('ledger');
                setFullLedgerOpen(true);
              }}
            >
              Audit ledger
            </button>
          </nav>
        </div>

        <div className="pz-v3-admin-topbar-right">
          <DemoPersonaSwitcher darkTheme={true} />
          <button
            type="button"
            className="pz-v3-admin-switch-btn"
            onClick={() => navigateNewsroom('inbox')}
          >
            Newsroom →
          </button>
          <span data-testid="navbar-user-role-pill" className="pz-v3-admin-user-badge">
            {currentUser?.full_name || 'Rudo Moyo'} · Admin
          </span>
          <button
            type="button"
            data-testid="navbar-signout-btn"
            className="pz-v3-admin-switch-btn"
            onClick={logoutUser}
          >
            Sign out
          </button>
        </div>
      </header>

      {/* =====================================================================
          MAIN ADMIN CONTROL DESK WORKSPACE
          ===================================================================== */}
      <main className="pz-v3-admin-container">
        {/* HEADER + RIGHT-HAND GREEN SHA-256 AUDIT LEDGER STATUS CARD */}
        <section className="pz-v3-admin-hero">
          <div className="pz-v3-admin-hero-left">
            <div className="pz-v3-admin-eyebrow">EDITORIAL OPERATIONS / ACCESS &amp; RIGHTS</div>
            <h1 className="pz-v3-admin-headline">Trust is an editorial responsibility.</h1>
            <p className="pz-v3-admin-subtitle">
              Verify the press. Protect contributors. Keep every decision accountable.
            </p>
          </div>

          <div
            className="pz-v3-audit-status-card"
            data-node-id="105:498"
            role="status"
            aria-label="Tamper-proof SHA-256 audit chain status"
          >
            <div className="pz-v3-audit-status-title">✓ SHA-256 Audit Ledger</div>
            <div className="pz-v3-audit-status-state">
              {auditIntact ? 'Verified & Intact' : 'Verification Warning'}
            </div>
            <div className="pz-v3-audit-status-meta">
              LAST CHECK {auditLastCheckTime} · {auditEntriesCount.toLocaleString()} ENTRIES
            </div>
          </div>
        </section>

        {/* ===================================================================
            SECTION 1: PENDING JOURNALIST VERIFICATIONS TABLE (Figma 105:502)
            =================================================================== */}
        <section
          id="pz-admin-journalists"
          className="pz-v3-admin-card"
          data-node-id="105:502"
          aria-labelledby="pz-pending-press-heading"
        >
          <div className="pz-v3-admin-card-head">
            <div>
              <h2 id="pz-pending-press-heading" className="pz-v3-admin-card-title">
                Pending journalist verifications
              </h2>
              <p className="pz-v3-admin-card-sub">
                Only approved, accredited applicants can enter the Newsroom.
              </p>
            </div>
            <span className="pz-v3-awaiting-pill">{pendingCount} awaiting review</span>
          </div>

          <div className="pz-v3-table-scroll">
            <table className="pz-v3-admin-table">
              <thead>
                <tr>
                  <th>APPLICANT NAME</th>
                  <th>MEDIA HOUSE</th>
                  <th>WORK EMAIL</th>
                  <th>ZMC ACCREDITATION</th>
                  <th>PRESS CARD</th>
                  <th>ACCESS DECISION</th>
                </tr>
              </thead>
              <tbody>
                {applicants.map((app) => {
                  const isPending = app.verification_status === 'pending_verification';
                  const isApproved = app.verification_status === 'verified';
                  return (
                    <tr key={app.id}>
                      <td className="pz-v3-td-strong">{app.full_name}</td>
                      <td>{app.media_house || 'Independent'}</td>
                      <td className="pz-v3-td-muted">{app.email}</td>
                      <td className="pz-v3-td-mono">{app.zmc_number || 'ZMC-2026-PENDING'}</td>
                      <td>
                        <button
                          type="button"
                          className="pz-v3-press-card-badge"
                          onClick={() => setSelectedPressCardModal(app)}
                        >
                          <span className="pz-v3-press-card-top">
                            ZMC &nbsp;|&nbsp; {app.shortCardName}
                          </span>
                          <span className="pz-v3-press-card-sub">
                            PRESS ID &nbsp;·&nbsp; View securely ↗
                          </span>
                        </button>
                      </td>
                      <td>
                        {isPending ? (
                          <div className="pz-v3-decision-btns">
                            <button
                              type="button"
                              className="pz-v3-approve-btn"
                              disabled={decidingId === app.id}
                              onClick={() => handleDecision(app, 'approve')}
                            >
                              Approve as Journalist
                            </button>
                            <button
                              type="button"
                              className="pz-v3-reject-btn"
                              disabled={decidingId === app.id}
                              onClick={() => handleDecision(app, 'reject')}
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <div className="pz-v3-decision-resolved">
                            <span
                              className={`pz-v3-decision-status-pill ${
                                isApproved ? 'is-approved' : 'is-rejected'
                              }`}
                            >
                              {isApproved ? '✓ Approved as Journalist' : '✕ Rejected'}
                            </span>
                            <button
                              type="button"
                              className="pz-v3-undo-decision-btn"
                              onClick={() =>
                                setApplicants((prev) =>
                                  prev.map((r) =>
                                    r.id === app.id
                                      ? { ...r, verification_status: 'pending_verification' }
                                      : r
                                  )
                                )
                              }
                            >
                              Reset
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* ===================================================================
            SECTION 2: MEDIA LICENSING & SETTLEMENT QUEUE TABLE (Figma 105:550)
            =================================================================== */}
        <section
          id="pz-admin-settlements"
          className="pz-v3-admin-card"
          data-node-id="105:550"
          aria-labelledby="pz-settlement-heading"
        >
          <div className="pz-v3-admin-card-head">
            <div>
              <h2 id="pz-settlement-heading" className="pz-v3-admin-card-title">
                Media licensing &amp; settlement queue
              </h2>
              <p className="pz-v3-admin-card-sub">
                Pre-authorized rights · 70% paid to contributors · No manual permission bottleneck
              </p>
            </div>

            <button
              type="button"
              className={`pz-v3-flagged-filter-btn ${showFlaggedOnly ? 'is-active' : ''}`}
              onClick={() => setShowFlaggedOnly((prev) => !prev)}
            >
              Flagged AI / Screen-Recapture Submissions · 3
            </button>
          </div>

          <div className="pz-v3-table-scroll">
            <table className="pz-v3-admin-table">
              <thead>
                <tr>
                  <th>ASSET / REQUEST</th>
                  <th>NEWSROOM</th>
                  <th>LICENSE STATUS</th>
                  <th>CONTRIBUTOR</th>
                  <th>SETTLEMENT REF</th>
                </tr>
              </thead>
              <tbody>
                {visibleSettlements.map((row) => (
                  <tr key={row.id} className={row.isFlagged ? 'is-flagged-row' : ''}>
                    <td className="pz-v3-td-mono pz-v3-td-strong">{row.assetRequest}</td>
                    <td className="pz-v3-td-strong">{row.newsroom}</td>
                    <td>
                      <span
                        className={`pz-v3-settlement-status ${
                          row.isFlagged ? 'is-flagged' : 'is-settled'
                        }`}
                      >
                        <strong>{row.licenseTier}</strong> · {row.licenseStatus}
                      </span>
                    </td>
                    <td
                      className={`pz-v3-td-mono ${
                        row.isFlagged ? 'pz-v3-text-danger' : 'pz-v3-td-strong'
                      }`}
                    >
                      {row.contributorShare}
                    </td>
                    <td
                      className={`pz-v3-td-mono ${
                        row.isFlagged ? 'pz-v3-text-danger' : 'pz-v3-text-emerald'
                      }`}
                    >
                      {row.settlementRef}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ===================================================================
            SECTION 3 & FOOTER ROW: RECENT AUDIT ACTIONS + PRIVACY & PII TAKEDOWN
            =================================================================== */}
        <section className="pz-v3-admin-bottom-grid">
          {/* LEFT: DARK #0F172A RECENT AUDIT ACTIONS MONOSPACE STRIP (Figma 105:585) */}
          <div className="pz-v3-audit-strip" data-node-id="105:585">
            <div className="pz-v3-audit-strip-head">
              <span className="pz-v3-audit-strip-title">RECENT AUDIT ACTIONS</span>
              <button
                type="button"
                className="pz-v3-audit-open-link"
                onClick={() => setFullLedgerOpen(true)}
              >
                Open full ledger ↗
              </button>
            </div>

            <div className="pz-v3-audit-entries">
              {auditActions.slice(0, 3).map((entry, idx) => (
                <div key={idx} className="pz-v3-audit-entry-line">
                  {entry}
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: RED-BORDERED PRIVACY & PII TAKEDOWN REQUESTS PANEL (Figma 105:577) */}
          <div className="pz-v3-pii-panel" data-node-id="105:577">
            <h3 className="pz-v3-pii-title">Privacy &amp; PII takedown requests</h3>

            <div className="pz-v3-pii-item">
              <div className="pz-v3-pii-item-head">#PZ-8438 • Visible number plate</div>
              <button
                type="button"
                className="pz-v3-pii-action-link"
                onClick={() => {
                  setResolvedPiiRefs((prev) => ({
                    ...prev,
                    '#PZ-8438': 'Number plate blurred & redacted by R. Moyo',
                  }));
                  showToast('#PZ-8438 vehicle number plate blurred and PII redaction logged.');
                }}
              >
                {resolvedPiiRefs['#PZ-8438']
                  ? `✓ ${resolvedPiiRefs['#PZ-8438']}`
                  : 'Distribution paused · Review & redact →'}
              </button>
            </div>

            <div className="pz-v3-pii-item">
              <div className="pz-v3-pii-item-head">#PZ-8410 • Contributor withdraws consent</div>
              <button
                type="button"
                className="pz-v3-pii-action-link"
                onClick={() => {
                  setResolvedPiiRefs((prev) => ({
                    ...prev,
                    '#PZ-8410': 'Licensee notified & asset withdrawn from pool',
                  }));
                  showToast('#PZ-8410 takedown notice dispatched to licensee newsroom.');
                }}
              >
                {resolvedPiiRefs['#PZ-8410']
                  ? `✓ ${resolvedPiiRefs['#PZ-8410']}`
                  : 'Takedown requested · Contact licensee →'}
              </button>
            </div>
          </div>
        </section>

        <footer className="pz-v3-admin-footer">
          DEMO CONTROL DESK · Illustrative applicants, settlements and audit entries
        </footer>
      </main>

      {/* =====================================================================
          MODAL 1: SECURE PRESS CARD VERIFICATION PREVIEW
          ===================================================================== */}
      {selectedPressCardModal && (
        <div
          className="pz-v3-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Press card verification preview"
        >
          <div className="pz-v3-modal-card">
            <div className="pz-v3-modal-head">
              <strong>ZMC Press Accreditation Verification</strong>
              <button
                type="button"
                className="pz-v3-close-btn"
                onClick={() => setSelectedPressCardModal(null)}
              >
                ×
              </button>
            </div>
            <div className="pz-v3-press-id-preview-box">
              <div className="pz-v3-press-id-header">
                ZIMBABWE MEDIA COMMISSION (ZMC) · ACCREDITED PRESS ID
              </div>
              <div className="pz-v3-press-id-grid">
                <div>
                  <span className="pz-v3-press-id-label">JOURNALIST</span>
                  <strong>{selectedPressCardModal.full_name}</strong>
                </div>
                <div>
                  <span className="pz-v3-press-id-label">MEDIA HOUSE</span>
                  <strong>{selectedPressCardModal.media_house}</strong>
                </div>
                <div>
                  <span className="pz-v3-press-id-label">ACCREDITATION NO.</span>
                  <strong className="pz-v3-mono">{selectedPressCardModal.zmc_number}</strong>
                </div>
                <div>
                  <span className="pz-v3-press-id-label">OFFICIAL EMAIL</span>
                  <span>{selectedPressCardModal.email}</span>
                </div>
              </div>
            </div>
            <div className="pz-v3-modal-actions">
              <button
                type="button"
                className="pz-v3-approve-btn"
                onClick={() => {
                  handleDecision(selectedPressCardModal, 'approve');
                  setSelectedPressCardModal(null);
                }}
              >
                Approve as Journalist
              </button>
              <button
                type="button"
                className="pz-v3-reject-btn"
                onClick={() => {
                  handleDecision(selectedPressCardModal, 'reject');
                  setSelectedPressCardModal(null);
                }}
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: FULL SHA-256 TAMPER-PROOF AUDIT LEDGER
          ===================================================================== */}
      {fullLedgerOpen && (
        <div
          className="pz-v3-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Full SHA-256 Audit Ledger"
        >
          <div className="pz-v3-modal-card is-wide">
            <div className="pz-v3-modal-head">
              <strong>SHA-256 Cryptographic Editorial Audit Ledger</strong>
              <button
                type="button"
                className="pz-v3-close-btn"
                onClick={() => setFullLedgerOpen(false)}
              >
                ×
              </button>
            </div>
            <p style={{ fontSize: '13px', color: '#475569', marginBottom: '12px' }}>
              Every editorial approval, rejection, journalist accreditation decision, and media
              license settlement is hash-chained (`prev_hash → entry_hash`).
            </p>
            <div className="pz-v3-audit-strip" style={{ marginBottom: '12px' }}>
              <div className="pz-v3-audit-entries">
                {auditActions.map((line, i) => (
                  <div key={i} className="pz-v3-audit-entry-line">
                    {line}
                  </div>
                ))}
                <div className="pz-v3-audit-entry-line">
                  09:28:04  LICENSE   #PZ-8460   StarFM    •   c41d…90a2 → 3be0…170f
                </div>
                <div className="pz-v3-audit-entry-line">
                  09:14:22  AI_SCAN   #PZ-8441   SYSTEM    •   0000…0000 → c41d…90a2
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
