"use client";

import { MapContainer, TileLayer, CircleMarker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useMapFollowsDarkClass } from "@/hooks/use-map-follows-dark-class";

export function ListingLocationMapPreview({ lat, lon }: { lat: number; lon: number }) {
  const mapDark = useMapFollowsDarkClass();
  const tileUrl = mapDark
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

  return (
    <MapContainer
      center={[lat, lon]}
      zoom={14}
      className="z-0 h-[min(50vh,340px)] w-full rounded-lg border border-border dark:border-gray-700"
      scrollWheelZoom
      aria-label="Approximate job area on map"
    >
      <TileLayer
        key={mapDark ? "dark" : "light"}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url={tileUrl}
      />
      <CircleMarker
        center={[lat, lon]}
        radius={11}
        pathOptions={{
          color: "#059669",
          fillColor: "#34d399",
          fillOpacity: 0.88,
          weight: 2,
        }}
      />
    </MapContainer>
  );
}
