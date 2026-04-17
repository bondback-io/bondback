"use client";

import * as React from "react";
import {
  Circle,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { cn } from "@/lib/utils";
import type { FindJobsMapPoint } from "@/lib/find-jobs/map-types";
import { useFindJobsMap, type FindJobsMapFocusRequest } from "@/components/find-jobs/find-jobs-map-context";
import { FindJobsMapRadiusControl } from "@/components/find-jobs/find-jobs-map-radius-control";

function makeBondBackIcon(selected: boolean): L.DivIcon {
  const color = selected ? "rgb(5 150 105)" : "rgb(16 185 129)";
  const ring = selected
    ? "0 0 0 3px rgba(255,255,255,0.95), 0 2px 8px rgba(0,0,0,0.35)"
    : "0 2px 8px rgba(0,0,0,0.3)";
  const html = `<div style="width:36px;height:44px;display:flex;align-items:flex-start;justify-content:center;padding-top:2px;">
      <div style="width:28px;height:28px;border-radius:9999px;background:${color};box-shadow:${ring};border:2px solid white;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:11px;color:white;font-family:system-ui,sans-serif;">BB</div>
    </div>`;
  return L.divIcon({
    className: "bondback-map-marker",
    html,
    iconSize: [36, 44],
    iconAnchor: [18, 40],
    popupAnchor: [0, -34],
  });
}

const ICON_NORMAL = makeBondBackIcon(false);
const ICON_SELECTED = makeBondBackIcon(true);

function userLocationIcon() {
  return L.divIcon({
    className: "bondback-user-loc",
    html: `<div style="width:16px;height:16px;border-radius:9999px;background:#2563eb;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function FitInitialBounds({
  points,
  centerLat,
  centerLon,
}: {
  points: FindJobsMapPoint[];
  centerLat: number;
  centerLon: number;
}) {
  const map = useMap();
  const signature = React.useMemo(
    () => points.map((p) => p.id).join(","),
    [points]
  );
  const lastSig = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (signature === lastSig.current) return;
    lastSig.current = signature;
    const valid = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
    if (valid.length === 0) {
      map.setView([centerLat, centerLon], 10);
      return;
    }
    const b = L.latLngBounds(valid.map((p) => [p.lat, p.lon] as [number, number]));
    b.extend([centerLat, centerLon]);
    map.fitBounds(b, { padding: [40, 40], maxZoom: 14 });
  }, [map, points, signature, centerLat, centerLon]);
  return null;
}

function VisibleMarkers({
  points,
  onPinSelect,
  markerRefs,
}: {
  points: FindJobsMapPoint[];
  onPinSelect: (id: string) => void;
  markerRefs: React.MutableRefObject<Map<string, L.Marker>>;
}) {
  const map = useMap();
  const [bounds, setBounds] = React.useState(() => map.getBounds());
  useMapEvents({
    moveend() {
      setBounds(map.getBounds());
    },
    zoomend() {
      setBounds(map.getBounds());
    },
  });

  const pad = 0.08;
  const extended = L.latLngBounds(
    [bounds.getSouth() - pad, bounds.getWest() - pad],
    [bounds.getNorth() + pad, bounds.getEast() + pad]
  );

  const { highlightedListingId } = useFindJobsMap();

  const visible = React.useMemo(() => {
    return points.filter((p) => extended.contains([p.lat, p.lon]));
  }, [points, extended]);

  return (
    <>
      {visible.map((p) => (
        <Marker
          key={`${p.id}-${highlightedListingId === p.id ? "1" : "0"}`}
          position={[p.lat, p.lon]}
          icon={highlightedListingId === p.id ? ICON_SELECTED : ICON_NORMAL}
          eventHandlers={{
            click: () => onPinSelect(p.id),
          }}
          ref={(instance) => {
            if (instance) markerRefs.current.set(p.id, instance);
            else markerRefs.current.delete(p.id);
          }}
        />
      ))}
    </>
  );
}

function MapFocusSync({
  focusRequest,
  points,
  markerRefs,
  onConsumed,
}: {
  focusRequest: FindJobsMapFocusRequest | null;
  points: FindJobsMapPoint[];
  markerRefs: React.MutableRefObject<Map<string, L.Marker>>;
  onConsumed: () => void;
}) {
  const map = useMap();

  React.useEffect(() => {
    if (!focusRequest) return;
    const focusId = focusRequest.id;
    const p = points.find((x) => x.id === focusId);
    if (!p) {
      onConsumed();
      return;
    }

    const zoom = Math.max(map.getZoom(), 13);
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const finish = () => {
      onConsumed();
    };

    if (prefersReduced) {
      map.setView([p.lat, p.lon], zoom, { animate: false });
      finish();
      return;
    }

    const onMoveEnd = () => {
      finish();
    };
    map.once("moveend", onMoveEnd);
    map.flyTo([p.lat, p.lon], zoom, { duration: 0.22 });

    const safety = window.setTimeout(() => {
      map.off("moveend", onMoveEnd);
      finish();
    }, 900);

    return () => {
      window.clearTimeout(safety);
      map.off("moveend", onMoveEnd);
    };
  }, [focusRequest, points, map, markerRefs, onConsumed]);

  return null;
}

export type FindJobsMapPaneProps = {
  points: FindJobsMapPoint[];
  centerLat: number;
  centerLon: number;
  radiusKm: number;
};

export function FindJobsMapPane({ points, centerLat, centerLon, radiusKm }: FindJobsMapPaneProps) {
  const {
    detailListing,
    setHighlightedListingId,
    mapFocusRequest,
    clearMapFocusRequest,
    setDetailListing,
    getListingById,
  } = useFindJobsMap();

  const markerRefs = React.useRef<Map<string, L.Marker>>(new Map());

  const [userLoc, setUserLoc] = React.useState<{ lat: number; lon: number } | null>(null);

  React.useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLoc({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      () => {},
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 12_000 }
    );
  }, []);

  const onPinSelect = React.useCallback(
    (id: string) => {
      if (detailListing && String(detailListing.id) === id) {
        setDetailListing(null);
        return;
      }
      setHighlightedListingId(id);
      const row = getListingById(id);
      if (row) setDetailListing(row);
      const el = document.querySelector(`[data-find-job-card="${CSS.escape(id)}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    },
    [detailListing, setHighlightedListingId, getListingById, setDetailListing]
  );

  const radiusM = Math.max(1000, radiusKm * 1000);

  return (
    <div className="relative h-full min-h-[280px] w-full bg-muted/30 dark:bg-gray-900/50">
      <MapContainer
        center={[centerLat, centerLon]}
        zoom={11}
        className={cn("z-0 h-full min-h-[280px] w-full rounded-none lg:min-h-0")}
        scrollWheelZoom
        aria-label="Job locations map"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        <Circle
          center={[centerLat, centerLon]}
          radius={radiusM}
          pathOptions={{
            color: "#10b981",
            fillColor: "#10b981",
            fillOpacity: 0.06,
            weight: 1,
          }}
        />
        <FitInitialBounds points={points} centerLat={centerLat} centerLon={centerLon} />
        <VisibleMarkers
          points={points}
          onPinSelect={onPinSelect}
          markerRefs={markerRefs}
        />
        <MapFocusSync
          focusRequest={mapFocusRequest}
          points={points}
          markerRefs={markerRefs}
          onConsumed={clearMapFocusRequest}
        />
        {userLoc ? (
          <Marker position={[userLoc.lat, userLoc.lon]} icon={userLocationIcon()}>
            <Popup>Your location</Popup>
          </Marker>
        ) : null}
      </MapContainer>
      <div className="pointer-events-none absolute left-3 top-3 z-[1000] rounded-lg bg-background/90 px-2.5 py-1.5 text-xs font-medium text-muted-foreground shadow-sm ring-1 ring-border backdrop-blur dark:bg-gray-950/90 dark:text-gray-400 dark:ring-gray-800">
        {radiusKm} km search · {points.length} job{points.length === 1 ? "" : "s"} on map
      </div>
      <React.Suspense fallback={null}>
        <FindJobsMapRadiusControl radiusKm={radiusKm} />
      </React.Suspense>
    </div>
  );
}
