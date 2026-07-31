import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { Layers, Loader2 } from "lucide-react";
import { toast } from "sonner";
import PlannerPanel from "@/components/PlannerPanel";
import ElevationChart from "@/components/ElevationChart";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import {
  deleteSavedRoute,
  listSavedRoutes,
  saveRoute,
  type SavedRoute,
} from "@/lib/saved-routes";
import {
  generateRoute,
  geocodePlace,
  parsePrompt,
  planWaypointRoute,
  snapRouteToPaths,
  type AvoidOption,
  type GeneratedRoute,
  type LatLng,
  type Vehicle,
} from "@/lib/trail-engine";


const TrailMap = lazy(() => import("@/components/TrailMap"));

const DEFAULT_CENTER: LatLng = { lat: 18.7883, lng: 98.9853 }; // Chiang Mai


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TrailMind AI — AI Route Planner for MTB & Adventure Moto" },
      {
        name: "description",
        content:
          "Describe the ride you want and TrailMind AI drafts a route on OpenStreetMap with an elevation profile, trail beta and an instant .gpx download.",
      },
      { property: "og:title", content: "TrailMind AI — AI Route Planner for MTB & Moto" },
      {
        property: "og:description",
        content:
          "Prompt-to-route planning with live map, elevation graph and one-click GPX export for your GPS computer.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function MapSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center topo-grid">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function Index() {
  const [prompt, setPrompt] = useState(
    "Rocky singletrack with high elevation gain near Chiang Mai",
  );
  const [vehicle, setVehicle] = useState<Vehicle>("mtb");
  const [center, setCenter] = useState<LatLng>(DEFAULT_CENTER);
  const [locationLabel, setLocationLabel] = useState("Locating you…");
  const [route, setRoute] = useState<GeneratedRoute | null>(null);
  const [loading, setLoading] = useState(false);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [layer, setLayer] = useState<"street" | "topo">("topo");
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [saving, setSaving] = useState(false);
  const [avoid, setAvoid] = useState<AvoidOption[]>([]);
  const [pins, setPins] = useState<LatLng[]>([]);
  const [clickMode, setClickMode] = useState<"area" | "pins">("area");
  const { user } = useSession();

  const navigate = useNavigate();

  const refreshSaved = useCallback(() => {
    if (!user) {
      setSavedRoutes([]);
      return;
    }
    listSavedRoutes()
      .then(setSavedRoutes)
      .catch(() => setSavedRoutes([]));
  }, [user]);

  useEffect(() => {
    refreshSaved();
  }, [refreshSaved]);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setLocationLabel("Location unavailable — showing Chiang Mai");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationLabel(
          `GPS lock · ${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)}`,
        );
      },
      () => setLocationLabel("Location blocked — showing Chiang Mai"),
      { timeout: 8000 },
    );
  }, []);

  function toggleAvoid(o: AvoidOption) {
    setAvoid((a) => (a.includes(o) ? a.filter((x) => x !== o) : [...a, o]));
  }

  function handleMapClick(p: LatLng) {
    if (clickMode === "area") {
      setCenter(p);
      setLocationLabel(`Planning around ${p.lat.toFixed(3)}, ${p.lng.toFixed(3)}`);
      return;
    }
    setPins((prev) => {
      if (prev.length < 2) return [...prev, p];
      // Extra clicks become waypoints between the start and the finish.
      return [...prev.slice(0, -1), p, prev[prev.length - 1]!];
    });
  }

  function removePin(i: number) {
    setPins((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleGenerate() {
    if (pins.length < 2 && !prompt.trim()) return;
    setLoading(true);
    setHoverIndex(null);
    try {
      if (pins.length >= 2) {
        const planned = await planWaypointRoute(prompt, pins, vehicle, avoid);
        if (!planned) {
          toast.error("Could not connect those pins by road — try moving them closer to a route.");
          return;
        }
        setRoute(planned);
        return;
      }

      const { place } = parsePrompt(prompt);
      let origin = center;
      if (place) {
        const geo = await geocodePlace(place);
        if (geo) {
          origin = geo;
          setCenter(geo);
        }
      }
      const draft = generateRoute(prompt, origin, vehicle);
      // Snap the drafted loop onto real OpenStreetMap ways so the drawn line
      // follows the tracks and roads visible on the map.
      const snapped = await snapRouteToPaths(draft, avoid);
      setRoute(snapped);
    } finally {
      setLoading(false);
    }
  }


  async function handleSave() {
    if (!route) return;
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    setSaving(true);
    try {
      await saveRoute(route, user.id);
      toast.success("Route saved to your account");
      refreshSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save route");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSaved(id: string) {
    try {
      await deleteSavedRoute(id);
      setSavedRoutes((rs) => rs.filter((r) => r.id !== id));
    } catch {
      toast.error("Could not delete route");
    }
  }

  function handleOpenSaved(s: SavedRoute) {
    const r = s.route;
    setRoute(r);
    setPrompt(r.prompt);
    setVehicle(r.vehicle);
    setHoverIndex(null);
    if (r.points[0]) setCenter({ lat: r.points[0].lat, lng: r.points[0].lng });
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setSavedRoutes([]);
    toast.success("Signed out");
  }

  return (
    <main className="flex h-screen w-full flex-col overflow-hidden lg:flex-row">
      <div className="h-[52vh] w-full shrink-0 lg:h-full lg:w-[420px]">
        <PlannerPanel
          prompt={prompt}
          setPrompt={setPrompt}
          vehicle={vehicle}
          setVehicle={setVehicle}
          onGenerate={handleGenerate}
          loading={loading}
          route={route}
          locationLabel={locationLabel}
          userEmail={user?.email ?? null}
          onSignOut={handleSignOut}
          onSave={handleSave}
          saving={saving}
          savedRoutes={savedRoutes}
          onOpenSaved={handleOpenSaved}
          onDeleteSaved={handleDeleteSaved}
          avoid={avoid}
          onToggleAvoid={toggleAvoid}
          pins={pins}
          clickMode={clickMode}
          setClickMode={setClickMode}
          onRemovePin={removePin}
          onClearPins={() => setPins([])}
        />
      </div>


      <div className="flex min-h-0 flex-1 flex-col">
        <div className="relative min-h-0 flex-1">
          <ClientOnly fallback={<MapSkeleton />}>
            <Suspense fallback={<MapSkeleton />}>
              <TrailMap
                route={route}
                center={center}
                hoverIndex={hoverIndex}
                layer={layer}
                pins={pins}
                clickMode={clickMode}
                onMapClick={handleMapClick}
                onPinClick={removePin}
              />
            </Suspense>
          </ClientOnly>


          <button
            onClick={() => setLayer(layer === "topo" ? "street" : "topo")}
            className="absolute top-3 right-3 z-[400] flex items-center gap-1.5 rounded-sm border border-border bg-card/95 px-3 py-2 text-xs font-medium backdrop-blur transition-colors hover:border-primary"
          >
            <Layers className="size-3.5 text-primary" />
            {layer === "topo" ? "OSM Topo" : "OSM Street"}
          </button>
        </div>

        <div className="h-56 shrink-0 border-t border-border bg-card px-3 pt-3 pb-2">
          {route ? (
            <>
              <div className="mb-1 flex items-center justify-between px-1">
                <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                  Elevation profile
                </h3>
                <span className="text-xs text-muted-foreground">
                  {route.ascent} m up · {route.descent} m down
                </span>
              </div>
              <div className="h-[calc(100%-1.5rem)]">
                <ElevationChart route={route} onHover={setHoverIndex} />
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              The elevation profile appears here once a route is planned.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
