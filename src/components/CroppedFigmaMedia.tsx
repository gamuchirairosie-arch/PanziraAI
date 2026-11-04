import React from 'react';
import { ASSETS } from '../assetsMap';

interface RoadPhotoProps {
  photoType: 'figma-road-damage' | 'graphic-collision-demo' | 'custom-upload';
  customPhotoDataUrl?: string;
  isGraphic: boolean;
  isRevealed?: boolean;
  onToggleReveal?: () => void;
  graphicReason?: string;
  height?: number;
  /**
   * Must be explicitly true in designated newsroom/journalist views to allow
   * temporary unblurring. Public interfaces default to false and never expose reveal controls.
   */
  allowEditorReveal?: boolean;
}

/**
 * Renders citizen-submitted evidence imagery using local assets or user uploads.
 * Enforces Panzira AI's graphic-image safety UI behavior:
 * - Public views (`allowEditorReveal = false`): flagged images are always hidden/blurred with
 *   no reveal button.
 * - Newsroom views (`allowEditorReveal = true`): flagged images default to blurred with a
 *   temporary reveal toggle for editorial review.
 */
export const EvidencePhotoFrame: React.FC<RoadPhotoProps> = ({
  photoType,
  customPhotoDataUrl,
  isGraphic,
  isRevealed = false,
  onToggleReveal,
  graphicReason,
  height = 212,
  allowEditorReveal = false,
}) => {
  // Public interfaces can never reveal restricted imagery even if isRevealed were passed
  const canRevealInWorkspace = Boolean(allowEditorReveal && onToggleReveal);
  const shouldBlur = isGraphic && (!canRevealInWorkspace || !isRevealed);

  const renderInnerImage = () => {
    if (photoType === 'custom-upload' && customPhotoDataUrl) {
      return (
        <img
          src={customPhotoDataUrl}
          alt="Submitted road hazard attachment"
          style={{
            width: '100%',
            height: `${height}px`,
            objectFit: 'cover',
            display: 'block',
          }}
        />
      );
    }

    if (photoType === 'graphic-collision-demo') {
      return (
        <svg
          viewBox="0 0 420 200"
          preserveAspectRatio="xMidYMid slice"
          style={{ width: '100%', height: `${height}px`, display: 'block' }}
          role="img"
          aria-label="Restricted roadside collision attachment"
        >
          <image
            href={ASSETS.citizenPhotoAndMap}
            x="-1998"
            y="-634"
            width="2872"
            height="1616"
          />
          <rect x="0" y="0" width="420" height="200" fill="rgba(181, 61, 56, 0.16)" />
        </svg>
      );
    }

    return (
      <svg
        viewBox="0 0 416 196"
        preserveAspectRatio="xMidYMid slice"
        style={{ width: '100%', height: `${height}px`, display: 'block' }}
        role="img"
        aria-label="Citizen photograph showing potholes on highway with commuter omnibus"
      >
        <image
          href={ASSETS.citizenPhotoAndMap}
          x="-1994"
          y="-632"
          width="2872"
          height="1616"
        />
      </svg>
    );
  };

  if (!isGraphic) {
    return (
      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          border: '1px solid var(--pz-border)',
          borderRadius: '6px',
          overflow: 'hidden',
          background: 'var(--pz-pale)',
        }}
      >
        {renderInnerImage()}
      </div>
    );
  }

  return (
    <div className="pz-graphic-gate" style={{ maxWidth: '480px', width: '100%' }}>
      <div className={shouldBlur ? 'pz-graphic-blurred' : undefined}>{renderInnerImage()}</div>

      {shouldBlur ? (
        <div className="pz-graphic-overlay">
          <span
            style={{
              background: '#b53d38',
              color: '#ffffff',
              fontSize: '11.5px',
              fontWeight: 600,
              padding: '3px 8px',
              borderRadius: '4px',
            }}
          >
            {canRevealInWorkspace
              ? 'Graphic imagery blurred'
              : 'Restricted image preview hidden'}
          </span>

          <p style={{ fontWeight: 600, fontSize: '15px', color: '#ffffff', lineHeight: 1.35 }}>
            {canRevealInWorkspace
              ? 'Potentially distressing collision or crash imagery is blurred by default'
              : 'Flagged road-incident attachment hidden on public form'}
          </p>

          <p style={{ fontSize: '12.5px', color: '#e6ebe7', maxWidth: '430px', lineHeight: 1.45 }}>
            {canRevealInWorkspace
              ? graphicReason ||
                'Blurred in this newsroom demo workspace to prevent accidental exposure, and excluded from all public views. Production access control requires server-side authentication.'
              : 'Your attachment is marked as potentially distressing and will remain blurred for newsroom verification. Flagged collision images are never displayed on the public dashboard.'}
          </p>

          {canRevealInWorkspace && onToggleReveal && (
            <button
              type="button"
              onClick={onToggleReveal}
              style={{
                marginTop: '4px',
                background: '#ffffff',
                color: '#202a24',
                border: '1px solid #dce2dc',
                borderRadius: '4px',
                padding: '8px 12px',
                fontSize: '12.5px',
                fontWeight: 600,
                minHeight: '36px',
              }}
            >
              Temporarily unblur in newsroom workspace
            </button>
          )}
        </div>
      ) : (
        <div className="pz-graphic-banner-revealed">
          <div style={{ fontSize: '12px', color: 'var(--pz-red)', fontWeight: 600 }}>
            Temporary newsroom preview active · Excluded from public dashboard
          </div>
          {canRevealInWorkspace && onToggleReveal && (
            <button
              type="button"
              onClick={onToggleReveal}
              className="pz-btn-secondary"
              style={{ minHeight: '34px', padding: '4px 10px', fontSize: '12px' }}
            >
              Re-apply blur
            </button>
          )}
        </div>
      )}
    </div>
  );
};
