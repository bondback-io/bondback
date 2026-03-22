/**
 * Australian suburbs and postcodes by state (curated list for autocomplete).
 * Covers NSW, VIC, QLD, WA, SA, TAS, NT, ACT.
 */

export const AU_STATES = [
  // Prioritise Queensland first for initial launch, then NSW, VIC, others.
  { value: "QLD", label: "Queensland" },
  { value: "NSW", label: "New South Wales" },
  { value: "VIC", label: "Victoria" },
  { value: "WA", label: "Western Australia" },
  { value: "SA", label: "South Australia" },
  { value: "TAS", label: "Tasmania" },
  { value: "NT", label: "Northern Territory" },
  { value: "ACT", label: "Australian Capital Territory" },
] as const;

export type AuStateCode = (typeof AU_STATES)[number]["value"];

export type SuburbEntry = {
  suburb: string;
  postcode: string;
  state: AuStateCode;
};

/** Suburb + postcode list (suburb, postcode, state). */
export const AU_SUBURBS: SuburbEntry[] = [
  // QLD (launch priority)
  { suburb: "Brisbane", postcode: "4000", state: "QLD" },
  { suburb: "Fortitude Valley", postcode: "4006", state: "QLD" },
  { suburb: "South Brisbane", postcode: "4101", state: "QLD" },
  { suburb: "West End", postcode: "4101", state: "QLD" },
  { suburb: "Toowong", postcode: "4066", state: "QLD" },
  { suburb: "Indooroopilly", postcode: "4068", state: "QLD" },
  { suburb: "Gold Coast", postcode: "4217", state: "QLD" },
  { suburb: "Surfers Paradise", postcode: "4217", state: "QLD" },
  { suburb: "Sunshine Coast", postcode: "4558", state: "QLD" },
  { suburb: "Townsville", postcode: "4810", state: "QLD" },
  { suburb: "Cairns", postcode: "4870", state: "QLD" },
  { suburb: "Ipswich", postcode: "4305", state: "QLD" },
  // NSW
  { suburb: "Sydney", postcode: "2000", state: "NSW" },
  { suburb: "Surry Hills", postcode: "2010", state: "NSW" },
  { suburb: "Darlinghurst", postcode: "2010", state: "NSW" },
  { suburb: "Paddington", postcode: "2021", state: "NSW" },
  { suburb: "Bondi Junction", postcode: "2022", state: "NSW" },
  { suburb: "Bondi Beach", postcode: "2026", state: "NSW" },
  { suburb: "Maroubra", postcode: "2035", state: "NSW" },
  { suburb: "North Sydney", postcode: "2060", state: "NSW" },
  { suburb: "Chatswood", postcode: "2067", state: "NSW" },
  { suburb: "Parramatta", postcode: "2150", state: "NSW" },
  { suburb: "Ryde", postcode: "2112", state: "NSW" },
  { suburb: "Strathfield", postcode: "2135", state: "NSW" },
  { suburb: "Burwood", postcode: "2134", state: "NSW" },
  { suburb: "Canterbury", postcode: "2193", state: "NSW" },
  { suburb: "Liverpool", postcode: "2170", state: "NSW" },
  { suburb: "Penrith", postcode: "2750", state: "NSW" },
  { suburb: "Newcastle", postcode: "2300", state: "NSW" },
  { suburb: "Wollongong", postcode: "2500", state: "NSW" },
  // VIC
  { suburb: "Melbourne", postcode: "3000", state: "VIC" },
  { suburb: "South Yarra", postcode: "3141", state: "VIC" },
  { suburb: "Prahran", postcode: "3181", state: "VIC" },
  { suburb: "St Kilda", postcode: "3182", state: "VIC" },
  { suburb: "Carlton", postcode: "3053", state: "VIC" },
  { suburb: "Fitzroy", postcode: "3065", state: "VIC" },
  { suburb: "Richmond", postcode: "3121", state: "VIC" },
  { suburb: "Collingwood", postcode: "3066", state: "VIC" },
  { suburb: "Brunswick", postcode: "3056", state: "VIC" },
  { suburb: "Footscray", postcode: "3011", state: "VIC" },
  { suburb: "Box Hill", postcode: "3128", state: "VIC" },
  { suburb: "Doncaster", postcode: "3108", state: "VIC" },
  { suburb: "Geelong", postcode: "3220", state: "VIC" },
  { suburb: "Ballarat", postcode: "3350", state: "VIC" },
  { suburb: "Bendigo", postcode: "3550", state: "VIC" },
  // WA
  { suburb: "Perth", postcode: "6000", state: "WA" },
  { suburb: "Northbridge", postcode: "6003", state: "WA" },
  { suburb: "Subiaco", postcode: "6008", state: "WA" },
  { suburb: "Fremantle", postcode: "6160", state: "WA" },
  { suburb: "Joondalup", postcode: "6027", state: "WA" },
  { suburb: "Mandurah", postcode: "6210", state: "WA" },
  { suburb: "Bunbury", postcode: "6230", state: "WA" },
  // SA
  { suburb: "Adelaide", postcode: "5000", state: "SA" },
  { suburb: "North Adelaide", postcode: "5006", state: "SA" },
  { suburb: "Glenelg", postcode: "5045", state: "SA" },
  { suburb: "Norwood", postcode: "5067", state: "SA" },
  { suburb: "Port Adelaide", postcode: "5015", state: "SA" },
  { suburb: "Mount Gambier", postcode: "5290", state: "SA" },
  // TAS
  { suburb: "Hobart", postcode: "7000", state: "TAS" },
  { suburb: "Launceston", postcode: "7250", state: "TAS" },
  { suburb: "Devonport", postcode: "7310", state: "TAS" },
  { suburb: "Burnie", postcode: "7320", state: "TAS" },
  // NT
  { suburb: "Darwin", postcode: "0800", state: "NT" },
  { suburb: "Alice Springs", postcode: "0870", state: "NT" },
  { suburb: "Palmerston", postcode: "0830", state: "NT" },
  // ACT
  { suburb: "Canberra", postcode: "2601", state: "ACT" },
  { suburb: "Belconnen", postcode: "2617", state: "ACT" },
  { suburb: "Woden", postcode: "2606", state: "ACT" },
  { suburb: "Gungahlin", postcode: "2912", state: "ACT" },
];

export function filterSuburbs(
  query: string,
  stateCode?: AuStateCode | null
): SuburbEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  let list = AU_SUBURBS;
  if (stateCode) {
    list = list.filter((s) => s.state === stateCode);
  }
  const matches = list.filter(
    (s) =>
      s.suburb.toLowerCase().includes(q) ||
      s.postcode.startsWith(q)
  );
  // When searching without a specific state, prioritise Queensland suburbs first.
  if (!stateCode) {
    return [
      ...matches.filter((s) => s.state === "QLD"),
      ...matches.filter((s) => s.state !== "QLD"),
    ];
  }
  return matches;
}
