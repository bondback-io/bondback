"use client";

import { MapContainer, TileLayer, CircleMarker } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export function ListingLocationMapPreview({ lat, lon }: { lat: number; lon: number }) {
  return (
    <MapContainer
      center={[lat, lon]}
      zoom={14}
      className="z-0 h-[min(50vh,340px)] w-full rounded-lg border border-border dark:border-gray-700"
      scrollWheelZoom
      aria-label="Approximate job area on map"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
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
