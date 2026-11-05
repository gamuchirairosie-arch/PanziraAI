import React, { useMemo, useState } from 'react';
import { ASSETS } from '../assetsMap';
import { CorridorContextMap } from '../components/BulawayoMap';
import { EvidencePhotoFrame } from '../components/CroppedFigmaMedia';
import { usePanzira } from '../context/PanziraContext';
import { HazardCategoryKey, SignalReport } from '../types';
import {
  toLocalDateTimeInputValue,
  validateObservedDateTime,
} from '../utils/dateTime';

interface CategoryChoice {
  key: HazardCategoryKey;
  label: string;
  description: string;
  icon: string;
}

const CATEGORY_OPTIONS: CategoryChoice[] = [
  {
    key: 'potholes',
    label: 'Road surface damage',
    description: 'Large potholes, washed-out shoulders, deep trenches or collapsed road edges',
    icon: ASSETS.catRoadDamage,
  },
  {
    key: 'flooding',
    label: 'Flooding',
    description: 'Standing water across lanes, blocked storm drains or flooded low bridges',
    icon: ASSETS.catFlooding,
  },
  {
    key: 'collisions',
    label: 'Collision or breakdown',
    description: 'Crash blocking traffic, stationary heavy truck or spilled cargo',
    icon: ASSETS.catCollision,
  },
  {
    key: 'visibility',
    label: 'Visibility & lighting',
    description: 'Failed street lighting, missing warning signs, smoke or unlit roadworks',
    icon: ASSETS.catVisibility,
  },
  {
    key: 'other',
    label: 'Other road hazard',
    description: 'Fallen trees, stray livestock on highway corridor, or damaged barriers',
    icon: ASSETS.catOther,
  },
];

export const ReportHazardView: React.FC = () => {
  const { submitCitizenReport, navigatePublic, navigateNewsroom } = usePanzira();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [categoryKey, setCategoryKey] = useState<HazardCategoryKey>('potholes');
  const [roadArea, setRoadArea] = useState<string>('');
  const [landmark, setLandmark] = useState<string>('');
  const [language, setLanguage] = useState<'English' | 'Shona' | 'Ndebele'>('English');
  const [description, setDescription] = useState<string>('');
  const [deviceLocation, setDeviceLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  // Initialize observed date/time to current local browser time
  const [observedDateTimeInput, setObservedDateTimeInput] = useState<string>(() =>
    toLocalDateTimeInputValue(new Date())
  );
  const [dateFieldError, setDateFieldError] = useState<string | null>(null);
  const [evidenceLink, setEvidenceLink] = useState<string>('');

  const [photoType, setPhotoType] = useState<'none' | 'figma-road-damage' | 'custom-upload'>('none');
  const [customPhotoDataUrl, setCustomPhotoDataUrl] = useState<string | undefined>(undefined);
  const [photoFilename, setPhotoFilename] = useState<string | undefined>(undefined);
  const [containsGraphicContent, setContainsGraphicContent] = useState<boolean>(false);

  const [consentChecked, setConsentChecked] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submittedReceipt, setSubmittedReceipt] = useState<SignalReport | null>(null);

  const selectedCategoryObj =
    CATEGORY_OPTIONS.find((c) => c.key === categoryKey) || CATEGORY_OPTIONS[0];

  const validatedDateResult = useMemo(
    () => validateObservedDateTime(observedDateTimeInput),
    [observedDateTimeInput]
  );

  const handleSelectCategory = (key: HazardCategoryKey) => {
    setCategoryKey(key);
    if (key === 'collisions') {
      setContainsGraphicContent(true);
    }
    setValidationError(null);
  };

  const handleDeviceLocation = () => {
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError('This browser does not provide device location. You can still submit the road and landmark.');
      return;
    }
    if (!window.isSecureContext) {
      setLocationError('Device location requires a secure HTTPS page. You can still submit the road and landmark.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDeviceLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setLocating(false);
      },
      (error) => {
        setLocationError(error.code === error.PERMISSION_DENIED
          ? 'Location permission was declined. You can still submit the road and landmark.'
          : 'Could not get a device location. You can still submit the road and landmark.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  };

  const handleDateTimeChange = (nextVal: string) => {
    setObservedDateTimeInput(nextVal);
    const check = validateObservedDateTime(nextVal);
    setDateFieldError(check.valid ? null : check.error || 'Enter a valid observed date and time.');
    if (check.valid) {
      setValidationError(null);
    }
  };

  const handleAdvanceToStep3 = () => {
    if (!roadArea.trim()) {
      setValidationError('Please enter the road or area name (for example, Khami Road or A5).');
      return;
    }
    if (!landmark.trim()) {
      setValidationError(
        'Please provide a nearby landmark, turn-off, or junction so editors can locate the hazard.'
      );
      return;
    }

    const dateCheck = validateObservedDateTime(observedDateTimeInput);
    if (!dateCheck.valid) {
      const msg = dateCheck.error || 'Please enter a valid non-future observed date and time.';
      setDateFieldError(msg);
      setValidationError(msg);
      return;
    }

    if (description.trim().length < 12) {
      setValidationError(
        'Please describe what you observed in at least 12 characters so the verification desk can assess it.'
      );
      return;
    }

    setDateFieldError(null);
    setValidationError(null);
    setStep(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoType('custom-upload');
        setCustomPhotoDataUrl(reader.result);
        setPhotoFilename(file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFinalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const dateCheck = validateObservedDateTime(observedDateTimeInput);
    if (!dateCheck.valid || !dateCheck.normalizedReadable) {
      const msg = dateCheck.error || 'Observed date and time is invalid.';
      setDateFieldError(msg);
      setValidationError(msg);
      setStep(2);
      return;
    }

    if (!consentChecked) {
      setValidationError(
        'Please confirm that you understand reports require human verification before publication.'
      );
      return;
    }
    setValidationError(null);
    setIsSubmitting(true);

    try {
      const created = submitCitizenReport({
        categoryKey,
        categoryLabel: selectedCategoryObj.label,
        roadArea: roadArea.trim(),
        landmark: landmark.trim(),
        description: description.trim(),
        reportedDateTime: dateCheck.normalizedReadable,
        observedIso: dateCheck.isoString,
        evidenceLink: evidenceLink.trim() || undefined,
        language,
        photoType,
        customPhotoDataUrl,
        photoFilename,
        containsGraphicContent,
        reportedLat: deviceLocation?.lat,
        reportedLng: deviceLocation?.lng,
      });

      setSubmittedReceipt(created);
      setStep(4);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================================================================
  // STEP 4: SUBMISSION CONFIRMATION RECEIPT
  // =========================================================================
  if (step === 4 && submittedReceipt) {
    return (
      <div className="pz-report-container" style={{ maxWidth: '720px' }}>
        <div className="pz-card-panel" style={{ padding: '26px', gap: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '6px',
                background: 'var(--pz-active-surface)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <img src={ASSETS.receiptInbox} alt="" style={{ width: '24px', height: '24px' }} />
            </div>
            <div>
              <span className="pz-badge pz-badge-amber">
                Pending editorial review · Not published publicly
              </span>
              <h1 className="pz-page-title" style={{ marginTop: '6px', fontSize: '26px' }}>
                Demo report received for verification
              </h1>
            </div>
          </div>

          <p style={{ fontSize: '14.5px', color: 'var(--pz-muted)' }}>
            Thank you. Your report has been queued in the Panzira AI Bulawayo newsroom inbox.
            Automated intake structures incoming submissions to assist journalists, and{' '}
            <strong>never automatically publishes road warnings</strong>.
          </p>

          <div
            className="pz-notice-box"
            style={{
              border: '1px solid var(--pz-border)',
              borderRadius: '6px',
              padding: '16px',
              gap: '6px',
            }}
          >
            <div className="pz-field-label">Submission reference</div>
            <div
              style={{
                fontSize: '24px',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: 'var(--pz-primary-green)',
              }}
            >
              {submittedReceipt.id}
            </div>
            <div style={{ fontSize: '14px', color: 'var(--pz-text)' }}>
              <strong>{submittedReceipt.categoryLabel}</strong> · {submittedReceipt.roadArea} (
              {submittedReceipt.landmark})
            </div>
            <div style={{ fontSize: '13px', color: 'var(--pz-muted)' }}>
              Observed: {submittedReceipt.reportedDateTime} · Status: Unverified lead (0 of 4
              editorial checks completed)
              {submittedReceipt.isGraphicImage
                ? ' · Flagged attachment kept hidden from public display'
                : ''}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h2 className="pz-subsection-heading">What happens next</h2>
            <div style={{ fontSize: '14px', color: 'var(--pz-text)', display: 'grid', gap: '6px' }}>
              <div>
                <strong>1. Intake structuring:</strong> Extracts road name, hazard category, and
                draft translation if submitted in Shona or Ndebele.
              </div>
              <div>
                <strong>2. Human corroboration:</strong> Editors check landmark accuracy, media
                recency, and independent witnesses.
              </div>
              <div>
                <strong>3. Editor approval gate:</strong> Only after all 4 checks pass can an editor
                publish a verified alert to the Bulawayo map.
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px',
              marginTop: '6px',
            }}
          >
            <button
              type="button"
              className="pz-btn-primary"
              onClick={() => navigateNewsroom('verify', submittedReceipt.id)}
            >
              View in demo newsroom ({submittedReceipt.id}) →
            </button>
            <button
              type="button"
              className="pz-btn-secondary"
              onClick={() => navigatePublic('my-reports')}
            >
              Track in My Reports
            </button>
            <button
              type="button"
              className="pz-btn-secondary"
              onClick={() => navigatePublic('overview')}
            >
              Return to overview
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pz-report-container">
      {/* Back link & Step Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <button
            type="button"
            onClick={() =>
              step === 1 ? navigatePublic('overview') : setStep((s) => (s - 1) as 1 | 2)
            }
            style={{
              background: 'transparent',
              border: 'none',
              padding: '4px 0',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: 'var(--pz-primary-green)',
              fontWeight: 600,
              fontSize: '13.5px',
            }}
          >
            <img src={ASSETS.arrowLeft} alt="" style={{ width: '16px', height: '16px' }} />
            <span>{step === 1 ? 'Back to Bulawayo overview' : 'Previous step'}</span>
          </button>

          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--pz-muted)' }}>
            Step {step} of 3
          </span>
        </div>

        <div className="pz-progress-track" aria-label={`Reporting step ${step} of 3`}>
          <div className={`pz-progress-seg ${step >= 1 ? 'is-filled' : ''}`} />
          <div className={`pz-progress-seg ${step >= 2 ? 'is-filled' : ''}`} />
          <div className={`pz-progress-seg ${step >= 3 ? 'is-filled' : ''}`} />
        </div>
      </div>

      {/* Explicit Verification Requirement Notice */}
      <div className="pz-notice-box-bordered">
        <p style={{ fontSize: '13.5px', color: 'var(--pz-text)' }}>
          <strong>Verification required before publication:</strong> Citizen reports enter our
          newsroom inbox as unverified leads and are never auto-published by AI. In a
          life-threatening emergency, contact Zimbabwe Republic Police or ambulance services
          directly.
        </p>
      </div>

      <div className="pz-report-split">
        {/* =================================================================
            LEFT COLUMN: ACTIVE WIZARD STEP
            ================================================================= */}
        <form
          onSubmit={handleFinalSubmit}
          noValidate
          style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
        >
          {validationError && (
            <div
              className="pz-missing-panel"
              role="alert"
              style={{ borderColor: 'var(--pz-red)' }}
            >
              <strong style={{ color: 'var(--pz-red)', fontSize: '13.5px' }}>
                Please check your submission:
              </strong>
              <span style={{ fontSize: '13.5px', color: 'var(--pz-text)' }}>{validationError}</span>
            </div>
          )}

          {/* STEP 1: HAZARD CATEGORY */}
          {step === 1 && (
            <>
              <div>
                <h1 className="pz-page-title">Report a road hazard</h1>
                <p className="pz-page-subtitle">
                  What kind of road condition did you observe? Choose the closest category.
                </p>
              </div>

              <div
                role="radiogroup"
                aria-label="Hazard category"
                style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
              >
                {CATEGORY_OPTIONS.map((opt) => {
                  const selected = categoryKey === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={`pz-category-option ${selected ? 'is-selected' : ''}`}
                      onClick={() => handleSelectCategory(opt.key)}
                    >
                      <img
                        src={opt.icon}
                        alt=""
                        style={{ width: '24px', height: '24px', flexShrink: 0 }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '15.5px', color: 'var(--pz-text)' }}>
                          {opt.label}
                        </div>
                        <div style={{ fontSize: '13.5px', color: 'var(--pz-muted)', marginTop: '2px' }}>
                          {opt.description}
                        </div>
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

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                  marginTop: '6px',
                  flexWrap: 'wrap',
                }}
              >
                <button
                  type="button"
                  className="pz-btn-secondary"
                  onClick={() => navigatePublic('overview')}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="pz-btn-primary"
                  onClick={() => {
                    setStep(2);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  Next: location & details →
                </button>
              </div>
            </>
          )}

          {/* STEP 2: LOCATION, VALIDATED DATE/TIME, DESCRIPTION & SOURCE LINK */}
          {step === 2 && (
            <>
              <div>
                <h1 className="pz-page-title">Where and what happened?</h1>
                <p className="pz-page-subtitle">
                  Include a specific landmark or turn-off so Bulawayo editors can verify the exact
                  segment.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '8px',
                    flexWrap: 'wrap',
                  }}
                >
                  <label htmlFor="pz-road-input" style={{ fontWeight: 600, fontSize: '13.5px' }}>
                    Road or corridor *
                  </label>
                  <button
                    type="button"
                    className="pz-portal-link-btn"
                    style={{ height: '34px', fontSize: '12px' }}
                    onClick={handleDeviceLocation}
                    disabled={locating}
                  >
                    <img src={ASSETS.locateFixed} alt="" style={{ width: '14px', height: '14px' }} />
                    <span>{locating ? 'Finding location…' : deviceLocation ? 'Refresh my location' : 'Use my location (optional)'}</span>
                  </button>
                </div>
                <input
                  id="pz-road-input"
                  className="pz-input"
                  type="text"
                  value={roadArea}
                  onChange={(e) => setRoadArea(e.target.value)}
                  placeholder="e.g. A5 Bulawayo–Plumtree Road, Khami Road, 12th Avenue"
                />
                <p className="pz-page-subtitle" role={locationError ? 'alert' : 'status'}>
                  {locationError || (deviceLocation
                    ? `Location captured with about ${Math.round(deviceLocation.accuracy)} m accuracy. Shared with newsroom editors to locate this report.`
                    : 'Your browser asks permission before sharing location. Coordinates are optional and are not shown on the public map.')}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                  {[
                    'A5 Bulawayo–Plumtree Road',
                    'Khami Road, Mzilikazi',
                    'Lobengula St & 12th Ave',
                    'Esigodini Road (A7)',
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setRoadArea(preset)}
                      style={{
                        background: 'var(--pz-pale)',
                        border: '1px solid var(--pz-border)',
                        borderRadius: '4px',
                        padding: '5px 9px',
                        fontSize: '12px',
                        color: 'var(--pz-text)',
                      }}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label htmlFor="pz-landmark-input" style={{ fontWeight: 600, fontSize: '13.5px' }}>
                  Exact landmark, junction, or kilometre peg *
                </label>
                <input
                  id="pz-landmark-input"
                  className="pz-input"
                  type="text"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  placeholder="e.g. 400m past Plumtree turn-off, city-bound lane"
                />
              </div>

              <CorridorContextMap
                mode="report-preview"
                landmarkLabel={landmark || roadArea || 'Bulawayo corridor preview'}
                height={200}
              />

              <div className="pz-extract-2col">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label htmlFor="pz-lang-select" style={{ fontWeight: 600, fontSize: '13.5px' }}>
                    Report language
                  </label>
                  <select
                    id="pz-lang-select"
                    className="pz-select"
                    value={language}
                    onChange={(e) =>
                      setLanguage(e.target.value as 'English' | 'Shona' | 'Ndebele')
                    }
                  >
                    <option value="English">English</option>
                    <option value="Shona">Shona (ChiShona)</option>
                    <option value="Ndebele">Ndebele (IsiNdebele)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label htmlFor="pz-time-input" style={{ fontWeight: 600, fontSize: '13.5px' }}>
                    Observed date & time *
                  </label>
                  <input
                    id="pz-time-input"
                    className={`pz-input ${dateFieldError ? 'is-invalid' : ''}`}
                    type="datetime-local"
                    value={observedDateTimeInput}
                    max={toLocalDateTimeInputValue(new Date())}
                    min="2020-01-01T00:00"
                    aria-invalid={Boolean(dateFieldError)}
                    aria-describedby="pz-time-help"
                    onChange={(e) => handleDateTimeChange(e.target.value)}
                  />
                  <span
                    id="pz-time-help"
                    style={{
                      fontSize: '12px',
                      color: dateFieldError ? 'var(--pz-red)' : 'var(--pz-muted)',
                      fontWeight: dateFieldError ? 600 : 400,
                    }}
                  >
                    {dateFieldError
                      ? dateFieldError
                      : validatedDateResult.normalizedReadable
                        ? `Recorded as ${validatedDateResult.normalizedReadable} (local time)`
                        : 'Select the date and time you observed the hazard (cannot be in the future).'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label htmlFor="pz-desc-input" style={{ fontWeight: 600, fontSize: '13.5px' }}>
                  Hazard description *
                </label>
                <textarea
                  id="pz-desc-input"
                  className="pz-textarea"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={
                    language === 'Shona'
                      ? 'e.g. Pane gomba guru pakati pemugwagwa pedyo nePlumtree turn-off...'
                      : 'Describe the road hazard, which lane is affected, and whether vehicles are swerving or blocked...'
                  }
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label htmlFor="pz-link-input" style={{ fontWeight: 600, fontSize: '13.5px' }}>
                  Public source or evidence link (optional)
                </label>
                <input
                  id="pz-link-input"
                  className="pz-input"
                  type="url"
                  value={evidenceLink}
                  onChange={(e) => setEvidenceLink(e.target.value)}
                  placeholder="https://... (optional public post or council notice URL)"
                />
                <span style={{ fontSize: '12px', color: 'var(--pz-muted)' }}>
                  Only share publicly accessible links. Panzira AI never scrapes private WhatsApp
                  groups.
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}
              >
                <button
                  type="button"
                  className="pz-btn-secondary"
                  onClick={() => setStep(1)}
                >
                  ← Back
                </button>
                <button
                  type="button"
                  className="pz-btn-primary"
                  onClick={handleAdvanceToStep3}
                >
                  Next: optional photo & consent →
                </button>
              </div>
            </>
          )}

          {/* STEP 3: OPTIONAL IMAGE (PUBLIC-SAFE, NO REVEAL CONTROLS) & CONSENT */}
          {step === 3 && (
            <>
              <div>
                <h1 className="pz-page-title">Optional photo & review</h1>
                <p className="pz-page-subtitle">
                  Photos help editors verify landmarks, while text-only submissions work cleanly on
                  low-data connections.
                </p>
              </div>

              {/* Photo Attachment Controls */}
              <div className="pz-card-panel">
                <div style={{ fontWeight: 600, fontSize: '14.5px' }}>
                  Optional photograph (never take photos while driving)
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  <label
                    className="pz-btn-secondary"
                    style={{ minHeight: '40px', fontSize: '13px', cursor: 'pointer' }}
                  >
                    <span>Upload image file…</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      style={{ display: 'none' }}
                    />
                  </label>

                  <button
                    type="button"
                    className={`pz-btn-tonal ${photoType === 'figma-road-damage' ? 'is-active' : ''
                      }`}
                    style={{ minHeight: '40px', fontSize: '13px' }}
                    onClick={() => {
                      setPhotoType('figma-road-damage');
                      setPhotoFilename('bulawayo-road-damage-demo.jpg');
                      setCustomPhotoDataUrl(undefined);
                    }}
                  >
                    Attach demo pothole photo
                  </button>

                  <button
                    type="button"
                    className="pz-btn-secondary"
                    style={{ minHeight: '40px', fontSize: '13px' }}
                    onClick={() => {
                      setPhotoType('none');
                      setPhotoFilename(undefined);
                      setCustomPhotoDataUrl(undefined);
                    }}
                  >
                    No photo (low-bandwidth)
                  </button>
                </div>

                {photoType !== 'none' && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      marginTop: '6px',
                    }}
                  >
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                        fontSize: '13.5px',
                        cursor: 'pointer',
                        background: 'var(--pz-missing-bg)',
                        padding: '10px 12px',
                        borderRadius: '4px',
                        border: '1px solid var(--pz-border)',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={containsGraphicContent || categoryKey === 'collisions'}
                        disabled={categoryKey === 'collisions'}
                        onChange={(e) => setContainsGraphicContent(e.target.checked)}
                        style={{ marginTop: '3px' }}
                      />
                      <span>
                        <strong>Graphic-image safety notice:</strong>{' '}
                        {categoryKey === 'collisions'
                          ? 'Collision attachments are automatically flagged as potentially distressing, hidden here, blurred in the newsroom workspace, and never shown publicly.'
                          : 'Mark if this photo shows a vehicle crash, injured people, or distressing scene (keeps image hidden here and excluded from public display).'}
                      </span>
                    </label>

                    {/* Public-safe preview: allowEditorReveal is strictly false */}
                    <EvidencePhotoFrame
                      photoType={photoType}
                      customPhotoDataUrl={customPhotoDataUrl}
                      isGraphic={containsGraphicContent || categoryKey === 'collisions'}
                      isRevealed={false}
                      allowEditorReveal={false}
                      height={180}
                    />
                  </div>
                )}
              </div>

              {/* Submission Summary */}
              <div
                className="pz-notice-box"
                style={{ borderRadius: '6px', gap: '8px', padding: '16px' }}
              >
                <div className="pz-field-label">Review your report</div>
                <div style={{ fontSize: '14px' }}>
                  <strong>Category:</strong> {selectedCategoryObj.label}
                </div>
                <div style={{ fontSize: '14px' }}>
                  <strong>Location:</strong> {roadArea} · {landmark}
                </div>
                <div style={{ fontSize: '14px' }}>
                  <strong>Observed:</strong>{' '}
                  {validatedDateResult.normalizedReadable || observedDateTimeInput} ({language})
                </div>
                <div style={{ fontSize: '14px' }}>
                  <strong>Description:</strong> “{description}”
                </div>
                <div style={{ fontSize: '14px' }}>
                  <strong>Attachment:</strong>{' '}
                  {photoType === 'none'
                    ? 'None (low-bandwidth text report)'
                    : `${photoFilename || 'Attached photo'}${containsGraphicContent || categoryKey === 'collisions'
                      ? ' (flagged as restricted — hidden on public views)'
                      : ''
                    }`}
                </div>
              </div>

              {/* Consent Checkbox */}
              <label
                className="pz-checklist-row"
                style={{
                  border: '1px solid var(--pz-border)',
                  padding: '12px',
                  background: consentChecked ? 'var(--pz-active-surface)' : 'var(--pz-white)',
                }}
              >
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => {
                    setConsentChecked(e.target.checked);
                    if (e.target.checked) setValidationError(null);
                  }}
                  style={{ width: '18px', height: '18px', marginTop: '2px', flexShrink: 0 }}
                />
                <span style={{ fontSize: '13.5px', color: 'var(--pz-text)' }}>
                  I confirm this opt-in report is submitted for editorial verification in the
                  Panzira AI demo. I understand it requires human corroboration and will{' '}
                  <strong>not</strong> be auto-published. *
                </span>
              </label>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}
              >
                <button
                  type="button"
                  className="pz-btn-secondary"
                  onClick={() => setStep(2)}
                >
                  ← Edit details
                </button>
                <button type="submit" className="pz-btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting report...' : 'Submit demo report for verification'}
                </button>
              </div>
            </>
          )}
        </form>

        {/* =================================================================
            RIGHT COLUMN: REPORTING GUIDANCE PANEL
            ================================================================= */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="pz-card-panel">
            <h2 className="pz-card-title">Your report starts a review</h2>
            <p style={{ fontSize: '13.5px', color: 'var(--pz-muted)' }}>
              Submissions go straight into the Panzira AI Signal Monitor and Journalist Inbox.
              Automated structuring helps translate Shona/Ndebele reports and group nearby corridor
              mentions, while human editors make every verification decision.
            </p>
          </div>

          <div className="pz-cream-panel">
            <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--pz-text)' }}>
              Graphic-image & privacy safeguards
            </div>
            <p style={{ fontSize: '13px', color: 'var(--pz-muted)' }}>
              • Crash scenes and distressing photographs are kept hidden on public forms, blurred in
              the newsroom workspace, and never shown on the public map.
              <br />• Contributor phone numbers and identities are withheld from public alerts.
              <br />• Low-bandwidth text reports carry full weight when corroborated.
            </p>
          </div>

          <div className="pz-missing-panel">
            <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--pz-red)' }}>
              Not an emergency dispatch service
            </div>
            <p style={{ fontSize: '13px', color: 'var(--pz-text)' }}>
              Never stop in an active highway lane to photograph a hazard. Alert emergency
              responders first if anyone is injured.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
};
