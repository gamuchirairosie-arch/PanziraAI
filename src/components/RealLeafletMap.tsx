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

type RouteAlternative = { coordinates: [number, number][]; distance: number; duration: number; steps: string[] };

function segmentDistanceMeters(point: [number, number], start: [number, number], end: [number, number]): number {
  const scaleX = 111320 * Math.cos((point[0] * Math.PI) / 180);
  const project = ([lat, lng]: [number, number]) => [lng * scaleX, lat * 111320] as [number, number];
  const p = project(point), a = project(start), b = project(end);
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const length2 = dx * dx + dy * dy;
  const t = length2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length2)) : 0;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
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
  const heatLayerRef = useRef<L.Layer | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const settingDestinationRef = useRef(false);
  const [heatEnabled, setHeatEnabled] = useState(true);
  const [origin, setOrigin] = useState<[number, number] | null>(null);
  const [destination, setDestination] = useState<[number, number] | null>(null);
  const [route, setRoute] = useState<RouteAlternative | null>(null);
  const [routeBusy, setRouteBusy] = useState(false);
  const [routeMessage, setRouteMessage] = useState('Use your location, select a destination on the map, and choose an incident to request a detour suggestion.');
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
      routeLayerRef.current = L.layerGroup().addTo(map);
      map.on('click', (event: L.LeafletMouseEvent) => {
        if (!settingDestinationRef.current) return;
        settingDestinationRef.current = false;
        setDestination([event.latlng.lat, event.latlng.lng]);
        setRoute(null);
        setRouteMessage('Destination selected. Choose an incident and request an alternate route.');
      });
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
      const [lat, lng] = alert.lat != null && alert.lng != null
        ? [alert.lat, alert.lng] as [number, number]
        : pctToLatLng(alert.desktopPin.xPct, alert.desktopPin.yPct);
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
      const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
      }[char] || char));
      const popupHtml = `
        <div style="font-family: 'Inter', system-ui, sans-serif; font-size: 12.5px; color: #1c2720; min-width: 200px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: ${
              alert.isCritical ? '#b53d38' : '#145438'
            };">
              ${escapeHtml(alert.categoryLabel)}
            </span>
            <span style="font-size: 10px; background: #e8eee9; padding: 1px 6px; border-radius: 3px; font-weight: 600;">
              Verified
            </span>
          </div>
          <div style="font-weight: 700; font-size: 13px; line-height: 1.3; margin-bottom: 4px;">
            ${escapeHtml(alert.title)}
          </div>
          <div style="font-size: 11.5px; color: #526358; margin-bottom: 6px;">
            📍 ${escapeHtml(alert.location)}
          </div>
          <div style="font-size: 11px; line-height: 1.4; color: #37463e; border-top: 1px solid #e1e7e2; padding-top: 4px;">
            ${escapeHtml(alert.description)}
          </div>
          <div style="font-size: 10px; color: #6e7e74; margin-top: 4px; font-style: italic;">
            ${escapeHtml(alert.sourceAttribution)}
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

  // A lightweight canvas heat overlay keeps the map dependency-free. It visualises
  // only editor-approved public alerts; private/unverified reports never reach it.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (heatLayerRef.current) map.removeLayer(heatLayerRef.current);
    heatLayerRef.current = null;
    if (!heatEnabled || alerts.length === 0) return;
    const points = alerts.map((alert) => {
      const [lat, lng] = alert.lat != null && alert.lng != null
        ? [alert.lat, alert.lng] as [number, number]
        : pctToLatLng(alert.desktopPin.xPct, alert.desktopPin.yPct);
      return { lat, lng, weight: alert.isCritical ? 1.45 : 1 };
    });
    const HeatGrid = (L.GridLayer as any).extend({
      createTile: (coords: L.Coords, done: (error: Error | null, tile: HTMLElement) => void) => {
        const canvas = document.createElement('canvas');
        const size = 256;
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) { done(null, canvas); return canvas; }
        for (const point of points) {
          const pixel = map.project([point.lat, point.lng], coords.z);
          const x = pixel.x - coords.x * size;
          const y = pixel.y - coords.y * size;
          if (x < -54 || y < -54 || x > size + 54 || y > size + 54) continue;
          const radius = 38;
          const alpha = Math.min(0.68, 0.34 * point.weight);
          const gradient = ctx.createRadialGradient(x, y, 2, x, y, radius);
          gradient.addColorStop(0, `rgba(190, 32, 38, ${alpha})`);
          gradient.addColorStop(0.4, `rgba(242, 112, 36, ${alpha * 0.82})`);
          gradient.addColorStop(0.75, `rgba(250, 214, 67, ${alpha * 0.42})`);
          gradient.addColorStop(1, 'rgba(250, 214, 67, 0)');
          ctx.fillStyle = gradient;
          ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
        }
        done(null, canvas);
        return canvas;
      },
    });
    heatLayerRef.current = new HeatGrid({ opacity: 0.78, zIndex: 350 }).addTo(map);
    return () => { if (heatLayerRef.current && map.hasLayer(heatLayerRef.current)) map.removeLayer(heatLayerRef.current); };
  }, [alerts, heatEnabled]);

  useEffect(() => {
    const layers = routeLayerRef.current;
    if (!layers) return;
    layers.clearLayers();
    const map = mapInstanceRef.current;
    if (destination && map) {
      L.marker(destination).bindTooltip('Selected destination').addTo(layers);
    }
    if (origin) {
      L.circleMarker(origin, { radius: 7, color: '#174c82', fillColor: '#4b9ad8', fillOpacity: 1, weight: 2 })
        .bindTooltip('Your selected start').addTo(layers);
    }
    if (route) {
      L.polyline(route.coordinates, { color: '#176b45', weight: 6, opacity: 0.88 }).addTo(layers);
    }
  }, [origin, destination, route]);

  const useCurrentLocation = () => {
    if (!navigator.geolocation || !window.isSecureContext) {
      setRouteMessage('Device location needs browser support, your permission, and a secure HTTPS page.');
      return;
    }
    setRouteBusy(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setOrigin([position.coords.latitude, position.coords.longitude]);
        setRoute(null);
      setRouteMessage(`Start set (about ${Math.round(position.coords.accuracy)} m accuracy). Select a destination on the map. Your start and destination are sent to the public OSRM routing service when you request a route.`);
        setRouteBusy(false);
      },
      () => { setRouteMessage('Location unavailable or permission declined. No location was saved.'); setRouteBusy(false); },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  };

  const findDetour = async () => {
    const selected = alerts.find((alert) => alert.id === selectedAlertId);
    if (!origin || !destination || !selected) {
      setRouteMessage('Choose a verified incident, allow device location, and select a destination on the map.');
      return;
    }
    setRouteBusy(true); setRoute(null);
    try {
      const [sceneLat, sceneLng] = selected.lat != null && selected.lng != null
        ? [selected.lat, selected.lng]
        : pctToLatLng(selected.desktopPin.xPct, selected.desktopPin.yPct);
      const coords = `${origin[1]},${origin[0]};${destination[1]},${destination[0]}`;
      const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?alternatives=3&steps=true&overview=full&geometries=geojson`);
      if (!response.ok) throw new Error('Routing service is temporarily unavailable.');
      const payload = await response.json();
      const options: RouteAlternative[] = (payload.routes || []).map((item: any) => {
        const geometry: [number, number][] = (item.geometry?.coordinates || []).map(([lng, lat]: [number, number]) => [lat, lng]);
        const steps = (item.legs || []).flatMap((leg: any) => leg.steps || [])
          .map((step: any) => step.maneuver?.instruction || step.name).filter(Boolean).slice(0, 8);
        return { coordinates: geometry, distance: item.distance, duration: item.duration, steps } as RouteAlternative;
      });
      const safe = options.filter((option) => {
        if (option.coordinates.length < 2) return false;
        for (let i = 1; i < option.coordinates.length; i += 1) {
          if (segmentDistanceMeters([sceneLat, sceneLng], option.coordinates[i - 1], option.coordinates[i]) <= 250) return false;
        }
        return true;
      });
      if (!safe.length) {
        setRouteMessage('No suggested route could be shown clear of the selected incident. Follow local signs and authority guidance.');
      } else {
        const chosen = safe.sort((a, b) => a.duration - b.duration)[0];
        setRoute(chosen);
        setRouteMessage(`Suggested route: ${(chosen.distance / 1000).toFixed(1)} km, about ${Math.max(1, Math.round(chosen.duration / 60))} min. It stays at least 250 m from the mapped incident point.${chosen.steps.length ? ` Directions: ${chosen.steps.join(' · ')}` : ''}`);
      }
    } catch (error) {
      setRouteMessage(error instanceof Error ? error.message : 'Could not calculate an alternate route.');
    } finally { setRouteBusy(false); }
  };

  const fitAllAlerts = () => {
    const map = mapInstanceRef.current;
    if (!map || alerts.length === 0) return;
    const points = alerts.map((alert) => alert.lat != null && alert.lng != null
      ? [alert.lat, alert.lng] as [number, number]
      : pctToLatLng(alert.desktopPin.xPct, alert.desktopPin.yPct));
    if (points.length === 1) map.flyTo(points[0], 14, { duration: 0.5 });
    else map.fitBounds(L.latLngBounds(points).pad(0.14), { maxZoom: 14, animate: true });
  };

  const clearRoute = () => {
    setOrigin(null);
    setDestination(null);
    setRoute(null);
    setRouteMessage('Route cleared. Choose your location and a destination to plan around an incident.');
  };

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
        <button
          type="button"
          aria-pressed={heatEnabled}
          onClick={() => setHeatEnabled((enabled) => !enabled)}
          style={{ border: 'none', background: heatEnabled ? '#b53d38' : 'transparent',
            color: heatEnabled ? '#fff' : '#37463e', fontSize: '11px', fontWeight: 600,
            padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}
        >
          Heat {heatEnabled ? 'On' : 'Off'}
        </button>
        <button
          type="button"
          onClick={fitAllAlerts}
          disabled={alerts.length === 0}
          title="Show all verified incidents"
          style={{ border: 'none', background: 'transparent', color: '#37463e', fontSize: '11px',
            fontWeight: 600, padding: '4px 8px', borderRadius: '4px', cursor: alerts.length ? 'pointer' : 'default',
            opacity: alerts.length ? 1 : 0.5 }}
        >
          Show all
        </button>
      </div>

      <section aria-label="Route around selected incident" style={{ position: 'absolute', right: 12,
        bottom: 46, zIndex: 1000, width: 'min(330px, calc(100% - 24px))', background: 'rgba(255,255,255,.96)',
        border: '1px solid #dce2dc', borderRadius: 7, padding: 10, boxShadow: '0 2px 8px rgba(0,0,0,.12)',
        display: 'grid', gap: 7 }}>
        <strong style={{ fontSize: 12 }}>Plan around an incident</strong>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button type="button" className="pz-btn-secondary" style={{ minHeight: 32, padding: '4px 8px', fontSize: 11 }} onClick={useCurrentLocation} disabled={routeBusy}>
            Use my location
          </button>
          <button type="button" className="pz-btn-secondary" style={{ minHeight: 32, padding: '4px 8px', fontSize: 11 }}
            onClick={() => { settingDestinationRef.current = true; setRouteMessage('Click the map to set your destination.'); }}>
            Set destination on map
          </button>
          <button type="button" className="pz-btn-primary" style={{ minHeight: 32, padding: '4px 8px', fontSize: 11 }} onClick={() => void findDetour()} disabled={routeBusy}>
            {routeBusy ? 'Finding…' : 'Find detour'}
          </button>
          {(origin || destination || route) && <button type="button" className="pz-btn-secondary"
            style={{ minHeight: 32, padding: '4px 8px', fontSize: 11 }} onClick={clearRoute} disabled={routeBusy}>
            Clear route
          </button>}
        </div>
        <small role="status" style={{ lineHeight: 1.35, whiteSpace: 'pre-line' }}>{routeMessage}</small>
        <small style={{ color: '#5b6660', lineHeight: 1.3 }}>OSRM/OpenStreetMap estimate; no live road closures or traffic data. Confirm signs and official advice.</small>
      </section>

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
        📍 Bulawayo · <strong>{alerts.length}</strong> verified alerts · Heat shows alert concentration
      </div>
    </div>
  );
};
