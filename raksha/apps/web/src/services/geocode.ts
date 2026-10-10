import { z } from "zod";

export interface Place { name: string; detail?: string; lng: number; lat: number }

const photon = z.object({
  features: z.array(z.object({
    geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]) }),
    properties: z.object({ name: z.string().optional(), street: z.string().optional(), district: z.string().optional(), city: z.string().optional(), state: z.string().optional() }),
  })),
});

/** Photon autocomplete biased to the city centre; Nominatim as a polite fallback. */
export async function searchPlaces(q: string, near: { lat: number; lng: number } | null, signal?: AbortSignal): Promise<Place[]> {
  if (q.trim().length < 2) return [];
  try {
    const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}${near ? `&lat=${near.lat}&lon=${near.lng}` : ""}&limit=6&lang=en`, { signal });
    if (!r.ok) throw new Error(String(r.status));
    return photon.parse(await r.json()).features.filter((f) => f.properties.name).map((f) => ({
      name: f.properties.name!, detail: [f.properties.street, f.properties.district ?? f.properties.city].filter(Boolean).join(", ") || undefined,
      lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1],
    }));
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&limit=6&countrycodes=in${near ? `&viewbox=${near.lng - 0.3},${near.lat + 0.3},${near.lng + 0.3},${near.lat - 0.3}` : ""}`, { signal });
    const j = (await r.json()) as { display_name: string; lat: string; lon: string }[];
    return j.map((x) => ({ name: x.display_name.split(",")[0]!, detail: x.display_name.split(",").slice(1, 3).join(","), lat: +x.lat, lng: +x.lon }));
  }
}
