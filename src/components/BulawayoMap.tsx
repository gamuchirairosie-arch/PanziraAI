import React, { useState } from 'react';
import { ASSETS } from '../assetsMap';
import { HazardCategoryKey, VerifiedPublicAlert } from '../types';
import { RealLeafletMap } from './RealLeafletMap';

/**
 * Neutral cartographic basemap of Greater Bulawayo (CBD, arterial highways, suburbs, and
 * watercourses) with zero baked-in incident markers. All hazard markers are rendered
 * dynamically from application data so filters and search control 100% of visible pins.
 */
const BulawayoNeutralBasemap: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  return (
    <svg
      viewBox="0 0 1000 540"
      preserveAspectRatio="xMidYMid slice"
      style={{ width: '100%', height: '100%', display: 'block' }}
      role="img"
      aria-label="Neutral street and arterial corridor basemap of Bulawayo"
    >
      {/* Base terrain */}
      <rect x="0" y="0" width="1000" height="540" fill="#f2f4f0" />

      {/* Greenbelt & park reserves (Centenary Park, Hillside Dams, Khami open belt) */}
      <polygon points="565,215 645,205 660,268 575,278" fill="#e1ece2" />
      <polygon points="650,385 770,370 805,465 675,480" fill="#e1ece2" />
      <polygon points="40,150 165,135 185,235 55,255" fill="#e6eee6" />

      {/* Urban built-up residential & industrial sectors */}
      <polygon points="415,190 585,190 595,345 415,345" fill="#e8ece7" />
      <polygon points="210,165 395,180 390,295 195,280" fill="#eaeeea" />
      <polygon points="420,65 595,60 605,175 425,180" fill="#eaeeea" />
      <polygon points="610,75 790,90 780,205 605,195" fill="#eaeeea" />
      <polygon points="180,340 405,345 395,485 160,475" fill="#eaeeea" />

      {/* Watercourses (Matsheumhlope stream & Khami tributary) */}
      <path
        d="M 605 20 C 618 115, 635 205, 668 305 C 692 380, 725 455, 760 540"
        fill="none"
        stroke="#d5e5ed"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M 0 185 C 85 195, 145 215, 205 255"
        fill="none"
        stroke="#d5e5ed"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <ellipse cx="722" cy="428" rx="28" ry="15" fill="#cde0ea" />

      {/* Secondary local road network & CBD grid */}
      <g stroke="#ffffff" strokeWidth="2.2" fill="none">
        {/* CBD North-South avenues */}
        <line x1="435" y1="150" x2="435" y2="375" />
        <line x1="468" y1="140" x2="468" y2="380" />
        <line x1="502" y1="135" x2="502" y2="385" />
        <line x1="536" y1="145" x2="536" y2="380" />
        <line x1="570" y1="155" x2="570" y2="375" />

        {/* CBD East-West streets */}
        <line x1="395" y1="205" x2="625" y2="205" />
        <line x1="390" y1="235" x2="635" y2="235" />
        <line x1="385" y1="265" x2="645" y2="265" />
        <line x1="385" y1="295" x2="650" y2="295" />
        <line x1="390" y1="325" x2="645" y2="325" />

        {/* Western suburb connectors (Mzilikazi, Mpopoma, Njube, Pumula, Nkulumane) */}
        <path d="M 110 215 L 405 215" />
        <path d="M 95 285 L 395 285" />
        <path d="M 245 140 L 245 465" />
        <path d="M 325 145 L 325 480" />
        <path d="M 165 360 L 420 360" />
        <path d="M 140 430 L 395 430" />

        {/* Northern & Eastern connectors (North End, Matshobana, Suburbs, Hillside) */}
        <path d="M 380 115 L 765 115" />
        <path d="M 635 90 L 635 390" />
        <path d="M 715 100 L 715 445" />
        <path d="M 575 375 L 845 375" />
      </g>

      {/* Subtle railway alignment */}
      <path
        d="M 0 330 Q 250 322 430 335 T 890 220"
        fill="none"
        stroke="#cbd3cb"
        strokeWidth="2"
        strokeDasharray="6 5"
      />

      {/* Major Arterial Corridors (Casing) */}
      <g stroke="#d7c58b" strokeWidth="8.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {/* A5 Bulawayo–Plumtree Road (SW from CBD) */}
        <path d="M 468 312 L 335 372 L 175 448 L 15 518" />
        {/* Khami Road (West from CBD via Mzilikazi) */}
        <path d="M 435 265 L 275 236 L 125 224 L 0 216" />
        {/* Joshua Mqabuko Nkomo St / Airport Corridor (North) */}
        <path d="M 482 310 L 482 130 L 465 0" />
        {/* A6 Leopold Takawira Ave / Harare Rd (NE via Matshobana) */}
        <path d="M 536 250 L 690 142 L 885 38 L 965 0" />
        {/* Lobengula St & 12th Ave Spine + A7 Esigodini Rd (SE) */}
        <path d="M 435 308 L 575 308 L 735 378 L 915 478 L 1000 520" />
        {/* Hillside Rd (South-East) */}
        <path d="M 555 312 L 685 392 L 755 540" />
        {/* Hyde Park Rd (West-SW commuter link) */}
        <path d="M 335 372 L 330 432 L 210 462 L 40 472" />
      </g>

      {/* Major Arterial Corridors (Inner fill) */}
      <g stroke="#f7e9bc" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M 468 312 L 335 372 L 175 448 L 15 518" />
        <path d="M 435 265 L 275 236 L 125 224 L 0 216" />
        <path d="M 482 310 L 482 130 L 465 0" />
        <path d="M 536 250 L 690 142 L 885 38 L 965 0" />
        <path d="M 435 308 L 575 308 L 735 378 L 915 478 L 1000 520" />
        <path d="M 555 312 L 685 392 L 755 540" />
        <path d="M 335 372 L 330 432 L 210 462 L 40 472" />
      </g>

      {/* Highway Route Shields (Neutral geographic route identifiers, not incident markers) */}
      <g fontFamily="Public Sans, system-ui, sans-serif" fontWeight="700" fontSize="11">
        <rect x="122" y="446" width="32" height="20" rx="3" fill="#ffffff" stroke="#8a968e" />
        <text x="138" y="460" textAnchor="middle" fill="#2f3b34">
          A5
        </text>

        <rect x="782" y="82" width="32" height="20" rx="3" fill="#ffffff" stroke="#8a968e" />
        <text x="798" y="96" textAnchor="middle" fill="#2f3b34">
          A6
        </text>

        <rect x="852" y="440" width="32" height="20" rx="3" fill="#ffffff" stroke="#8a968e" />
        <text x="868" y="454" textAnchor="middle" fill="#2f3b34">
          A7
        </text>
      </g>

      {/* Suburb, Corridor & City Labels */}
      <g
        fontFamily="Public Sans, system-ui, sans-serif"
        fill="#536058"
        style={{ pointerEvents: 'none' }}
      >
        <text
          x="502"
          y="274"
          textAnchor="middle"
          fontSize={compact ? '18' : '16'}
          fontWeight="700"
          fill="#202a24"
        >
          Bulawayo CBD
        </text>

        <text x="480" y="96" textAnchor="middle" fontSize="12" fontWeight="600">
          North End
        </text>
        <text x="695" y="124" textAnchor="middle" fontSize="12" fontWeight="600">
          Matshobana
        </text>
        <text x="275" y="205" textAnchor="middle" fontSize="12" fontWeight="600">
          Mzilikazi
        </text>
        <text x="165" y="182" textAnchor="middle" fontSize="11.5" fontWeight="500">
          Mpopoma
        </text>
        <text x="112" y="308" textAnchor="middle" fontSize="11.5" fontWeight="500">
          Njube
        </text>
        <text x="650" y="294" textAnchor="middle" fontSize="12" fontWeight="600">
          Suburbs
        </text>
        <text x="720" y="408" textAnchor="middle" fontSize="12" fontWeight="600">
          Hillside
        </text>
        <text x="285" y="458" textAnchor="middle" fontSize="12" fontWeight="600">
          Nkulumane
        </text>
        <text x="830" y="366" textAnchor="middle" fontSize="11.5" fontWeight="500">
          Four Winds
        </text>

        {/* Road corridor labels */}
        <text x="190" y="250" fontSize="11" fontWeight="600" fill="#46524b">
          Khami Rd
        </text>
        <text x="235" y="410" fontSize="11" fontWeight="600" fill="#46524b">
          A5 Plumtree Rd
        </text>
        <text x="580" y="330" fontSize="11" fontWeight="600" fill="#46524b">
          12th Ave / Lobengula St
        </text>
        <text x="760" y="424" fontSize="11" fontWeight="600" fill="#46524b">
          Esigodini Rd
        </text>
      </g>
    </svg>
  );
};

/**
 * Renders a crisp category-specific SVG glyph inside dynamic map pins.
 */
const CategoryPinGlyph: React.FC<{ category: HazardCategoryKey }> = ({ category }) => {
  if (category === 'collisions') {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 17h14v-5l-2-5H7l-2 5v5Z" />
        <circle cx="7.5" cy="17.5" r="1.5" />
        <circle cx="16.5" cy="17.5" r="1.5" />
      </svg>
    );
  }
  if (category === 'flooding') {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 10c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
        <path d="M2 16c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
      </svg>
    );
  }
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m10.29 3.86-8.17 14.14A2 2 0 0 0 3.85 21h16.3a2 2 0 0 0 1.73-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
};

interface PublicBulawayoMapProps {
  alerts: VerifiedPublicAlert[];
  selectedAlertId: string | null;
  onSelectAlert: (alert: VerifiedPublicAlert) => void;
  height?: number;
}

export const PublicBulawayoMap: React.FC<PublicBulawayoMapProps> = ({
  alerts,
  selectedAlertId,
  onSelectAlert,
  height = 520,
}) => {
  const [viewMode, setViewMode] = useState<'real' | 'schematic'>('real');
  const [zoom, setZoom] = useState<number>(1);

  const handleZoomIn = () => setZoom((z) => Math.min(1.45, Number((z + 0.15).toFixed(2))));
  const handleZoomOut = () => setZoom((z) => Math.max(1, Number((z - 0.15).toFixed(2))));
  const handleReset = () => setZoom(1);

  if (viewMode === 'real') {
    return (
      <div style={{ position: 'relative' }}>
        {/* Toggle Mode Switcher */}
        <div
          style={{
            position: 'absolute',
            top: '12px',
            left: '60px',
            zIndex: 1000,
            background: 'rgba(255, 255, 255, 0.95)',
            border: '1px solid #dce2dc',
            borderRadius: '6px',
            padding: '2px 4px',
            display: 'flex',
            gap: '4px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
          }}
        >
          <button
            type="button"
            onClick={() => setViewMode('real')}
            style={{
              border: 'none',
              background: '#145438',
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: 700,
              padding: '4px 8px',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            🗺️ Real Map (OSM)
          </button>
          <button
            type="button"
            onClick={() => setViewMode('schematic')}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#46524b',
              fontSize: '11px',
              fontWeight: 600,
              padding: '4px 8px',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            📐 Schematic View
          </button>
        </div>

        <RealLeafletMap
          alerts={alerts}
          selectedAlertId={selectedAlertId}
          onSelectAlert={onSelectAlert}
          height={height}
        />
      </div>
    );
  }

  return (
    <div
      className="pz-map-frame"
      style={{ height: `${height}px` }}
      aria-label="Bulawayo verified road hazards map"
    >
      {/* Toggle Mode Switcher */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          zIndex: 20,
          background: 'rgba(255, 255, 255, 0.95)',
          border: '1px solid #dce2dc',
          borderRadius: '6px',
          padding: '2px 4px',
          display: 'flex',
          gap: '4px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
        }}
      >
        <button
          type="button"
          onClick={() => setViewMode('real')}
          style={{
            border: 'none',
            background: 'transparent',
            color: '#46524b',
            fontSize: '11px',
            fontWeight: 600,
            padding: '4px 8px',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          🗺️ Real Map (OSM)
        </button>
        <button
          type="button"
          onClick={() => setViewMode('schematic')}
          style={{
            border: 'none',
            background: '#145438',
            color: '#ffffff',
            fontSize: '11px',
            fontWeight: 700,
            padding: '4px 8px',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          📐 Schematic View
        </button>
      </div>
      {/* Interactive zoomable neutral basemap + dynamic pins */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          transform: `scale(${zoom})`,
          transformOrigin: 'center center',
          transition: 'transform 0.18s ease-out',
        }}
      >
        <BulawayoNeutralBasemap />

        {/* 100% Dynamic Verified Incident Pins */}
        {alerts.map((alert) => {
          const isSelected = alert.id === selectedAlertId;
          const pinFill = alert.isCritical ? '#b53d38' : '#145438';

          return (
            <button
              key={alert.id}
              type="button"
              data-testid={`public-map-pin-${alert.id}`}
              data-category={alert.categoryKey}
              className={`pz-map-pin-btn ${isSelected ? 'is-selected' : ''}`}
              style={{
                left: `${alert.desktopPin.xPct}%`,
                top: `${alert.desktopPin.yPct}%`,
              }}
              onClick={() => onSelectAlert(alert)}
              title={`${alert.title} — ${alert.location} (${alert.severity})`}
              aria-label={`Verified ${alert.categoryLabel} alert: ${alert.title} at ${alert.location}`}
            >
              <div
                style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    width: isSelected ? '38px' : '34px',
                    height: isSelected ? '38px' : '34px',
                    borderRadius: '50%',
                    background: pinFill,
                    border: isSelected ? '3px solid #ffffff' : '2px solid #ffffff',
                    boxShadow: isSelected
                      ? '0 0 0 3px #145438, 0 3px 8px rgba(32, 42, 36, 0.28)'
                      : '0 2px 5px rgba(32, 42, 36, 0.22)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CategoryPinGlyph category={alert.categoryKey} />
                </div>
                <span
                  style={{
                    width: 0,
                    height: 0,
                    borderLeft: '6px solid transparent',
                    borderRight: '6px solid transparent',
                    borderTop: `8px solid ${pinFill}`,
                    marginTop: '-1px',
                  }}
                />
                {alert.isCritical && (
                  <span
                    style={{
                      position: 'absolute',
                      right: '-6px',
                      top: '-5px',
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      background: '#ffffff',
                      border: '1.5px solid #b53d38',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <img
                      src={ASSETS.triangleAlertRed}
                      alt=""
                      style={{ width: '11px', height: '11px' }}
                    />
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Map zoom & reset controls */}
      <div className="pz-map-controls" role="group" aria-label="Map zoom controls">
        <button
          type="button"
          className="pz-map-ctrl-btn"
          onClick={handleZoomIn}
          title="Zoom in"
          aria-label="Zoom in"
        >
          <img src={ASSETS.plus} alt="" style={{ width: '18px', height: '18px' }} />
        </button>
        <button
          type="button"
          className="pz-map-ctrl-btn"
          onClick={handleZoomOut}
          title="Zoom out"
          aria-label="Zoom out"
        >
          <img src={ASSETS.minus} alt="" style={{ width: '18px', height: '18px' }} />
        </button>
        <button
          type="button"
          className="pz-map-ctrl-btn"
          onClick={handleReset}
          title="Reset Bulawayo map view"
          aria-label="Reset Bulawayo map view"
        >
          <img src={ASSETS.locateFixed} alt="" style={{ width: '18px', height: '18px' }} />
        </button>
      </div>

      {/* Dynamic active-marker status badge */}
      <div
        style={{
          position: 'absolute',
          right: '12px',
          top: '12px',
          background: 'rgba(255, 255, 255, 0.95)',
          border: '1px solid var(--pz-border)',
          borderRadius: '4px',
          padding: '6px 10px',
          fontSize: '12px',
          color: 'var(--pz-text)',
          fontWeight: 500,
          zIndex: 14,
        }}
      >
        Showing <strong>{alerts.length}</strong> verified marker{alerts.length === 1 ? '' : 's'} ·
        Zoom {Math.round(zoom * 100)}%
      </div>

      <div className="pz-map-attribution">
        Bulawayo arterial basemap · Green: verified moderate · Red: verified critical/high severity
        (demo data)
      </div>
    </div>
  );
};

interface CorridorContextMapProps {
  mode: 'verification' | 'hotspots' | 'report-preview';
  activeCorridorId?: 'A5' | 'KHAMI' | 'ESIGODINI';
  onSelectCorridor?: (id: 'A5' | 'KHAMI' | 'ESIGODINI') => void;
  landmarkLabel?: string;
  markerCoords?: { xPct: number; yPct: number };
  isVerifiedMarker?: boolean;
  height?: number;
}

export const CorridorContextMap: React.FC<CorridorContextMapProps> = ({
  mode,
  activeCorridorId = 'A5',
  onSelectCorridor,
  landmarkLabel,
  markerCoords,
  isVerifiedMarker = false,
  height = 260,
}) => {
  const [zoom, setZoom] = useState<number>(1);

  return (
    <div
      className="pz-map-frame"
      style={{ height: `${height}px` }}
      aria-label="Bulawayo corridor screening map"
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          transform: `scale(${zoom})`,
          transformOrigin: 'center center',
          transition: 'transform 0.18s ease-out',
        }}
      >
        <BulawayoNeutralBasemap compact />

        {mode === 'hotspots' && (
          <>
            {/* A5 Corridor Screening Cluster */}
            <button
              type="button"
              className={`pz-map-pin-btn ${activeCorridorId === 'A5' ? 'is-selected' : ''}`}
              style={{ left: '25%', top: '74%' }}
              onClick={() => onSelectCorridor?.('A5')}
              title="A5 · Bulawayo–Plumtree (3 related submissions)"
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'rgba(250, 237, 190, 0.92)',
                    border: '2px solid #d5a528',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '14px',
                    color: '#6e5207',
                  }}
                >
                  3
                </div>
                <span
                  style={{
                    background: activeCorridorId === 'A5' ? '#17583b' : '#ffffff',
                    color: activeCorridorId === 'A5' ? '#ffffff' : '#202a24',
                    border: '1px solid #17583b',
                    borderRadius: '4px',
                    padding: '2px 7px',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    marginTop: '3px',
                  }}
                >
                  01 · A5 (3 leads)
                </span>
              </div>
            </button>

            {/* Khami Road Corridor Screening Cluster */}
            <button
              type="button"
              className={`pz-map-pin-btn ${activeCorridorId === 'KHAMI' ? 'is-selected' : ''}`}
              style={{ left: '28%', top: '44%' }}
              onClick={() => onSelectCorridor?.('KHAMI')}
              title="Khami Road · Mzilikazi (2 signal mentions)"
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '50%',
                    background: 'rgba(250, 237, 190, 0.92)',
                    border: '2px solid #d5a528',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '13px',
                    color: '#6e5207',
                  }}
                >
                  2
                </div>
                <span
                  style={{
                    background: activeCorridorId === 'KHAMI' ? '#17583b' : '#ffffff',
                    color: activeCorridorId === 'KHAMI' ? '#ffffff' : '#202a24',
                    border: '1px solid #dce2dc',
                    borderRadius: '4px',
                    padding: '2px 7px',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    marginTop: '3px',
                  }}
                >
                  02 · Khami (2 mentions)
                </span>
              </div>
            </button>

            {/* Esigodini Road Lead */}
            <button
              type="button"
              className={`pz-map-pin-btn ${activeCorridorId === 'ESIGODINI' ? 'is-selected' : ''}`}
              style={{ left: '78%', top: '76%' }}
              onClick={() => onSelectCorridor?.('ESIGODINI')}
              title="Esigodini Road (A7) · 1 uncorroborated lead"
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'rgba(250, 237, 190, 0.92)',
                    border: '2px solid #d5a528',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '13px',
                    color: '#6e5207',
                  }}
                >
                  1
                </div>
                <span
                  style={{
                    background: activeCorridorId === 'ESIGODINI' ? '#17583b' : '#ffffff',
                    color: activeCorridorId === 'ESIGODINI' ? '#ffffff' : '#202a24',
                    border: '1px solid #dce2dc',
                    borderRadius: '4px',
                    padding: '2px 7px',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    marginTop: '3px',
                  }}
                >
                  03 · A7 (1 lead)
                </span>
              </div>
            </button>
          </>
        )}

        {mode === 'verification' && (
          <div
            style={{
              position: 'absolute',
              left: `${markerCoords?.xPct ?? 26}%`,
              top: `${markerCoords?.yPct ?? 68}%`,
              transform: 'translate(-50%, -85%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <img
              src={isVerifiedMarker ? ASSETS.pinNewsroomGreen : ASSETS.pinNewsroomGold}
              alt=""
              style={{ width: '32px', height: '40px' }}
            />
            {landmarkLabel && (
              <span
                style={{
                  background: '#ffffff',
                  border: '1px solid #dce2dc',
                  borderRadius: '4px',
                  padding: '2px 7px',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  color: '#202a24',
                  marginTop: '2px',
                  maxWidth: '210px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {landmarkLabel}
              </span>
            )}
          </div>
        )}

        {mode === 'report-preview' && (
          <div
            style={{
              position: 'absolute',
              left: `${markerCoords?.xPct ?? 48}%`,
              top: `${markerCoords?.yPct ?? 52}%`,
              transform: 'translate(-50%, -85%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <img src={ASSETS.pinNewsroomGold} alt="" style={{ width: '32px', height: '40px' }} />
            <span
              style={{
                background: '#ffffff',
                border: '1px solid #dce2dc',
                borderRadius: '4px',
                padding: '2px 8px',
                fontSize: '11.5px',
                fontWeight: 600,
                color: '#202a24',
                marginTop: '2px',
                maxWidth: '230px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {landmarkLabel || 'Approximate Bulawayo area'}
            </span>
          </div>
        )}
      </div>

      {/* Compact zoom controls */}
      <div className="pz-map-controls" role="group" aria-label="Corridor map zoom">
        <button
          type="button"
          className="pz-map-ctrl-btn"
          style={{ width: '36px', height: '36px' }}
          onClick={() => setZoom((z) => Math.min(1.4, Number((z + 0.15).toFixed(2))))}
          aria-label="Zoom in"
        >
          <img src={ASSETS.plus} alt="" style={{ width: '15px', height: '15px' }} />
        </button>
        <button
          type="button"
          className="pz-map-ctrl-btn"
          style={{ width: '36px', height: '36px' }}
          onClick={() => setZoom((z) => Math.max(1, Number((z - 0.15).toFixed(2))))}
          aria-label="Zoom out"
        >
          <img src={ASSETS.minus} alt="" style={{ width: '15px', height: '15px' }} />
        </button>
      </div>

      <div className="pz-map-attribution" style={{ fontSize: '11.5px', padding: '5px 10px' }}>
        Bulawayo corridor context · Gold: unverified screening lead · Green: verified alert
      </div>
    </div>
  );
};
