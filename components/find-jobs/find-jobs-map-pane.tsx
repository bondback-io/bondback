"use client";

import * as React from "react";
import {
  Circle,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  Tooltip,
  ZoomControl,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Filter, Navigation, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FindJobsMapPoint } from "@/lib/find-jobs/map-types";
import {
  useFindJobsMap,
  type FindJobsMapFocusRequest,
} from "@/components/find-jobs/find-jobs-map-context";
import { FindJobsMapRadiusControl } from "@/components/find-jobs/find-jobs-map-radius-control";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  dominantServiceTypeFromCounts,
  type ServiceTypeKey,
} from "@/lib/service-types";
import { FIND_JOBS_MAP_POINTS_SOFT_CAP } from "@/lib/find-jobs/map-points-from-listings";

const MARKER_TO_POINT = new WeakMap<L.Marker, FindJobsMapPoint>();

type MarkerClusterGroupWithIcons = L.LayerGroup & {
  clearLayers: () => void;
  addLayer: (layer: L.Layer) => L.LayerGroup;
  removeLayer: (layer: L.Layer) => L.LayerGroup;
  getBounds: () => L.LatLngBounds;
  on: (ev: string, fn: (e: L.LeafletEvent) => void) => unknown;
};

function clusterColorForService(st: ServiceTypeKey): string {
  switch (st) {
    case "recurring_house_cleaning":
      return "rgb(22 163 74)";
    case "airbnb_turnover":
      return "rgb(217 119 6)";
    case "deep_clean":
      return "rgb(147 51 234)";
    default:
      return "rgb(37 99 235)";
  }
}

function makeClusterIcon(count: number, dominant: ServiceTypeKey): L.DivIcon {
  const bg = clusterColorForService(dominant);
  const html = `<div style="min-width:36px;height:36px;border-radius:9999px;background:${bg};border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;color:white;font-family:system-ui,sans-serif;padding:0 8px;">${count}</div>`;
  return L.divIcon({
    className: "bondback-cluster-icon",
    html,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

function pinInnerHtml(p: FindJobsMapPoint, selected: boolean): string {
  const urgent = p.isUrgent;
  const st = p.serviceType;
  let fill = "rgb(37 99 235)";
  let size = 28;
  let glyph = "BB";
  if (st === "recurring_house_cleaning") {
    fill = "rgb(22 163 74)";
    size = 32;
    glyph = "📅";
  } else if (st === "airbnb_turnover") {
    fill = "rgb(217 119 6)";
    glyph = "★";
  } else if (st === "deep_clean") {
    fill = "rgb(147 51 234)";
    glyph = "✦";
  }
  if (selected) fill = "rgb(220 38 38)";
  const pulse =
    urgent || st === "recurring_house_cleaning"
      ? `animation:bb-pin-pulse ${urgent ? "0.9s" : "1.4s"} ease-in-out infinite`
      : "";
  const ring = selected
    ? "0 0 0 3px rgba(255,255,255,0.95), 0 2px 8px rgba(0,0,0,0.35)"
    : "0 2px 8px rgba(0,0,0,0.3)";
  const urgentDot = urgent
    ? `<span style="position:absolute;top:-2px;right:-2px;width:12px;height:12px;border-radius:9999px;background:#ef4444;border:2px solid white;box-shadow:0 0 0 1px rgba(0,0,0,0.15);"></span>`
    : "";
  return `<div style="position:relative;width:${size + 8}px;height:${size + 14}px;display:flex;align-items:flex-start;justify-content:center;padding-top:2px;">
    <div style="width:${size}px;height:${size}px;border-radius:9999px;background:${fill};box-shadow:${ring};border:2px solid white;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:${st === "bond_cleaning" ? 11 : 14}px;color:white;font-family:system-ui,sans-serif;${pulse ? pulse + ";" : ""}">${glyph}</div>
    ${urgentDot}
  </div>`;
}

function makeServiceIcon(p: FindJobsMapPoint, selected: boolean): L.DivIcon {
  const size = p.serviceType === "recurring_house_cleaning" ? 40 : 36;
  const anchorY = p.serviceType === "recurring_house_cleaning" ? 44 : 40;
  return L.divIcon({
    className: cn("bondback-map-marker", p.isUrgent && "bb-pin-urgent"),
    html: pinInnerHtml(p, selected),
    iconSize: [size, size + 8],
    iconAnchor: [size / 2, anchorY],
    popupAnchor: [0, -28],
  });
}

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
  const signature = React.useMemo(() => points.map((p) => p.id).join(","), [points]);
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
    if (
      !Number.isFinite(p.lat) ||
      !Number.isFinite(p.lon) ||
      Math.abs(p.lat) > 90 ||
      Math.abs(p.lon) > 180
    ) {
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

function useIsMobileMap() {
  const [m, setM] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const apply = () => setM(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return m;
}

function ClusteredJobMarkers({
  points,
  onPinSelect,
  markerRefs,
}: {
  points: FindJobsMapPoint[];
  onPinSelect: (id: string) => void;
  markerRefs: React.MutableRefObject<Map<string, L.Marker>>;
}) {
  const map = useMap();
  const { highlightedListingId } = useFindJobsMap();
  const clusterRef = React.useRef<MarkerClusterGroupWithIcons | null>(null);
  const isMobile = useIsMobileMap();

  React.useEffect(() => {
    const Lc = L as typeof L & {
      markerClusterGroup: (opts?: Record<string, unknown>) => MarkerClusterGroupWithIcons;
    };
    const mcg = Lc.markerClusterGroup({
      maxClusterRadius: isMobile ? 52 : 72,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      iconCreateFunction: (cluster: {
        getChildCount: () => number;
        getAllChildMarkers: () => L.Marker[];
      }) => {
        const markers = cluster.getAllChildMarkers();
        const counts: Partial<Record<ServiceTypeKey, number>> = {};
        for (const mk of markers) {
          const pt = MARKER_TO_POINT.get(mk);
          if (!pt) continue;
          counts[pt.serviceType] = (counts[pt.serviceType] ?? 0) + 1;
        }
        const dominant = dominantServiceTypeFromCounts(counts);
        return makeClusterIcon(cluster.getChildCount(), dominant);
      },
    });
    clusterRef.current = mcg;
    map.addLayer(mcg);
    return () => {
      map.removeLayer(mcg);
      clusterRef.current = null;
    };
  }, [map, isMobile]);

  React.useEffect(() => {
    const mcg = clusterRef.current;
    if (!mcg) return;
    mcg.clearLayers();
    markerRefs.current.clear();
    const capped = points.slice(0, FIND_JOBS_MAP_POINTS_SOFT_CAP);
    capped.forEach((p, stackIndex) => {
      const selected = highlightedListingId === p.id;
      const icon = makeServiceIcon(p, selected);
      const marker = L.marker([p.lat, p.lon], { icon });
      MARKER_TO_POINT.set(marker, p);
      marker.on("click", () => onPinSelect(p.id));
      marker.setZIndexOffset(selected ? 3500 : 200 + stackIndex);
      markerRefs.current.set(p.id, marker);
      mcg.addLayer(marker);
    });
  }, [points, highlightedListingId, onPinSelect, markerRefs]);

  return null;
}

/** Non-clustered tooltips require Marker children — render lightweight duplicate markers for hover only when not practical; cluster handles click. */
function MapPinPulseStyle() {
  return (
    <style>{`
@keyframes bb-pin-pulse { 0%, 100% { opacity: 1; filter: brightness(1); transform: scale(1); } 50% { opacity: 0.92; filter: brightness(1.08); transform: scale(1.06); } }
`}</style>
  );
}

export type FindJobsMapPaneProps = {
  points: FindJobsMapPoint[];
  centerLat: number;
  centerLon: number;
  radiusKm: number;
};

export function FindJobsMapPane({ points, centerLat, centerLon, radiusKm }: FindJobsMapPaneProps) {
  const router = useRouter();
  const {
    detailListing,
    setHighlightedListingId,
    mapFocusRequest,
    clearMapFocusRequest,
    setDetailListing,
    getListingById,
  } = useFindJobsMap();

  const markerRefs = React.useRef<Map<string, L.Marker>>(new Map());
  const isMobile = useIsMobileMap();

  const [userLoc, setUserLoc] = React.useState<{ lat: number; lon: number } | null>(null);
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [pullDist, setPullDist] = React.useState(0);
  const touchStartY = React.useRef<number | null>(null);

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

  const [previewRadiusKm, setPreviewRadiusKm] = React.useState(radiusKm);
  React.useEffect(() => {
    setPreviewRadiusKm(radiusKm);
  }, [radiusKm]);

  const displayRadiusKm = previewRadiusKm;
  const radiusM = Math.max(1000, displayRadiusKm * 1000);

  const circlePathOptions = React.useMemo(
    () => ({
      color: "#10b981",
      fillColor: "#10b981",
      fillOpacity: 0.1,
      weight: 2,
    }),
    []
  );

  const flyToUser = React.useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setUserLoc({ lat, lon });
        window.dispatchEvent(
          new CustomEvent("bondback:find-jobs-map-fly-to", { detail: { lat, lon, zoom: 13 } })
        );
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 0, timeout: 12_000 }
    );
  }, []);

  return (
    <div
      className={cn(
        "relative w-full bg-muted/30 dark:bg-gray-900/50",
        isMobile ? "min-h-[min(100dvh,720px)] h-[100dvh] max-h-[100dvh] touch-pan-x touch-pan-y" : "h-full min-h-[280px]"
      )}
      onTouchStart={(e) => {
        if (!isMobile || window.scrollY > 8) return;
        touchStartY.current = e.touches[0]?.clientY ?? null;
      }}
      onTouchMove={(e) => {
        if (touchStartY.current == null) return;
        const y = e.touches[0]?.clientY ?? 0;
        const d = Math.max(0, y - touchStartY.current);
        if (window.scrollY <= 2 && d > 0) setPullDist(Math.min(d, 80));
      }}
      onTouchEnd={() => {
        if (pullDist > 48) {
          router.refresh();
        }
        setPullDist(0);
        touchStartY.current = null;
      }}
    >
      <MapPinPulseStyle />
      {pullDist > 8 ? (
        <div
          className="pointer-events-none absolute left-1/2 top-2 z-[2000] -translate-x-1/2 rounded-full bg-background/95 px-3 py-1 text-xs font-medium shadow-md ring-1 ring-border"
          style={{ opacity: Math.min(1, pullDist / 48) }}
        >
          Release to refresh
        </div>
      ) : null}
      <MapContainer
        center={[centerLat, centerLon]}
        zoom={11}
        className={cn(
          "z-0 w-full rounded-none",
          isMobile ? "h-full min-h-0" : "h-full min-h-[280px] lg:min-h-0"
        )}
        scrollWheelZoom
        zoomControl={false}
        aria-label="Job locations map"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        <ZoomControl position="topright" />
        <Circle center={[centerLat, centerLon]} radius={radiusM} pathOptions={circlePathOptions} />
        <FitInitialBounds points={points} centerLat={centerLat} centerLon={centerLon} />
        <ClusteredJobMarkers points={points} onPinSelect={onPinSelect} markerRefs={markerRefs} />
        <MapFlyToListener />
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
      <div className="pointer-events-none absolute left-3 top-3 z-[1000] max-w-[min(100%,220px)] rounded-lg bg-background/90 px-2.5 py-1.5 text-xs font-medium text-muted-foreground shadow-sm ring-1 ring-border backdrop-blur dark:bg-gray-950/90 dark:text-gray-400 dark:ring-gray-800">
        {displayRadiusKm} km search · {points.length} job{points.length === 1 ? "" : "s"} on map
      </div>

      {isMobile ? (
        <div className="pointer-events-auto absolute bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-3 z-[1100] flex flex-col gap-2">
          <Button
            type="button"
            size="icon"
            className="h-12 w-12 rounded-full border border-border/80 bg-background/95 shadow-lg backdrop-blur dark:bg-gray-950/95"
            onClick={flyToUser}
            aria-label="Centre map on my location"
          >
            <Navigation className="h-5 w-5" aria-hidden />
          </Button>
          <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
            <SheetTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="h-12 w-12 rounded-full border border-border/80 shadow-lg"
                aria-label="Filter jobs"
              >
                <Filter className="h-5 w-5" aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl">
              <SheetTitle className="sr-only">Map filters</SheetTitle>
              <FindJobsMapFilterForm onApplied={() => setFilterOpen(false)} />
            </SheetContent>
          </Sheet>
          <Button
            type="button"
            size="icon"
            className="h-12 w-12 rounded-full bg-emerald-600 text-white shadow-lg hover:bg-emerald-700"
            asChild
          >
            <Link href="/listings/new" aria-label="List a job">
              <Plus className="h-5 w-5" aria-hidden />
            </Link>
          </Button>
        </div>
      ) : null}

      <React.Suspense fallback={null}>
        <FindJobsMapRadiusControl radiusKm={radiusKm} onPreviewKmChange={setPreviewRadiusKm} />
      </React.Suspense>
    </div>
  );
}

function MapFlyToListener() {
  const map = useMap();
  React.useEffect(() => {
    const handler = (ev: Event) => {
      const ce = ev as CustomEvent<{ lat: number; lon: number; zoom?: number }>;
      const { lat, lon, zoom } = ce.detail;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      map.flyTo([lat, lon], zoom ?? 13, { duration: 0.35 });
    };
    window.addEventListener("bondback:find-jobs-map-fly-to", handler);
    return () => window.removeEventListener("bondback:find-jobs-map-fly-to", handler);
  }, [map]);
  return null;
}

function FindJobsMapFilterForm({ onApplied }: { onApplied: () => void }) {
  const router = useRouter();
  const sp =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();
  const [service, setService] = React.useState(sp.get("service_type") ?? "any");
  const [urgent, setUrgent] = React.useState(sp.get("urgent_only") === "1");

  const apply = React.useCallback(() => {
    const next = new URLSearchParams(window.location.search);
    if (service === "any") next.delete("service_type");
    else next.set("service_type", service);
    if (urgent) next.set("urgent_only", "1");
    else next.delete("urgent_only");
    const qs = next.toString();
    router.replace(qs ? `/find-jobs?${qs}` : "/find-jobs");
    onApplied();
  }, [router, service, urgent, onApplied]);

  return (
    <div className="space-y-4 pb-6 pt-2">
      <div className="space-y-2">
        <Label>Service type</Label>
        <Select value={service} onValueChange={setService}>
          <SelectTrigger>
            <SelectValue placeholder="Any" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any service</SelectItem>
            <SelectItem value="bond_cleaning">Bond cleaning</SelectItem>
            <SelectItem value="recurring_house_cleaning">Recurring house cleaning</SelectItem>
            <SelectItem value="airbnb_turnover">Airbnb / short-stay turnover</SelectItem>
            <SelectItem value="deep_clean">Deep / spring / move-in</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
        <Label htmlFor="map-urgent-only" className="text-sm font-medium">
          Urgent only
        </Label>
        <Switch id="map-urgent-only" checked={urgent} onCheckedChange={setUrgent} />
      </div>
      <Button type="button" className="w-full" onClick={apply}>
        Apply filters
      </Button>
    </div>
  );
}
