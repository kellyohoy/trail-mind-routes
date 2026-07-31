import { useEffect } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, useMap } from "react-leaflet";
import type { GeneratedRoute, LatLng } from "@/lib/trail-engine";

function Fit({ route, center }: { route: GeneratedRoute | null; center: LatLng }) {
  const map = useMap();
  useEffect(() => {
    if (route && route.points.length) {
      map.fitBounds(
        route.points.map((p) => [p.lat, p.lng] as [number, number]),
        { padding: [40, 40] },
      );
    } else {
      map.setView([center.lat, center.lng], 12);
    }
  }, [route, center, map]);
  return null;
}

function Marker({ route, hoverIndex }: { route: GeneratedRoute; hoverIndex: number | null }) {
  const p = hoverIndex == null ? null : route.points[hoverIndex];
  if (!p) return null;
  return (
    <CircleMarker
      center={[p.lat, p.lng]}
      radius={7}
      pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#f0a63c", fillOpacity: 1 }}
    >
      <Tooltip direction="top" offset={[0, -8]} permanent>
        {(p.dist / 1000).toFixed(1)} km · {p.ele} m
      </Tooltip>
    </CircleMarker>
  );
}

export default function TrailMap({
  route,
  center,
  hoverIndex,
  layer,
}: {
  route: GeneratedRoute | null;
  center: LatLng;
  hoverIndex: number | null;
  layer: "street" | "topo";
}) {
  const line = route?.points.map((p) => [p.lat, p.lng] as [number, number]) ?? [];
  const start = route?.points[0];

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={12}
      className="h-full w-full"
      scrollWheelZoom
    >
      {layer === "topo" ? (
        <TileLayer
          attribution='Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, tiles &copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
          url="https://tile.opentopomap.org/{z}/{x}/{y}.png"
        />
      ) : (
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
      )}

      {line.length > 1 && (
        <>
          <Polyline positions={line} pathOptions={{ color: "#10160f", weight: 9, opacity: 0.55 }} />
          <Polyline positions={line} pathOptions={{ color: "#f0a63c", weight: 4 }} />
        </>
      )}

      {start && (
        <CircleMarker
          center={[start.lat, start.lng]}
          radius={8}
          pathOptions={{ color: "#0f1a0f", weight: 2, fillColor: "#b8e04a", fillOpacity: 1 }}
        >
          <Tooltip direction="right">Start / Finish</Tooltip>
        </CircleMarker>
      )}

      {!route && (
        <CircleMarker
          center={[center.lat, center.lng]}
          radius={9}
          pathOptions={{ color: "#b8e04a", weight: 2, fillColor: "#b8e04a", fillOpacity: 0.35 }}
        >
          <Tooltip direction="top">You are here</Tooltip>
        </CircleMarker>
      )}

      {route && <Marker route={route} hoverIndex={hoverIndex} />}
      <Fit route={route} center={center} />
    </MapContainer>
  );
}
