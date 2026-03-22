/**
 * One-time script to seed the public.suburbs reference table in Supabase
 * with the complete Australian suburbs + postcodes dataset.
 *
 * Source CSV:
 *   https://github.com/matthewproctor/australianpostcodes
 *   https://raw.githubusercontent.com/matthewproctor/australianpostcodes/master/australian_postcodes.csv
 *
 * Run once with:
 *   npm run seed:suburbs
 *
 * Required env in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...   (from Supabase Dashboard → Settings → API → service_role)
 */

import { createClient } from "@supabase/supabase-js";

const CSV_URL =
  "https://raw.githubusercontent.com/matthewproctor/australianpostcodes/master/australian_postcodes.csv";

type CsvRow = {
  postcode: string;
  locality: string;
  state: string;
  lat: string;
  lon: string;
};

async function main() {
  // Prefer the public URL, fall back to SUPABASE_URL if needed.
  // Avoid placeholder values like "your-supabase-url-here".
  const urlEnv =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const url = urlEnv && urlEnv.startsWith("http") ? urlEnv : null;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.error(
      "Missing env. Add NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY to .env.local"
    );
    process.exit(1);
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log("Fetching CSV from", CSV_URL);
  const res = await fetch(CSV_URL);
  if (!res.ok) {
    console.error("Failed to fetch CSV:", res.status, res.statusText);
    process.exit(1);
  }

  const text = await res.text();
  const lines = text.split(/\r?\n/);
  const header = lines[0];

  console.log("CSV header:", header);

  // Header indices for the columns we care about.
  // id,postcode,locality,state,long,lat,...
  const headerCols = header.split(",");
  const idxPostcode = headerCols.indexOf("postcode");
  const idxLocality = headerCols.indexOf("locality");
  const idxState = headerCols.indexOf("state");
  const idxLat = headerCols.indexOf("lat");
  const idxLon = headerCols.indexOf("long");

  if (
    idxPostcode === -1 ||
    idxLocality === -1 ||
    idxState === -1 ||
    idxLat === -1 ||
    idxLon === -1
  ) {
    console.error("CSV header did not contain expected columns.");
    process.exit(1);
  }

  let total = 0;
  let skipped = 0;

  const batch: {
    postcode: string;
    suburb: string;
    state: string;
    lat: number | null;
    lon: number | null;
  }[] = [];

  async function flushBatch() {
    if (batch.length === 0) return;
    const toInsert = [...batch];
    batch.length = 0;

    const { error } = await supabase
      .from("suburbs")
      .insert(toInsert, { count: "exact" });

    if (error) {
      console.error("Error inserting batch:", error.message);
      // Do not exit immediately – log and continue to avoid partial failure
      // causing the whole script to stop. You can re-run if necessary.
    } else {
      console.log(`Inserted batch of ${toInsert.length} rows...`);
    }
  }

  // Process lines after header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Simple CSV splitting: this dataset does not contain embedded commas
    // in the fields we care about (postcode, locality, state, long, lat),
    // so a basic split is sufficient here.
    const cols = line.split(",");
    if (cols.length <= Math.max(idxPostcode, idxLocality, idxState, idxLat, idxLon)) {
      skipped++;
      continue;
    }

    const postcode = cols[idxPostcode].replace(/^"|"$/g, "").trim();
    const locality = cols[idxLocality].replace(/^"|"$/g, "").trim();
    const state = cols[idxState].replace(/^"|"$/g, "").trim();
    const latStr = cols[idxLat].replace(/^"|"$/g, "").trim();
    const lonStr = cols[idxLon].replace(/^"|"$/g, "").trim();

    if (!postcode || !locality) {
      skipped++;
      continue;
    }

    const lat = latStr ? Number(latStr) : null;
    const lon = lonStr ? Number(lonStr) : null;

    batch.push({
      postcode,
      suburb: locality,
      state,
      lat: Number.isFinite(lat) ? lat : null,
      lon: Number.isFinite(lon) ? lon : null,
    });
    total++;

    if (batch.length >= 500) {
      await flushBatch();
    }
  }

  await flushBatch();

  console.log(`Done. Inserted approximately ${total} rows, skipped ${skipped} rows.`);
  console.log("Run once with: npm run seed:suburbs");
}

main().catch((err) => {
  console.error("Unexpected error in seed-suburbs.ts:", err);
  process.exit(1);
});

