import React, { useEffect, useMemo, useState } from 'react';
import { ASSETS } from '../assetsMap';
import { EvidencePhotoFrame } from '../components/CroppedFigmaMedia';
import { CompactReportPicker } from '../components/CompactReportPicker';
import { usePanzira } from '../context/PanziraContext';
import { HazardCategoryKey, SignalReport, VerificationChecklist } from '../types';

type InboxFilter = 'all' | 'lead' | 'verifying' | 'verified' | 'rejected';

function formatRemainingLockTime(lockedUntilIso?: string | null): string {
  if (!lockedUntilIso) return '29:59';
  const target = new Date(lockedUntilIso).getTime();
  if (Number.isNaN(target)) return '29:59';
  const diffSec = Math.max(0, Math.floor((target - Date.now()) / 1000));
  const mm = String(Math.floor(diffSec / 60)).padStart(2, '0');
  const ss = String(diffSec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export const AntiCollisionClaimBar: React.FC<{
  signal: SignalReport;
}> = ({ signal }) => {
  const { currentUser, claimSignalLock, releaseSignalLock } = usePanzira();
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!signal.claimLockedUntil) return;
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, [signal.claimLockedUntil]);

  const now = Date.now();
  const lockExpiryMs = signal.claimLockedUntil ? new Date(signal.claimLockedUntil).getTime() : 0;
  const isLocked = Boolean(signal.claimedByName && lockExpiryMs > now);
  const currentActorId = currentUser?.id || 1;
  const isLockedByOther =
    isLocked &&
    signal.claimedById !== undefined &&
    signal.claimedById !== null &&
    signal.claimedById !== currentActorId &&
    currentUser?.role !== 'admin';

  if (!isLocked) {
    return (
      <div
        data-testid="anti-collision-lock-bar"
        style={{
          background: '#f8fafc',
          border: '1px solid #cbd5e1',
          borderRadius: '5px',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          <span
            className="pz-mono"
            style={{
              fontSize: '11px',
              fontWeight: 500,
              color: '#0f172a',
              lineHeight: '16px',
            }}
          >
            UNCLAIMED · INVESTIGATION ACCESS IS READ-ONLY
          </span>
          <button
            type="button"
            onClick={() => claimSignalLock(signal.id, true)}
            style={{
              background: 'transparent',
              border: '1px dashed #94a3b8',
              borderRadius: '4px',
              padding: '2px 8px',
              fontSize: '11px',
              fontWeight: 600,
              color: '#475569',
              cursor: 'pointer',
            }}
            title="Demo helper: simulate a lock held by another accredited journalist to test anti-collision protection"
          >
            Simulate Rival Journalist Lock
          </button>
        </div>

        <button
          type="button"
          data-testid="claim-report-lock-btn"
          onClick={() => claimSignalLock(signal.id, false)}
          style={{
            width: '100%',
            height: '44px',
            background: '#059669',
            color: '#ffffff',
            border: 'none',
            borderRadius: '4px',
            fontFamily: 'var(--pz-font-sans)',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          Claim Report for Investigation (30m Lock)
        </button>
      </div>
    );
  }

  return (
    <div
      data-testid="anti-collision-lock-bar"
      style={{
        background: isLockedByOther ? '#fef2f2' : '#ecfdf5',
        border: isLockedByOther ? '1px solid #dc2626' : '1px solid #059669',
        borderRadius: '5px',
        padding: '12px 14px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <div
          className="pz-mono"
          data-testid="claim-lock-status-pill"
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: isLockedByOther ? '#991b1b' : '#065f46',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            flexWrap: 'wrap',
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ flexShrink: 0 }}
          >
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span>
            CLAIMED BY {signal.claimedByName} ({signal.claimedByMediaHouse || 'Panzira Newsroom'}) •
            LOCK EXPIRES IN {formatRemainingLockTime(signal.claimLockedUntil)}
          </span>
        </div>
        {isLockedByOther && (
          <span style={{ fontSize: '12px', color: '#b91c1c', fontWeight: 500 }}>
            Anti-collision protection active: Verification checkboxes and Publish button are locked
            while another journalist investigates.
          </span>
        )}
      </div>

      <button
        type="button"
        data-testid="release-report-lock-btn"
        onClick={() => releaseSignalLock(signal.id)}
        style={{
          padding: '6px 12px',
          borderRadius: '4px',
          border: isLockedByOther ? '1px solid #dc2626' : '1px solid #059669',
          background: '#ffffff',
          color: isLockedByOther ? '#991b1b' : '#065f46',
          fontWeight: 600,
          fontSize: '12px',
          cursor: 'pointer',
        }}
      >
        Release Lock
      </button>
    </div>
  );
};

export const AiForensicsAndLicensingPanel: React.FC<{
  signal: SignalReport;
  isLockedByOther: boolean;
}> = ({ signal, isLockedByOther }) => {
  const {
    toggleVisualAiCheck,
    licenseSignalMedia,
    togglePiiRedaction,
    revealedGraphicIds,
    toggleGraphicReveal,
  } = usePanzira();
  const [lensModalOpen, setLensModalOpen] = useState(false);

  if (signal.photoType === 'none') {
    return (
      <div
        data-testid="verify-no-photo-notice"
        style={{
          background: '#f8fafc',
          border: '1px solid #cbd5e1',
          borderRadius: '5px',
          padding: '14px 16px',
          fontSize: '13.5px',
          color: '#475569',
        }}
      >
        No photograph attached — submitted as a low-bandwidth text report. Editors must corroborate
        via independent witnesses, local reporters, or municipal road logs.
      </div>
    );
  }

  const isFlaggedAi =
    signal.aiScanVerdict === 'flagged_ai_or_screen' || Boolean(signal.screenRecaptureFlag);
  const commercialEligible =
    signal.commercialEligible !== undefined ? signal.commercialEligible : !isFlaggedAi;
  const visualChecked = Boolean(signal.humanVisualAiCheck || signal.humanVisualAiCheckPassed);
  const licenseTier = signal.licenseTier || 'commercial_pool';
  const canUnlockCommercial =
    licenseTier === 'commercial_pool' && commercialEligible && visualChecked && !isLockedByOther;

  const now = Date.now();
  const lockExpiryMs = signal.claimLockedUntil ? new Date(signal.claimLockedUntil).getTime() : 0;
  const isClaimed = Boolean(signal.claimedByName && lockExpiryMs > now);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Figma 108:117 — Watermarked evidence viewer with top AI Forensics banner */}
      <div
        style={{
          position: 'relative',
          height: '246px',
          borderRadius: '5px',
          border: '1px solid #cbd5e1',
          overflow: 'hidden',
          background: '#0f172a',
        }}
      >
        <EvidencePhotoFrame
          photoType={signal.photoType}
          customPhotoDataUrl={signal.customPhotoDataUrl}
          isGraphic={signal.isGraphicImage}
          isRevealed={Boolean(revealedGraphicIds[signal.id])}
          allowEditorReveal={true}
          onToggleReveal={() => toggleGraphicReveal(signal.id)}
          graphicReason={signal.graphicSafetyReason}
          height={246}
        />

        {/* Top AI Forensics status strip (Figma 108:118) */}
        <div
          data-testid="ai-forensics-banner"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            background: isFlaggedAi ? '#7f1d1d' : '#0f172a',
            padding: '10px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            zIndex: 2,
          }}
        >
          <span
            className="pz-mono"
            style={{
              fontSize: '11px',
              fontWeight: 500,
              color: isFlaggedAi ? '#fca5a5' : '#f8fafc',
              lineHeight: '16px',
            }}
          >
            {isFlaggedAi
              ? 'AUTO-SCAN WARNING: SUSPECTED AI-GENERATED OR SCREEN RECAPTURE — COMMERCIAL PAYOUT BLOCKED'
              : signal.exifSummary ||
                'AUTO-SCAN: 98.4% REAL CAMERA • EXIF: SAMSUNG A54 • MOIRÉ SCREEN CHECK: PASS • DUPLICATE HASH: UNIQUE'}
          </span>
          <span
            style={{
              fontSize: '11px',
              color: '#cbd5e1',
              lineHeight: '16px',
            }}
          >
            Illustrative model result · AI scan is not proof of authenticity
          </span>
        </div>

        {/* Diagonal Watermark Overlay (Figma 108:121) */}
        {!signal.mediaAccessToken && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          >
            <span
              style={{
                transform: 'rotate(-14deg)',
                fontSize: '17px',
                fontWeight: 600,
                color: 'rgba(255, 255, 255, 0.78)',
                letterSpacing: '0.04em',
                textShadow: '0 1px 4px rgba(0, 0, 0, 0.65)',
                userSelect: 'none',
                textAlign: 'center',
                padding: '0 16px',
              }}
            >
              PANZIRA AI — UNLICENSED INTERNAL PREVIEW
            </span>
          </div>
        )}
      </div>

      {/* Figma 108:122 — EXIF and hash provenance strip */}
      <div
        style={{
          background: '#0f172a',
          borderRadius: '4px',
          padding: '10px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        <div
          className="pz-mono"
          style={{
            fontSize: '12px',
            fontWeight: 500,
            color: '#f8fafc',
            lineHeight: '18px',
            display: 'flex',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <span>SHA-256: 8f9a...2c1b • Unique Capture • GPS Match</span>
          {signal.mediaAccessToken && (
            <span style={{ color: '#6ee7b7' }}>
              ✓ UNWATERMARKED UNLOCKED ({signal.mediaAccessToken})
            </span>
          )}
        </div>
        <span style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: '18px' }}>
          Technical match only · Capture time unknown · Not corroborated
          {signal.piiRedacted ? ' · PII Redaction Active (Faces & Plates Blurred)' : ''}
        </span>
      </div>

      {/* Figma 108:125 — Mandatory human visual inspection box */}
      <div
        data-testid="mandatory-human-visual-ai-box"
        style={{
          background: '#fffbeb',
          border: '1px solid #d97706',
          borderRadius: '5px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <h3
          style={{
            fontFamily: 'var(--pz-font-serif)',
            fontSize: '24px',
            fontWeight: 600,
            lineHeight: '28px',
            color: '#78350f',
            margin: 0,
          }}
        >
          Human visual inspection required
        </h3>
        <p
          style={{
            fontSize: '14px',
            lineHeight: '21px',
            color: '#78350f',
            margin: 0,
          }}
        >
          Automated AI detectors can miss subtle artifacts. Zoom in and manually inspect hands,
          vehicle number plates, text signage, shadows, and road reflections before approving.
        </p>

        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            cursor: isLockedByOther ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: 500,
            color: '#0f172a',
            lineHeight: '20px',
            opacity: isLockedByOther ? 0.6 : 1,
          }}
        >
          <input
            type="checkbox"
            data-testid="human-visual-ai-checkbox"
            checked={visualChecked}
            disabled={isLockedByOther}
            onChange={() => toggleVisualAiCheck(signal.id)}
            style={{ width: '16px', height: '16px', marginTop: '2px', accentColor: '#d97706' }}
          />
          <span>
            I have visually inspected this image myself and confirm it shows no signs of AI
            generation or manipulation.
          </span>
        </label>

        <div>
          <button
            type="button"
            data-testid="inspect-google-lens-btn"
            onClick={() => setLensModalOpen(true)}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              color: '#1d4ed8',
              fontWeight: 600,
              fontSize: '13px',
              lineHeight: '18px',
              cursor: 'pointer',
            }}
          >
            Inspect Full-Res &amp; Check on Google Lens ↗
          </button>
        </div>

        <div
          className="pz-mono"
          style={{
            fontSize: '12px',
            color: visualChecked ? '#047857' : '#92400e',
            lineHeight: '18px',
          }}
        >
          {visualChecked
            ? '✓ HUMAN VISUAL INSPECTION RECORDED BY EDITOR'
            : isClaimed
              ? 'Check the box above after completing your manual visual inspection.'
              : 'Claim this report before recording your inspection.'}
        </div>
      </div>

      {/* Figma 108:131 — Instant flat-fee agency licensing */}
      <div
        data-testid="instant-licensing-drawer"
        style={{
          background: '#f8fafc',
          border: '1px solid #cbd5e1',
          borderRadius: '5px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <span
          className="pz-mono"
          style={{
            fontSize: '11px',
            fontWeight: 500,
            color: '#92400e',
            lineHeight: '16px',
          }}
        >
          {licenseTier === 'commercial_pool'
            ? 'PRE-AUTHORIZED COMMERCIAL POOL'
            : licenseTier === 'free_attribution'
              ? 'PUBLIC NEWS WITH ATTRIBUTION ($0)'
              : 'SAFETY VERIFICATION ONLY ($0 — NO EXTERNAL PUBLICATION)'}
        </span>

        <h3
          style={{
            fontFamily: 'var(--pz-font-serif)',
            fontSize: '24px',
            fontWeight: 600,
            lineHeight: '28px',
            color: '#0f172a',
            margin: 0,
          }}
        >
          Instant publication rights. No permission wait.
        </h3>

        <p
          style={{
            fontSize: '14px',
            lineHeight: '20px',
            color: '#334155',
            margin: 0,
          }}
        >
          Unlocks become available after AI screening and your mandatory human visual check.
          Attribution: {signal.contributorCredit || '@RoadWatchZW'}.
        </p>

        {licenseTier === 'commercial_pool' ? (
          <>
            {isFlaggedAi && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #ef4444',
                  borderRadius: '4px',
                  padding: '8px 10px',
                  fontSize: '12.5px',
                  color: '#991b1b',
                  fontWeight: 600,
                }}
              >
                Commercial licensing disabled: Automated AI / screen-recapture check flagged this
                image.
              </div>
            )}

            <button
              type="button"
              data-testid="license-standard-btn"
              disabled={!canUnlockCommercial}
              onClick={() => licenseSignalMedia(signal.id, 'standard')}
              style={{
                width: '100%',
                height: '44px',
                borderRadius: '4px',
                border: 'none',
                background: canUnlockCommercial ? '#059669' : '#e2e8f0',
                color: canUnlockCommercial ? '#ffffff' : '#475569',
                fontWeight: 600,
                fontSize: '13px',
                cursor: canUnlockCommercial ? 'pointer' : 'not-allowed',
              }}
            >
              Unlock Standard Publication License — $5.00 USD
            </button>

            <div
              className="pz-mono"
              style={{
                fontSize: '12px',
                color: '#475569',
                lineHeight: '18px',
              }}
            >
              Non-exclusive • Citizen immediately earns $3.50 USD
            </div>

            <button
              type="button"
              data-testid="license-exclusive-btn"
              disabled={!canUnlockCommercial}
              onClick={() => licenseSignalMedia(signal.id, 'exclusive')}
              style={{
                width: '100%',
                height: '44px',
                borderRadius: '4px',
                border: 'none',
                background: canUnlockCommercial ? '#0f172a' : '#e2e8f0',
                color: canUnlockCommercial ? '#ffffff' : '#475569',
                fontWeight: 600,
                fontSize: '13px',
                cursor: canUnlockCommercial ? 'pointer' : 'not-allowed',
              }}
            >
              Unlock 24-Hr Exclusive Breaking License — $15.00 USD
            </button>

            <div
              className="pz-mono"
              style={{
                fontSize: '12px',
                color: '#475569',
                lineHeight: '18px',
              }}
            >
              Locks photo from other newsrooms for 24h • Citizen earns $10.50 USD
            </div>

            {signal.royaltyEarnedUsd !== undefined && signal.royaltyEarnedUsd > 0 && (
              <div
                className="pz-mono"
                data-testid="royalty-credited-banner"
                style={{
                  background: '#ecfdf5',
                  border: '1px solid #10b981',
                  borderRadius: '4px',
                  padding: '8px 10px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#065f46',
                  display: 'flex',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '6px',
                }}
              >
                <span>
                  ✓ ECOCASH ROYALTY CREDITED: +${signal.royaltyEarnedUsd.toFixed(2)} USD TO CITIZEN
                </span>
                <span>TOKEN: {signal.mediaAccessToken}</span>
              </div>
            )}
          </>
        ) : (
          <div style={{ fontSize: '13px', color: '#334155', fontWeight: 500 }}>
            {licenseTier === 'free_attribution'
              ? 'Contributor authorized free publication with mandatory credit.'
              : 'Contributor restricted this photo to internal road-safety verification only ($0).'}
          </div>
        )}

        <div>
          <button
            type="button"
            data-testid="pii-redaction-btn"
            onClick={() => togglePiiRedaction(signal.id)}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              color: '#1d4ed8',
              fontWeight: 600,
              fontSize: '13px',
              lineHeight: '18px',
              cursor: 'pointer',
            }}
          >
            {signal.piiRedacted
              ? '✓ Faces / Number Plates Blurred (PII Redaction Active) — Undo ↗'
              : 'Blur Faces / Number Plates (PII Redaction) ↗'}
          </button>
        </div>
      </div>

      {/* Full-Res & Google Lens Inspection Modal */}
      {lensModalOpen && (
        <div
          className="pz-modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setLensModalOpen(false)}
        >
          <div
            className="pz-modal-panel"
            style={{ maxWidth: '640px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div>
                <span className="pz-mono" style={{ fontSize: '11px', color: '#059669', fontWeight: 700 }}>
                  FORENSIC ZOOM &amp; PROVENANCE INSPECTOR
                </span>
                <h3 className="pz-section-heading" style={{ marginTop: '2px' }}>
                  Full-Res Artifact &amp; Reverse Image Check ({signal.id})
                </h3>
              </div>
              <button
                type="button"
                className="pz-btn-secondary"
                onClick={() => setLensModalOpen(false)}
              >
                Close
              </button>
            </div>

            <EvidencePhotoFrame
              photoType={signal.photoType}
              customPhotoDataUrl={signal.customPhotoDataUrl}
              isGraphic={signal.isGraphicImage}
              isRevealed={true}
              allowEditorReveal={false}
              height={280}
            />

            <div
              className="pz-mono"
              style={{
                background: '#0f172a',
                color: '#e2e8f0',
                padding: '12px',
                borderRadius: '6px',
                fontSize: '12px',
                display: 'grid',
                gap: '4px',
              }}
            >
              <div>FILE: {signal.photoFilename || 'road-damage.jpg'}</div>
              <div>SHA-256: 8f9a4b02e7110d4c918e3b7a2c1b</div>
              <div>
                REVERSE IMAGE / LENS MATCH: 0 prior online appearances found (Unique citizen capture)
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const CORE_GATES: Array<{
  key: keyof VerificationChecklist;
  label: string;
}> = [
  {
    key: 'locationAndTime',
    label: 'Source, location and report time confirmed',
  },
  {
    key: 'independentSource',
    label: 'Independent corroborating evidence reviewed',
  },
  {
    key: 'hazardStillPresent',
    label: 'Current road condition and severity checked',
  },
  {
    key: 'mediaAndDate',
    label: 'Editor approval and publication rights reviewed',
  },
];

/**
 * Figma V3 — `SignalInboxAndVerifyView · Rights & verification / Desktop` (75:494)
 * & `02 · Journalist inbox / Mobile` (75:601)
 */
export const SignalInboxView: React.FC = () => {
  const {
    signals,
    currentUser,
    newsroomSearch,
    setNewsroomSearch,
    selectedInboxId,
    setSelectedInboxId,
    setSelectedVerifyId,
    navigateNewsroom,
    toggleChecklist,
    toggleTranslationVerified,
    verifySignal,
    simulateChannelIntake,
  } = usePanzira();

  const [statusFilter, setStatusFilter] = useState<InboxFilter>('all');
  const [channelFilter, setChannelFilter] = useState<
    'all' | 'web' | 'telegram' | 'rss' | 'whatsapp' | 'ussd'
  >('all');
  const [mobileShowReview, setMobileShowReview] = useState(false);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('panzira:mobile-inbox-review-state', {
        detail: { open: mobileShowReview },
      })
    );
  }, [mobileShowReview]);

  useEffect(() => {
    const handleShowInboxList = () => {
      setMobileShowReview(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('panzira:mobile-inbox-list', handleShowInboxList);
    return () => {
      window.removeEventListener('panzira:mobile-inbox-list', handleShowInboxList);
      window.dispatchEvent(
        new CustomEvent('panzira:mobile-inbox-review-state', {
          detail: { open: false },
        })
      );
    };
  }, []);
  const [simulatorChannel, setSimulatorChannel] = useState<'ussd' | 'whatsapp' | null>(null);
  const [simCorridor, setSimCorridor] = useState('A5 Bulawayo–Plumtree Road');
  const [simLandmark, setSimLandmark] = useState('Near Plumtree turn-off (km 14)');
  const [simCategory, setSimCategory] = useState<HazardCategoryKey>('potholes');
  const [simLanguage, setSimLanguage] = useState<'English' | 'Shona' | 'Ndebele'>('Shona');
  const [simText, setSimText] = useState(
    'Pane gomba guru paA5 pedyo nePlumtree turn-off. Mota dziri kutsauka nzira.'
  );
  const [simHasPhoto, setSimHasPhoto] = useState(true);
  const [simFlaggedAi, setSimFlaggedAi] = useState(false);

  const filteredSignals = useMemo(() => {
    const q = newsroomSearch.trim().toLowerCase();
    return signals.filter((sig) => {
      if (statusFilter !== 'all' && sig.workflowStatus !== statusFilter) return false;
      const ch = (sig.sourceChannelLabel || '').toLowerCase();
      if (channelFilter === 'web' && !ch.includes('web')) return false;
      if (channelFilter === 'telegram' && !ch.includes('telegram')) return false;
      if (
        channelFilter === 'rss' &&
        !ch.includes('rss') &&
        !ch.includes('facebook') &&
        !ch.includes('instagram') &&
        !ch.includes('feed')
      )
        return false;
      if (channelFilter === 'whatsapp' && !ch.includes('whatsapp')) return false;
      if (channelFilter === 'ussd' && !ch.includes('ussd') && !ch.includes('sms')) return false;
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

  useEffect(() => {
    if (filteredSignals.length > 0 && !filteredSignals.some((s) => s.id === selectedInboxId)) {
      setSelectedInboxId(filteredSignals[0].id);
    }
  }, [filteredSignals, selectedInboxId, setSelectedInboxId]);

  const selectedLead = useMemo(() => {
    if (filteredSignals.length === 0) return null;
    return filteredSignals.find((s) => s.id === selectedInboxId) || filteredSignals[0];
  }, [filteredSignals, selectedInboxId]);

  const counts = useMemo(() => {
    const leadCount = signals.filter((s) => s.workflowStatus === 'lead').length;
    const verifyingCount = signals.filter((s) => s.workflowStatus === 'verifying').length;
    const verifiedCount = signals.filter((s) => s.workflowStatus === 'verified').length;
    const rejectedCount = signals.filter((s) => s.workflowStatus === 'rejected').length;
    return {
      all: Math.max(24, signals.length),
      lead: Math.max(16, leadCount),
      verifying: Math.max(8, verifyingCount),
      verified: verifiedCount,
      rejected: rejectedCount,
    };
  }, [signals]);

  const now = Date.now();
  const lockExpiryMs = selectedLead?.claimLockedUntil
    ? new Date(selectedLead.claimLockedUntil).getTime()
    : 0;
  const isLocked = Boolean(selectedLead?.claimedByName && lockExpiryMs > now);
  const currentActorId = currentUser?.id || 1;
  const isLockedByOther =
    isLocked &&
    selectedLead?.claimedById !== undefined &&
    selectedLead?.claimedById !== null &&
    selectedLead.claimedById !== currentActorId &&
    currentUser?.role !== 'admin';

  const metCount = selectedLead
    ? Object.values(selectedLead.checklist).filter(Boolean).length
    : 0;
  const allCoreComplete = metCount === 4;
  const hasPhoto = selectedLead ? selectedLead.photoType !== 'none' : false;
  const visualAiChecked = selectedLead
    ? !hasPhoto || Boolean(selectedLead.humanVisualAiCheck || selectedLead.humanVisualAiCheckPassed)
    : false;
  const needsTranslationGate = selectedLead
    ? selectedLead.originalLanguage === 'Shona' || selectedLead.originalLanguage === 'Ndebele'
    : false;
  const translationChecked = selectedLead
    ? !needsTranslationGate || Boolean(selectedLead.translationVerified)
    : true;
  const canApproveAlert =
    Boolean(selectedLead) &&
    allCoreComplete &&
    visualAiChecked &&
    translationChecked &&
    !isLockedByOther &&
    selectedLead?.workflowStatus !== 'verified';

  return (
    <div className={`pz-v3-inbox-page ${mobileShowReview ? 'is-mobile-detail-active' : ''}`}>
      {/* Task heading (Figma 75:511) */}
      <div className="pz-v3-inbox-heading" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span
          style={{
            fontSize: '14px',
            fontWeight: 500,
            lineHeight: '20px',
            color: '#176b45',
          }}
        >
          Newsroom / Inbox
        </span>
        <h1
          style={{
            fontFamily: "'Newsreader', Georgia, serif",
            fontSize: '32px',
            fontWeight: 500,
            lineHeight: '38px',
            color: '#202a24',
            margin: 0,
          }}
        >
          Review incoming reports
        </h1>
        <p
          style={{
            fontSize: '14px',
            lineHeight: '20px',
            color: '#5d6b63',
            margin: 0,
          }}
        >
          {counts.all} sample reports · newest first
        </p>
      </div>

      {/* Interactive Channel Simulator Drawer (USSD *140# & WhatsApp Demo) */}
      {simulatorChannel && (
        <div
          data-testid="channel-simulator-drawer"
          style={{
            background: '#0f172a',
            color: '#f8fafc',
            borderRadius: '8px',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            border: '1px solid #334155',
          }}
        >
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
              <span
                className="pz-mono"
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: simulatorChannel === 'ussd' ? '#fbbf24' : '#34d399',
                  letterSpacing: '0.06em',
                }}
              >
                {simulatorChannel === 'ussd'
                  ? "AFRICA'S TALKING USSD *140# GATEWAY SIMULATOR (FEATURE PHONE)"
                  : 'META WHATSAPP CLOUD API OPT-IN TIPLINE SIMULATOR'}
              </span>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', marginTop: '2px' }}>
                {simulatorChannel === 'ussd'
                  ? 'Simulate a zero-data USSD *140# highway hazard report'
                  : 'Simulate an opt-in WhatsApp citizen report (Shona / Ndebele / Photo)'}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setSimulatorChannel(null)}
              style={{
                background: '#1e293b',
                color: '#e2e8f0',
                border: '1px solid #475569',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Close Simulator ×
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11.5px', color: '#94a3b8', fontWeight: 600 }}>
                Corridor / Highway
              </label>
              <input
                type="text"
                className="pz-input"
                style={{ background: '#1e293b', color: '#ffffff', borderColor: '#475569' }}
                value={simCorridor}
                onChange={(e) => setSimCorridor(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11.5px', color: '#94a3b8', fontWeight: 600 }}>
                Landmark / KM Marker
              </label>
              <input
                type="text"
                className="pz-input"
                style={{ background: '#1e293b', color: '#ffffff', borderColor: '#475569' }}
                value={simLandmark}
                onChange={(e) => setSimLandmark(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11.5px', color: '#94a3b8', fontWeight: 600 }}>
                Language
              </label>
              <select
                className="pz-select"
                style={{ background: '#1e293b', color: '#ffffff', borderColor: '#475569' }}
                value={simLanguage}
                onChange={(e) => {
                  const lang = e.target.value as 'English' | 'Shona' | 'Ndebele';
                  setSimLanguage(lang);
                  if (lang === 'Shona') {
                    setSimText(
                      'Pane gomba guru paA5 pedyo nePlumtree turn-off. Mota dziri kutsauka nzira.'
                    );
                  } else if (lang === 'Ndebele') {
                    setSimText(
                      'Kulomgodi omkhulu kuA5 eduze lePlumtree turn-off. Izimota ziyaphambuka.'
                    );
                  } else {
                    setSimText(
                      'Deep unmarked pothole on A5 near Plumtree turn-off causing vehicles to swerve.'
                    );
                  }
                }}
              >
                <option value="Shona">Shona (Triggers 5th Translation Gate)</option>
                <option value="Ndebele">Ndebele (Triggers 5th Translation Gate)</option>
                <option value="English">English</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11.5px', color: '#94a3b8', fontWeight: 600 }}>
                Hazard Category
              </label>
              <select
                className="pz-select"
                style={{ background: '#1e293b', color: '#ffffff', borderColor: '#475569' }}
                value={simCategory}
                onChange={(e) => setSimCategory(e.target.value as HazardCategoryKey)}
              >
                <option value="potholes">Road surface damage / Potholes</option>
                <option value="flooding">Flooding or water on road</option>
                <option value="collisions">Collision or obstruction</option>
                <option value="visibility">Missing signs or broken lights</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11.5px', color: '#94a3b8', fontWeight: 600 }}>
              Incoming Citizen Message
            </label>
            <input
              type="text"
              className="pz-input"
              style={{ background: '#1e293b', color: '#ffffff', borderColor: '#475569' }}
              value={simText}
              onChange={(e) => setSimText(e.target.value)}
            />
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            {simulatorChannel === 'whatsapp' ? (
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '12.5px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={simHasPhoto}
                    onChange={(e) => setSimHasPhoto(e.target.checked)}
                  />
                  <span>Attach Citizen Camera Photo (Commercial Pool)</span>
                </label>
                {simHasPhoto && (
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      color: '#fca5a5',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={simFlaggedAi}
                      onChange={(e) => setSimFlaggedAi(e.target.checked)}
                    />
                    <span>Simulate AI / Screen-Recapture Disqualification Flag</span>
                  </label>
                )}
              </div>
            ) : (
              <span className="pz-mono" style={{ fontSize: '11.5px', color: '#fbbf24' }}>
                SESSION: *140*1*2# • ECONET ZERO-RATED USSD GATEWAY (TEXT ONLY)
              </span>
            )}

            <button
              type="button"
              data-testid="channel-simulator-submit-btn"
              onClick={async () => {
                const created = await simulateChannelIntake(simulatorChannel, {
                  corridor: simCorridor,
                  landmark: simLandmark,
                  categoryKey: simCategory,
                  categoryLabel:
                    simCategory === 'flooding'
                      ? 'Flooding or water on road'
                      : simCategory === 'collisions'
                        ? 'Collision or obstruction'
                        : simCategory === 'visibility'
                          ? 'Missing signs or streetlights'
                          : 'Road surface damage',
                  description: simText,
                  language: simLanguage,
                  hasPhoto: simulatorChannel === 'whatsapp' ? simHasPhoto : false,
                  flaggedAiDemo: simulatorChannel === 'whatsapp' ? simFlaggedAi : false,
                });
                setSelectedInboxId(created.id);
                setSimulatorChannel(null);
              }}
              style={{
                padding: '9px 16px',
                borderRadius: '6px',
                border: 'none',
                background: simulatorChannel === 'ussd' ? '#d97706' : '#059669',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Inject Live {simulatorChannel === 'ussd' ? 'USSD *140#' : 'WhatsApp'} Report into Inbox →
            </button>
          </div>
        </div>
      )}

      {/* Main 2-column inbox & inspection container (Figma 75:530) */}
      <div
        className={`pz-v3-inbox-container ${
          mobileShowReview ? 'is-mobile-detail' : 'is-mobile-list'
        }`}
      >
        {/* ===================================================================
            LEFT COLUMN: Incoming reports list (Figma 75:531)
            =================================================================== */}
        <div className="pz-v3-inbox-list-col">
          {/* Search and filters (Figma 75:515) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Search input (Figma 75:516) */}
            <div
              style={{
                height: '48px',
                background: '#ffffff',
                border: '1px solid #d9e1db',
                borderRadius: '6px',
                padding: '0 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <img
                src={ASSETS.search}
                alt=""
                style={{ width: '18px', height: '18px', flexShrink: 0 }}
              />
              <input
                type="search"
                value={newsroomSearch}
                onChange={(e) => setNewsroomSearch(e.target.value)}
                placeholder="Search reports or locations"
                aria-label="Search reports or locations"
                style={{
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  width: '100%',
                  fontSize: '15px',
                  color: '#202a24',
                }}
              />
              {newsroomSearch && (
                <button
                  type="button"
                  onClick={() => setNewsroomSearch('')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#5d6b63',
                    fontSize: '18px',
                    cursor: 'pointer',
                  }}
                >
                  ×
                </button>
              )}
            </div>

            {/* Status filter pills (Figma 75:520) */}
            <div
              role="tablist"
              aria-label="Filter inbox by review status"
              style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}
            >
              {(
                [
                  { key: 'all', label: `All · ${counts.all}` },
                  { key: 'lead', label: `New · ${counts.lead}` },
                  { key: 'verifying', label: `In review · ${counts.verifying}` },
                  { key: 'verified', label: 'Human verified' },
                  { key: 'rejected', label: 'Rejected' },
                ] as const
              ).map((tab) => {
                const active = statusFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    data-testid={`inbox-filter-${tab.key}`}
                    aria-selected={active}
                    onClick={() => setStatusFilter(tab.key)}
                    style={{
                      height: '44px',
                      padding: '0 14px',
                      borderRadius: '6px',
                      border: active ? '1px solid #145438' : '1px solid #d9e1db',
                      background: active ? '#145438' : '#ffffff',
                      color: active ? '#ffffff' : '#202a24',
                      fontSize: '14px',
                      fontWeight: active ? 600 : 400,
                      cursor: 'pointer',
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Inbox channel pills (Figma 105:667) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setChannelFilter(channelFilter === 'web' ? 'all' : 'web')}
                  style={{
                    height: '28px',
                    padding: '0 12px',
                    borderRadius: '4px',
                    border: channelFilter === 'web' ? '1px solid #1d4ed8' : 'none',
                    background: '#eff6ff',
                    color: '#1d4ed8',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  WEB
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setChannelFilter(channelFilter === 'telegram' ? 'all' : 'telegram')
                  }
                  style={{
                    height: '28px',
                    padding: '0 12px',
                    borderRadius: '4px',
                    border: channelFilter === 'telegram' ? '1px solid #075985' : 'none',
                    background: '#e0f2fe',
                    color: '#075985',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  TELEGRAM
                </button>
                <button
                  type="button"
                  onClick={() => setChannelFilter(channelFilter === 'rss' ? 'all' : 'rss')}
                  style={{
                    height: '28px',
                    padding: '0 12px',
                    borderRadius: '4px',
                    border: channelFilter === 'rss' ? '1px solid #334155' : 'none',
                    background: '#f1f5f9',
                    color: '#334155',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  RSS FEED
                </button>
                {channelFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setChannelFilter('all')}
                    style={{
                      height: '28px',
                      padding: '0 10px',
                      borderRadius: '4px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#475569',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Show All Channels
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <button
                  type="button"
                  data-testid="channel-sim-ussd-btn"
                  onClick={() => {
                    setChannelFilter('all');
                    setSimulatorChannel('ussd');
                  }}
                  style={{
                    height: '28px',
                    padding: '0 12px',
                    borderRadius: '4px',
                    border: 'none',
                    background: '#fffbeb',
                    color: '#92400e',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  USSD *140# • DEMO
                </button>
                <button
                  type="button"
                  data-testid="channel-sim-whatsapp-btn"
                  onClick={() => {
                    setChannelFilter('all');
                    setSimulatorChannel('whatsapp');
                  }}
                  style={{
                    height: '28px',
                    padding: '0 12px',
                    borderRadius: '4px',
                    border: 'none',
                    background: '#ecfdf5',
                    color: '#047857',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  WHATSAPP • DEMO
                </button>
              </div>
            </div>
          </div>

          {/* Report rows list (Figma 75:532) */}
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: '4px' }}>
            {filteredSignals.map((sig) => {
              const isSelected = selectedLead?.id === sig.id;
              const isNew = sig.workflowStatus === 'lead';
              const isVerified = sig.workflowStatus === 'verified';
              const isRejected = sig.workflowStatus === 'rejected';
              return (
                <button
                  key={sig.id}
                  type="button"
                  data-testid={`inbox-row-${sig.id}`}
                  onClick={() => {
                    setSelectedInboxId(sig.id);
                    setSelectedVerifyId(sig.id);
                    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
                      setMobileShowReview(true);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: isSelected ? '#f8faf9' : '#ffffff',
                    border: 'none',
                    borderBottom: '1px solid #d9e1db',
                    borderLeft: isSelected ? '3px solid #145438' : '3px solid transparent',
                    padding: '18px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'var(--pz-font-serif)',
                        fontSize: '18px',
                        fontWeight: 600,
                        lineHeight: '24px',
                        color: '#202a24',
                      }}
                    >
                      {sig.inboxTitle || sig.title}
                    </div>
                    <div
                      style={{
                        fontSize: '14px',
                        lineHeight: '20px',
                        color: '#5d6b63',
                      }}
                    >
                      {sig.sourceChannelShort} · {sig.roadArea}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span
                        className="pz-mono"
                        style={{
                          fontSize: '12px',
                          lineHeight: '16px',
                          color: '#5d6b63',
                        }}
                      >
                        {sig.reportedDateTime}
                      </span>
                      <span
                        style={{
                          padding: '4px 10px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: 500,
                          lineHeight: '16px',
                          background: isVerified
                            ? '#ecfdf5'
                            : isRejected
                              ? '#fef2f2'
                              : '#faf1d3',
                          color: isVerified
                            ? '#047857'
                            : isRejected
                              ? '#b91c1c'
                              : '#785b0a',
                          border: isNew ? '1px dashed #d97706' : 'none',
                        }}
                      >
                        {isVerified
                          ? 'Human verified'
                          : isRejected
                            ? 'Rejected'
                            : isNew
                              ? 'New'
                              : 'In review'}
                      </span>
                    </div>
                  </div>
                  <span style={{ color: '#5d6b63', fontSize: '18px', lineHeight: 1 }}>›</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ===================================================================
            RIGHT COLUMN: Signal inspection drawer (Figma 105:678)
            =================================================================== */}
        {selectedLead ? (
          <div className="pz-v3-inbox-drawer-col" data-testid="inbox-inspection-drawer">
            {/* Mobile-only top navigation back to Inbox list or straight into 4-Step Verification */}
            <div className="pz-v3-mobile-drawer-topbar">
              <button
                type="button"
                data-testid="mobile-back-to-inbox-btn"
                onClick={() => {
                  setMobileShowReview(false);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: '4px 0',
                  color: '#176b45',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                ← Back to Inbox
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedVerifyId(selectedLead.id);
                  navigateNewsroom('verify', selectedLead.id);
                }}
                style={{
                  background: '#ecfdf5',
                  border: '1px solid #145438',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  color: '#145438',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Open 4-Step Verification →
              </button>
            </div>

            {/* Journalist claim and lock bar (Figma 108:106) */}
            <AntiCollisionClaimBar signal={selectedLead} />

            {/* Metadata line & quick link to full Guided Verification (Figma 108:110) */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <span
                className="pz-mono"
                style={{
                  fontSize: '11px',
                  fontWeight: 500,
                  lineHeight: '16px',
                  color: '#475569',
                }}
              >
                {selectedLead.id} · {selectedLead.sourceChannelShort.toUpperCase()} · BULAWAYO
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedVerifyId(selectedLead.id);
                  navigateNewsroom('verify', selectedLead.id);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  color: '#176b45',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Open 4-Step Guided Verification →
              </button>
            </div>

            {/* Title (Figma 108:111) */}
            <h2
              style={{
                fontFamily: 'var(--pz-font-serif)',
                fontSize: '30px',
                fontWeight: 600,
                lineHeight: '36px',
                color: '#0f172a',
                margin: 0,
              }}
            >
              {selectedLead.inboxTitle || selectedLead.title}
            </h2>

            {/* Source and original report (Figma 108:112) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span
                className="pz-mono"
                style={{
                  fontSize: '11px',
                  fontWeight: 500,
                  lineHeight: '16px',
                  color: '#1d4ed8',
                }}
              >
                UNDER INVESTIGATION · {selectedLead.originalLanguage} source
              </span>
              <span
                className="pz-mono"
                style={{
                  fontSize: '12px',
                  lineHeight: '18px',
                  color: '#334155',
                }}
              >
                {selectedLead.corridor} · Received {selectedLead.reportedDateTime}
              </span>
              <p
                style={{
                  fontSize: '16px',
                  lineHeight: '24px',
                  color: '#0f172a',
                  margin: 0,
                }}
              >
                {selectedLead.originalQuote}
              </p>
              {selectedLead.draftEnglishTranslation && (
                <div
                  style={{
                    background: '#fffbeb',
                    borderLeft: '3px solid #d97706',
                    padding: '8px 12px',
                    fontSize: '13.5px',
                    color: '#78350f',
                  }}
                >
                  <strong>Draft English translation ({selectedLead.originalLanguage}):</strong>{' '}
                  {selectedLead.draftEnglishTranslation}
                </div>
              )}
              <span
                style={{
                  fontSize: '12px',
                  lineHeight: '18px',
                  color: '#92400e',
                }}
              >
                Contributor unconfirmed. Provenance is not verification.
              </span>
            </div>

            {/* Watermarked Evidence Viewer + EXIF Strip + Mandatory Human Visual Check + Instant Licensing */}
            <AiForensicsAndLicensingPanel
              signal={selectedLead}
              isLockedByOther={isLockedByOther}
            />

            {/* Editorial verification gates (Figma 108:142) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '4px' }}>
              <h3
                style={{
                  fontFamily: 'var(--pz-font-serif)',
                  fontSize: '25px',
                  fontWeight: 600,
                  lineHeight: '30px',
                  color: '#0f172a',
                  margin: 0,
                }}
              >
                Editorial verification gates
              </h3>
              <span
                className="pz-mono"
                style={{
                  fontSize: '11px',
                  lineHeight: '16px',
                  color: '#64748b',
                }}
              >
                {isLocked ? 'Investigation active' : 'Claim report to edit'} · {metCount} / 4 core
                checks complete
              </span>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {CORE_GATES.map((gate) => {
                  const checked = selectedLead.checklist[gate.key];
                  return (
                    <label
                      key={gate.key}
                      data-testid={`inbox-gate-${gate.key}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        fontSize: '14px',
                        lineHeight: '20px',
                        color: checked ? '#0f172a' : '#64748b',
                        cursor: isLockedByOther ? 'not-allowed' : 'pointer',
                        opacity: isLockedByOther ? 0.55 : 1,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={isLockedByOther}
                        onChange={() => toggleChecklist(selectedLead.id, gate.key)}
                        style={{ width: '16px', height: '16px', accentColor: '#145438' }}
                      />
                      <span>{gate.label}</span>
                    </label>
                  );
                })}
              </div>

              {/* Conditional 5th translation gate (Figma 108:149) */}
              <div
                style={{
                  background: needsTranslationGate ? '#fffbeb' : '#f1f5f9',
                  border: needsTranslationGate ? '1px solid #d97706' : '1px solid #cbd5e1',
                  borderRadius: '4px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  marginTop: '4px',
                }}
              >
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    fontSize: '13px',
                    fontWeight: 500,
                    lineHeight: '18px',
                    color: needsTranslationGate ? '#0f172a' : '#64748b',
                    cursor: needsTranslationGate && !isLockedByOther ? 'pointer' : 'default',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={needsTranslationGate ? Boolean(selectedLead.translationVerified) : false}
                    disabled={!needsTranslationGate || isLockedByOther}
                    onChange={() => {
                      if (needsTranslationGate && !isLockedByOther) {
                        toggleTranslationVerified(selectedLead.id);
                      }
                    }}
                    style={{ width: '15px', height: '15px', marginTop: '2px', accentColor: '#d97706' }}
                  />
                  <span>
                    Shona / Ndebele translation reviewed and verified accurate by human editor.
                  </span>
                </label>
                <span
                  className="pz-mono"
                  style={{
                    fontSize: '11px',
                    lineHeight: '16px',
                    color: needsTranslationGate ? '#92400e' : '#64748b',
                  }}
                >
                  {needsTranslationGate
                    ? `5TH GATE — Required for this ${selectedLead.originalLanguage} submission before public alert approval.`
                    : '5TH GATE — Applies only to Shona / Ndebele reports. Not required for this English source.'}
                </span>
              </div>
            </div>

            {/* Publish button (Figma 108:152) */}
            <button
              type="button"
              data-testid="inbox-approve-publish-btn"
              disabled={!canApproveAlert}
              onClick={() => verifySignal(selectedLead.id)}
              style={{
                width: '100%',
                height: '46px',
                borderRadius: '4px',
                border: 'none',
                background:
                  selectedLead.workflowStatus === 'verified'
                    ? '#059669'
                    : canApproveAlert
                      ? '#145438'
                      : '#e2e8f0',
                color:
                  selectedLead.workflowStatus === 'verified' || canApproveAlert
                    ? '#ffffff'
                    : '#64748b',
                fontSize: '14px',
                fontWeight: 600,
                cursor: canApproveAlert ? 'pointer' : 'not-allowed',
              }}
            >
              {selectedLead.workflowStatus === 'verified'
                ? '✓ Verified & Published Public Alert'
                : 'Approve & Publish Public Alert'}
            </button>

            <div
              className="pz-mono"
              style={{
                fontSize: '11px',
                lineHeight: '16px',
                color: '#475569',
              }}
            >
              DEMO STATE: {isLocked ? 'CLAIMED' : 'UNCLAIMED'} / AI SCAN PASS /{' '}
              {visualAiChecked ? 'HUMAN REVIEW COMPLETE' : 'HUMAN REVIEW PENDING'}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

/**
 * Figma V3 — `03 · Report review / Desktop` & `Mobile` (75:715, 75:842)
 * and `04 · Guided verification / Desktop` & `Mobile` (75:891, 75:989, 81:39, 81:266, 81:493)
 */
export const IncidentVerificationView: React.FC = () => {
  const {
    signals,
    currentUser,
    selectedVerifyId,
    setSelectedVerifyId,
    navigateNewsroom,
    navigatePublic,
    toggleChecklist,
    toggleTranslationVerified,
    updateEditorialNotes,
    requestEvidence,
    rejectSignal,
    verifySignal,
  } = usePanzira();

  const [viewMode, setViewMode] = useState<'guided' | 'review'>('guided');
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1);
  const [aiExpanded, setAiExpanded] = useState(false);

  const signal = useMemo(
    () => signals.find((s) => s.id === selectedVerifyId) || signals[0],
    [signals, selectedVerifyId]
  );

  const metCount = Object.values(signal.checklist).filter(Boolean).length;
  const allChecksComplete = metCount === 4;

  const now = Date.now();
  const lockExpiryMs = signal.claimLockedUntil ? new Date(signal.claimLockedUntil).getTime() : 0;
  const isLocked = Boolean(signal.claimedByName && lockExpiryMs > now);
  const currentActorId = currentUser?.id || 1;
  const isLockedByOther =
    isLocked &&
    signal.claimedById !== undefined &&
    signal.claimedById !== null &&
    signal.claimedById !== currentActorId &&
    currentUser?.role !== 'admin';

  const hasPhoto = signal.photoType !== 'none';
  const visualAiChecked =
    !hasPhoto || Boolean(signal.humanVisualAiCheck || signal.humanVisualAiCheckPassed);
  const needsTranslationGate =
    signal.originalLanguage === 'Shona' || signal.originalLanguage === 'Ndebele';
  const translationChecked = !needsTranslationGate || Boolean(signal.translationVerified);
  const canApproveAlert =
    allChecksComplete && visualAiChecked && translationChecked && !isLockedByOther;

  /* =========================================================================
     MODE A: `03 · Report review / Desktop` & `Mobile` (Figma 75:715 & 75:842)
     ========================================================================= */
  if (viewMode === 'review') {
    return (
      <div className="pz-v3-review-page">
        {/* Task heading (Figma 75:742) */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <h1
              style={{
                fontFamily: 'var(--pz-font-serif)',
                fontSize: '32px',
                fontWeight: 500,
                lineHeight: '38px',
                color: '#202a24',
                margin: 0,
              }}
            >
              Review this report
            </h1>
            <p style={{ fontSize: '14px', lineHeight: '20px', color: '#5d6b63', margin: 0 }}>
              {signal.id} ·{' '}
              <button
                type="button"
                onClick={() => navigateNewsroom('inbox')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  color: '#176b45',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Return to inbox to choose another report
              </button>
            </p>
          </div>

          <CompactReportPicker
            signals={signals}
            selectedId={signal.id}
            onSelect={(id) => setSelectedVerifyId(id)}
          />
        </div>

        {/* Centered 840px report review card (Figma 75:750) */}
        <div className="pz-v3-review-card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <span style={{ fontSize: '14px', lineHeight: '20px', color: '#5d6b63' }}>
              {signal.id} · Bulawayo
            </span>
            <h2
              style={{
                fontFamily: 'var(--pz-font-serif)',
                fontSize: '30px',
                fontWeight: 600,
                lineHeight: '36px',
                color: '#202a24',
                margin: 0,
              }}
            >
              {signal.inboxTitle || signal.title}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span
                style={{
                  background: '#faf1d3',
                  color: '#785b0a',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  fontSize: '13px',
                  fontWeight: 500,
                }}
              >
                {signal.workflowStatus === 'verified' ? 'Human verified' : 'In review'}
              </span>
              <span
                style={{
                  fontFamily: 'var(--pz-font-serif)',
                  fontSize: '20px',
                  fontWeight: 500,
                  lineHeight: '26px',
                  color: '#202a24',
                }}
              >
                {signal.categoryLabel}
              </span>
            </div>
            <span
              className="pz-mono"
              style={{ fontSize: '13px', lineHeight: '20px', color: '#5d6b63' }}
            >
              {signal.corridor} · {signal.sourceChannelShort} · Received {signal.reportedDateTime}
            </span>
          </div>

          {/* Original report */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <span
              style={{
                fontSize: '14px',
                fontWeight: 600,
                lineHeight: '20px',
                color: '#202a24',
              }}
            >
              Original report
            </span>
            <p
              style={{
                fontSize: '17px',
                lineHeight: '26px',
                color: '#202a24',
                margin: 0,
              }}
            >
              {signal.originalQuote}
            </p>
            <span style={{ fontSize: '13px', lineHeight: '18px', color: '#5d6b63' }}>
              Contributor unconfirmed. Provenance is not verification.
            </span>
          </div>

          {/* Citizen evidence photo (Figma 75:826) */}
          {signal.photoType !== 'none' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div
                style={{
                  maxWidth: '520px',
                  borderRadius: '6px',
                  overflow: 'hidden',
                  border: '1px solid #d9e1db',
                }}
              >
                <EvidencePhotoFrame
                  photoType={signal.photoType}
                  customPhotoDataUrl={signal.customPhotoDataUrl}
                  isGraphic={signal.isGraphicImage}
                  isRevealed={true}
                  allowEditorReveal={false}
                  height={200}
                />
              </div>
              <span style={{ fontSize: '13px', lineHeight: '18px', color: '#5d6b63' }}>
                Citizen upload · Capture time unknown · Not corroborated
              </span>
            </div>
          )}

          {/* Collapsible AI suggestions (Figma 75:830) */}
          <div
            style={{
              border: '1px solid #d9e1db',
              borderRadius: '6px',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <button
              type="button"
              onClick={() => setAiExpanded((prev) => !prev)}
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '14px', fontWeight: 500, color: '#202a24' }}>
                  AI suggestions · 2 findings
                </span>
                <span style={{ fontSize: '13px', color: '#5d6b63' }}>
                  Optional machine extraction, not verified evidence.
                </span>
              </div>
              <span style={{ color: '#5d6b63', fontSize: '14px' }}>
                {aiExpanded ? '▴' : '▾'}
              </span>
            </button>

            {aiExpanded && (
              <div
                style={{
                  paddingTop: '10px',
                  borderTop: '1px solid #d9e1db',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '12px',
                  fontSize: '13.5px',
                }}
              >
                <div>
                  <strong style={{ color: '#202a24' }}>Suggested classification:</strong>{' '}
                  <span style={{ color: '#5d6b63' }}>{signal.aiHazardType}</span>
                </div>
                <div>
                  <strong style={{ color: '#202a24' }}>Corridor match:</strong>{' '}
                  <span style={{ color: '#5d6b63' }}>{signal.aiLikelyCorridor}</span>
                </div>
              </div>
            )}
          </div>

          <p style={{ fontSize: '13px', lineHeight: '18px', color: '#5d6b63', margin: 0 }}>
            2 potentially related reports · 3 in cluster. Not confirmation.
          </p>

          <div>
            <button
              type="button"
              onClick={() => setViewMode('guided')}
              style={{
                height: '48px',
                padding: '0 22px',
                borderRadius: '6px',
                border: 'none',
                background: '#145438',
                color: '#ffffff',
                fontSize: '15px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Open verification
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* =========================================================================
     MODE B: `04 · Guided verification / Desktop` & `Mobile` (Figma 75:891)
     ========================================================================= */
  return (
    <div className="pz-v3-guided-page">
      {/* Case heading (Figma 75:908) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => navigateNewsroom('inbox')}
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                color: '#176b45',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              ← Back to inbox · {signal.id}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('review')}
              style={{
                background: 'transparent',
                border: '1px solid #d9e1db',
                borderRadius: '4px',
                padding: '3px 10px',
                color: '#5d6b63',
                fontSize: '12.5px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              View Report Summary Card (03)
            </button>
          </div>

          <h1
            style={{
              fontFamily: 'var(--pz-font-serif)',
              fontSize: '34px',
              fontWeight: 600,
              lineHeight: '40px',
              color: '#202a24',
              margin: 0,
            }}
          >
            {signal.inboxTitle || signal.title}
          </h1>

          {/* Badges row (Figma 75:911) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span
              style={{
                background: signal.workflowStatus === 'verified' ? '#ecfdf5' : '#faf1d3',
                color: signal.workflowStatus === 'verified' ? '#047857' : '#785b0a',
                padding: '6px 12px',
                borderRadius: '4px',
                fontSize: '13px',
                fontWeight: 500,
              }}
            >
              {signal.workflowStatus === 'verified' ? 'Human verified' : 'In review'}
            </span>

            <span
              style={{
                background: '#f8e6e3',
                color: '#9e2f24',
                padding: '6px 12px',
                borderRadius: '4px',
                fontSize: '13px',
                fontWeight: 500,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <img
                src={ASSETS.triangleAlertRed}
                alt=""
                style={{ width: '14px', height: '14px' }}
              />
              <span>Reported {signal.severityLabel.toLowerCase()} severity</span>
            </span>

            <span style={{ fontSize: '14px', lineHeight: '20px', color: '#5d6b63' }}>
              Category: {signal.categoryLabel}
            </span>

            {signal.workflowStatus === 'verified' && (
              <button
                type="button"
                onClick={() => navigatePublic('map')}
                style={{
                  background: '#ecfdf5',
                  border: '1px solid #145438',
                  borderRadius: '4px',
                  padding: '4px 10px',
                  color: '#145438',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                View on Road Conditions Map →
              </button>
            )}
          </div>
        </div>

        <CompactReportPicker
          signals={signals}
          selectedId={signal.id}
          onSelect={(id) => setSelectedVerifyId(id)}
        />
      </div>

      {/* Anti-collision claim bar */}
      <AntiCollisionClaimBar signal={signal} />

      {/* Main 2-column guided verification split (Figma 75:919) */}
      <div className="pz-v3-guided-split">
        {/* ===================================================================
            LEFT COLUMN: Source panel (Figma 75:920)
            =================================================================== */}
        <div className="pz-v3-guided-source-col">
          {/* Source provenance */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h2
              style={{
                fontFamily: 'var(--pz-font-serif)',
                fontSize: '20px',
                fontWeight: 600,
                lineHeight: '26px',
                color: '#202a24',
                margin: 0,
              }}
            >
              Source provenance
            </h2>
            <span
              className="pz-mono"
              style={{ fontSize: '13px', lineHeight: '20px', color: '#202a24', fontWeight: 500 }}
            >
              {signal.sourceChannelShort} · Received {signal.reportedDateTime}
            </span>
            <span style={{ fontSize: '13px', lineHeight: '18px', color: '#5d6b63' }}>
              Contributor identity unconfirmed · Capture time unknown · Location precision uncertain
            </span>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #d9e1db', margin: 0 }} />

          {/* Original text */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h2
              style={{
                fontFamily: 'var(--pz-font-serif)',
                fontSize: '20px',
                fontWeight: 600,
                lineHeight: '26px',
                color: '#202a24',
                margin: 0,
              }}
            >
              Original text
            </h2>
            <p
              style={{
                fontSize: '16px',
                lineHeight: '25px',
                color: '#202a24',
                margin: 0,
              }}
            >
              {signal.originalQuote}
            </p>
            {signal.draftEnglishTranslation && (
              <div
                style={{
                  background: '#fffbeb',
                  borderLeft: '3px solid #d97706',
                  padding: '8px 12px',
                  fontSize: '13.5px',
                  color: '#78350f',
                }}
              >
                <strong>Draft English translation ({signal.originalLanguage}):</strong>{' '}
                {signal.draftEnglishTranslation}
              </div>
            )}
            <span style={{ fontSize: '13px', lineHeight: '18px', color: '#5d6b63' }}>
              {signal.roadArea}. Provenance is not verification.
            </span>
          </div>

          {/* Evidence & Forensics */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <AiForensicsAndLicensingPanel signal={signal} isLockedByOther={isLockedByOther} />

            {/* AI suggestions disclosure box (Figma 75:935) */}
            <div
              style={{
                border: '1px solid #d9e1db',
                borderRadius: '6px',
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <button
                type="button"
                onClick={() => setAiExpanded((prev) => !prev)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#202a24' }}>
                    AI suggestions · 2 findings
                  </span>
                  <span style={{ fontSize: '13px', color: '#5d6b63' }}>
                    Optional machine extraction, not verified evidence.
                  </span>
                </div>
                <span style={{ color: '#5d6b63', fontSize: '14px' }}>
                  {aiExpanded ? '▴' : '▾'}
                </span>
              </button>

              {aiExpanded && (
                <div
                  style={{
                    paddingTop: '10px',
                    borderTop: '1px solid #d9e1db',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '12px',
                    fontSize: '13px',
                  }}
                >
                  <div>
                    <strong style={{ color: '#202a24' }}>Classification:</strong>{' '}
                    <span style={{ color: '#5d6b63' }}>{signal.aiHazardType}</span>
                  </div>
                  <div>
                    <strong style={{ color: '#202a24' }}>Corridor:</strong>{' '}
                    <span style={{ color: '#5d6b63' }}>{signal.aiLikelyCorridor}</span>
                  </div>
                </div>
              )}
            </div>

            <p style={{ fontSize: '13px', lineHeight: '19px', color: '#5d6b63', margin: 0 }}>
              2 potentially related reports (3 total). Similar submissions are not independent
              confirmation.
            </p>
          </div>
        </div>

        {/* ===================================================================
            RIGHT COLUMN: 4-Step Guided Verification Card (Figma 78:48 / 81:90 / 81:317 / 81:544)
            =================================================================== */}
        <div className="pz-v3-guided-step-col">
          {/* 4-Step Switcher Bar */}
          <div className="pz-v3-step-tabs">
            {(
              [
                { step: 1, title: '1. Source', checked: signal.checklist.locationAndTime },
                {
                  step: 2,
                  title: '2. Corroborate',
                  checked: signal.checklist.independentSource,
                },
                {
                  step: 3,
                  title: '3. Condition',
                  checked: signal.checklist.hazardStillPresent,
                },
                {
                  step: 4,
                  title: '4. Decision',
                  checked: signal.checklist.mediaAndDate,
                },
              ] as const
            ).map((s) => {
              const isCurrent = activeStep === s.step;
              return (
                <button
                  key={s.step}
                  type="button"
                  onClick={() => setActiveStep(s.step)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: isCurrent
                      ? '1.5px solid #145438'
                      : s.checked
                        ? '1px solid #059669'
                        : '1px solid #d9e1db',
                    background: isCurrent ? '#ecf3ef' : s.checked ? '#ecfdf5' : '#ffffff',
                    color: isCurrent || s.checked ? '#145438' : '#5d6b63',
                    fontSize: '12.5px',
                    fontWeight: isCurrent || s.checked ? 600 : 500,
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  {s.checked ? `✓ ${s.title}` : s.title}
                </button>
              );
            })}
          </div>

          {/* Active Guided Step Card (Figma 78:48) */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #d9e1db',
              borderRadius: '8px',
              padding: '28px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
          >
            {activeStep === 1 && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 500,
                      lineHeight: '16px',
                      letterSpacing: '0.36px',
                      color: '#176b45',
                    }}
                  >
                    STEP 1 OF 4 · VERIFY THE SOURCE
                  </span>
                  <h2
                    style={{
                      fontFamily: 'var(--pz-font-serif)',
                      fontSize: '26px',
                      fontWeight: 600,
                      lineHeight: '32px',
                      color: '#202a24',
                      margin: 0,
                    }}
                  >
                    Confirm location and time
                  </h2>
                </div>

                <p style={{ fontSize: '15px', lineHeight: '22px', color: '#5d6b63', margin: 0 }}>
                  Where and when did this happen? Verify these before any public alert.
                </p>

                <div
                  style={{
                    background: '#ecf3ef',
                    borderRadius: '6px',
                    padding: '16px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <span style={{ fontSize: '15px', fontWeight: 500, color: '#202a24' }}>
                    {signal.corridor} · {signal.landmark}
                  </span>
                  <span className="pz-mono" style={{ fontSize: '12px', color: '#5d6b63' }}>
                    {signal.sourceChannelShort} report · {signal.reportedDateTime}
                  </span>
                </div>

                <label
                  data-testid="verify-check-sourceConfirmed"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    cursor: isLockedByOther ? 'not-allowed' : 'pointer',
                    fontSize: '15px',
                    fontWeight: 500,
                    color: '#202a24',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={signal.checklist.locationAndTime}
                    disabled={isLockedByOther}
                    onChange={() => toggleChecklist(signal.id, 'locationAndTime')}
                    style={{ width: '20px', height: '20px', accentColor: '#145438' }}
                  />
                  <span>I confirmed the exact road section and report time</span>
                </label>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#176b45' }}>
                    View original text, photo and AI notes ▾
                  </span>
                  <span style={{ fontSize: '13px', color: '#5d6b63' }}>
                    Supporting details remain available when needed.
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() =>
                      requestEvidence(
                        signal.id,
                        'Requested exact road section and timestamp confirmation'
                      )
                    }
                    style={{
                      flex: 1,
                      height: '44px',
                      borderRadius: '6px',
                      border: 'none',
                      background: '#145438',
                      color: '#ffffff',
                      fontSize: '14px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    Request location evidence
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveStep(2)}
                    style={{
                      height: '44px',
                      padding: '0 16px',
                      borderRadius: '6px',
                      border: '1px solid #145438',
                      background: '#ffffff',
                      color: '#145438',
                      fontSize: '14px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    Next step →
                  </button>
                </div>

                <span style={{ fontSize: '12px', color: '#5d6b63' }}>
                  Up next: corroborate evidence → check current condition → editor approval.
                </span>
              </>
            )}

            {activeStep === 2 && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 500,
                      lineHeight: '16px',
                      letterSpacing: '0.36px',
                      color: '#176b45',
                    }}
                  >
                    STEP 2 OF 4 · CORROBORATE THE EVIDENCE
                  </span>
                  <h2
                    style={{
                      fontFamily: 'var(--pz-font-serif)',
                      fontSize: '26px',
                      fontWeight: 600,
                      lineHeight: '32px',
                      color: '#202a24',
                      margin: 0,
                    }}
                  >
                    Review independent corroboration
                  </h2>
                </div>

                <p style={{ fontSize: '15px', lineHeight: '22px', color: '#5d6b63', margin: 0 }}>
                  Cross-check with a second independent witness, trusted corridor desk contact, or
                  municipal road log before treating this report as confirmed.
                </p>

                <label
                  data-testid="verify-check-independentCorroboration"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    cursor: isLockedByOther ? 'not-allowed' : 'pointer',
                    fontSize: '15px',
                    fontWeight: 500,
                    color: '#202a24',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={signal.checklist.independentSource}
                    disabled={isLockedByOther}
                    onChange={() => toggleChecklist(signal.id, 'independentSource')}
                    style={{ width: '20px', height: '20px', accentColor: '#145438' }}
                  />
                  <span>I reviewed independent corroborating evidence</span>
                </label>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() =>
                      requestEvidence(signal.id, 'Requested independent witness corroboration')
                    }
                    style={{
                      flex: 1,
                      height: '44px',
                      borderRadius: '6px',
                      border: 'none',
                      background: '#145438',
                      color: '#ffffff',
                      fontSize: '14px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    Request corroborating evidence
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveStep(3)}
                    style={{
                      height: '44px',
                      padding: '0 16px',
                      borderRadius: '6px',
                      border: '1px solid #145438',
                      background: '#ffffff',
                      color: '#145438',
                      fontSize: '14px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    Next step →
                  </button>
                </div>
              </>
            )}

            {activeStep === 3 && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 500,
                      lineHeight: '16px',
                      letterSpacing: '0.36px',
                      color: '#176b45',
                    }}
                  >
                    STEP 3 OF 4 · CHECK THE CURRENT CONDITION
                  </span>
                  <h2
                    style={{
                      fontFamily: 'var(--pz-font-serif)',
                      fontSize: '26px',
                      fontWeight: 600,
                      lineHeight: '32px',
                      color: '#202a24',
                      margin: 0,
                    }}
                  >
                    Confirm current road condition and severity
                  </h2>
                </div>

                <p style={{ fontSize: '15px', lineHeight: '22px', color: '#5d6b63', margin: 0 }}>
                  Verify that the hazard is still active on {signal.corridor} and that the reported{' '}
                  {signal.severityLabel.toLowerCase()} severity rating is accurate for drivers.
                </p>

                <label
                  data-testid="verify-check-severityConfirmed"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    cursor: isLockedByOther ? 'not-allowed' : 'pointer',
                    fontSize: '15px',
                    fontWeight: 500,
                    color: '#202a24',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={signal.checklist.hazardStillPresent}
                    disabled={isLockedByOther}
                    onChange={() => toggleChecklist(signal.id, 'hazardStillPresent')}
                    style={{ width: '20px', height: '20px', accentColor: '#145438' }}
                  />
                  <span>I confirmed the current road condition and severity</span>
                </label>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setActiveStep(4)}
                    style={{
                      height: '44px',
                      padding: '0 20px',
                      borderRadius: '6px',
                      border: 'none',
                      background: '#145438',
                      color: '#ffffff',
                      fontSize: '14px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    Continue to Step 4 (Editorial Decision) →
                  </button>
                </div>
              </>
            )}

            {activeStep === 4 && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 500,
                      lineHeight: '16px',
                      letterSpacing: '0.36px',
                      color: '#176b45',
                    }}
                  >
                    STEP 4 OF 4 · MAKE THE EDITORIAL DECISION
                  </span>
                  <h2
                    style={{
                      fontFamily: 'var(--pz-font-serif)',
                      fontSize: '26px',
                      fontWeight: 600,
                      lineHeight: '32px',
                      color: '#202a24',
                      margin: 0,
                    }}
                  >
                    Editor approval and publication rights
                  </h2>
                </div>

                <label
                  data-testid="verify-check-editorApproval"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    cursor: isLockedByOther ? 'not-allowed' : 'pointer',
                    fontSize: '15px',
                    fontWeight: 500,
                    color: '#202a24',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={signal.checklist.mediaAndDate}
                    disabled={isLockedByOther}
                    onChange={() => toggleChecklist(signal.id, 'mediaAndDate')}
                    style={{ width: '20px', height: '20px', accentColor: '#145438' }}
                  />
                  <span>I approve public alert publication and verified media rights</span>
                </label>
              </>
            )}

            {/* Complete 4-Gate + 5th Translation Gate Checklist Summary */}
            <div
              style={{
                borderTop: '1px solid #d9e1db',
                paddingTop: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <span className="pz-mono" style={{ fontSize: '11.5px', color: '#5d6b63' }}>
                ALL 4 CORE GATES ({metCount}/4 COMPLETE)
              </span>

              {CORE_GATES.map((gate) => {
                const isChecked = signal.checklist[gate.key];
                return (
                  <label
                    key={gate.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      fontSize: '14px',
                      color: isChecked ? '#202a24' : '#5d6b63',
                      cursor: isLockedByOther ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isLockedByOther}
                      onChange={() => toggleChecklist(signal.id, gate.key)}
                      style={{ width: '16px', height: '16px', accentColor: '#145438' }}
                    />
                    <span>{gate.label}</span>
                  </label>
                );
              })}

              {/* 5th Gate — Shona / Ndebele translation check */}
              <div
                data-testid="verify-check-translation-5th-gate"
                style={{
                  background: needsTranslationGate ? '#fffbeb' : '#f1f5f9',
                  border: needsTranslationGate ? '1px solid #d97706' : '1px solid #cbd5e1',
                  borderRadius: '5px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  marginTop: '4px',
                }}
              >
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    fontSize: '13.5px',
                    fontWeight: 500,
                    color: needsTranslationGate ? '#0f172a' : '#64748b',
                    cursor: needsTranslationGate && !isLockedByOther ? 'pointer' : 'default',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={needsTranslationGate ? Boolean(signal.translationVerified) : false}
                    disabled={!needsTranslationGate || isLockedByOther}
                    onChange={() => {
                      if (needsTranslationGate && !isLockedByOther) {
                        toggleTranslationVerified(signal.id);
                      }
                    }}
                    style={{ width: '16px', height: '16px', marginTop: '2px', accentColor: '#d97706' }}
                  />
                  <span>
                    Shona / Ndebele translation reviewed and verified accurate by human editor
                  </span>
                </label>
                <span className="pz-mono" style={{ fontSize: '11px', color: '#64748b' }}>
                  {needsTranslationGate
                    ? `5TH GATE · Required for this ${signal.originalLanguage} submission before publication.`
                    : '5TH GATE — Applies only to Shona / Ndebele reports. Not required for this English source.'}
                </span>
              </div>

              {/* Editorial notes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                <label
                  htmlFor="pz-editor-notes"
                  style={{ fontSize: '13px', fontWeight: 600, color: '#202a24' }}
                >
                  Editorial verification notes (Rudo Moyo)
                </label>
                <textarea
                  id="pz-editor-notes"
                  className="pz-textarea"
                  value={signal.editorialNotes}
                  onChange={(e) => updateEditorialNotes(signal.id, e.target.value)}
                  placeholder="Record witness calls, road authority responses, kilometre markers, or translation checks..."
                />
              </div>

              {/* Sticky/Action Bar (Figma 75:1058) */}
              <div
                style={{
                  borderTop: '1px solid #d9e1db',
                  paddingTop: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <span style={{ fontSize: '13px', color: '#5d6b63' }}>
                  {metCount}/4 checks complete ·{' '}
                  {canApproveAlert ? 'Ready for human verification' : 'Public publication blocked'}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    requestEvidence(signal.id, 'Requested follow-up location or photo evidence')
                  }
                  style={{
                    width: '100%',
                    height: '48px',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#145438',
                    color: '#ffffff',
                    fontSize: '15px',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                  }}
                >
                  <img
                    src={ASSETS.messageSquare}
                    alt=""
                    style={{ width: '16px', height: '16px' }}
                  />
                  <span>Request evidence</span>
                </button>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => rejectSignal(signal.id)}
                    style={{
                      height: '44px',
                      borderRadius: '6px',
                      border: '1px solid #75b494',
                      background: '#ffffff',
                      color: '#176b45',
                      fontSize: '14px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    Reject
                  </button>

                  <button
                    type="button"
                    data-testid="verify-approve-btn"
                    disabled={!canApproveAlert}
                    onClick={() => verifySignal(signal.id)}
                    style={{
                      height: '44px',
                      borderRadius: '6px',
                      border: 'none',
                      background:
                        signal.workflowStatus === 'verified'
                          ? '#059669'
                          : canApproveAlert
                            ? '#145438'
                            : '#e4ebe6',
                      color:
                        signal.workflowStatus === 'verified' || canApproveAlert
                          ? '#ffffff'
                          : '#5d6b63',
                      fontSize: '14px',
                      fontWeight: 500,
                      cursor: canApproveAlert ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {signal.workflowStatus === 'verified' ? '✓ Human verified' : 'Human verify'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
