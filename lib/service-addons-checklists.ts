/**
 * Service-type add-ons & cleaner checklists (non–bond-cleaning only).
 *
 * - **Priced add-ons**: optional extras selected on the new listing form; amounts are stored per id
 *   in global settings and summed into the suggested price.
 * - **Free checklist items**: guidance tasks shown on the cleaner job checklist (no charge).
 *
 * Bond cleaning keeps using `global_settings.pricing_addon_*` + `default_cleaner_checklist_items`.
 */

import type { ServiceTypeKey } from "@/lib/service-types";

export const SERVICE_ADDON_CHECKLIST_CUSTOM_TYPES = [
  "airbnb_turnover",
  "recurring_house_cleaning",
  "deep_clean",
] as const;

export type ServiceAddonChecklistCustomType =
  (typeof SERVICE_ADDON_CHECKLIST_CUSTOM_TYPES)[number];

export type ServicePricedAddon = {
  id: string;
  name: string;
  /** Whole AUD (market-style flat add-ons). */
  priceAud: number;
};

export type ServiceAddonsChecklistEntry = {
  priced: ServicePricedAddon[];
  free: string[];
};

/** Merged config including defaults for all custom service types. */
export type ServiceAddonsChecklistsMerged = Record<
  ServiceAddonChecklistCustomType,
  ServiceAddonsChecklistEntry
>;

const CONFIG_VERSION = 1;

/**
 * Catalog lines added after initial launch: merged into saved global_settings when missing,
 * so existing admins keep edits/deletes while new recommendations still appear once.
 */
const SERVICE_ADDONS_CATALOG_EXTENSIONS: ServiceAddonsChecklistsMerged = {
  airbnb_turnover: {
    priced: [
      { id: "airbnb_bathroom_deep_clean", name: "Full Bathroom Deep Clean", priceAud: 70 },
      { id: "airbnb_balcony_patio_clean", name: "Balcony / Patio Clean", priceAud: 50 },
      { id: "airbnb_laundry_linen_service", name: "Laundry / Linen Service", priceAud: 45 },
      { id: "airbnb_car_space_garage_sweep", name: "Car Space / Garage Sweep", priceAud: 35 },
    ],
    free: [
      "Dust all surfaces and light fixtures",
      "Clean all mirrors and glass",
      "Check and clean inside wardrobes",
      "Final walkthrough and tidy",
    ],
  },
  recurring_house_cleaning: {
    priced: [
      { id: "recurring_full_bathroom_deep_clean", name: "Full Bathroom Deep Clean", priceAud: 55 },
      { id: "recurring_interior_window_cleaning", name: "Interior Window Cleaning", priceAud: 60 },
      { id: "recurring_fridge_deep_clean", name: "Fridge Deep Clean", priceAud: 40 },
      { id: "recurring_wardrobe_cupboard_organise", name: "Wardrobe / Cupboard Organise", priceAud: 50 },
    ],
    free: [
      "Dust all furniture and shelves",
      "Clean all glass surfaces and mirrors",
      "Vacuum under furniture",
      "Quick tidy of living areas",
    ],
  },
  deep_clean: {
    priced: [
      { id: "deep_full_window_interior_tracks", name: "Full Window Cleaning (interior + tracks)", priceAud: 95 },
      { id: "deep_carpet_steam_per_room", name: "Carpet Steam Clean (per room)", priceAud: 85 },
      { id: "deep_wall_washing_all_walls", name: "Wall Washing (all walls)", priceAud: 70 },
      { id: "deep_light_fixture_chandelier_clean", name: "Light Fixture / Chandelier Clean", priceAud: 40 },
      { id: "deep_inside_oven_rangehood_deep_clean", name: "Inside Oven + Rangehood Deep Clean", priceAud: 80 },
    ],
    free: [
      "Clean inside all drawers and cabinets",
      "Remove cobwebs from ceilings and corners",
      "Clean baseboards and door frames",
      "Polish all stainless steel appliances",
      "Deep clean skirting boards",
    ],
  },
};

/** 2026-style flat add-on pricing (QLD/NSW/VIC short-stay & residential market band). */
export const DEFAULT_SERVICE_ADDONS_CHECKLISTS: ServiceAddonsChecklistsMerged = {
  airbnb_turnover: {
    priced: [
      { id: "airbnb_full_kitchen_deep_clean", name: "Full Kitchen Deep Clean", priceAud: 75 },
      { id: "airbnb_bbq_outdoor", name: "BBQ / Outdoor Area", priceAud: 55 },
      { id: "airbnb_interior_windows", name: "Interior Window Cleaning", priceAud: 65 },
      { id: "airbnb_fridge_deep", name: "Fridge Deep Clean", priceAud: 45 },
      ...SERVICE_ADDONS_CATALOG_EXTENSIONS.airbnb_turnover.priced,
    ],
    free: [
      "Change linens & towels",
      "Restock amenities",
      "Empty bins + new liners",
      "Welcome setup",
      ...SERVICE_ADDONS_CATALOG_EXTENSIONS.airbnb_turnover.free,
    ],
  },
  recurring_house_cleaning: {
    priced: [
      { id: "recurring_pet_hair", name: "Extra Pet Hair Treatment", priceAud: 35 },
      { id: "recurring_kitchen_deep_wipe", name: "Kitchen Deep Wipe", priceAud: 40 },
      { id: "recurring_oven_clean", name: "Oven Clean", priceAud: 60 },
      ...SERVICE_ADDONS_CATALOG_EXTENSIONS.recurring_house_cleaning.priced,
    ],
    free: [
      "Bin emptying",
      "Pet areas focus",
      "Light fridge wipe",
      "Kitchen bench detail",
      ...SERVICE_ADDONS_CATALOG_EXTENSIONS.recurring_house_cleaning.free,
    ],
  },
  deep_clean: {
    priced: [
      { id: "deep_oven_rangehood", name: "Full Oven + Rangehood", priceAud: 80 },
      { id: "deep_tile_grout", name: "Tile & Grout Scrub", priceAud: 85 },
      { id: "deep_inside_cupboards", name: "Inside Cupboards & Drawers", priceAud: 65 },
      { id: "deep_wall_washing_baseboards", name: "Wall Washing / Baseboards", priceAud: 55 },
      { id: "deep_high_dusting_fixtures", name: "High Dusting & Light Fixtures", priceAud: 40 },
      ...SERVICE_ADDONS_CATALOG_EXTENSIONS.deep_clean.priced,
    ],
    free: [
      "Behind appliances",
      "High dusting",
      "Baseboards",
      "Window tracks & sills",
      "Full bathroom detail",
      ...SERVICE_ADDONS_CATALOG_EXTENSIONS.deep_clean.free,
    ],
  },
};

function deepCloneDefaults(): ServiceAddonsChecklistsMerged {
  return {
    airbnb_turnover: {
      priced: DEFAULT_SERVICE_ADDONS_CHECKLISTS.airbnb_turnover.priced.map((p) => ({ ...p })),
      free: [...DEFAULT_SERVICE_ADDONS_CHECKLISTS.airbnb_turnover.free],
    },
    recurring_house_cleaning: {
      priced: DEFAULT_SERVICE_ADDONS_CHECKLISTS.recurring_house_cleaning.priced.map((p) => ({
        ...p,
      })),
      free: [...DEFAULT_SERVICE_ADDONS_CHECKLISTS.recurring_house_cleaning.free],
    },
    deep_clean: {
      priced: DEFAULT_SERVICE_ADDONS_CHECKLISTS.deep_clean.priced.map((p) => ({ ...p })),
      free: [...DEFAULT_SERVICE_ADDONS_CHECKLISTS.deep_clean.free],
    },
  };
}

function parsePriced(raw: unknown): ServicePricedAddon[] {
  if (!Array.isArray(raw)) return [];
  const out: ServicePricedAddon[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const o = row as Record<string, unknown>;
    const id = String(o.id ?? "").trim();
    const name = String(o.name ?? "").trim();
    const priceRaw = o.price_aud ?? o.priceAud;
    const n =
      typeof priceRaw === "number" && Number.isFinite(priceRaw)
        ? priceRaw
        : typeof priceRaw === "string" && priceRaw.trim() !== ""
          ? Number(priceRaw)
          : NaN;
    if (!id || !name || !Number.isFinite(n)) continue;
    out.push({
      id: id.slice(0, 64),
      name: name.slice(0, 200),
      priceAud: Math.max(0, Math.min(99999, Math.round(n))),
    });
  }
  return out;
}

function parseFree(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((v) => String(v ?? "").trim())
    .filter((v) => v.length > 0)
    .map((v) => v.slice(0, 300));
}

/**
 * After applying saved admin JSON, append catalog extension lines that are not yet present.
 * Does not restore default items an admin removed — only ids/strings defined in
 * `SERVICE_ADDONS_CATALOG_EXTENSIONS`.
 */
function appendCatalogExtensionsIfMissing(merged: ServiceAddonsChecklistsMerged): void {
  for (const key of SERVICE_ADDON_CHECKLIST_CUSTOM_TYPES) {
    const ext = SERVICE_ADDONS_CATALOG_EXTENSIONS[key];
    const seenIds = new Set(merged[key].priced.map((p) => p.id));
    for (const p of ext.priced) {
      if (!seenIds.has(p.id)) {
        merged[key].priced.push({ ...p });
        seenIds.add(p.id);
      }
    }
    for (const line of ext.free) {
      const t = line.trim();
      if (!t) continue;
      if (!merged[key].free.some((existing) => existing.trim() === t)) {
        merged[key].free.push(line);
      }
    }
  }
}

/**
 * Merge DB JSON with code defaults so every custom service type always has full entries.
 */
export function mergeServiceAddonsChecklists(raw: unknown): ServiceAddonsChecklistsMerged {
  const base = deepCloneDefaults();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  const root = raw as Record<string, unknown>;
  const v = root.v;
  if (v != null && Number(v) !== CONFIG_VERSION) {
    return base;
  }
  const by = root.byService;
  if (!by || typeof by !== "object" || Array.isArray(by)) {
    return base;
  }
  const byObj = by as Record<string, unknown>;

  for (const key of SERVICE_ADDON_CHECKLIST_CUSTOM_TYPES) {
    const block = byObj[key];
    if (!block || typeof block !== "object" || Array.isArray(block)) continue;
    const b = block as Record<string, unknown>;
    if ("priced" in b) {
      base[key].priced = parsePriced(b.priced);
    }
    if ("free" in b) {
      base[key].free = parseFree(b.free);
    }
  }
  appendCatalogExtensionsIfMissing(base);
  return base;
}

/** Serialize for `global_settings.service_addons_checklists` (snake_case in JSON). */
export function serializeServiceAddonsChecklistsForDb(
  merged: ServiceAddonsChecklistsMerged
): Record<string, unknown> {
  const byService: Record<string, unknown> = {};
  for (const key of SERVICE_ADDON_CHECKLIST_CUSTOM_TYPES) {
    const e = merged[key];
    byService[key] = {
      priced: e.priced.map((p) => ({
        id: p.id,
        name: p.name,
        price_aud: p.priceAud,
      })),
      free: e.free,
    };
  }
  return { v: CONFIG_VERSION, byService };
}

export function sumSelectedServicePricedAddonsAud(
  serviceType: ServiceTypeKey,
  selectedIds: string[],
  merged: ServiceAddonsChecklistsMerged
): number {
  if (
    serviceType !== "airbnb_turnover" &&
    serviceType !== "recurring_house_cleaning" &&
    serviceType !== "deep_clean"
  ) {
    return 0;
  }
  const priced = merged[serviceType].priced;
  const byId = new Map(priced.map((p) => [p.id, p.priceAud]));
  let sum = 0;
  for (const id of selectedIds) {
    const line = byId.get(id);
    if (line != null) sum += line;
  }
  return sum;
}

export function allowedServicePricedAddonIds(
  serviceType: ServiceTypeKey,
  merged: ServiceAddonsChecklistsMerged
): Set<string> {
  if (
    serviceType !== "airbnb_turnover" &&
    serviceType !== "recurring_house_cleaning" &&
    serviceType !== "deep_clean"
  ) {
    return new Set();
  }
  return new Set(merged[serviceType].priced.map((p) => p.id));
}
