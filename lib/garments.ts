// Shared mapper: Rails garment rows → UI Material objects.
// Both the fitting room and the studio consume this so the shape stays consistent.

export interface GarmentRow {
  id: number;
  image_url?: string | null;
  garment_type?: string | null;
  is_global_inventory?: boolean;
  measurements?: Record<string, unknown> | null;
}

export interface Material {
  id: number;
  name: string;
  tag: string;
  photo: string | null;
}

export function mapGarmentRow(g: GarmentRow): Material {
  return {
    id:    g.id,
    name:  (g.garment_type ?? "GARMENT").replace(/_/g, " ").toUpperCase(),
    tag:   g.is_global_inventory ? "STORE" : "MY CLOSET",
    photo: g.image_url ?? null,
  };
}

/** Unwrap the Rails { data: [...], count } envelope (or a bare array) and map every row. */
export function parseGarmentsResponse(json: unknown): Material[] {
  if (!json || typeof json !== "object") return [];
  const j = json as Record<string, unknown>;
  const arr: unknown[] = Array.isArray(j.data)
    ? j.data
    : Array.isArray(json)
    ? (json as unknown[])
    : [];
  return (arr as GarmentRow[]).map(mapGarmentRow);
}
