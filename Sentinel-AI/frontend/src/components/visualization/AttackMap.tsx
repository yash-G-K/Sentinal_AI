'use client';

import Globe from 'react-globe.gl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { geoEquirectangular } from 'd3-geo';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { useWebSocket, type WSMessage } from '../../hooks/useWebSocket';
import { getCountryCoords, isoToFullName } from './countryCoordinates';


import * as THREE from 'three';
const EMPTY_CUSTOM_LAYER: any[] = [];
const COUNTRY_TEXTURE_WIDTH = 4096;
const COUNTRY_TEXTURE_HEIGHT = 2048;
const AUTO_ROTATE_SPEED = 0.5;
const UNFOCUSED_DOT_OPACITY = 0.14;
const COUNTRY_BASE_ALTITUDE = 0.002;
const COUNTRY_POP_ALTITUDE = 0.09;
const COUNTRY_EXIT_DURATION = 900;

const COUNTRY_ALIASES: Record<string, string> = {
  usa: 'united states of america',
  us: 'united states of america',
  'u s a': 'united states of america',
  'u s': 'united states of america',
  'united states': 'united states of america',
  uk: 'united kingdom',
  'u k': 'united kingdom',
  gb: 'united kingdom',
  gbr: 'united kingdom',
  'united kindom': 'united kingdom',
  'united kingdon': 'united kingdom',
  'united kingdom of great britain and northern ireland': 'united kingdom',
  britain: 'united kingdom',
  'great britain': 'united kingdom',
  russia: 'russian federation',
  iran: 'iran islamic republic of',
  vietnam: 'viet nam',
  syria: 'syrian arab republic',
  laos: 'lao people s democratic republic',
  bolivia: 'bolivia plurinational state of',
  venezuela: 'venezuela bolivarian republic of',
  tanzania: 'tanzania united republic of',
  moldova: 'moldova republic of',
  'south korea': 'korea republic of',
  'north korea': 'korea democratic people s republic of',
};

const normalizeCountryName = (name: string) =>
  String(name || '')
    .trim()
    .toLowerCase()
    .replace(/^the\s/, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, ' ')
    .trim();

const countryKey = (name: string) => {
  const normalized = normalizeCountryName(name);
  return COUNTRY_ALIASES[normalized] || normalized;
};

const hexToRgb = (hex: string) => {
  const cleanHex = hex.replace('#', '');
  const value = parseInt(cleanHex, 16);

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
};

const mixHex = (from: string, to: string, amount: number) => {
  const start = hexToRgb(from);
  const end = hexToRgb(to);
  const mix = (a: number, b: number) => Math.round(a + (b - a) * amount);

  return `rgb(${mix(start.r, end.r)}, ${mix(start.g, end.g)}, ${mix(start.b, end.b)})`;
};

const ringCrossesAntimeridian = (ring: any[]) =>
  ring.some((point: any, index: number) => {
    if (index === 0) return false;
    return Math.abs(point[0] - ring[index - 1][0]) > 180;
  });

const ringTouchesPolarCap = (ring: any[], latitudeLimit = 82) =>
  ring.some(([, lat]: [number, number]) => Math.abs(lat) > latitudeLimit);

const shouldKeepPolarFeature = (feature: any) => {
  const key = countryKey(feature.properties?.name ?? '');
  return key === 'antarctica' || key === 'greenland';
};

const removePolarRings = (feature: any, latitudeLimit = 82) => {
  if (shouldKeepPolarFeature(feature)) {
    return feature;
  }

  const geometry = feature.geometry;
  const polygons = geometry?.type === 'Polygon'
    ? [geometry.coordinates]
    : geometry?.type === 'MultiPolygon'
      ? geometry.coordinates
      : [];

  const safePolygons = polygons
    .map((polygon: any[]) => {
      const [outerRing, ...innerRings] = polygon;

      if (!outerRing || ringTouchesPolarCap(outerRing, latitudeLimit)) {
        return null;
      }

      return [
        outerRing,
        ...innerRings.filter((ring: any[]) => !ringTouchesPolarCap(ring, latitudeLimit))
      ];
    })
    .filter(Boolean);

  if (!safePolygons.length) return null;

  return {
    ...feature,
    geometry: {
      ...geometry,
      type: geometry.type === 'Polygon' ? 'Polygon' : 'MultiPolygon',
      coordinates: geometry.type === 'Polygon' ? safePolygons[0] : safePolygons
    }
  };
};

const extractBorderPaths = (feature: any) => {
  const country = feature.properties?.name ?? '';
  const geometry = feature.geometry;
  const polygons = geometry?.type === 'Polygon'
    ? [geometry.coordinates]
    : geometry?.type === 'MultiPolygon'
      ? geometry.coordinates
      : [];

  return polygons.flatMap((polygon: any[]) =>
    polygon
      .filter((ring: any[]) => !ringTouchesPolarCap(ring))
      .filter((ring: any[]) => !ringCrossesAntimeridian(ring))
      .map((ring: any[]) => ({
        country,
        points: ring.map(([lng, lat]) => ({ lat, lng, alt: 0.001 }))
      }))
  );
};

const drawProjectedFeaturePath = (
  ctx: CanvasRenderingContext2D,
  projection: any,
  feature: any,
  closeAntarcticaToPole = true
) => {
  const isAntarctica = countryKey(feature.properties?.name ?? '') === 'antarctica';
  const geometry = feature.geometry;
  const polygons = geometry?.type === 'Polygon'
    ? [geometry.coordinates]
    : geometry?.type === 'MultiPolygon'
      ? geometry.coordinates
      : [];

  const drawRing = (ring: any[]) => {
    ring.forEach(([lng, lat]: [number, number], index: number) => {
      const point = projection([lng, lat]);
      if (!point) return;

      if (index === 0) {
        ctx.moveTo(point[0], point[1]);
      } else {
        ctx.lineTo(point[0], point[1]);
      }
    });

    ctx.closePath();
  };

  const drawAntarcticaRing = (ring: any[]) => {
    if (!ringCrossesAntimeridian(ring)) {
      drawRing(ring);
      return;
    }

    const segments: any[][] = [];
    let segment: any[] = [];

    ring.forEach((point: any, index: number) => {
      const previous = index > 0 ? ring[index - 1] : null;

      if (previous && Math.abs(point[0] - previous[0]) > 180) {
        if (segment.length > 1) segments.push(segment);
        segment = [point];
        return;
      }

      segment.push(point);
    });

    if (segment.length > 1) segments.push(segment);

    segments.forEach((seg) => {
      const first = seg[0];
      const last = seg[seg.length - 1];

      seg.forEach(([lng, lat]: [number, number], index: number) => {
        const point = projection([lng, lat]);
        if (!point) return;

        if (index === 0) {
          ctx.moveTo(point[0], point[1]);
        } else {
          ctx.lineTo(point[0], point[1]);
        }
      });

      if (!closeAntarcticaToPole) {
        return;
      }

      const lastBottom = projection([last[0], -90]);
      const firstBottom = projection([first[0], -90]);

      if (lastBottom && firstBottom) {
        ctx.lineTo(lastBottom[0], lastBottom[1]);
        ctx.lineTo(firstBottom[0], firstBottom[1]);
      }

      ctx.closePath();
    });
  };

  polygons.forEach((polygon: any[]) => {
    polygon
      .forEach((ring: any[]) => {
        if (isAntarctica) {
          drawAntarcticaRing(ring);
          return;
        }

        if (!ringCrossesAntimeridian(ring)) {
          drawRing(ring);
        }
      });
  });
};

const normalizeLng360 = (lng: number) => ((lng % 360) + 360) % 360;

const collectFeatureCoordinates = (feature: any): [number, number][] => {
  const geometry = feature.geometry;
  const polygons = geometry?.type === 'Polygon'
    ? [geometry.coordinates]
    : geometry?.type === 'MultiPolygon'
      ? geometry.coordinates
      : [];

  return polygons.flatMap((polygon: any[]) =>
    polygon.flatMap((ring: any[]) =>
      ring.filter(([lng, lat]: [number, number]) =>
        Number.isFinite(lng) && Number.isFinite(lat) && Math.abs(lat) <= 82
      )
    )
  );
};

const getCountryViewpoint = (feature: any, fallback: any) => {
  const coordinates = collectFeatureCoordinates(feature);

  if (!coordinates.length) {
    return {
      lat: Number(fallback.fromLat),
      lng: Number(fallback.fromLng),
      altitude: 0.85
    };
  }

  const latitudes = coordinates.map(([, lat]) => lat);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const lat = (minLat + maxLat) / 2;

  const sortedLngs = coordinates
    .map(([lng]) => normalizeLng360(lng))
    .sort((a, b) => a - b);

  let largestGap = -1;
  let largestGapIndex = 0;

  sortedLngs.forEach((lng, index) => {
    const next = index === sortedLngs.length - 1
      ? sortedLngs[0] + 360
            : sortedLngs[index + 1];
const gap = next - lng;

if (gap > largestGap) {
  largestGap = gap;
  largestGapIndex = index;
}
    });

const lngSpan = 360 - largestGap;
const intervalStart = sortedLngs[(largestGapIndex + 1) % sortedLngs.length];
const centerLng360 = normalizeLng360(intervalStart + lngSpan / 2);
const lng = centerLng360 > 180 ? centerLng360 - 360 : centerLng360;
const latSpan = maxLat - minLat;
const extent = Math.max(latSpan, lngSpan);
const altitude = Math.min(Math.max(0.68 + extent / 115, 0.78), 1.3);

return { lat, lng, altitude };
};

export function AttackMap({ dark = true }: { dark?: boolean }) {
    const theme = dark ? 'dark' : 'light';
    const [geoData, setGeoData] = useState<any[]>([]);

    // Seed globe with historical data from REST API on mount
    useEffect(() => {
        fetch('http://localhost:8000/api/v1/dashboard/charts')
            .then(r => r.json())
            .then(data => {
                const topCountries: { country: string; count: number }[] = data?.geo?.top_countries || [];
                const seeded: any[] = topCountries
                    .filter(item => item.country && item.country !== 'Local')
                    .map(item => {
                        const rawCountry = item.country;
                        const country = isoToFullName(rawCountry);
                        const coords = getCountryCoords(rawCountry) || [0, 0];
                        return { lat: coords[0], lon: coords[1], country, city: country, count: item.count, ip: '' };
                    });
                if (seeded.length > 0) setGeoData(seeded);
            })
            .catch(() => {/* silently ignore – globe will populate via WebSocket */});
    }, []);

    const handleMessage = useCallback((msg: WSMessage) => {
        if (msg.type !== 'threat') return;
        const d = msg.data as any;
        // Convert ISO-2 codes (e.g. "US", "RU") to full names (e.g. "United States")
        const rawCountry = d.country || 'Unknown';
        const country = isoToFullName(rawCountry);
        
        setGeoData(prev => {
            const next = [...prev];
            const existing = next.find(x => x.country === country);
            if (existing) {
                existing.count = (existing.count || 0) + 1;
                existing.ip = d.ip || existing.ip;
            } else {
                const coords = getCountryCoords(rawCountry) || [d.lat || 0, d.lng || 0];
                next.push({ lat: coords[0], lon: coords[1], country, city: country, count: 1, ip: d.ip });
            }
            return next;
        });
    }, []);

    useWebSocket('/api/v1/ws/threats', handleMessage);

  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<any>(null);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rotateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualRotateResumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoDeselectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zoomFrameRef = useRef<number | null>(null);
  const focusFrameRef = useRef<number | null>(null);
  const exitTimerRefs = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const autoRotateFrameRef = useRef<number | null>(null);
  const focusFadeRef = useRef(0);
  const pendingAltitudeRef = useRef(2.5);
  const selectedCountryKeyRef = useRef('');
  const focusCountryKeyRef = useRef('');
  const poppedCountryRef = useRef<any>(null);
  const dotScaleRef = useRef(1);
  const pointCacheRef = useRef<Map<string, any>>(new Map());
  const capMaterialCacheRef = useRef<Map<string, any>>(new Map());
  const globeMaterialRef = useRef<any>(null);
  const globePointerDownRef = useRef<{ x: number; y: number } | null>(null);
  const exitingCountriesRef = useRef<Map<string, any>>(new Map());
  const exitingCountryProgressRef = useRef<Map<string, number>>(new Map());
  const isLight = theme === 'light';
  const colors = {
    panelBorder: isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.07)',
    subtleBorder: isLight ? 'rgba(15,23,42,0.10)' : 'rgba(255,255,255,0.04)',
    headerText: isLight ? 'rgba(15,23,42,0.55)' : 'rgba(255,255,255,0.35)',
    text: isLight ? '#0f172a' : '#ffffff',
    mutedText: isLight ? 'rgba(15,23,42,0.68)' : 'rgba(255,255,255,0.7)',
    rowHover: isLight ? 'rgba(239,68,68,0.07)' : 'rgba(251,243,243,0.05)',
    rowSelected: isLight ? 'rgba(239,68,68,0.10)' : 'rgba(249,249,249,0.09)',
    selectedCount: isLight ? '#b91c1c' : '#8be9fd',
    globeBackground: isLight ? '#ffffff' : '#000000',
    ocean: isLight ? '#0b3a78' : '#020b1d',
    globeImage: isLight
      ? '//unpkg.com/three-globe/example/img/earth-blue-marble.jpg'
      : '//unpkg.com/three-globe/example/img/earth-dark.jpg',
    normalCountry: isLight ? '#d7dde5' : '#7d8794',
    activeCountry: isLight ? '#2563eb' : '#5a82dc',
    topCountry: '#eab308',
    dimCountry: isLight ? '#8b6f72' : '#4a2529',
    dimNormalCountry: isLight ? '#b8c0cc' : '#56616f',
    normalSide: isLight ? '#9ca3af' : '#4b5563',
    activeSide: isLight ? '#1d4ed8' : '#3f61d8',
    topSide: '#a16207',
    dimSide: isLight ? '#7a5a5e' : '#32191d',
    strokeColor: isLight ? '#2563eb' : '#8db8ff',
    popoverBg: isLight ? 'rgba(255,255,255,0.94)' : 'rgba(8,12,20,0.78)',
    popoverBorder: isLight ? 'rgba(15,23,42,0.14)' : 'rgba(250,250,250,0.25)',
    metricBg: isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.05)',
  };

  const [selectedCountry, setSelectedCountry] = useState<any>(null);
  const [selectedCountryCount, setSelectedCountryCount] = useState(0);

  const [dimensions, setDimensions] = useState({
    width: 300,
    height: 300
  });
  const [cameraAltitude, setCameraAltitude] = useState(2.5);

  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [countries, setCountries] = useState<any[]>([]);
  const [poppedCountry, setPoppedCountry] = useState<any>(null);
  const [exitingCountries, setExitingCountries] = useState<any[]>([]);
  const [, setExitProgressVersion] = useState(0);
  const [focusCountryKey, setFocusCountryKey] = useState('');
  const [focusFade, setFocusFade] = useState(0);
  const [globeMaterial, setGlobeMaterial] = useState<any>(null);
  const selectedCountryKey = useMemo(
    () => selectedCountry ? countryKey(selectedCountry.from) : '',
    [selectedCountry]
  );
  const poppedCountryKey = useMemo(
    () => poppedCountry ? countryKey(poppedCountry.from) : '',
    [poppedCountry]
  );
  const exitingCountryKeys = useMemo(
    () => new Set(exitingCountries.map((country: any) => countryKey(country.from))),
    [exitingCountries]
  );

  const COUNTRY_REQUEST_COUNTS = useMemo(() => {
    const counts = new Map<string, number>();

    geoData?.forEach((item: any) => {
      const key = countryKey(item.country || 'Unknown');
      counts.set(key, (counts.get(key) || 0) + (Number(item.count) || 0));
    });

    return counts;
  }, [geoData]);

  const maxCountryRequestCount = useMemo(() => {
    let max = 0;
    COUNTRY_REQUEST_COUNTS.forEach((count) => {
      max = Math.max(max, count);
    });
    return max;
  }, [COUNTRY_REQUEST_COUNTS]);

  selectedCountryKeyRef.current = selectedCountryKey;
  focusCountryKeyRef.current = focusCountryKey;
  poppedCountryRef.current = poppedCountry;

  const isSelectedCountry = (name: string) =>
    selectedCountryKey ? selectedCountryKey === countryKey(name) : false;

  const isPoppedCountry = (name: string) =>
    poppedCountryKey ? poppedCountryKey === countryKey(name) : false;

  const isExitingCountry = (name: string) =>
    exitingCountryKeys.has(countryKey(name));

  const getCountryPopProgress = (name: string) => {
    const key = countryKey(name);
    const exitingProgress = exitingCountryProgressRef.current.get(key);

    if (typeof exitingProgress === 'number') return exitingProgress;

    for (const [exitingKey, progress] of exitingCountryProgressRef.current.entries()) {
      if (
        key === exitingKey ||
        key.includes(exitingKey) ||
        exitingKey.includes(key)
      ) {
        return progress;
      }
    }

    return isPoppedCountry(name) ? 1 : 0;
  };

  const isSelectedFeature = (feat: any) => {
    if (!selectedCountry) return false;

    const featureName = feat.properties?.name ?? '';
    const featureId = feat.id ?? feat.properties?.iso_a3 ?? feat.properties?.adm0_a3 ?? '';
    const selectedKey = countryKey(selectedCountry.from);
    const featureNameKey = countryKey(featureName);
    const featureIdKey = countryKey(featureId);

    return (
      selectedKey === featureNameKey ||
      selectedKey === featureIdKey ||
      selectedKey.includes(featureNameKey) ||
      featureNameKey.includes(selectedKey)
    );
  };

  const isPoppedFeature = (feat: any) => {
    if (!poppedCountry) return false;

    const featureName = feat.properties?.name ?? '';
    const featureId = feat.id ?? feat.properties?.iso_a3 ?? feat.properties?.adm0_a3 ?? '';
    const poppedKey = countryKey(poppedCountry.from);
    const featureNameKey = countryKey(featureName);
    const featureIdKey = countryKey(featureId);

    return (
      poppedKey === featureNameKey ||
      poppedKey === featureIdKey ||
      poppedKey.includes(featureNameKey) ||
      featureNameKey.includes(poppedKey)
    );
  };

  const featureMatchesCountryKey = (feat: any, key: string) => {
    const featureName = feat.properties?.name ?? '';
    const featureId = feat.id ?? feat.properties?.iso_a3 ?? feat.properties?.adm0_a3 ?? '';
    const featureNameKey = countryKey(featureName);
    const featureIdKey = countryKey(featureId);

    return (
      key === featureNameKey ||
      key === featureIdKey ||
      key.includes(featureNameKey) ||
      featureNameKey.includes(key)
    );
  };

  const isFocusedFeature = (feat: any) => {
    if (!focusCountryKey) return false;

    const featureName = feat.properties?.name ?? '';
    const featureId = feat.id ?? feat.properties?.iso_a3 ?? feat.properties?.adm0_a3 ?? '';
    const featureNameKey = countryKey(featureName);
    const featureIdKey = countryKey(featureId);

    return (
      focusCountryKey === featureNameKey ||
      focusCountryKey === featureIdKey ||
      focusCountryKey.includes(featureNameKey) ||
      featureNameKey.includes(focusCountryKey)
    );
  };

  const getSeverityColor = (countryName: string) => {
    const requestCount = COUNTRY_REQUEST_COUNTS.get(countryKey(countryName)) || 0;

    if (!requestCount || !maxCountryRequestCount) {
      return colors.normalCountry;
    }

    const severity = Math.log1p(requestCount) / Math.log1p(maxCountryRequestCount);

    const flippedSeverity = 1 - severity;

    if (flippedSeverity < 0.25) return mixHex('#3a1d21', '#5a252b', flippedSeverity / 0.25);
    if (flippedSeverity < 0.5) return mixHex('#5a252b', '#7a3036', (flippedSeverity - 0.25) / 0.25);
    if (flippedSeverity < 0.75) return mixHex('#7a3036', '#a4454b', (flippedSeverity - 0.5) / 0.25);

    return mixHex('#a4454b', '#c0565c', (flippedSeverity - 0.75) / 0.25);
  };

  const getSeveritySideColor = (countryName: string) => {
    const requestCount = COUNTRY_REQUEST_COUNTS.get(countryKey(countryName)) || 0;

    if (!requestCount || !maxCountryRequestCount) {
      return colors.normalSide;
    }

    const severity = Math.log1p(requestCount) / Math.log1p(maxCountryRequestCount);

    const flippedSeverity = 1 - severity;

    if (flippedSeverity < 0.25) return mixHex('#271316', '#3d181d', flippedSeverity / 0.25);
    if (flippedSeverity < 0.5) return mixHex('#3d181d', '#562126', (flippedSeverity - 0.25) / 0.25);
    if (flippedSeverity < 0.75) return mixHex('#562126', '#743034', (flippedSeverity - 0.5) / 0.25);

    return mixHex('#743034', '#8a3d42', (flippedSeverity - 0.75) / 0.25);
  };

  const getCountryBaseColors = (name: string) => {
    return {
      cap: getSeverityColor(name),
      side: getSeveritySideColor(name)
    };
  };

  const getCountryCapColor = (feat: any) => {
    const name = feat.properties?.name ?? '';
    const base = getCountryBaseColors(name).cap;

    if (focusCountryKey && !isFocusedFeature(feat)) {
      return mixHex(base, colors.dimCountry, focusFade);
    }

    return base;
  };

  const getCountryCapMaterial = (feat: any) => {
    const color = getCountryCapColor(feat);
    const cachedMaterial = capMaterialCacheRef.current.get(color);

    if (cachedMaterial) {
      return cachedMaterial;
    }

    const material = new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      depthWrite: true,
      depthTest: true,
    });

    capMaterialCacheRef.current.set(color, material);
    return material;
  };

  const getCountrySideColor = (feat: any) => {
    const name = feat.properties?.name ?? '';
    const base = getCountryBaseColors(name).side;

    if (focusCountryKey && !isFocusedFeature(feat)) {
      return mixHex(base, colors.dimSide, focusFade);
    }

    return base;
  };

  const dotScale = Math.min(Math.max(cameraAltitude / 1.8, 0.65), 2.2);
  dotScaleRef.current = dotScale;

  const getCountryRoofAltitude = (country: string) =>
    COUNTRY_BASE_ALTITUDE + ((COUNTRY_POP_ALTITUDE - COUNTRY_BASE_ALTITUDE) * getCountryPopProgress(country));

  const requestDotAltitude = (dot: any) =>
    getCountryRoofAltitude(dot.country) + 0.0015;

  const getRequestDotPixelSize = (baseSize: number, country: string) => {
    const selectedBoost = selectedCountryKeyRef.current === countryKey(country) ? 1.1 : 1;
    const zoomScale = Math.min(dotScaleRef.current, 1.25);
    return Math.round(Math.min(Math.max(baseSize * zoomScale * selectedBoost * 12, 4), 8));
  };

  const getRequestDotOpacity = (country: string, isVisible: boolean) => {
    if (!isVisible) return '0';

    const focusedKey = focusCountryKeyRef.current;
    if (!focusedKey || focusedKey === countryKey(country)) return '1';

    const opacity = 1 - (focusFadeRef.current * (1 - UNFOCUSED_DOT_OPACITY));
    return String(Math.max(UNFOCUSED_DOT_OPACITY, opacity));
  };

  const createRequestDotElement = useCallback((dot: any) => {
    const size = getRequestDotPixelSize(dot.size, dot.country);
    const el = document.createElement('div');

    el.dataset.attackDot = 'true';
    el.dataset.country = dot.country;
    el.dataset.size = String(dot.size);
    el.dataset.visible = 'true';
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.borderRadius = '999px';
    el.style.background = '#ff5a5a';
    el.style.boxShadow = 'none';
    el.style.pointerEvents = 'none';
    el.style.transform = 'translate(-50%, -50%)';
    el.style.transition = 'width 160ms ease, height 160ms ease, background-color 160ms ease, opacity 160ms ease';

    return el;
  }, []);

  const updateRequestDotElement = useCallback((el: HTMLElement, isVisible: boolean) => {
    const country = el.dataset.country || '';
    const baseSize = Number(el.dataset.size || 0.16);
    const size = getRequestDotPixelSize(baseSize, country);
    const selected = selectedCountryKeyRef.current === countryKey(country);

    el.dataset.visible = isVisible ? 'true' : 'false';
    el.style.opacity = getRequestDotOpacity(country, isVisible);
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.background = selected ? '#ff4d4d' : '#ff5a5a';
  }, []);

  const refreshRequestDotOpacity = useCallback(() => {
    containerRef.current
      ?.querySelectorAll<HTMLElement>('[data-attack-dot="true"]')
      .forEach((el) => {
        updateRequestDotElement(el, el.dataset.visible !== 'false');
      });
  }, [updateRequestDotElement]);

  const handleZoom = useCallback((pov: any) => {
    if (typeof pov?.altitude !== 'number') return;

    pendingAltitudeRef.current = pov.altitude;

    if (zoomFrameRef.current !== null) return;

    zoomFrameRef.current = requestAnimationFrame(() => {
      zoomFrameRef.current = null;

      setCameraAltitude((prev) =>
        Math.abs(prev - pendingAltitudeRef.current) > 0.12
          ? pendingAltitudeRef.current
          : prev
      );
    });
  }, []);

  const zoomGlobe = (direction: 'in' | 'out') => {
    const globe = globeRef.current;
    if (!globe) return;

    const currentPov = globe.pointOfView?.() || {};
    const currentAltitude = typeof currentPov.altitude === 'number'
      ? currentPov.altitude
      : cameraAltitude;
    const nextAltitude = Math.min(
      Math.max(currentAltitude * (direction === 'in' ? 0.72 : 1.35), 0.55),
      3.8
    );

    pendingAltitudeRef.current = nextAltitude;
    setCameraAltitude(nextAltitude);
    globe.pointOfView(
      {
        lat: currentPov.lat ?? 0,
        lng: currentPov.lng ?? 0,
        altitude: nextAltitude
      },
      650
    );
  };

  const cancelAutoRotateRamp = () => {
    if (autoRotateFrameRef.current !== null) {
      cancelAnimationFrame(autoRotateFrameRef.current);
      autoRotateFrameRef.current = null;
    }
  };

  const setAutoRotate = (enabled: boolean) => {
    const controls = globeRef.current?.controls();
    if (controls) {
      cancelAutoRotateRamp();
      controls.autoRotate = enabled;
      controls.autoRotateSpeed = enabled ? AUTO_ROTATE_SPEED : 0;
    }
  };

  const startAutoRotateSmooth = (duration = 1000) => {
    const controls = globeRef.current?.controls();
    if (!controls) return;

    cancelAutoRotateRamp();
    controls.autoRotate = true;

    const startedAt = performance.now();
    const startSpeed = Math.max(0, Number(controls.autoRotateSpeed) || 0);

    const tick = (now: number) => {
      const t = Math.min((now - startedAt) / duration, 1);
      const eased = t < 0.5
        ? 2 * t * t
        : 1 - Math.pow(-2 * t + 2, 2) / 2;

      controls.autoRotateSpeed = startSpeed + (AUTO_ROTATE_SPEED - startSpeed) * eased;

      if (t < 1) {
        autoRotateFrameRef.current = requestAnimationFrame(tick);
      } else {
        autoRotateFrameRef.current = null;
        controls.autoRotateSpeed = AUTO_ROTATE_SPEED;
      }
    };

    autoRotateFrameRef.current = requestAnimationFrame(tick);
  };

  const pauseAutoRotate = () => {
    if (manualRotateResumeTimerRef.current) clearTimeout(manualRotateResumeTimerRef.current);
    setAutoRotate(false);
  };

  const resumeAutoRotateAfterManualMove = () => {
    if (manualRotateResumeTimerRef.current) clearTimeout(manualRotateResumeTimerRef.current);
    manualRotateResumeTimerRef.current = setTimeout(() => {
      startAutoRotateSmooth(1000);
    }, 1000);
  };

  const cancelCountryExit = (key: string) => {
    const existingTimer = exitTimerRefs.current.get(key);
    if (existingTimer) clearTimeout(existingTimer);

    exitTimerRefs.current.delete(key);
    exitingCountriesRef.current.delete(key);
    exitingCountryProgressRef.current.delete(key);
    setExitingCountries(Array.from(exitingCountriesRef.current.values()));
  };

  const startCountryExit = (country: any) => {
    if (!country) return;

    const key = countryKey(country.from);

    const existingTimer = exitTimerRefs.current.get(key);
    if (existingTimer) clearTimeout(existingTimer);

    exitingCountriesRef.current.set(key, country);
    exitingCountryProgressRef.current.set(key, 0);
    setExitingCountries(Array.from(exitingCountriesRef.current.values()));

    const timer = setTimeout(() => {
      exitingCountriesRef.current.delete(key);
      exitingCountryProgressRef.current.delete(key);
      exitTimerRefs.current.delete(key);
      setExitingCountries(Array.from(exitingCountriesRef.current.values()));
      setExitProgressVersion((version) => version + 1);
    }, COUNTRY_EXIT_DURATION);

    exitTimerRefs.current.set(key, timer);
  };

  const clearSelectedCountry = (country = poppedCountryRef.current) => {
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    if (rotateTimerRef.current) clearTimeout(rotateTimerRef.current);
    if (manualRotateResumeTimerRef.current) clearTimeout(manualRotateResumeTimerRef.current);
    if (autoDeselectTimerRef.current) clearTimeout(autoDeselectTimerRef.current);

    startCountryExit(country);
    setPoppedCountry(null);
    setSelectedCountry(null);
    setSelectedCountryCount(0);
    startAutoRotateSmooth(1000);
  };

  const handleGlobePointerDown = (event: any) => {
    globePointerDownRef.current = {
      x: event.clientX,
      y: event.clientY
    };
    pauseAutoRotate();
  };

  const handleGlobePointerUp = (event: any) => {
    if (!globePointerDownRef.current) return;

    const deltaX = event.clientX - globePointerDownRef.current.x;
    const deltaY = event.clientY - globePointerDownRef.current.y;
    const moved = Math.hypot(deltaX, deltaY);

    globePointerDownRef.current = null;

    if (moved >= 6) {
      resumeAutoRotateAfterManualMove();
      return;
    }

    if (selectedCountry) {
      clearSelectedCountry();
    } else {
      startAutoRotateSmooth(350);
    }
  };

  // =========================
  // LIVE BACKEND DATA
  // =========================

  const ATTACK_POINTS = useMemo(() => {
    const cache = pointCacheRef.current;
    const activeKeys = new Set<string>();

    const points = geoData?.map((item: any) => {
      const lat = Number(item.lat);
      const lng = Number(item.lon);
      const country = item.country || 'Unknown';
      const key = `${countryKey(country)}:${lat.toFixed(3)}:${lng.toFixed(3)}`;

      activeKeys.add(key);

      const nextPoint = {
        lat,
        lng,
        label: item.city || country,
        size: Math.min(Math.max(Math.sqrt(item.count || 1) / 28, 0.11), 0.28),
        country,
        ip: item.ip || '',
        requests: item.count || 1
      };

      const existingPoint = cache.get(key);
      if (existingPoint) {
        Object.assign(existingPoint, nextPoint);
        return existingPoint;
      }

      cache.set(key, nextPoint);
      return nextPoint;
    }) || [];

    for (const key of cache.keys()) {
      if (!activeKeys.has(key)) {
        cache.delete(key);
      }
    }

    return points;
  }, [geoData]);

  // =========================
  // VISIBLE REQUEST DOTS
  // =========================

  const REQUEST_DOTS = useMemo(() => ATTACK_POINTS.filter((p: any) =>
    Number.isFinite(p.lat) && Number.isFinite(p.lng)
  ), [ATTACK_POINTS]);

  const REQUEST_SOURCES = useMemo(() => {
    if (!geoData) return [];
    const countryMap = new Map<string, any>();
    geoData.forEach((item: any) => {
      const countryName = item.country || 'Unknown';
      const key = countryKey(countryName);
      const count = Number(item.count) || 0;

      if (countryMap.has(key)) {
        countryMap.get(key).count = count;
      } else {
        countryMap.set(key, {
          from: countryName,
          count: count,
          fromLat: Number(item.lat),
          fromLng: Number(item.lon),
        });
      }
    });

    return Array.from(countryMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }, [geoData]);

  const SELECTED_COUNTRY_POLYGONS = useMemo(() => {
    const activeKeys = new Set<string>();

    if (poppedCountryKey) {
      activeKeys.add(poppedCountryKey);
    }

    exitingCountryKeys.forEach((key) => activeKeys.add(key));

    if (!activeKeys.size) return [];

    return countries.filter((feat: any) =>
      Array.from(activeKeys).some((key) => featureMatchesCountryKey(feat, key))
    );
  }, [countries, poppedCountryKey, exitingCountryKeys]);

  const COUNTRY_BORDER_PATHS = useMemo(
    () => countries.flatMap((feature: any) => extractBorderPaths(feature)),
    [countries]
  );

  const getBorderColor = (path: any) => {
    if (focusCountryKey && countryKey(path.country) !== focusCountryKey) {
      return mixHex(colors.strokeColor, colors.dimSide, Math.min(focusFade, 0.65));
    }

    return colors.strokeColor;
  };

  // =========================
  // LOAD WORLD GEOJSON
  // =========================

  useEffect(() => {
    fetch('/countries.geo.json')
      .then((r) => r.json())
      .then((data) => setCountries(data.features))
      .catch(() => { });
  }, []);

  // =========================
  // GLOBE TEXTURE Ã¢â¬â fixed stale closure
  //
  // All color logic is computed inline from snapshots of the current
  // render's values so the canvas never paints with stale data.
  // Previously getSurfaceCountryColor / getSurfaceBorderColor / colors.ocean
  // were captured from an outer render closure, causing COUNTRY_REQUEST_COUNTS
  // to appear empty and making every country the same dark shade as the ocean.
  // =========================

  useEffect(() => {
    if (!countries.length) return;

    // Snapshot every value the canvas needs right now.
    const oceanColor = isLight ? '#779bca' : '#020b1d';
    const normalColor = isLight ? '#d7dde5' : '#202833ff';
    const dimNormalColor = isLight ? '#b8c0cc' : '#2c3e69';
    const dimCountryColor = isLight ? '#2c3e69' : '#2c3e69';
    const strokeColorVal = isLight ? '#2563eb' : '#8db8ff';
    const dimSideColor = isLight ? '#7a5a5e' : '#32191d';

    // Inline country fill Ã¢â¬â uses the snapshotted COUNTRY_REQUEST_COUNTS
    const getCountryFill = (feature: any, dimmed: boolean): string => {
      const name = feature.properties?.name ?? '';
      const requestCount = COUNTRY_REQUEST_COUNTS.get(countryKey(name)) || 0;

      if (!requestCount || !maxCountryRequestCount) {
        return dimmed ? dimNormalColor : normalColor;
      }

      const severity = Math.log1p(requestCount) / Math.log1p(maxCountryRequestCount);
      let base: string;

      const flippedSeverity = 1 - severity;

      if (flippedSeverity < 0.25) {
        base = mixHex('#3a1d21', '#5a252b', flippedSeverity / 0.25);
      } else if (flippedSeverity < 0.5) {
        base = mixHex('#5a252b', '#7a3036', (flippedSeverity - 0.25) / 0.25);
      } else if (flippedSeverity < 0.75) {
        base = mixHex('#7a3036', '#a4454b', (flippedSeverity - 0.5) / 0.25);
      } else {
        base = mixHex('#a4454b', '#c0565c', (flippedSeverity - 0.75) / 0.25);
      }

      return dimmed ? mixHex(base, dimCountryColor, 1) : base;
    };

    const getBorderStroke = (dimmed: boolean): string =>
      dimmed
        ? mixHex(strokeColorVal, dimSideColor, 0.65)
        : strokeColorVal;

    const renderTexture = (dimmed: boolean) => {
      const canvas = document.createElement('canvas');
      canvas.width = COUNTRY_TEXTURE_WIDTH;
      canvas.height = COUNTRY_TEXTURE_HEIGHT;

      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      // Ocean fill Ã¢â¬â always the dark/blue ocean color, never country color
      ctx.fillStyle = oceanColor;
      ctx.fillRect(0, 0, COUNTRY_TEXTURE_WIDTH, COUNTRY_TEXTURE_HEIGHT);

      const projection = geoEquirectangular()
        .scale(COUNTRY_TEXTURE_WIDTH / (2 * Math.PI))
        .translate([COUNTRY_TEXTURE_WIDTH / 2, COUNTRY_TEXTURE_HEIGHT / 2])
        .precision(0.1);

      // Fill countries Ã¢â¬â gray for zero-request, severity-colored for active
      countries
        .map((feature: any) => removePolarRings(feature))
        .filter(Boolean)
        .forEach((feature: any) => {
          ctx.beginPath();
          drawProjectedFeaturePath(ctx, projection, feature);
          ctx.fillStyle = getCountryFill(feature, dimmed);
          ctx.fill('evenodd');
        });

      // Stroke borders on top
      countries
        .map((feature: any) => removePolarRings(feature))
        .filter(Boolean)
        .forEach((feature: any) => {
          ctx.beginPath();
          drawProjectedFeaturePath(ctx, projection, feature, false);
          ctx.strokeStyle = getBorderStroke(dimmed);
          ctx.lineWidth = 1.4;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.stroke();
        });

      const seamWidth = 2;
      ctx.drawImage(canvas, seamWidth, 0, seamWidth, COUNTRY_TEXTURE_HEIGHT, COUNTRY_TEXTURE_WIDTH - seamWidth, 0, seamWidth, COUNTRY_TEXTURE_HEIGHT);
      ctx.drawImage(canvas, COUNTRY_TEXTURE_WIDTH - seamWidth * 2, 0, seamWidth, COUNTRY_TEXTURE_HEIGHT, 0, 0, seamWidth, COUNTRY_TEXTURE_HEIGHT);

      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.needsUpdate = true;

      return texture;
    };

    const baseTexture = renderTexture(false);
    const dimTexture = renderTexture(true);

    if (!baseTexture || !dimTexture) return;

    const existingMaterial = globeMaterialRef.current;

    if (existingMaterial) {
      existingMaterial.uniforms.baseTexture.value?.dispose?.();
      existingMaterial.uniforms.dimTexture.value?.dispose?.();
      existingMaterial.uniforms.baseTexture.value = baseTexture;
      existingMaterial.uniforms.dimTexture.value = dimTexture;
      existingMaterial.uniforms.fade.value = focusFadeRef.current;
      existingMaterial.needsUpdate = true;
      return;
    }

    const material = new THREE.ShaderMaterial({
      uniforms: {
        baseTexture: { value: baseTexture },
        dimTexture: { value: dimTexture },
        fade: { value: focusFadeRef.current },
      },
      vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
      fragmentShader: `
                uniform sampler2D baseTexture;
                uniform sampler2D dimTexture;
                uniform float fade;
                varying vec2 vUv;
                void main() {
                    vec4 baseColor = texture2D(baseTexture, vUv);
                    vec4 dimColor = texture2D(dimTexture, vUv);
                    gl_FragColor = mix(baseColor, dimColor, fade);
                }
            `,
    });

    globeMaterialRef.current = material;
    setGlobeMaterial(material);
  }, [
    countries,
    COUNTRY_REQUEST_COUNTS,
    maxCountryRequestCount,
    isLight
  ]);

  // =========================
  // RESPONSIVE
  // =========================

  useEffect(() => {
    const el = containerRef.current;

    if (!el) return;

    const obs = new ResizeObserver((entries) => {
      for (const e of entries) {
        const { width, height } = e.contentRect;

        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    });

    obs.observe(el);

    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
      if (rotateTimerRef.current) clearTimeout(rotateTimerRef.current);
      if (manualRotateResumeTimerRef.current) clearTimeout(manualRotateResumeTimerRef.current);
      if (autoDeselectTimerRef.current) clearTimeout(autoDeselectTimerRef.current);
      if (zoomFrameRef.current !== null) cancelAnimationFrame(zoomFrameRef.current);
      if (focusFrameRef.current !== null) cancelAnimationFrame(focusFrameRef.current);
      exitTimerRefs.current.forEach((timer) => clearTimeout(timer));
      exitTimerRefs.current.clear();
      if (autoRotateFrameRef.current !== null) cancelAnimationFrame(autoRotateFrameRef.current);
    };
  }, []);

  useEffect(() => {
    const target = selectedCountryKey ? 1 : 0;
    if (selectedCountryKey) {
      setFocusCountryKey(selectedCountryKey);
    }

    const start = focusFadeRef.current;
    const startedAt = performance.now();
    const duration = 900;

    if (focusFrameRef.current !== null) {
      cancelAnimationFrame(focusFrameRef.current);
    }

    const tick = (now: number) => {
      const t = Math.min((now - startedAt) / duration, 1);
      const eased = t < 0.5
        ? 2 * t * t
        : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const next = start + (target - start) * eased;

      focusFadeRef.current = next;

      if (globeMaterialRef.current) {
        globeMaterialRef.current.uniforms.fade.value = next;
      }

      refreshRequestDotOpacity();

      if (t < 1) {
        focusFrameRef.current = requestAnimationFrame(tick);
      } else {
        focusFrameRef.current = null;
        setFocusFade(target);
        if (!selectedCountryKey) {
          setFocusCountryKey('');
        }
        refreshRequestDotOpacity();
      }
    };

    focusFrameRef.current = requestAnimationFrame(tick);
  }, [selectedCountryKey, refreshRequestDotOpacity]);

  // =========================
  // CLICK COUNTRY
  // =========================

  const handleRowClick = (source: any) => {

    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    if (rotateTimerRef.current) clearTimeout(rotateTimerRef.current);
    if (autoDeselectTimerRef.current) clearTimeout(autoDeselectTimerRef.current);

    setAutoRotate(false);
    if (poppedCountry && countryKey(poppedCountry.from) !== countryKey(source.from)) {
      startCountryExit(poppedCountry);
      setPoppedCountry(null);
    }
    cancelCountryExit(countryKey(source.from));
    setSelectedCountry(null);
    setSelectedCountryCount(source.count || 0);

    const sourceKey = countryKey(source.from);
    const selectedFeature = countries.find((feat: any) =>
      featureMatchesCountryKey(feat, sourceKey)
    );
    const countryViewpoint = selectedFeature
      ? getCountryViewpoint(selectedFeature, source)
      : {
        lat: source.fromLat,
        lng: source.fromLng,
        altitude: 0.85
      };

    globeRef.current?.pointOfView(
      countryViewpoint,
      1800
    );

    revealTimerRef.current = setTimeout(() => {
      setSelectedCountry(source);
      setPoppedCountry(source);
      autoDeselectTimerRef.current = setTimeout(() => {
        clearSelectedCountry(source);
      }, 20000);

      rotateTimerRef.current = setTimeout(() => {
        startAutoRotateSmooth(1200);
      }, 10000);
    }, 120);
  };

  const countryLegendGradient = 'linear-gradient(90deg, #c0565c 0%, #a4454b 25%, #7a3036 50%, #5a252b 75%, #3a1d21 100%)';

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        width: '100%',
        overflow: 'hidden'
      }}
    >

      {/* LEFT TABLE - Adjusted to 40% width */}

      <div
        style={{
          width: '40%',
          minWidth: '40%',
          display: 'flex',
          flexDirection: 'column',
          borderRight: `1px solid ${colors.panelBorder}`,
          overflow: 'hidden'
        }}
      >


        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 100px',
            padding: '8px 16px',
            fontSize: '11px',
            fontWeight: 700,
            color: colors.text,
            borderBottom: `1px solid ${colors.panelBorder}`,
          }}
        >
          <span>COUNTRY</span>
          <span style={{ textAlign: 'right' }}>COUNT</span>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >

          <style jsx>{`
                        div::-webkit-scrollbar {
                            display: none;
                        }
                    `}</style>

          {REQUEST_SOURCES.map((source: any, i: number) => {

            const isSel = isSelectedCountry(source.from);
            const isHov = hoveredRow === i;

            return (
              <div
                key={i}
                onClick={() => handleRowClick(source)}
                onMouseEnter={() => setHoveredRow(i)}
                onMouseLeave={() => setHoveredRow(null)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 100px',
                  alignItems: 'center',
                  padding: '10px 16px',
                  cursor: 'pointer',
                  borderBottom: `1px solid ${colors.subtleBorder}`,
                  borderLeft: isSel
                    ? '2px solid #ef4444'
                    : '2px solid transparent',
                  backgroundColor: isSel
                    ? colors.rowSelected
                    : isHov
                      ? colors.rowHover
                      : 'transparent',
                }}
              >

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    minWidth: 0
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      backgroundColor: '#ef4444',
                      flexShrink: 0
                    }}
                  />

                  <span
                    style={{
                      fontSize: 12,
                      color: isSel
                        ? colors.text
                        : colors.mutedText,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {source.from}
                  </span>
                </div>

                <div
                  style={{
                    textAlign: 'right',
                    fontSize: 12,
                    fontWeight: 700,
                    color: isSel
                      ? colors.selectedCount
                      : colors.text,
                    whiteSpace: 'nowrap'
                  }}
                >
                  {source.count.toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* GLOBE */}

      <div
        ref={containerRef}
        onPointerDown={handleGlobePointerDown}
        onPointerUp={handleGlobePointerUp}
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden'
        }}
      >

        <Globe
          ref={globeRef}
          globeImageUrl={!globeMaterial ? colors.globeImage : null}
          globeMaterial={globeMaterial}
          backgroundColor={colors.globeBackground}
          width={dimensions.width}
          height={dimensions.height}
          enablePointerInteraction={false}
          globeCurvatureResolution={4}
          showAtmosphere={true}
          atmosphereColor={isLight ? '#93c5fd' : '#1e3a8a'}
          atmosphereAltitude={0.06}

          polygonsData={SELECTED_COUNTRY_POLYGONS}
          polygonCapCurvatureResolution={4}

          polygonCapColor={getCountryCapColor}
          polygonCapMaterial={getCountryCapMaterial}

          polygonSideColor={getCountrySideColor}

          polygonStrokeColor={() => colors.strokeColor}

          polygonAltitude={(feat: any) => {
            const name = feat.properties?.name ?? '';

            return getCountryRoofAltitude(name);
          }}

          polygonsTransitionDuration={900}

          htmlElementsData={REQUEST_DOTS}
          htmlLat={(d: any) => d.lat}
          htmlLng={(d: any) => d.lng}
          htmlAltitude={(d: any) => requestDotAltitude(d)}
          htmlElement={createRequestDotElement}
          htmlElementVisibilityModifier={updateRequestDotElement}
          htmlTransitionDuration={900}
          pathsData={EMPTY_CUSTOM_LAYER}
          customLayerData={EMPTY_CUSTOM_LAYER}

          onZoom={handleZoom}

          ringsData={
            selectedCountry
              ? [
                {
                  lat: selectedCountry.fromLat,
                  lng: selectedCountry.fromLng
                }
              ]
              : []
          }

          ringColor={() => 'rgba(255,100,100,0.5)'}
          ringMaxRadius={6}
          ringPropagationSpeed={2}
          ringRepeatPeriod={800}

          onGlobeReady={() => {

            if (!globeRef.current) return;

            const controls = globeRef.current.controls();

            controls.autoRotate = true;
            controls.autoRotateSpeed = AUTO_ROTATE_SPEED;
          }}
        />

        <div
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
          style={{
            position: 'absolute',
            left: 16,
            bottom: 16,
            zIndex: 100,
            width: 120,
            color: colors.text,
            pointerEvents: 'auto'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 6,
              fontSize: 9,
              fontWeight: 700,
              textTransform: 'uppercase'
            }}
          >



          </div>

          <div
            style={{
              height: 7,
              borderRadius: 999,
              background: countryLegendGradient,
              border: `1px solid ${colors.subtleBorder}`
            }}
          />

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 5,
              color: colors.mutedText,
              fontSize: 9,
              fontWeight: 600
            }}
          >
            <span>Low</span>
            <span>High</span>
          </div>
        </div>

        <div
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
          style={{
            position: 'absolute',
            right: 16,
            bottom: 16,
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column-reverse',
            gap: 8,
            pointerEvents: 'auto'
          }}
        >
          <button
            type="button"
            onClick={() => zoomGlobe('out')}
            title="Zoom out"
            aria-label="Zoom out"
            style={{
              width: 28,
              height: 28,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 6,
              border: `1px solid ${colors.subtleBorder}`,
              background: 'hsla(var(--card) / 0.8)',
              backdropFilter: 'blur(12px)',
              color: colors.text,
              cursor: 'pointer'
            }}
          >
            <ZoomOut size={15} />
          </button>
          <button
            type="button"
            onClick={() => zoomGlobe('in')}
            title="Zoom in"
            aria-label="Zoom in"
            style={{
              width: 28,
              height: 28,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 6,
              border: `1px solid ${colors.subtleBorder}`,
              background: 'hsla(var(--card) / 0.8)',
              backdropFilter: 'blur(12px)',
              color: colors.text,
              cursor: 'pointer'
            }}
          >
            <ZoomIn size={15} />
          </button>
        </div>

        {selectedCountry && (
          <div
            onPointerDown={(event) => event.stopPropagation()}
            onPointerUp={(event) => event.stopPropagation()}
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              zIndex: 100,
              background: 'hsla(var(--card) / 0.8)',
              backdropFilter: 'blur(12px)',
              border: `1px solid ${colors.popoverBorder}`,
              borderRadius: 16,
              boxShadow: '0 4px 16px -4px rgba(0,0,0,0.5)',
              padding: '9px 12px',
              minWidth: 165,
              color: colors.text
            }}
          >

            <div
              style={{
                fontSize: 9,
                textTransform: 'uppercase',
                color: colors.text,
                marginBottom: 5,
                fontWeight: 700
              }}
            >
              Active Attack Source
            </div>

            <div
              style={{
                fontSize: 17,
                fontWeight: 700,
                marginBottom: 6,
              }}
            >
              {selectedCountry.from}
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'hsla(var(--card) / 0.8)',
                backdropFilter: 'blur(12px)',
                borderRadius: 8,
                padding: '6px 8px'
              }}
            >

              <span
                style={{
                  fontSize: 10,
                  color: colors.mutedText
                }}
              >
                Requests
              </span>

              <span
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: '#ff7b7b'
                }}
              >
                {selectedCountryCount.toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
