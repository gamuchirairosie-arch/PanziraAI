import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ASSETS } from '../assetsMap';
import { usePanzira } from '../context/PanziraContext';
import { INITIAL_VERIFIED_ALERTS } from '../data/seedData';
import { VerifiedPublicAlert } from '../types';
import { HumanVerifiedShieldBadge } from './CitizenHomeView';
import { RealLeafletMap } from '../components/RealLeafletMap';

type RoadCategoryFilter = 'all' | 'potholes' | 'flooding' | 'collisions';

const MOBILE_QUERY = '(max-width: 768px)';

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia(MOBILE_QUERY).matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isMobile;
}

export const PublicSafetyMapView: React.FC = () => {
  const { verifiedAlerts, publicSearch, setPublicSearch, navigatePublic } = usePanzira();

  const [categoryFilter, setCategoryFilter] = useState<RoadCategoryFilter>('all');
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [useLiveLeaflet, setUseLiveLeaflet] = useState<boolean>(false);
  const isMobile = useIsMobile();
  const detailRef = useRef<HTMLDivElement | null>(null);
  const [scrollRequest, setScrollRequest] = useState(0);

  // Select an alert (from a marker or the list) and, on mobile, bring the detail card into view
  const selectAlert = (id: string) => {
    setSelectedAlertId(id);
    setScrollRequest((n) => n + 1);
  };

  useEffect(() => {
    if (scrollRequest === 0 || !isMobile) return;
    const frame = requestAnimationFrame(() => {
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => cancelAnimationFrame(frame);
  }, [scrollRequest, isMobile]);

  const filteredAlerts = useMemo(() => {
    const q = publicSearch.trim().toLowerCase();
    return verifiedAlerts.filter((alert) => {
      if (categoryFilter !== 'all' && alert.categoryKey !== categoryFilter) return false;
      if (!q) return true;
      return (
        alert.title.toLowerCase().includes(q) ||
        alert.location.toLowerCase().includes(q) ||
        alert.corridor.toLowerCase().includes(q) ||
        alert.description.toLowerCase().includes(q) ||
        alert.categoryLabel.toLowerCase().includes(q)
      );
    });
  }, [verifiedAlerts, categoryFilter, publicSearch]);

  const selectedAlert: VerifiedPublicAlert | null = useMemo(() => {
    if (!selectedAlertId) return null;
    return filteredAlerts.find((a) => a.id === selectedAlertId) || verifiedAlerts.find((a) => a.id === selectedAlertId) || null;
  }, [filteredAlerts, verifiedAlerts, selectedAlertId]);

  const alertCount = verifiedAlerts.length > 0 ? verifiedAlerts.length : 12;

  const handleSelectCategoryPin = (category: RoadCategoryFilter, fallbackTitle: string) => {
    const match =
      filteredAlerts.find((a) => category === 'all' || a.categoryKey === category) ||
      verifiedAlerts.find((a) => category === 'all' || a.categoryKey === category) ||
      verifiedAlerts[0];
    if (match) {
      selectAlert(match.id);
    } else {
      setPublicSearch(fallbackTitle);
    }
  };

  return (
    <div data-node-id="75:1086" className="pz-v3-road-conditions">
      {/* Map Heading */}
      <div
        data-node-id="75:1104"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap',
          width: '100%',
        }}
      >
        <div
          data-node-id="75:1105"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            minWidth: '260px',
            flex: '1 1 auto',
          }}
        >
          <h1
            data-node-id="75:1106"
            className="pz-v3-road-title"
            style={{
              margin: 0,
              fontFamily: "'Newsreader', Georgia, serif",
              fontWeight: 500,
              fontSize: '32px',
              lineHeight: 1.05,
              letterSpacing: '-0.64px',
              color: '#202a24',
            }}
          >
            Road conditions around Bulawayo
          </h1>
          <p
            data-node-id="75:1107"
            style={{
              margin: 0,
              fontFamily: 'var(--pz-font-sans)',
              fontWeight: 400,
              fontSize: '14px',
              lineHeight: 1.5,
              color: '#5d6b63',
            }}
          >
            {alertCount} example alerts · 3 corridors · Demo data (4 Nov 2026)
          </p>
        </div>

        <HumanVerifiedShieldBadge />
      </div>

      {/* Search and Category Filters */}
      <div
        data-node-id="75:1109"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
          width: '100%',
        }}
      >
        {/* Place Search */}
        <div
          data-node-id="75:1110"
          style={{
            width: '400px',
            maxWidth: '100%',
          }}
        >
          <div
            data-node-id="75:1111"
            style={{
              background: '#ffffff',
              border: '1px solid #d9e1db',
              borderRadius: '6px',
              height: '48px',
              padding: '0 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <img
              src={ASSETS.search}
              alt=""
              style={{ width: '20px', height: '20px', flexShrink: 0, opacity: 0.7 }}
            />
            <input
              type="search"
              value={publicSearch}
              onChange={(e) => setPublicSearch(e.target.value)}
              placeholder="Search roads or places"
              aria-label="Search roads or places"
              style={{
                border: 'none',
                outline: 'none',
                background: 'transparent',
                width: '100%',
                fontFamily: 'var(--pz-font-sans)',
                fontSize: '15px',
                color: '#202a24',
              }}
            />
            {publicSearch && (
              <button
                type="button"
                onClick={() => setPublicSearch('')}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#5d6b63',
                  fontSize: '18px',
                  cursor: 'pointer',
                  padding: '0 4px',
                }}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Category Filter Buttons */}
        <button
          type="button"
          data-node-id="75:1115"
          onClick={() => setCategoryFilter('all')}
          style={{
            height: '44px',
            padding: '0 14px',
            borderRadius: '6px',
            border: categoryFilter === 'all' ? '1px solid #145438' : '1px solid #d9e1db',
            background: categoryFilter === 'all' ? '#145438' : '#ffffff',
            color: categoryFilter === 'all' ? '#ffffff' : '#202a24',
            fontFamily: 'var(--pz-font-sans)',
            fontWeight: categoryFilter === 'all' ? 400 : 500,
            fontSize: '14px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          All categories
        </button>

        <button
          type="button"
          data-node-id="75:1116"
          onClick={() => setCategoryFilter('potholes')}
          style={{
            height: '44px',
            padding: '0 14px',
            borderRadius: '6px',
            border: categoryFilter === 'potholes' ? '1px solid #145438' : '1px solid #d9e1db',
            background: categoryFilter === 'potholes' ? '#145438' : '#ffffff',
            color: categoryFilter === 'potholes' ? '#ffffff' : '#202a24',
            fontFamily: 'var(--pz-font-sans)',
            fontWeight: 500,
            fontSize: '14px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          △ Road damage
        </button>

        <button
          type="button"
          data-node-id="75:1118"
          onClick={() => setCategoryFilter('flooding')}
          style={{
            height: '44px',
            padding: '0 14px',
            borderRadius: '6px',
            border: categoryFilter === 'flooding' ? '1px solid #145438' : '1px solid #d9e1db',
            background: categoryFilter === 'flooding' ? '#145438' : '#ffffff',
            color: categoryFilter === 'flooding' ? '#ffffff' : '#202a24',
            fontFamily: 'var(--pz-font-sans)',
            fontWeight: 500,
            fontSize: '14px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          ≋ Flooding
        </button>

        <button
          type="button"
          data-node-id="75:1120"
          onClick={() => setCategoryFilter('collisions')}
          style={{
            height: '44px',
            padding: '0 14px',
            borderRadius: '6px',
            border: categoryFilter === 'collisions' ? '1px solid #145438' : '1px solid #d9e1db',
            background: categoryFilter === 'collisions' ? '#145438' : '#ffffff',
            color: categoryFilter === 'collisions' ? '#ffffff' : '#202a24',
            fontFamily: 'var(--pz-font-sans)',
            fontWeight: 500,
            fontSize: '14px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Collisions
        </button>
      </div>

      {/* Main Split: Left Map Viewport + Right Explore Road Hazards Card (stacks on mobile) */}
      <div data-node-id="75:1122" className="pz-v3-road-conditions-grid">
        {/* Left: Segmented Map Mode Toggle Above Map + Map Viewport */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            width: '100%',
            minWidth: 0,
          }}
        >
          {/* Clean Segmented Bar ABOVE the map container so it never overlaps +/- zoom buttons */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              flexWrap: 'wrap',
            }}
          >
            <div
              role="group"
              aria-label="Map display mode"
              data-testid="map-mode-toggle"
              style={{
                display: 'inline-flex',
                background: '#f8faf9',
                border: '1px solid #d9e1db',
                borderRadius: '6px',
                padding: '2px',
                gap: '2px',
              }}
            >
              {(
                [
                  { live: false, label: 'Corridor map' },
                  { live: true, label: 'Interactive map' },
                ] as const
              ).map((opt) => {
                const active = useLiveLeaflet === opt.live;
                return (
                  <button
                    key={opt.label}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setUseLiveLeaflet(opt.live)}
                    style={{
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      background: active ? '#145438' : 'transparent',
                      color: active ? '#ffffff' : '#202a24',
                      fontFamily: 'var(--pz-font-sans)',
                      fontSize: '12.5px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <span style={{ fontSize: '12px', color: '#5d6b63' }}>
              Tap a marker to inspect the verified hazard
            </span>
          </div>

          <div data-node-id="75:1123" className="pz-v3-road-map-viewport">
            {useLiveLeaflet ? (
              <RealLeafletMap
                alerts={filteredAlerts}
                selectedAlertId={selectedAlertId}
                onSelectAlert={(a) => selectAlert(a.id)}
                height={isMobile ? 340 : 620}
              />
            ) : (
            <div
              data-node-id="75:1124"
              style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                transform: `scale(${zoom})`,
                transformOrigin: 'center center',
                transition: 'transform 0.2s ease',
              }}
            >
              {/* Exact Figma Clean Bulawayo Basemap SVG */}
              <svg
                viewBox="0 0 928 620"
                preserveAspectRatio="xMidYMid slice"
                style={{ width: '100%', height: '100%', display: 'block' }}
                aria-label="Bulawayo road network map"
              >
                <rect width="928" height="620" fill="#f0efe9" />
                {/* Green spaces */}
                <rect x="111.36" y="105.4" width="120.64" height="105.4" rx="30" fill="#dde8d7" />
                <rect x="640.32" y="248" width="111.36" height="105.4" rx="18" fill="#dde8d7" />
                <rect x="696" y="483.6" width="204.16" height="124" rx="30" fill="#dde8d7" />

                {/* Watercourse */}
                <path
                  d="M 48 0 C 145 70, 210 210, 270 320 C 330 415, 580 410, 928 530"
                  fill="none"
                  stroke="#c5dce6"
                  strokeWidth="8"
                  strokeLinecap="round"
                />

                {/* Tilted Local Street Grid */}
                <g
                  stroke="#ffffff"
                  strokeWidth="2"
                  fill="none"
                  transform="rotate(-11 464 310)"
                >
                  {[160, 215, 270, 325, 380, 435, 490, 545, 600, 655].map((x) => (
                    <line key={`v-${x}`} x1={x} y1="70" x2={x} y2="520" />
                  ))}
                  {[95, 145, 195, 245, 295, 345, 395, 445, 495].map((y) => (
                    <line key={`h-${y}`} x1="140" y1={y} x2="680" y2={y} />
                  ))}
                </g>

                {/* Arterial Road Casings */}
                <g stroke="#d4c7a9" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" fill="none">
                  <path d="M 118 0 L 298 398 L 352 620" />
                  <path d="M 0 400 L 298 398 L 418 450 L 620 412 L 735 435 L 928 310" />
                  <path d="M 85 620 L 298 398" />
                  <path d="M 650 0 L 620 412 L 590 620" />
                </g>

                {/* Arterial Road Surfaces */}
                <g stroke="#faf4e4" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none">
                  <path d="M 118 0 L 298 398 L 352 620" />
                  <path d="M 0 400 L 298 398 L 418 450 L 620 412 L 735 435 L 928 310" />
                  <path d="M 85 620 L 298 398" />
                  <path d="M 650 0 L 620 412 L 590 620" />
                </g>

                {/* Street & Suburb Labels matching Figma 75:1132 - 75:1144 */}
                <g
                  fontFamily="Public Sans, sans-serif"
                  fontWeight="500"
                  fontSize="13.5"
                  fill="#5d6b63"
                >
                  <text x="668" y="52">A6 · Inyathi</text>
                  <text x="93" y="548">A5 · Plumtree</text>
                  <text x="761" y="306">A6</text>
                  <text x="548" y="468">Lobengula St</text>
                  <text x="186" y="380">Khami Rd</text>
                  <text x="687" y="548">HILLSIDE</text>
                  <text x="111" y="486">NJUBE</text>
                  <text x="724" y="368">SUBURBS</text>
                  <text x="483" y="405">CBD</text>
                  <text x="427" y="331">BULAWAYO</text>
                  <text x="650" y="157">MATSHOBANA</text>
                  <text x="334" y="114">NORTH END</text>
                  <text x="121" y="170">MZILIKAZI</text>
                </g>
              </svg>

              {/* Dynamic Incident Markers matching Figma 75:1145 */}
              <div
                data-node-id="75:1145"
                style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                }}
              >
                {/* Cluster Marker "9" (A6 / Matshobana) */}
                <button
                  type="button"
                  data-node-id="75:1146"
                  onClick={() => handleSelectCategoryPin('all', 'A6')}
                  title="9 approved reports along A6 & Eastern Suburbs"
                  style={{
                    pointerEvents: 'auto',
                    position: 'absolute',
                    left: '73%',
                    top: '31%',
                    width: '44px',
                    height: '44px',
                    borderRadius: '24px',
                    background: '#176b45',
                    border: '2px solid #ffffff',
                    color: '#ffffff',
                    fontFamily: 'var(--pz-font-sans)',
                    fontWeight: 500,
                    fontSize: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
                  }}
                >
                  9
                </button>

                {/* Collision Marker (North End) */}
                {(categoryFilter === 'all' || categoryFilter === 'collisions') && (
                  <button
                    type="button"
                    data-node-id="75:1149"
                    onClick={() => handleSelectCategoryPin('collisions', 'North End')}
                    title="Verified collision alert"
                    style={{
                      pointerEvents: 'auto',
                      position: 'absolute',
                      left: '44%',
                      top: '25%',
                      width: '44px',
                      height: '44px',
                      borderRadius: '7px',
                      background: '#176b45',
                      border: '2px solid #ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
                    }}
                  >
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 17h14v-5l-2-5H7l-2 5v5Z" />
                      <circle cx="7.5" cy="17.5" r="1.5" />
                      <circle cx="16.5" cy="17.5" r="1.5" />
                    </svg>
                  </button>
                )}

                {/* Flooding Marker + Critical Badge (Lobengula St) */}
                {(categoryFilter === 'all' || categoryFilter === 'flooding') && (
                  <button
                    type="button"
                    data-node-id="75:1153"
                    onClick={() => handleSelectCategoryPin('flooding', 'Lobengula')}
                    title="Verified flooding alert — Lobengula St & 12th Ave"
                    style={{
                      pointerEvents: 'auto',
                      position: 'absolute',
                      left: '66%',
                      top: '63%',
                      width: '48px',
                      height: '48px',
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '24px',
                        background: '#176b45',
                        border: '2px solid #ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
                      }}
                    >
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M2 8c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
                        <path d="M2 13c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
                        <path d="M2 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
                      </svg>
                    </div>
                    <span
                      style={{
                        position: 'absolute',
                        left: '30px',
                        top: '-6px',
                        width: '22px',
                        height: '22px',
                        borderRadius: '4px',
                        background: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                      }}
                    >
                      <img
                        src={ASSETS.triangleAlertRed}
                        alt=""
                        style={{ width: '16px', height: '16px' }}
                      />
                    </span>
                  </button>
                )}

                {/* Road Surface Damage Marker (Khami Rd) */}
                {(categoryFilter === 'all' || categoryFilter === 'potholes') && (
                  <button
                    type="button"
                    data-node-id="75:1160"
                    onClick={() => handleSelectCategoryPin('potholes', 'Khami')}
                    title="Verified road surface damage — Khami Rd"
                    style={{
                      pointerEvents: 'auto',
                      position: 'absolute',
                      left: '26%',
                      top: '56.5%',
                      width: '44px',
                      height: '44px',
                      borderRadius: '7px',
                      background: '#176b45',
                      border: '3px solid #142c43',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.22)',
                    }}
                  >
                    <img
                      src={ASSETS.triangleAlertWhite}
                      alt=""
                      style={{ width: '22px', height: '22px' }}
                    />
                  </button>
                )}

                {/* Dynamic Verified Alerts newly published in session */}
                {filteredAlerts
                  .filter(
                    (alert) =>
                      !INITIAL_VERIFIED_ALERTS.some((baseline) => baseline.id === alert.id)
                  )
                  .map((alert) => {
                    const isSelected = selectedAlertId === alert.id;
                    const leftPct = Math.min(88, Math.max(10, alert.desktopPin?.xPct ?? 42));
                    const topPct = Math.min(82, Math.max(14, alert.desktopPin?.yPct ?? 48));
                    return (
                      <button
                        key={alert.id}
                        type="button"
                        onClick={() => selectAlert(alert.id)}
                        title={`Verified alert — ${alert.title}`}
                        style={{
                          pointerEvents: 'auto',
                          position: 'absolute',
                          left: `${leftPct}%`,
                          top: `${topPct}%`,
                          width: '44px',
                          height: '44px',
                          borderRadius: '10px',
                          background: '#176b45',
                          border: isSelected ? '3px solid #0f273c' : '2px solid #ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          boxShadow: '0 3px 10px rgba(23,107,69,0.35)',
                          transform: 'translate(-50%, -50%)',
                        }}
                      >
                        <img
                          src={ASSETS.triangleAlertWhite}
                          alt=""
                          style={{ width: '20px', height: '20px' }}
                        />
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {!useLiveLeaflet && (
            <>
              {/* Top-right Map Controls (Zoom + / - & Locate) */}
              <div
                data-node-id="75:1167"
                style={{
                  position: 'absolute',
                  right: '16px',
                  top: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  zIndex: 20,
                }}
              >
                <div
                  data-node-id="75:1168"
                  style={{
                    background: '#ffffff',
                    border: '1px solid #d9e1db',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <button
                    type="button"
                    data-node-id="75:1169"
                    onClick={() => setZoom((z) => Math.min(1.5, Number((z + 0.15).toFixed(2))))}
                    aria-label="Zoom in"
                    style={{
                      width: '44px',
                      height: '44px',
                      background: '#ffffff',
                      border: 'none',
                      borderBottom: '1px solid #dce2dc',
                      color: '#145438',
                      fontSize: '20px',
                      cursor: 'pointer',
                    }}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    data-node-id="75:1170"
                    onClick={() => setZoom((z) => Math.max(1, Number((z - 0.15).toFixed(2))))}
                    aria-label="Zoom out"
                    style={{
                      width: '44px',
                      height: '44px',
                      background: '#ffffff',
                      border: 'none',
                      color: '#145438',
                      fontSize: '20px',
                      cursor: 'pointer',
                    }}
                  >
                    −
                  </button>
                </div>

                <button
                  type="button"
                  data-node-id="75:1171"
                  onClick={() => setZoom(1)}
                  aria-label="Reset map center"
                  title="Reset Bulawayo map view"
                  style={{
                    width: '44px',
                    height: '44px',
                    background: '#ffffff',
                    border: '1px solid #d9e1db',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <img src={ASSETS.locateFixed} alt="" style={{ width: '22px', height: '22px' }} />
                </button>
              </div>

              {/* Bottom Attribution Strip */}
              <div
                data-node-id="75:1164"
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: '24px',
                  background: '#ffffff',
                  padding: '0 8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontFamily: 'var(--pz-font-sans)',
                  fontSize: '12px',
                  color: '#5d6b63',
                  zIndex: 20,
                }}
              >
                <span>Leaflet | © OpenStreetMap contributors</span>
                <span style={{ fontSize: '11px' }}>1 km</span>
              </div>
            </>
          )}
          </div>
        </div>

        {/* Right Column: Explore Road Hazards Card (79:39) + Selected Alert Detail */}
        <aside className="pz-v3-road-side-col">
          {/* Exact Figma Card 79:39 */}
          <div
            data-node-id="79:39"
            className="pz-v3-road-side-card"
            style={{
              background: '#f2f6f1',
              border: '1px solid #dde6df',
              borderRadius: '12px',
              padding: '26px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <h2
              data-node-id="79:40"
              style={{
                margin: 0,
                fontFamily: 'var(--pz-font-serif)',
                fontWeight: 600,
                fontSize: '23px',
                lineHeight: 1.05,
                letterSpacing: '-0.46px',
                color: '#202c25',
              }}
            >
              Explore road hazards
            </h2>
            <p
              data-node-id="79:41"
              style={{
                margin: 0,
                fontFamily: 'var(--pz-font-sans)',
                fontSize: '15px',
                lineHeight: 1.5,
                color: '#596b61',
              }}
            >
              Select a green marker to view the verified report, severity and safety guidance.
            </p>
            <div
              data-node-id="79:42"
              style={{
                background: '#ffffff',
                padding: '10px 12px',
                borderRadius: '6px',
                display: 'flex',
                flexDirection: 'column',
                gap: '9px',
                fontSize: '13px',
                lineHeight: 1.5,
              }}
            >
              <div
                data-node-id="79:43"
                style={{
                  fontFamily: 'var(--pz-font-sans)',
                  fontWeight: 500,
                  color: '#176243',
                }}
              >
                ● &nbsp;Green: human-verified report
              </div>
              <div
                data-node-id="79:44"
                style={{
                  fontFamily: 'var(--pz-font-sans)',
                  fontWeight: 400,
                  color: '#596b61',
                }}
              >
                ◯ &nbsp;Pending reports are not public
              </div>
            </div>
            <p
              data-node-id="79:45"
              style={{
                margin: 0,
                fontFamily: 'var(--pz-font-sans)',
                fontSize: '12px',
                lineHeight: 1.5,
                color: '#596b61',
              }}
            >
              Map uses OpenStreetMap / Leaflet. Zoom, pan, search and marker selection remain
              available.
            </p>
          </div>

          {/* Selected Incident Detail Sheet (75:1174) when a marker or alert is clicked */}
          {selectedAlert && (
            <div
              ref={detailRef}
              data-node-id="75:1174"
              data-testid="road-incident-detail-card"
              className="pz-v3-road-side-card pz-v3-road-detail-card"
              style={{
                background: '#ffffff',
                border: '1px solid #176b45',
                borderRadius: '12px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                scrollMarginTop: '80px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <img
                    src={
                      selectedAlert.categoryKey === 'flooding'
                        ? ASSETS.wavesGreen
                        : selectedAlert.categoryKey === 'collisions'
                          ? ASSETS.carFrontGreen
                          : ASSETS.triangleAlertGreen
                    }
                    alt=""
                    style={{ width: '20px', height: '20px' }}
                  />
                  <h3
                    style={{
                      margin: 0,
                      fontFamily: 'var(--pz-font-serif)',
                      fontWeight: 600,
                      fontSize: '20px',
                      lineHeight: 1.15,
                      color: '#202a24',
                    }}
                  >
                    {selectedAlert.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedAlertId(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#5d6b63',
                    fontSize: '18px',
                    cursor: 'pointer',
                  }}
                  aria-label="Close incident details"
                >
                  ×
                </button>
              </div>

              <p
                style={{
                  margin: 0,
                  fontFamily: 'var(--pz-font-sans)',
                  fontSize: '14px',
                  color: '#5d6b63',
                }}
              >
                {selectedAlert.location} · {selectedAlert.corridor}
              </p>

              <p
                style={{
                  margin: 0,
                  fontFamily: 'var(--pz-font-sans)',
                  fontSize: '14.5px',
                  lineHeight: 1.5,
                  color: '#202a24',
                }}
              >
                {selectedAlert.description}
              </p>

              <div
                style={{
                  height: '1px',
                  background: '#d9e1db',
                  width: '100%',
                }}
              />

              <p
                style={{
                  margin: 0,
                  fontFamily: 'var(--pz-font-sans)',
                  fontSize: '13px',
                  color: '#5d6b63',
                }}
              >
                {selectedAlert.sourceAttribution} · {selectedAlert.updatedAgo}
              </p>
            </div>
          )}

          {/* Compact Reviewed Alerts List for Quick Selection */}
          <div
            className="pz-v3-road-side-card"
            style={{
              background: '#ffffff',
              border: '1px solid #d9e1db',
              borderRadius: '12px',
              padding: '18px 20px',
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
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--pz-font-serif)',
                  fontWeight: 600,
                  fontSize: '17px',
                  color: '#202a24',
                }}
              >
                Verified corridor alerts ({filteredAlerts.length})
              </span>
              <button
                type="button"
                onClick={() => navigatePublic('report')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#176b45',
                  fontFamily: 'var(--pz-font-sans)',
                  fontWeight: 500,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                + Report hazard
              </button>
            </div>

            {filteredAlerts.map((alert) => {
              const active = alert.id === selectedAlertId;
              return (
                <button
                  key={alert.id}
                  type="button"
                  onClick={() => selectAlert(alert.id)}
                  style={{
                    textAlign: 'left',
                    background: active ? '#edf4ef' : '#ffffff',
                    border: active ? '1px solid #176b45' : '1px solid #e5ebe6',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--pz-font-serif)',
                      fontWeight: 600,
                      fontSize: '15px',
                      color: '#202a24',
                    }}
                  >
                    {alert.title}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--pz-font-sans)',
                      fontSize: '12.5px',
                      color: '#5d6b63',
                    }}
                  >
                    {alert.location} · {alert.updatedAgo}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default PublicSafetyMapView;
