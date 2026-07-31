import { supabase } from "@/integrations/supabase/client";
import type { GeneratedRoute } from "@/lib/trail-engine";

export type SavedRoute = {
  id: string;
  name: string;
  prompt: string;
  vehicle: string;
  distance_km: number;
  ascent: number;
  est_minutes: number;
  difficulty: string;
  created_at: string;
  route: GeneratedRoute;
};

export async function listSavedRoutes(): Promise<SavedRoute[]> {
  const { data, error } = await supabase
    .from("saved_routes")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as SavedRoute[];
}

export async function saveRoute(route: GeneratedRoute, userId: string) {
  const { error } = await supabase.from("saved_routes").insert({
    user_id: userId,
    name: route.name,
    prompt: route.prompt,
    vehicle: route.vehicle,
    distance_km: Number(route.distanceKm.toFixed(2)),
    ascent: route.ascent,
    est_minutes: route.estMinutes,
    difficulty: route.difficulty,
    route: JSON.parse(JSON.stringify(route)),
  });
  if (error) throw error;
}

export async function deleteSavedRoute(id: string) {
  const { error } = await supabase.from("saved_routes").delete().eq("id", id);
  if (error) throw error;
}
