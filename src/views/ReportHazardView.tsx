import React, { useRef, useState } from 'react';
import { ASSETS } from '../assetsMap';
import { NewCitizenReportInput, usePanzira } from '../context/PanziraContext';
import {
  AttributionMode,
  HazardCategoryKey,
  LicenseTier,
} from '../types';

type ReportStep = 1 | 2 | 3 | 4;

interface CategoryOption {
  key: HazardCategoryKey;
  label: string;
  subtitle: string;
  icon: string;
}

const CATEGORY_OPTIONS: CategoryOption[] = [
  {
    key: 'potholes',
    label: 'Road surface damage',
    subtitle: 'Potholes, cracks or damaged edges',
    icon: ASSETS.catRoadDamage,
  },
  {
    key: 'flooding',
    label: 'Flooding',
    subtitle: 'Standing or fast-moving water',
    icon: ASSETS.catFlooding,
  },
  {
    key: 'collisions',
    label: 'Collision',
    subtitle: 'A crash or blocked carriageway',
    icon: ASSETS.catCollision,
  },
  {
    key: 'other',
    label: 'Other hazard',
    subtitle: 'Visibility, vehicles or obstructions',
    icon: ASSETS.catOther,
  },
];

export const ReportHazardView: React.FC = () => {
  const { submitCitizenReport, navigatePublic, navigateAuth, setPendingClaimPrefill } = usePanzira();

  const [step, setStep] = useState<ReportStep>(1);
  const [categoryKey, setCategoryKey] = useState<HazardCategoryKey>('potholes');
  const [roadOrArea, setRoadOrArea] = useState<string>('A5 corridor (Bulawayo–Plumtree)');
  const [landmark, setLandmark] = useState<string>('Towards Plumtree');
  const [description, setDescription] = useState<string>(
    'Large potholes on the A5 towards Plumtree. Difficult to see at night.'
  );
  const [language, setLanguage] = useState<'English' | 'Shona' | 'Ndebele'>('English');
  const [lowBandwidth, setLowBandwidth] = useState<boolean>(true);
  const [includePhoto, setIncludePhoto] = useState<boolean>(false);
  const [customPhotoPreview, setCustomPhotoPreview] = useState<string | null>(null);
  const [customPhotoName, setCustomPhotoName] = useState<string | null>(null);
  const [licenseTier, setLicenseTier] = useState<LicenseTier>('safety_only');
  const [attributionMode, setAttributionMode] = useState<AttributionMode>('anonymous');
  const [consentChecked, setConsentChecked] = useState<boolean>(true);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);

  const [submittedReceipt, setSubmittedReceipt] = useState<{
    id: string;
    claimPin: string;
    licenseTier: LicenseTier;
    attributionMode: AttributionMode;
  } | null>(null);

  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  const activeCat = CATEGORY_OPTIONS.find((c) => c.key === categoryKey) || CATEGORY_OPTIONS[0];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCustomPhotoName(file.name);
    setIncludePhoto(true);
    setLowBandwidth(false);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCustomPhotoPreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUseCurrentLocation = () => {
    setGpsStatus('Approximate Bulawayo corridor coordinates attached (-20.155, 28.568).');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!consentChecked) return;

    const submission: NewCitizenReportInput = {
      categoryKey,
      categoryLabel: activeCat.label,
      roadArea: roadOrArea.trim() || 'A5 corridor (Bulawayo–Plumtree)',
      landmark: landmark.trim() || 'Towards Plumtree',
      reportedDateTime: '4 Nov 2026 · Just now',
      description:
        description.trim() ||
        'Large potholes on the A5 towards Plumtree. Difficult to see at night.',
      language,
      photoType: customPhotoPreview
        ? 'custom-upload'
        : includePhoto
          ? 'figma-road-damage'
          : 'none',
      customPhotoDataUrl: customPhotoPreview || undefined,
      photoFilename: customPhotoName || undefined,
      licenseTier,
      attributionMode,
    };

    const result = submitCitizenReport(submission);
    const formattedId = result.id.startsWith('#') ? result.id : `#${result.id}`;
    setSubmittedReceipt({
      id: formattedId,
      claimPin: result.claimPin || '4920',
      licenseTier,
      attributionMode,
    });
    setStep(4);
  };

  const renderProgressBar = () => (
    <div
      data-node-id="83:116"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: '8px',
        width: '100%',
      }}
    >
      {[
        { num: 1, label: '1. What happened?' },
        { num: 2, label: '2. Where?' },
        { num: 3, label: '3. Details' },
      ].map((item) => {
        const isCompletedOrCurrent = step >= item.num;
        const isCurrent = step === item.num;
        return (
          <button
            key={item.num}
            type="button"
            onClick={() => {
              if (item.num < step) setStep(item.num as ReportStep);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              textAlign: 'left',
              cursor: item.num < step ? 'pointer' : 'default',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div
              style={{
                width: '100%',
                height: '4px',
                borderRadius: '2px',
                background: isCompletedOrCurrent ? '#176b45' : '#d9e1db',
              }}
            />
            <span
              style={{
                fontFamily: 'var(--pz-font-sans)',
                fontWeight: isCurrent ? 500 : 400,
                fontSize: '15px',
                lineHeight: 1.5,
                color: isCurrent ? '#176b45' : '#5d6b63',
              }}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );

  const renderLowBandwidthSwitch = () => (
    <div
      data-node-id="83:159"
      style={{
        background: '#edf4ef',
        borderRadius: '6px',
        padding: '14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        width: '100%',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <span
          style={{
            fontFamily: 'var(--pz-font-sans)',
            fontWeight: 500,
            fontSize: '14px',
            lineHeight: 1.5,
            color: '#202a24',
          }}
        >
          Low-bandwidth mode · {lowBandwidth ? 'On' : 'Off'}
        </span>
        <span
          style={{
            fontFamily: 'var(--pz-font-sans)',
            fontWeight: 400,
            fontSize: '14px',
            lineHeight: 1.5,
            color: '#5d6b63',
          }}
        >
          Text only. No photo or map download needed.
        </span>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={lowBandwidth}
        onClick={() => setLowBandwidth((prev) => !prev)}
        style={{
          width: '40px',
          height: '24px',
          borderRadius: '20px',
          background: lowBandwidth ? '#176b45' : '#94a3b8',
          border: 'none',
          padding: '3px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: lowBandwidth ? 'flex-end' : 'flex-start',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            background: '#ffffff',
            display: 'block',
          }}
        />
      </button>
    </div>
  );

  // =========================================================================
  // STEP 4: POST-SUBMISSION CLAIM RECEIPT (83:499)
  // =========================================================================
  if (step === 4 && submittedReceipt) {
    return (
      <div
        data-node-id="83:499"
        style={{
          width: '100%',
          maxWidth: '620px',
          margin: '0 auto',
          padding: '76px 20px 40px',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
        }}
      >
        <h1
          data-node-id="105:633"
          style={{
            margin: 0,
            fontFamily: 'var(--pz-font-serif)',
            fontWeight: 500,
            fontSize: '32px',
            lineHeight: 1.05,
            letterSpacing: '-0.64px',
            color: '#0f172a',
          }}
        >
          ✓ Report received
        </h1>

        <p
          data-node-id="105:634"
          style={{
            margin: 0,
            fontFamily: 'var(--pz-font-sans)',
            fontSize: '12px',
            lineHeight: 1.5,
            color: '#475569',
          }}
        >
          This is a fictional confirmation. No real report has been submitted.
        </p>

        {/* Private Guest Claim Receipt Box */}
        <div
          data-node-id="105:635"
          style={{
            background: '#f8fafc',
            border: '1px dashed #94a3b8',
            borderRadius: '6px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <span
            data-node-id="105:636"
            style={{
              fontFamily: 'var(--pz-font-sans)',
              fontWeight: 500,
              fontSize: '11px',
              color: '#047857',
              letterSpacing: '0.02em',
            }}
          >
            YOUR PRIVATE CLAIM RECEIPT
          </span>

          <span
            data-node-id="105:637"
            style={{
              fontFamily: 'var(--pz-font-mono)',
              fontWeight: 500,
              fontSize: '11px',
              letterSpacing: '0.44px',
              color: '#475569',
            }}
          >
            REPORT REFERENCE
          </span>

          <span
            data-node-id="105:638"
            style={{
              fontFamily: 'var(--pz-font-mono)',
              fontWeight: 600,
              fontSize: '15px',
              letterSpacing: '0.48px',
              color: '#0f172a',
            }}
          >
            {submittedReceipt.id}
          </span>

          <div
            data-node-id="105:639"
            style={{
              background: '#fffbeb',
              borderRadius: '6px',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <span
              data-node-id="105:640"
              style={{
                fontFamily: 'var(--pz-font-mono)',
                fontWeight: 500,
                fontSize: '11px',
                letterSpacing: '0.44px',
                color: '#92400e',
              }}
            >
              CLAIM PIN
            </span>
            <span
              data-node-id="105:641"
              style={{
                fontFamily: 'var(--pz-font-mono)',
                fontWeight: 600,
                fontSize: '15px',
                letterSpacing: '0.48px',
                color: '#0f172a',
              }}
            >
              {submittedReceipt.claimPin}
            </span>
            <span
              data-node-id="105:642"
              style={{
                fontFamily: 'var(--pz-font-sans)',
                fontSize: '12px',
                color: '#92400e',
              }}
            >
              Keep this PIN private. It proves this guest report is yours.
            </span>
          </div>

          <span
            data-node-id="105:643"
            style={{
              fontFamily: 'var(--pz-font-sans)',
              fontWeight: 500,
              fontSize: '10px',
              color: '#92400e',
            }}
          >
            PENDING EDITORIAL REVIEW · NOT PUBLIC
          </span>
        </div>

        <h2
          data-node-id="105:644"
          style={{
            margin: 0,
            fontFamily: 'var(--pz-font-serif)',
            fontWeight: 500,
            fontSize: '21px',
            lineHeight: 1.05,
            letterSpacing: '-0.42px',
            color: '#0f172a',
          }}
        >
          Track verification. Claim your media royalties.
        </h2>

        <button
          type="button"
          data-node-id="105:645"
          onClick={() => {
            setPendingClaimPrefill({
              reference: submittedReceipt.id,
              pin: submittedReceipt.claimPin,
            });
            navigateAuth('citizen-signup');
          }}
          style={{
            width: '100%',
            background: '#176b45',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            padding: '14px 18px',
            fontFamily: 'var(--pz-font-sans)',
            fontWeight: 500,
            fontSize: '16px',
            lineHeight: 1.5,
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          Create Account to Track &amp; Receive EcoCash Royalties
        </button>

        <p
          data-node-id="105:647"
          style={{
            margin: 0,
            fontFamily: 'var(--pz-font-sans)',
            fontSize: '12px',
            lineHeight: 1.5,
            color: '#475569',
          }}
        >
          Use this receipt to link your report. You choose your media license; ownership stays with
          you.
        </p>

        <button
          type="button"
          data-node-id="105:648"
          onClick={() => navigatePublic('map')}
          style={{
            width: '100%',
            height: '48px',
            background: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            color: '#176b45',
            fontFamily: 'var(--pz-font-sans)',
            fontWeight: 500,
            fontSize: '16px',
            cursor: 'pointer',
          }}
        >
          Return to Live Map
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '680px',
        margin: '0 auto',
        padding: '40px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '28px',
      }}
    >
      {/* Top Eyebrow */}
      <p
        style={{
          margin: 0,
          fontFamily: 'var(--pz-font-sans)',
          fontSize: '14px',
          lineHeight: 1.5,
          color: '#5d6b63',
        }}
      >
        {step === 3 ? 'Report a hazard · Step 3 of 3' : 'Report a hazard'}
      </p>

      {/* 3-Step Segmented Progress Bar */}
      {renderProgressBar()}

      {/* =====================================================================
          STEP 1: 01 · What happened? (83:96)
          ===================================================================== */}
      {step === 1 && (
        <div
          data-node-id="83:96"
          style={{ display: 'flex', flexDirection: 'column', gap: '28px', width: '100%' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h1
              data-node-id="83:128"
              style={{
                margin: 0,
                fontFamily: 'var(--pz-font-serif)',
                fontWeight: 500,
                fontSize: '32px',
                lineHeight: 1.05,
                letterSpacing: '-0.64px',
                color: '#202a24',
              }}
            >
              What happened?
            </h1>
            <p
              data-node-id="83:129"
              style={{
                margin: 0,
                fontFamily: 'var(--pz-font-sans)',
                fontSize: '16px',
                lineHeight: 1.5,
                color: '#5d6b63',
              }}
            >
              Choose the category that best describes the hazard.
            </p>
          </div>

          {/* 2x2 Category Grid */}
          <div
            data-node-id="83:130"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '12px',
              width: '100%',
            }}
          >
            {CATEGORY_OPTIONS.map((option) => {
              const selected = option.key === categoryKey;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setCategoryKey(option.key)}
                  style={{
                    minHeight: '112px',
                    padding: '18px',
                    borderRadius: '6px',
                    background: selected ? '#edf4ef' : '#ffffff',
                    border: selected ? '2px solid #176b45' : '1px solid #d9e1db',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <img
                    src={option.icon}
                    alt=""
                    style={{ width: '24px', height: '24px', flexShrink: 0 }}
                  />
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      flex: '1 1 auto',
                      minWidth: 0,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--pz-font-sans)',
                        fontWeight: 500,
                        fontSize: '16px',
                        lineHeight: 1.5,
                        color: '#202a24',
                      }}
                    >
                      {option.label}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--pz-font-sans)',
                        fontWeight: 400,
                        fontSize: '14px',
                        lineHeight: 1.5,
                        color: '#5d6b63',
                      }}
                    >
                      {option.subtitle}
                    </span>
                  </div>
                  <img
                    src={selected ? ASSETS.radioChecked : ASSETS.radioUnchecked}
                    alt=""
                    style={{ width: '20px', height: '20px', flexShrink: 0 }}
                  />
                </button>
              );
            })}
          </div>

          {renderLowBandwidthSwitch()}

          <p
            data-node-id="83:165"
            style={{
              margin: 0,
              fontFamily: 'var(--pz-font-sans)',
              fontSize: '14px',
              lineHeight: 1.5,
              color: '#5d6b63',
            }}
          >
            Stay safe. Do not stop in traffic or put yourself at risk to report.
          </p>

          <div
            data-node-id="83:166"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '8px',
            }}
          >
            <button
              type="button"
              onClick={() => navigatePublic('overview')}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#176b45',
                fontFamily: 'var(--pz-font-sans)',
                fontWeight: 500,
                fontSize: '16px',
                height: '48px',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => setStep(2)}
              style={{
                background: '#176b45',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                height: '48px',
                padding: '0 22px',
                fontFamily: 'var(--pz-font-sans)',
                fontWeight: 500,
                fontSize: '16px',
                cursor: 'pointer',
              }}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          STEP 2: 02 · Where is it? (83:247)
          ===================================================================== */}
      {step === 2 && (
        <div
          data-node-id="83:247"
          style={{ display: 'flex', flexDirection: 'column', gap: '28px', width: '100%' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h1
              data-node-id="83:279"
              style={{
                margin: 0,
                fontFamily: 'var(--pz-font-serif)',
                fontWeight: 500,
                fontSize: '32px',
                lineHeight: 1.05,
                letterSpacing: '-0.64px',
                color: '#202a24',
              }}
            >
              Where is the hazard?
            </h1>
            <p
              data-node-id="83:280"
              style={{
                margin: 0,
                fontFamily: 'var(--pz-font-sans)',
                fontSize: '16px',
                lineHeight: 1.5,
                color: '#5d6b63',
              }}
            >
              A road name or nearby place is enough to start.
            </p>
          </div>

          {/* Field 1: Road or place */}
          <div
            data-node-id="83:281"
            style={{ display: 'flex', flexDirection: 'column', gap: '7px', width: '100%' }}
          >
            <label
              htmlFor="pz-v3-road-input"
              style={{
                fontFamily: 'var(--pz-font-sans)',
                fontWeight: 500,
                fontSize: '14px',
                color: '#202a24',
              }}
            >
              Road or place
            </label>
            <input
              id="pz-v3-road-input"
              type="text"
              value={roadOrArea}
              onChange={(e) => setRoadOrArea(e.target.value)}
              placeholder="A5 corridor (Bulawayo–Plumtree)"
              style={{
                width: '100%',
                minHeight: '50px',
                padding: '12px 14px',
                borderRadius: '6px',
                border: '1px solid #d9e1db',
                fontFamily: 'var(--pz-font-sans)',
                fontSize: '16px',
                color: '#202a24',
              }}
            />
            <span
              style={{
                fontFamily: 'var(--pz-font-sans)',
                fontSize: '14px',
                color: '#5d6b63',
              }}
            >
              Bulawayo, Zimbabwe
            </span>
          </div>

          {/* Field 2: Nearby landmark or direction */}
          <div
            data-node-id="83:286"
            style={{ display: 'flex', flexDirection: 'column', gap: '7px', width: '100%' }}
          >
            <label
              htmlFor="pz-v3-landmark-input"
              style={{
                fontFamily: 'var(--pz-font-sans)',
                fontWeight: 500,
                fontSize: '14px',
                color: '#202a24',
              }}
            >
              Nearby landmark or direction (optional)
            </label>
            <input
              id="pz-v3-landmark-input"
              type="text"
              value={landmark}
              onChange={(e) => setLandmark(e.target.value)}
              placeholder="Towards Plumtree"
              style={{
                width: '100%',
                minHeight: '50px',
                padding: '12px 14px',
                borderRadius: '6px',
                border: '1px solid #d9e1db',
                fontFamily: 'var(--pz-font-sans)',
                fontSize: '16px',
                color: '#202a24',
              }}
            />
            <span
              style={{
                fontFamily: 'var(--pz-font-sans)',
                fontSize: '14px',
                color: '#5d6b63',
              }}
            >
              Add a junction, landmark or approximate distance if you know it.
            </span>
          </div>

          {/* Optional GPS helper */}
          <button
            type="button"
            data-node-id="83:291"
            onClick={handleUseCurrentLocation}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              height: '48px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              color: '#176b45',
              fontFamily: 'var(--pz-font-sans)',
              fontWeight: 500,
              fontSize: '15px',
            }}
          >
            <img src={ASSETS.locateFixed} alt="" style={{ width: '22px', height: '22px' }} />
            <span>{gpsStatus || 'Use my current location (optional)'}</span>
          </button>

          {/* Location uncertainty box */}
          <div
            data-node-id="83:295"
            style={{
              background: '#f6f8f6',
              border: '1px solid #d9e1db',
              borderRadius: '6px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              fontSize: '14px',
            }}
          >
            <span style={{ fontWeight: 500, color: '#202a24' }}>Approximate location</span>
            <span style={{ color: '#5d6b63' }}>
              Exact location is not independently confirmed. You can continue without sharing GPS.
            </span>
          </div>

          {renderLowBandwidthSwitch()}

          <div
            data-node-id="83:304"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '8px',
            }}
          >
            <button
              type="button"
              onClick={() => setStep(1)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#176b45',
                fontFamily: 'var(--pz-font-sans)',
                fontWeight: 500,
                fontSize: '16px',
                height: '48px',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              ← Back
            </button>

            <button
              type="button"
              onClick={() => setStep(3)}
              style={{
                background: '#176b45',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                height: '48px',
                padding: '0 22px',
                fontFamily: 'var(--pz-font-sans)',
                fontWeight: 500,
                fontSize: '16px',
                cursor: 'pointer',
              }}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          STEP 3: ReportHazardView · Photo upload & rights (83:370)
          ===================================================================== */}
      {step === 3 && (
        <form
          data-node-id="83:370"
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h1
              data-node-id="83:402"
              style={{
                margin: 0,
                fontFamily: 'var(--pz-font-serif)',
                fontWeight: 500,
                fontSize: '32px',
                lineHeight: 1.05,
                letterSpacing: '-0.64px',
                color: '#202a24',
              }}
            >
              Add details and submit
            </h1>
            <p
              data-node-id="83:403"
              style={{
                margin: 0,
                fontFamily: 'var(--pz-font-sans)',
                fontSize: '16px',
                lineHeight: 1.5,
                color: '#5d6b63',
              }}
            >
              Tell us what you saw. Photos are optional.
            </p>
          </div>

          {/* Short Description + Language Selector */}
          <div
            data-node-id="83:404"
            style={{ display: 'flex', flexDirection: 'column', gap: '7px', width: '100%' }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                flexWrap: 'wrap',
              }}
            >
              <label
                htmlFor="pz-v3-desc-input"
                style={{
                  fontFamily: 'var(--pz-font-sans)',
                  fontWeight: 500,
                  fontSize: '14px',
                  color: '#202a24',
                }}
              >
                Short description
              </label>
              <div style={{ display: 'inline-flex', gap: '6px' }}>
                {(['English', 'Shona', 'Ndebele'] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setLanguage(lang)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '4px',
                      border: language === lang ? '1px solid #176b45' : '1px solid #d9e1db',
                      background: language === lang ? '#edf4ef' : '#ffffff',
                      color: language === lang ? '#176b45' : '#5d6b63',
                      fontSize: '12px',
                      fontWeight: language === lang ? 600 : 400,
                      cursor: 'pointer',
                    }}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              id="pz-v3-desc-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              style={{
                width: '100%',
                minHeight: '108px',
                padding: '12px',
                borderRadius: '6px',
                border: '1px solid #d9e1db',
                fontFamily: 'var(--pz-font-sans)',
                fontSize: '16px',
                lineHeight: 1.5,
                color: '#202a24',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Photo upload · Live camera or gallery (83:408) */}
          <div
            data-node-id="83:408"
            style={{
              background: '#ffffff',
              border: '1px dashed #94a3b8',
              borderRadius: '6px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                flexWrap: 'wrap',
              }}
            >
              <span
                data-node-id="108:532"
                style={{
                  fontFamily: 'var(--pz-font-sans)',
                  fontSize: '15px',
                  color: '#0f172a',
                }}
              >
                Add photo or evidence (optional)
              </span>
              <button
                type="button"
                onClick={() => {
                  setIncludePhoto((prev) => !prev);
                  if (!includePhoto) setLowBandwidth(false);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#176b45',
                  fontSize: '12.5px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                {includePhoto ? 'Remove attached photo' : 'Attach sample A5 pothole photo'}
              </button>
            </div>

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />

            <div
              data-node-id="108:533"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: '12px',
              }}
            >
              <button
                type="button"
                data-node-id="108:534"
                onClick={() => cameraInputRef.current?.click()}
                style={{
                  height: '46px',
                  background: '#f1f5f9',
                  border: '1px solid #94a3b8',
                  borderRadius: '6px',
                  fontFamily: 'var(--pz-font-sans)',
                  fontWeight: 500,
                  fontSize: '13px',
                  color: '#0f172a',
                  cursor: 'pointer',
                }}
              >
                Live Camera
              </button>

              <button
                type="button"
                data-node-id="108:536"
                onClick={() => galleryInputRef.current?.click()}
                style={{
                  height: '46px',
                  background: '#f1f5f9',
                  border: '1px solid #94a3b8',
                  borderRadius: '6px',
                  fontFamily: 'var(--pz-font-sans)',
                  fontWeight: 500,
                  fontSize: '13px',
                  color: '#0f172a',
                  cursor: 'pointer',
                }}
              >
                Gallery Upload
              </button>
            </div>

            {includePhoto && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '10px',
                }}
              >
                <img
                  src={customPhotoPreview || ASSETS.citizenPhotoAndMap}
                  alt="Selected road hazard evidence"
                  style={{
                    width: '80px',
                    height: '52px',
                    objectFit: 'cover',
                    borderRadius: '4px',
                  }}
                />
                <div style={{ fontSize: '12.5px', color: '#0f172a' }}>
                  <strong>{customPhotoName || 'A5_Plumtree_Pothole_Capture.jpg'}</strong>
                  <div style={{ color: '#475569', fontSize: '11.5px' }}>
                    Ready for EXIF &amp; AI authenticity screening
                  </div>
                </div>
              </div>
            )}

            <span
              data-node-id="108:538"
              style={{
                fontFamily: 'var(--pz-font-sans)',
                fontSize: '12px',
                color: '#475569',
              }}
            >
              Only upload original media you captured. You can always report without a photo.
            </span>
          </div>

          {/* Your Content Rights & Privacy (105:591) */}
          <div
            data-node-id="105:591"
            style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <h2
              data-node-id="105:592"
              style={{
                margin: 0,
                fontFamily: 'var(--pz-font-serif)',
                fontWeight: 500,
                fontSize: '26px',
                lineHeight: 1.05,
                letterSpacing: '-0.52px',
                color: '#0f172a',
              }}
            >
              Your Content Rights &amp; Privacy
            </h2>

            <p
              data-node-id="105:593"
              style={{
                margin: 0,
                fontFamily: 'var(--pz-font-sans)',
                fontSize: '12px',
                color: '#475569',
              }}
            >
              Your photo stays yours. Choose how it may be used.
            </p>

            {/* Option 1: Safety Verification Only ($0) */}
            <button
              type="button"
              data-node-id="105:594"
              onClick={() => setLicenseTier('safety_only')}
              style={{
                textAlign: 'left',
                background: licenseTier === 'safety_only' ? '#ecfdf5' : '#ffffff',
                border:
                  licenseTier === 'safety_only' ? '1px solid #059669' : '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '5px',
                cursor: 'pointer',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--pz-font-sans)',
                  fontWeight: 500,
                  fontSize: '15px',
                  color: licenseTier === 'safety_only' ? '#047857' : '#0f172a',
                }}
              >
                {licenseTier === 'safety_only' ? '◉' : '○'} Safety Verification Only (
                <span style={{ fontFamily: 'var(--pz-font-mono)', fontSize: '12px' }}>$0</span>)
              </span>
              <span style={{ fontSize: '12px', color: '#475569' }}>
                Internal newsroom verification only; never published.
              </span>
            </button>

            {/* Option 2: Public News with Attribution ($0) */}
            <button
              type="button"
              data-node-id="105:597"
              onClick={() => setLicenseTier('free_attribution')}
              style={{
                textAlign: 'left',
                background: licenseTier === 'free_attribution' ? '#ecfdf5' : '#ffffff',
                border:
                  licenseTier === 'free_attribution' ? '1px solid #059669' : '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '5px',
                cursor: 'pointer',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--pz-font-sans)',
                  fontWeight: 500,
                  fontSize: '15px',
                  color: licenseTier === 'free_attribution' ? '#047857' : '#0f172a',
                }}
              >
                {licenseTier === 'free_attribution' ? '◉' : '○'} Public News with Attribution (
                <span style={{ fontFamily: 'var(--pz-font-mono)', fontSize: '12px' }}>$0</span>)
              </span>
              <span style={{ fontSize: '12px', color: '#475569' }}>
                Free for newsrooms to publish with your credit.
              </span>
            </button>

            {/* Option 3: Pre-Authorized Commercial Pool ($3.50 – $10.50 Payout) */}
            <button
              type="button"
              data-node-id="105:600"
              onClick={() => setLicenseTier('commercial_pool')}
              style={{
                textAlign: 'left',
                background: licenseTier === 'commercial_pool' ? '#ecfdf5' : '#ffffff',
                border:
                  licenseTier === 'commercial_pool' ? '1px solid #059669' : '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '5px',
                cursor: 'pointer',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--pz-font-sans)',
                  fontWeight: 500,
                  fontSize: '15px',
                  color: licenseTier === 'commercial_pool' ? '#047857' : '#0f172a',
                }}
              >
                {licenseTier === 'commercial_pool' ? '◉' : '○'} Pre-Authorized Commercial Pool (
                <span style={{ fontFamily: 'var(--pz-font-mono)', fontSize: '12px' }}>$3.50</span>
                {' – '}
                <span style={{ fontFamily: 'var(--pz-font-mono)', fontSize: '12px' }}>$10.50</span>
                {' Payout)'}
              </span>
              <span style={{ fontSize: '12px', color: '#475569' }}>
                Instant flat-fee licensing:{' '}
                <span style={{ fontFamily: 'var(--pz-font-mono)' }}>$3.50</span> per standard
                newsroom use, <span style={{ fontFamily: 'var(--pz-font-mono)' }}>$10.50</span> for
                a 24h exclusive. You earn 70%.
              </span>
            </button>

            {/* AI Disqualification Notice (108:539) */}
            <div
              data-node-id="108:539"
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '5px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <span style={{ fontSize: '13px', color: '#991b1b' }}>
                AI-generated or internet-scraped images are automatically detected and disqualified.
              </span>
              <span style={{ fontSize: '11px', color: '#7f1d1d' }}>
                Detection is imperfect. Mandatory human review protects contributors and newsrooms.
              </span>
            </div>

            {/* Attribution Preference (105:603 & 105:604) */}
            <span
              data-node-id="105:603"
              style={{
                fontFamily: 'var(--pz-font-sans)',
                fontWeight: 500,
                fontSize: '12px',
                color: '#334155',
              }}
            >
              Attribution preference
            </span>

            <div
              data-node-id="105:604"
              style={{
                background: '#e2e8f0',
                padding: '3px',
                borderRadius: '6px',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              }}
            >
              {(
                [
                  { key: 'full_name', label: 'Credit My Name' },
                  { key: 'handle', label: 'Use Handle' },
                  { key: 'anonymous', label: 'Stay Anonymous' },
                ] as const
              ).map((item) => {
                const active = attributionMode === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setAttributionMode(item.key)}
                    style={{
                      padding: '8px',
                      borderRadius: '6px',
                      border: 'none',
                      background: active ? '#ffffff' : 'transparent',
                      color: active ? '#0f172a' : '#475569',
                      fontFamily: 'var(--pz-font-sans)',
                      fontWeight: active ? 500 : 400,
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            <span
              data-node-id="105:611"
              style={{
                fontFamily: 'var(--pz-font-sans)',
                fontSize: '11px',
                color: '#64748b',
              }}
            >
              Preferences apply if you add media. No login needed to report.
            </span>
          </div>

          {renderLowBandwidthSwitch()}

          {/* Report Review Summary (83:418) */}
          <div
            data-node-id="83:418"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              fontSize: '14px',
            }}
          >
            <span style={{ fontWeight: 500, color: '#202a24' }}>
              Review: {activeCat.label} · {roadOrArea}
            </span>
            <span style={{ color: '#5d6b63' }}>
              Approximate location · {includePhoto ? 'Photo evidence attached' : 'Text only · No evidence added'}
            </span>
          </div>

          {/* Consent Checkbox (83:421) */}
          <label
            data-node-id="83:421"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              cursor: 'pointer',
              fontSize: '14px',
              color: '#202a24',
            }}
          >
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={(e) => setConsentChecked(e.target.checked)}
              style={{
                width: '20px',
                height: '20px',
                accentColor: '#176b45',
                marginTop: '2px',
                flexShrink: 0,
              }}
            />
            <span>
              I agree this report can be reviewed by the editorial team before any public
              publication.
            </span>
          </label>

          <p
            data-node-id="83:426"
            style={{
              margin: 0,
              fontFamily: 'var(--pz-font-sans)',
              fontSize: '14px',
              color: '#5d6b63',
            }}
          >
            Submitting does not publish an alert. The team may ask for more information.
          </p>

          {/* Form Actions (83:427) */}
          <div
            data-node-id="83:427"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '8px',
            }}
          >
            <button
              type="button"
              onClick={() => setStep(2)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#176b45',
                fontFamily: 'var(--pz-font-sans)',
                fontWeight: 500,
                fontSize: '16px',
                height: '48px',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              ← Back
            </button>

            <button
              type="submit"
              disabled={!consentChecked}
              style={{
                background: consentChecked ? '#176b45' : '#94a3b8',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                height: '48px',
                padding: '0 22px',
                fontFamily: 'var(--pz-font-sans)',
                fontWeight: 500,
                fontSize: '16px',
                cursor: consentChecked ? 'pointer' : 'not-allowed',
              }}
            >
              Submit report
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default ReportHazardView;
