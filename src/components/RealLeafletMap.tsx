import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { VerifiedPublicAlert } from '../types';

/**
 * Converts percentage-based relative map coordinates to actual GPS coordinates
 * in Greater Bulawayo, Zimbabwe.
 *
 * Bulawayo Geographic Bounding Box:
 * North: -20.0800 (A6 / Richmond / North End)
 * South: -20.2400 (Plumtree / Bellevue / Four Winds)
 * West:  28.4600 (A5 / Khami Industrial)
 * East:  28.6800 (A7 Esigodini / Matsheumhlope)
 */
export function pctToLatLng(xPct: number, yPct: number): [number, number] {
  const minLat = -20.24;
  const maxLat = -20.08;
  const minLng = 28.46;
  const maxLng = 28.68;

  const lat = maxLat - (yPct / 100) * (maxLat - minLat);
  const lng = minLng + (xPct / 100) * (maxLng - minLng);
  return [Number(lat.toFixed(5)), Number(lng.toFixed(5))];
}

interface RealLeafletMapProps {
  alerts: VerifiedPublicAlert[];
  selectedAlertId: string | null;
  onSelectAlert: (alert: VerifiedPublicAlert) => void;
  height?: number;
  center?: [number, number];
  zoom?: number;
}

export const RealLeafletMap: React.FC<RealLeafletMapProps> = ({
  alerts,
  selectedAlertId,
  onSelectAlert,
  height = 520,
  center = [-20.155, 28.583], // Bulawayo CBD
  zoom = 13,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  // OpenStreetMap is the default street layer and needs no API key.
  const [activeLayer, setActiveLayer] = useState<'osm' | 'satellite'>('osm');

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center,
        zoom,
        zoomControl: false,
      });

      // Position zoom controls in top-left
      L.control.zoom({ position: 'topleft' }).addTo(map);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      const markersGroup = L.layerGroup().addTo(map);
      markersLayerRef.current = markersGroup;
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Handle tile layer switching
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove existing tile layers
    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

    let url: string;
    let attr: string;

    if (activeLayer === 'osm') {
      url = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      attr = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
    } else if (activeLayer === 'satellite') {
      url =
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      attr = 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community';
    } else {
      url = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      attr = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
    }

    L.tileLayer(url, { attribution: attr, maxZoom: 19 }).addTo(map);
  }, [activeLayer]);

  // Update incident markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersLayerRef.current;
    if (!map || !markersGroup) return;

    markersGroup.clearLayers();

    alerts.forEach((alert) => {
      const [lat, lng] = pctToLatLng(alert.desktopPin.xPct, alert.desktopPin.yPct);
      const isSelected = alert.id === selectedAlertId;
      const pinColor = alert.isCritical ? '#b53d38' : '#145438';

      // Custom HTML Marker Icon
      const customIcon = L.divIcon({
        className: 'pz-leaflet-marker',
        html: `
          <div style="
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            transform: translate(-50%, -100%);
            cursor: pointer;
          ">
            <div style="
              width: ${isSelected ? '38px' : '32px'};
              height: ${isSelected ? '38px' : '32px'};
              border-radius: 50%;
              background: ${pinColor};
              border: ${isSelected ? '3px solid #ffffff' : '2px solid #ffffff'};
              box-shadow: ${isSelected ? '0 0 0 3px #145438, 0 3px 10px rgba(0,0,0,0.35)' : '0 2px 6px rgba(0,0,0,0.28)'};
              display: flex;
              align-items: center;
              justify-content: center;
              transition: transform 0.15s ease;
            ">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                ${
                  alert.categoryKey === 'collisions'
                    ? '<path d="M5 17h14v-5l-2-5H7l-2 5v5Z"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/>'
                    : alert.categoryKey === 'flooding'
                    ? '<path d="M2 10c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M2 16c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>'
                    : '<path d="m10.29 3.86-8.17 14.14A2 2 0 0 0 3.85 21h16.3a2 2 0 0 0 1.73-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'
                }
              </svg>
            </div>
            <div style="
              width: 0;
              height: 0;
              border-left: 6px solid transparent;
              border-right: 6px solid transparent;
              border-top: 7px solid ${pinColor};
              margin-top: -1px;
            "></div>
          </div>
        `,
        iconSize: [36, 42],
        iconAnchor: [18, 42],
      });

      const marker = L.marker([lat, lng], { icon: customIcon }).addTo(markersGroup);

      // Popup
      const popupHtml = `
        <div style="font-family: 'Inter', system-ui, sans-serif; font-size: 12.5px; color: #1c2720; min-width: 200px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: ${
              alert.isCritical ? '#b53d38' : '#145438'
            };">
              ${alert.categoryLabel}
            </span>
            <span style="font-size: 10px; background: #e8eee9; padding: 1px 6px; border-radius: 3px; font-weight: 600;">
              Verified
            </span>
          </div>
          <div style="font-weight: 700; font-size: 13px; line-height: 1.3; margin-bottom: 4px;">
            ${alert.title}
          </div>
          <div style="font-size: 11.5px; color: #526358; margin-bottom: 6px;">
            📍 ${alert.location}
          </div>
          <div style="font-size: 11px; line-height: 1.4; color: #37463e; border-top: 1px solid #e1e7e2; padding-top: 4px;">
            ${alert.description}
          </div>
          <div style="font-size: 10px; color: #6e7e74; margin-top: 4px; font-style: italic;">
            ${alert.sourceAttribution}
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);

      marker.on('click', () => {
        onSelectAlert(alert);
      });

      if (isSelected) {
        marker.openPopup();
        map.flyTo([lat, lng], Math.max(map.getZoom(), 14), { duration: 0.6 });
      }
    });
  }, [alerts, selectedAlertId, onSelectAlert]);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: `${height}px`,
        borderRadius: '8px',
        overflow: 'hidden',
        border: '1px solid var(--pz-border, #dce2dc)',
      }}
    >
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

      {/* Layer selector bar */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          zIndex: 1000,
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(4px)',
          border: '1px solid #dce2dc',
          borderRadius: '6px',
          padding: '3px',
          display: 'flex',
          gap: '3px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveLayer('osm')}
          style={{
            border: 'none',
            background: activeLayer === 'osm' ? '#145438' : 'transparent',
            color: activeLayer === 'osm' ? '#ffffff' : '#37463e',
            fontSize: '11px',
            fontWeight: 600,
            padding: '4px 8px',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Street
        </button>
        <button
          type="button"
          onClick={() => setActiveLayer('satellite')}
          style={{
            border: 'none',
            background: activeLayer === 'satellite' ? '#145438' : 'transparent',
            color: activeLayer === 'satellite' ? '#ffffff' : '#37463e',
            fontSize: '11px',
            fontWeight: 600,
            padding: '4px 8px',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Satellite
        </button>
      </div>

      {/* Live active marker counter badge */}
      <div
        style={{
          position: 'absolute',
          bottom: '24px',
          left: '12px',
          zIndex: 1000,
          background: 'rgba(255, 255, 255, 0.95)',
          border: '1px solid #dce2dc',
          borderRadius: '4px',
          padding: '5px 9px',
          fontSize: '11.5px',
          fontWeight: 600,
          color: '#145438',
          boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
        }}
      >
        📍 Real Bulawayo Map · <strong>{alerts.length}</strong> live verified alerts
      </div>
    </div>
  );
};
