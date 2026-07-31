import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
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

function ClickCatcher({ onMapClick }: { onMapClick: (p: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
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

function pinLabel(i: number, total: number) {
  if (i === 0) return "Start";
  if (i === total - 1 && total > 1) return "Finish";
  return `Waypoint ${i}`;
}

export default function TrailMap({
  route,
  center,
  hoverIndex,
  layer,
  pins,
  clickMode,
  onMapClick,
  onPinClick,
}: {
  route: GeneratedRoute | null;
  center: LatLng;
  hoverIndex: number | null;
  layer: "street" | "topo";
  pins: LatLng[];
  clickMode: "area" | "pins";
  onMapClick: (p: LatLng) => void;
  onPinClick: (index: number) => void;
}) {
  const line = route?.points.map((p) => [p.lat, p.lng] as [number, number]) ?? [];

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

      <ClickCatcher onMapClick={onMapClick} />

      {line.length > 1 && (
        <>
          <Polyline positions={line} pathOptions={{ color: "#10160f", weight: 9, opacity: 0.55 }} />
          <Polyline positions={line} pathOptions={{ color: "#f0a63c", weight: 4 }} />
        </>
      )}

      {/* Planning pins: start, waypoints, finish */}
      {pins.map((p, i) => {
        const isStart = i === 0;
        const isEnd = i === pins.length - 1 && pins.length > 1;
        const fill = isStart ? "#b8e04a" : isEnd ? "#e0563c" : "#f0a63c";
        return (
          <CircleMarker
            key={`${p.lat}-${p.lng}-${i}`}
            center={[p.lat, p.lng]}
            radius={isStart || isEnd ? 9 : 7}
            pathOptions={{ color: "#0f1a0f", weight: 2, fillColor: fill, fillOpacity: 1 }}
            eventHandlers={{
              click: (e) => {
                e.originalEvent.stopPropagation();
                onPinClick(i);
              },
            }}
          >
            <Tooltip direction="top">{pinLabel(i, pins.length)} — click to remove</Tooltip>
          </CircleMarker>
        );
      })}

      {!route && !pins.length && (
        <CircleMarker
          center={[center.lat, center.lng]}
          radius={9}
          pathOptions={{ color: "#b8e04a", weight: 2, fillColor: "#b8e04a", fillOpacity: 0.35 }}
        >
          <Tooltip direction="top">
            {clickMode === "area" ? "Planning area — click the map to move it" : "You are here"}
          </Tooltip>
        </CircleMarker>
      )}

      {route && <Marker route={route} hoverIndex={hoverIndex} />}
      <Fit route={route} center={center} />
    </MapContainer>
  );
}
