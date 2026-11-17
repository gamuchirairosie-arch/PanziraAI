import React, { useState } from 'react';
import { ASSETS } from '../assetsMap';
import { DemoPersonaSwitcher } from '../components/AppShell';
import { usePanzira } from '../context/PanziraContext';
import { apiService } from '../services/api';

interface CitizenIncidentCardItem {
  reference: string;
  title: string;
  statusLabel: string;
  statusTone: 'live' | 'investigating';
  timestamp: string;
  completedStep: 1 | 2 | 3 | 4;
}

interface VaultMediaAssetItem {
  id: string;
  reference: string;
  claimPin: string;
  title: string;
  imageUrl: string;
  licenseTier: 'commercial_pool' | 'safety_only' | 'free_attribution';
  attributionMode: 'handle' | 'anonymous' | 'full_name';
}

const LICENSE_TIER_LABELS: Record<VaultMediaAssetItem['licenseTier'], string> = {
  commercial_pool: 'Commercial Pool ($5/$15)',
  safety_only: 'Safety Review Only',
  free_attribution: 'News Use w/ Attribution',
};

const ATTRIBUTION_MODE_LABELS: Record<VaultMediaAssetItem['attributionMode'], string> = {
  handle: 'Pseudonym: @TariroOnTheRoad',
  anonymous: 'Anonymous Whistleblower',
  full_name: 'Full Name',
};

const BASELINE_CITIZEN_REPORTS: CitizenIncidentCardItem[] = [
  {
    reference: '#PZ-8492',
    title: 'Road edge damage · R1, Shangani',
    statusLabel: 'Verified public alert live',
    statusTone: 'live',
    timestamp: '15 Nov 2026 · 08:14',
    completedStep: 4,
  },
  {
    reference: '#PZ-8486',
    title: 'Standing water · R2, Victoria Falls',
    statusLabel: 'Newsroom investigating',
    statusTone: 'investigating',
    timestamp: '14 Nov 2026 · 16:32',
    completedStep: 2,
  },
];

export const CitizenDashboardView: React.FC = () => {
  const {
    currentUser,
    signals,
    navigatePublic,
    navigateAuth,
    logoutUser,
    showToast,
    royaltyBalanceUsd,
    claimedReports: contextClaimedReports,
    lastRoyaltyActivity,
    claimReportInSession,
    cashOutRoyalties,
    pendingClaimPrefill,
  } = usePanzira();

  const contributorName = currentUser?.full_name || 'Tariro Moyo';
  const contributorHandle = currentUser?.handle || '@TariroOnTheRoad';
  const royaltyBalance = royaltyBalanceUsd;

  const [activeSubTab, setActiveSubTab] = useState<'reports' | 'vault'>('reports');

  // Claim a Guest Report modal/inline form state
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [claimRefInput, setClaimRefInput] = useState(() =>
    pendingClaimPrefill
      ? `#${pendingClaimPrefill.reference.replace(/^#/, '')}`
      : '#PZ-8492'
  );
  const [claimPinInput, setClaimPinInput] = useState(() =>
    pendingClaimPrefill ? pendingClaimPrefill.pin : '4920'
  );
  const [claimLicenseTier, setClaimLicenseTier] = useState<
    'commercial_pool' | 'safety_only' | 'free_attribution'
  >('commercial_pool');
  const [claimAttribution, setClaimAttribution] = useState<'handle' | 'anonymous' | 'full_name'>(
    'handle'
  );
  const [claimSubmitting, setClaimSubmitting] = useState(false);

  // Instant Royalty Activity interactive state
  const [cashOutReceipt, setCashOutReceipt] = useState<string | null>(null);
  const [takedownRequested, setTakedownRequested] = useState(false);

  // Baseline media rights & licensing vault items (merged with user session claims/uploads below)
  const [baselineVaultAssets, setBaselineVaultAssets] = useState<VaultMediaAssetItem[]>([
    {
      id: 'vault-1',
      reference: 'PZ-8492',
      claimPin: '4920',
      title: 'R1 Shangani · Road edge damage',
      imageUrl: ASSETS.citizenPhotoAndMap,
      licenseTier: 'commercial_pool',
      attributionMode: 'handle',
    },
    {
      id: 'vault-2',
      reference: 'PZ-DEMO-0427',
      claimPin: '0427',
      title: 'A5 corridor · Road surface damage',
      imageUrl: ASSETS.citizenPhotoAndMap,
      licenseTier: 'safety_only',
      attributionMode: 'anonymous',
    },
    {
      id: 'vault-3',
      reference: 'PZ-8486',
      claimPin: '8486',
      title: 'R2 Victoria Falls · Standing water',
      imageUrl: ASSETS.citizenPhotoAndMap,
      licenseTier: 'free_attribution',
      attributionMode: 'full_name',
    },
  ]);

  // Manage rights inline editor state
  const [editingVaultId, setEditingVaultId] = useState<string | null>(null);

  // Merge user-submitted session reports from context if not already in claimedReports
  const userSessionCards: CitizenIncidentCardItem[] = signals
    .filter((s) => s.isUserSubmitted)
    .map((s) => ({
      reference: `#${s.id}`,
      title: s.inboxTitle || s.title,
      statusLabel:
        s.workflowStatus === 'verified' ? 'Verified public alert live' : 'Newsroom investigating',
      statusTone: s.workflowStatus === 'verified' ? 'live' : 'investigating',
      timestamp: s.reportedDateTime,
      completedStep:
        s.workflowStatus === 'verified'
          ? 4
          : Object.values(s.checklist).filter(Boolean).length >= 2
            ? 3
            : 2,
    }));

  const allIncidentCards: CitizenIncidentCardItem[] = [];
  const seenRefs = new Set<string>();
  const pushUniqueIncident = (card: CitizenIncidentCardItem) => {
    const norm = card.reference.replace(/^#/, '').toUpperCase();
    if (seenRefs.has(norm)) return;
    seenRefs.add(norm);
    allIncidentCards.push(card);
  };
  userSessionCards.forEach(pushUniqueIncident);
  contextClaimedReports.forEach((rec) =>
    pushUniqueIncident({
      reference: rec.reference,
      title: rec.title,
      statusLabel: rec.statusLabel,
      statusTone: rec.statusTone,
      timestamp: rec.timestamp,
      completedStep: rec.completedStep,
    })
  );
  BASELINE_CITIZEN_REPORTS.forEach(pushUniqueIncident);

  const dynamicVaultAssets: VaultMediaAssetItem[] = [
    ...signals
      .filter((s) => s.isUserSubmitted && s.photoType !== 'none')
      .map((s) => ({
        id: `session-${s.id}`,
        reference: s.id.replace(/^#/, ''),
        claimPin: s.claimPin || '4920',
        title: s.inboxTitle || s.title,
        imageUrl: s.customPhotoDataUrl || ASSETS.citizenPhotoAndMap,
        licenseTier: (s.licenseTier || 'commercial_pool') as VaultMediaAssetItem['licenseTier'],
        attributionMode: (s.attributionMode || 'handle') as VaultMediaAssetItem['attributionMode'],
      })),
    ...contextClaimedReports
      .filter(
        (rec) =>
          !signals.some(
            (s) =>
              s.isUserSubmitted &&
              s.photoType !== 'none' &&
              s.id.replace(/^#/, '').toUpperCase() ===
                rec.reference.replace(/^#/, '').toUpperCase()
          )
      )
      .map((rec) => ({
        id: `claim-${rec.reference.replace(/^#/, '')}`,
        reference: rec.reference.replace(/^#/, ''),
        claimPin: rec.claimPin || '4920',
        title: rec.title,
        imageUrl: rec.imageUrl || ASSETS.citizenPhotoAndMap,
        licenseTier: rec.licenseTier,
        attributionMode: rec.attributionMode,
      })),
  ];

  const vaultAssets: VaultMediaAssetItem[] = [];
  const seenVaultRefs = new Set<string>();
  [...dynamicVaultAssets, ...baselineVaultAssets].forEach((item) => {
    const norm = item.reference.replace(/^#/, '').toUpperCase();
    if (seenVaultRefs.has(norm)) return;
    seenVaultRefs.add(norm);
    vaultAssets.push(item);
  });

  const handleClaimGuestReport = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanRef = claimRefInput.trim().replace(/^#/, '').toUpperCase();
    const cleanPin = claimPinInput.trim();
    if (!cleanRef || !cleanPin) {
      showToast('Please enter both the Guest Report Reference (#PZ-XXXX) and 4-digit Claim PIN.');
      return;
    }

    setClaimSubmitting(true);
    try {
      const res = await apiService.claimGuestReport({
        reference: cleanRef,
        claim_pin: cleanPin,
        license_tier: claimLicenseTier,
        attribution_mode: claimAttribution,
      });

      const formattedRef = `#${res.reference.replace(/^#/, '')}`;
      claimReportInSession({
        reference: res.reference,
        claimPin: cleanPin,
        licenseTier: claimLicenseTier,
        attributionMode: claimAttribution,
        contributorId: currentUser?.id,
        contributorHandle,
      });
      showToast(
        `Guest report ${formattedRef} verified via PIN and linked to your Contributor Rights Vault.`
      );
      setClaimModalOpen(false);
    } catch {
      const formattedRef = `#${cleanRef}`;
      claimReportInSession({
        reference: cleanRef,
        claimPin: cleanPin,
        licenseTier: claimLicenseTier,
        attributionMode: claimAttribution,
        contributorId: currentUser?.id,
        contributorHandle,
      });
      showToast(
        `Guest report ${formattedRef} (PIN ${cleanPin}) linked to your Contributor Rights Vault.`
      );
      setClaimModalOpen(false);
    } finally {
      setClaimSubmitting(false);
    }
  };

  const handleCashOut = () => {
    const settled = cashOutRoyalties();
    if (!settled) {
      showToast('Your royalty balance has already been settled to EcoCash / InnBucks.');
      return;
    }
    setCashOutReceipt(
      `Disbursed $${settled.amountUsd.toFixed(2)} USD to EcoCash / InnBucks (${contributorHandle}) · Ref ${settled.receiptCode}`
    );
    showToast(`Instant payout of $${settled.amountUsd.toFixed(2)} USD completed (${settled.receiptCode}).`);
  };

  const handleToggleTakedown = () => {
    const next = !takedownRequested;
    setTakedownRequested(next);
    if (next) {
      showToast(
        'Future commercial pool licensing revoked for #PZ-8492. Takedown notice sent to Editorial Admin Desk.'
      );
    } else {
      showToast('Pre-authorized commercial pool licensing restored for #PZ-8492.');
    }
  };

  const handleUpdateVaultRights = async (
    asset: VaultMediaAssetItem,
    nextTier: VaultMediaAssetItem['licenseTier'],
    nextAttr: VaultMediaAssetItem['attributionMode']
  ) => {
    setBaselineVaultAssets((prev) =>
      prev.map((item) =>
        item.id === asset.id
          ? { ...item, licenseTier: nextTier, attributionMode: nextAttr }
          : item
      )
    );
    claimReportInSession({
      reference: asset.reference,
      claimPin: asset.claimPin,
      licenseTier: nextTier,
      attributionMode: nextAttr,
      contributorId: currentUser?.id,
      contributorHandle,
    });
    try {
      await apiService.claimGuestReport({
        reference: asset.reference,
        claim_pin: asset.claimPin,
        license_tier: nextTier,
        attribution_mode: nextAttr,
      });
    } catch {
      // Local state already updated
    }
    showToast(
      `Updated rights for #${asset.reference}: ${LICENSE_TIER_LABELS[nextTier]} · ${ATTRIBUTION_MODE_LABELS[nextAttr]}`
    );
    setEditingVaultId(null);
  };

  return (
    <div className="pz-v3-citizen-page" data-node-id="105:55">
      {/* =====================================================================
          CONTRIBUTOR MASTHEAD (Matches Figma 105:314 Desktop & 105:401 Mobile)
          ===================================================================== */}
      <header className="pz-v3-citizen-masthead">
        <div className="pz-v3-citizen-masthead-left">
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

          <nav className="pz-v3-citizen-nav" aria-label="Contributor workspace navigation">
            <button
              type="button"
              className="pz-v3-citizen-nav-link"
              onClick={() => navigatePublic('map')}
            >
              Live map
            </button>
            <button
              type="button"
              className={`pz-v3-citizen-nav-link ${activeSubTab === 'reports' ? 'is-active' : ''}`}
              onClick={() => setActiveSubTab('reports')}
            >
              My reports
            </button>
            <button
              type="button"
              className={`pz-v3-citizen-nav-link ${activeSubTab === 'vault' ? 'is-active' : ''}`}
              onClick={() => {
                setActiveSubTab('vault');
                document
                  .getElementById('pz-media-rights-vault')
                  ?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Rights vault
            </button>
          </nav>
        </div>

        <div className="pz-v3-citizen-masthead-right">
          <DemoPersonaSwitcher />
          <span
            data-testid="navbar-user-role-pill"
            className="pz-v3-citizen-handle-pill pz-hide-mobile"
          >
            {currentUser?.full_name || 'Tariro Moyo'} · Citizen
          </span>
          <span className="pz-v3-citizen-mobile-vault pz-show-mobile">My vault</span>

          <div className="pz-v3-workspace-switcher-inline">
            <button
              type="button"
              className="pz-v3-workspace-pill pz-hide-mobile"
              onClick={() => navigatePublic('overview')}
            >
              Public Home
            </button>
            <button
              type="button"
              data-testid="navbar-signout-btn"
              className="pz-v3-workspace-pill"
              onClick={() => (currentUser ? logoutUser() : navigateAuth('signin'))}
            >
              {currentUser ? 'Sign out' : 'Sign in'}
            </button>
          </div>
        </div>
      </header>

      {/* =====================================================================
          MAIN WORKSPACE CONTAINER
          ===================================================================== */}
      <main className="pz-v3-citizen-container">
        {/* TOP HEADER & ROYALTY BALANCE WALLET */}
        <section className="pz-v3-citizen-hero">
          <div className="pz-v3-citizen-hero-left">
            <div className="pz-v3-citizen-eyebrow">CONTRIBUTOR WORKSPACE</div>
            <h1 className="pz-v3-citizen-headline">Your reports. Your rights.</h1>
            <div className="pz-v3-citizen-identity">
              {contributorName} &nbsp;/&nbsp; <span className="pz-v3-mono">{contributorHandle}</span>
            </div>
            <div className="pz-v3-citizen-badge-row">
              <span className="pz-v3-verified-contributor-badge">✓ Verified Contributor</span>
              <button
                type="button"
                className="pz-v3-claim-guest-btn"
                onClick={() => setClaimModalOpen((prev) => !prev)}
              >
                Claim a Guest Report (#PZ-XXXX) &nbsp;+
              </button>
            </div>
          </div>

          <div className="pz-v3-wallet-card" data-node-id="105:328">
            <div className="pz-v3-wallet-label">ROYALTY BALANCE</div>
            <div className="pz-v3-wallet-amount">${royaltyBalance.toFixed(2)} USD</div>
            <div className="pz-v3-wallet-ready">EcoCash / InnBucks Ready</div>
          </div>
        </section>

        {/* INLINE / MODAL FORM FOR CLAIMING A GUEST REPORT */}
        {claimModalOpen && (
          <section
            className="pz-v3-claim-drawer"
            aria-label="Claim a Guest Report with Reference and 4-digit PIN"
          >
            <form onSubmit={handleClaimGuestReport} className="pz-v3-claim-drawer-form">
              <div className="pz-v3-claim-drawer-head">
                <div>
                  <strong>Link a Guest Report to your Rights Vault</strong>
                  <p>
                    Enter the reference code (<span className="pz-v3-mono">#PZ-XXXX</span>) and
                    4-digit Claim PIN from your anonymous submission receipt.
                  </p>
                </div>
                <button
                  type="button"
                  className="pz-v3-close-btn"
                  onClick={() => setClaimModalOpen(false)}
                >
                  ×
                </button>
              </div>

              <div className="pz-v3-claim-drawer-grid">
                <div className="pz-v3-field">
                  <label className="pz-v3-label" htmlFor="pz-claim-ref">
                    Report Reference
                  </label>
                  <input
                    id="pz-claim-ref"
                    type="text"
                    className="pz-v3-input pz-v3-mono-input"
                    value={claimRefInput}
                    onChange={(e) => setClaimRefInput(e.target.value)}
                    placeholder="#PZ-8492"
                  />
                </div>

                <div className="pz-v3-field">
                  <label className="pz-v3-label" htmlFor="pz-claim-pin">
                    4-Digit Claim PIN
                  </label>
                  <input
                    id="pz-claim-pin"
                    type="text"
                    maxLength={8}
                    className="pz-v3-input pz-v3-mono-input"
                    value={claimPinInput}
                    onChange={(e) => setClaimPinInput(e.target.value)}
                    placeholder="4920"
                  />
                </div>

                <div className="pz-v3-field">
                  <label className="pz-v3-label" htmlFor="pz-claim-tier">
                    License Tier
                  </label>
                  <select
                    id="pz-claim-tier"
                    className="pz-v3-input"
                    value={claimLicenseTier}
                    onChange={(e) =>
                      setClaimLicenseTier(
                        e.target.value as 'commercial_pool' | 'safety_only' | 'free_attribution'
                      )
                    }
                  >
                    <option value="commercial_pool">Commercial Pool ($5/$15)</option>
                    <option value="free_attribution">News Use w/ Attribution</option>
                    <option value="safety_only">Safety Review Only</option>
                  </select>
                </div>

                <div className="pz-v3-field">
                  <label className="pz-v3-label" htmlFor="pz-claim-attr">
                    Attribution Mode
                  </label>
                  <select
                    id="pz-claim-attr"
                    className="pz-v3-input"
                    value={claimAttribution}
                    onChange={(e) =>
                      setClaimAttribution(e.target.value as 'handle' | 'anonymous' | 'full_name')
                    }
                  >
                    <option value="handle">Pseudonym: {contributorHandle}</option>
                    <option value="anonymous">Anonymous Whistleblower</option>
                    <option value="full_name">Full Name ({contributorName})</option>
                  </select>
                </div>
              </div>

              <div className="pz-v3-claim-drawer-actions">
                <button
                  type="submit"
                  className="pz-v3-green-action-btn"
                  disabled={claimSubmitting}
                >
                  {claimSubmitting ? 'Linking Guest Report…' : 'Link Guest Report & Save Rights'}
                </button>
              </div>
            </form>
          </section>
        )}

        {/* ===================================================================
            SECTION 1: MY INCIDENT REPORTS (4-Step Horizontal Green Progress Bar)
            =================================================================== */}
        <section className="pz-v3-section" aria-labelledby="pz-citizen-reports-heading">
          <h2 id="pz-citizen-reports-heading" className="pz-v3-section-title">
            My incident reports
          </h2>
          <p className="pz-v3-section-subtitle">
            {allIncidentCards.length} reports · Verification decisions are made by human editors
          </p>

          <div className="pz-v3-incident-list">
            {allIncidentCards.map((item) => {
              const steps = [
                { num: 1, desktop: '1. Submitted', mobile: '1 Submitted' },
                { num: 2, desktop: '2. Newsroom Investigating', mobile: '2 Investigating' },
                { num: 3, desktop: '3. Corroborated', mobile: '3 Corroborated' },
                { num: 4, desktop: '4. Verified Public Alert Live', mobile: '4 Alert live' },
              ];

              return (
                <article key={item.reference} className="pz-v3-incident-card">
                  <div className="pz-v3-incident-top">
                    <div className="pz-v3-incident-title-group">
                      <span className="pz-v3-incident-ref">{item.reference}</span>
                      <h3 className="pz-v3-incident-title">{item.title}</h3>
                    </div>
                    <span
                      className={`pz-v3-incident-status-pill ${
                        item.statusTone === 'live' ? 'is-live' : 'is-investigating'
                      }`}
                    >
                      {item.statusLabel}
                    </span>
                  </div>

                  <div className="pz-v3-incident-time">{item.timestamp}</div>

                  <div
                    className="pz-v3-progress-grid"
                    role="progressbar"
                    aria-valuemin={1}
                    aria-valuemax={4}
                    aria-valuenow={item.completedStep}
                    aria-label={`Verification step ${item.completedStep} of 4`}
                  >
                    {steps.map((st) => {
                      const isDone = st.num <= item.completedStep;
                      return (
                        <div
                          key={st.num}
                          className={`pz-v3-progress-step ${isDone ? 'is-complete' : ''}`}
                        >
                          <div className="pz-v3-progress-bar" />
                          <span className="pz-v3-progress-label pz-hide-mobile">{st.desktop}</span>
                          <span className="pz-v3-progress-label pz-show-mobile">{st.mobile}</span>
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* ===================================================================
            SECTION 2: INSTANT ROYALTY ACTIVITY BANNER (Figma 105:364)
            =================================================================== */}
        <section
          className="pz-v3-royalty-banner"
          data-node-id="105:364"
          aria-label="Instant Royalty Activity"
        >
          <div className="pz-v3-royalty-badge">
            {lastRoyaltyActivity
              ? `INSTANT LICENSE COMPLETED • +$${lastRoyaltyActivity.citizenShareUsd.toFixed(2)} USD CREDITED`
              : 'INSTANT LICENSE COMPLETED • +$3.50 USD CREDITED'}
          </div>

          <h2 className="pz-v3-royalty-headline">
            {lastRoyaltyActivity
              ? lastRoyaltyActivity.headline
              : 'The Chronicle licensed your R1 Shangani Highway photo (#PZ-8492)'}
          </h2>

          <p className="pz-v3-royalty-subtitle">
            {lastRoyaltyActivity
              ? lastRoyaltyActivity.subtitle
              : 'Standard Editorial License ($5.00 Flat Fee) • Your 70% Share: $3.50 USD (or $10.50 USD on $15.00 24h Exclusive)'}
          </p>

          {cashOutReceipt && (
            <div className="pz-v3-royalty-receipt" role="status">
              ✓ {cashOutReceipt}
            </div>
          )}

          {takedownRequested && (
            <div className="pz-v3-royalty-takedown-notice" role="status">
              Notice: Future licensing paused for #PZ-8492 — takedown request logged with the Editorial Admin Control Desk.
            </div>
          )}

          <div className="pz-v3-royalty-actions">
            <button
              type="button"
              className="pz-v3-cashout-btn"
              onClick={handleCashOut}
            >
              Cash Out to EcoCash / InnBucks
            </button>

            <button
              type="button"
              className="pz-v3-revoke-btn"
              onClick={handleToggleTakedown}
            >
              {takedownRequested
                ? 'Restore Pre-Authorized Licensing'
                : 'Revoke Future Licensing / Request Takedown'}
            </button>
          </div>
        </section>

        {/* ===================================================================
            SECTION 3: MEDIA RIGHTS & LICENSING VAULT (3-Column Photo Grid)
            =================================================================== */}
        <section
          id="pz-media-rights-vault"
          className="pz-v3-section"
          aria-labelledby="pz-vault-heading"
        >
          <h2 id="pz-vault-heading" className="pz-v3-section-title">
            Media rights &amp; licensing vault
          </h2>
          <p className="pz-v3-section-subtitle">
            You retain ownership. Every publication follows your permission.
          </p>

          <div className="pz-v3-vault-grid">
            {vaultAssets.map((asset) => {
              const isEditing = editingVaultId === asset.id;
              return (
                <article key={asset.id} className="pz-v3-vault-card">
                  <div className="pz-v3-vault-thumb-wrap">
                    <img
                      src={asset.imageUrl}
                      alt={asset.title}
                      className="pz-v3-vault-thumb"
                    />
                    <span className="pz-v3-vault-ref-chip">#{asset.reference}</span>
                  </div>

                  <div className="pz-v3-vault-body">
                    <span className={`pz-v3-tier-pill is-${asset.licenseTier}`}>
                      {LICENSE_TIER_LABELS[asset.licenseTier]}
                    </span>

                    <h3 className="pz-v3-vault-card-title">{asset.title}</h3>

                    <span className="pz-v3-attribution-pill">
                      {asset.attributionMode === 'handle'
                        ? `Pseudonym: ${contributorHandle}`
                        : ATTRIBUTION_MODE_LABELS[asset.attributionMode]}
                    </span>

                    {!isEditing ? (
                      <button
                        type="button"
                        className="pz-v3-manage-rights-link"
                        onClick={() => setEditingVaultId(asset.id)}
                      >
                        Manage rights &nbsp;→
                      </button>
                    ) : (
                      <div className="pz-v3-vault-editor">
                        <label className="pz-v3-vault-editor-label">
                          License Tier
                          <select
                            className="pz-v3-vault-select"
                            value={asset.licenseTier}
                            onChange={(e) =>
                              handleUpdateVaultRights(
                                asset,
                                e.target.value as VaultMediaAssetItem['licenseTier'],
                                asset.attributionMode
                              )
                            }
                          >
                            <option value="commercial_pool">Commercial Pool ($5/$15)</option>
                            <option value="safety_only">Safety Review Only</option>
                            <option value="free_attribution">News Use w/ Attribution</option>
                          </select>
                        </label>

                        <label className="pz-v3-vault-editor-label">
                          Attribution Mode
                          <select
                            className="pz-v3-vault-select"
                            value={asset.attributionMode}
                            onChange={(e) =>
                              handleUpdateVaultRights(
                                asset,
                                asset.licenseTier,
                                e.target.value as VaultMediaAssetItem['attributionMode']
                              )
                            }
                          >
                            <option value="handle">Pseudonym: {contributorHandle}</option>
                            <option value="anonymous">Anonymous Whistleblower</option>
                            <option value="full_name">Full Name</option>
                          </select>
                        </label>

                        <button
                          type="button"
                          className="pz-v3-manage-rights-link"
                          onClick={() => setEditingVaultId(null)}
                        >
                          Done ✓
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <footer className="pz-v3-citizen-footer">
          DEMO WORKSPACE · Illustrative media and balances
        </footer>
      </main>
    </div>
  );
};
