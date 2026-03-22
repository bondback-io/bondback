/**
 * State-specific bond cleaning checklist guidelines for end-of-lease cleaning.
 * Shown to cleaners when job is in progress. Links to official state resources where available.
 */
export type BondGuideline = {
  state: string;
  title: string;
  summary: string;
  checklist: string[];
  linkUrl?: string;
  linkLabel?: string;
};

const GUIDELINES: Record<string, BondGuideline> = {
  VIC: {
    state: "VIC",
    title: "Victoria bond cleaning guideline",
    summary:
      "Return the property in the same condition as at the start of the tenancy (minus fair wear and tear). Use your entry condition report as a reference.",
    checklist: [
      "Floors: sweep, mop, vacuum carpets and rugs",
      "Kitchen: clean oven, microwave, fridge; degrease range hood and filters; wipe cabinets and drawers",
      "Bathroom: clean toilet, basin, shower/tub; remove mould and soap residue",
      "Windows: inside and out where accessible; sills, frames and tracks",
      "Walls: spot clean marks; remove cobwebs and dust from corners and ceilings",
      "Light fittings, vents and skirting boards",
      "Remove all rubbish and personal items",
    ],
    linkUrl: "https://www.consumer.vic.gov.au/housing/renting",
    linkLabel: "Consumer Affairs Victoria – renting",
  },
  QLD: {
    state: "QLD",
    title: "Queensland bond cleaning guideline",
    summary:
      "Leave the premises in the same condition as when you moved in (minus fair wear and tear). You can clean yourself or use a professional cleaner.",
    checklist: [
      "Clean room by room: windows and tracks, skirting boards, light fittings, ceiling fans, vents",
      "Inside all cupboards (wardrobes, linen, kitchen, bathroom)",
      "Oven and kitchen appliances; remove grease and grime",
      "Outside: balconies, gardens, lawns; remove all rubbish",
      "Complete an Exit Condition Report (Form 14a) and compare to your Entry Condition Report",
      "Keep receipts and photos as evidence",
    ],
    linkUrl: "https://www.rta.qld.gov.au/ending-a-tenancy/vacating-a-property/cleaning",
    linkLabel: "RTA Queensland – vacating and cleaning",
  },
  NSW: {
    state: "NSW",
    title: "New South Wales bond cleaning guideline",
    summary:
      "Leave the property as close as possible to the condition at the start of the tenancy, apart from fair wear and tear.",
    checklist: [
      "Floors: vacuum and mop; carpets professionally cleaned if required by agreement",
      "Kitchen: oven, stovetop, range hood; inside cupboards and drawers",
      "Bathroom: toilet, basin, shower, bath; tiles and grout",
      "Windows: interior and accessible exterior; tracks and sills",
      "Walls: remove marks and cobwebs; dust light fittings and vents",
      "Remove all belongings and rubbish; gardens tidy if applicable",
    ],
    linkUrl: "https://www.nsw.gov.au/housing-and-construction/renting",
    linkLabel: "NSW Government – renting",
  },
  SA: {
    state: "SA",
    title: "South Australia bond cleaning guideline",
    summary:
      "Tenants must leave the property reasonably clean and in the same condition as at the start, allowing for fair wear and tear.",
    checklist: [
      "Floors: sweep, mop, vacuum; carpets as per condition report",
      "Kitchen: oven, appliances, cupboards; clean and degrease",
      "Bathroom: toilet, basin, shower; remove mould and scale",
      "Windows and sills; light fittings and vents",
      "Walls: spot clean; remove cobwebs; skirting boards",
      "Remove all rubbish and personal items",
    ],
    linkUrl: "https://www.sa.gov.au/topics/housing/renting-and-letting",
    linkLabel: "SA Government – renting",
  },
  WA: {
    state: "WA",
    title: "Western Australia bond cleaning guideline",
    summary:
      "The property should be left in the same condition as when the tenancy started, except for fair wear and tear.",
    checklist: [
      "Floors: vacuum, mop; carpet cleaning if required by agreement",
      "Kitchen: oven, grill, range hood; inside cupboards and drawers",
      "Bathroom: toilet, basin, shower; clean tiles and grout",
      "Windows: inside and accessible outside; tracks and frames",
      "Walls: remove marks; dust and cobwebs; light fittings",
      "All rubbish and belongings removed; gardens tidy if applicable",
    ],
    linkUrl: "https://www.commerce.wa.gov.au/consumer-protection/renting-home",
    linkLabel: "WA Consumer Protection – renting",
  },
  TAS: {
    state: "TAS",
    title: "Tasmania bond cleaning guideline",
    summary:
      "Leave the premises reasonably clean and in the same condition as at the start of the tenancy, minus fair wear and tear.",
    checklist: [
      "Floors: sweep, mop, vacuum",
      "Kitchen: oven, stovetop, range hood; cupboards and drawers",
      "Bathroom: toilet, basin, shower/bath; remove mould",
      "Windows and sills; light fittings and vents",
      "Walls: spot clean; cobwebs and dust",
      "Remove all rubbish and personal items",
    ],
    linkUrl: "https://www.cbos.tas.gov.au/topics/housing/renting",
    linkLabel: "CBOS Tasmania – renting",
  },
  ACT: {
    state: "ACT",
    title: "ACT bond cleaning guideline",
    summary:
      "Return the property in the same condition as at the start of the tenancy, allowing for fair wear and tear.",
    checklist: [
      "Floors: vacuum, mop; carpets as per condition report",
      "Kitchen: oven, appliances, cupboards; degrease where needed",
      "Bathroom: toilet, basin, shower; tiles and grout",
      "Windows: interior and accessible exterior; tracks",
      "Walls: spot clean; dust and cobwebs; light fittings",
      "Remove all belongings and rubbish",
    ],
    linkUrl: "https://www.acat.act.gov.au/renting",
    linkLabel: "ACAT – renting",
  },
  NT: {
    state: "NT",
    title: "Northern Territory bond cleaning guideline",
    summary:
      "Leave the premises in the same condition as at the start of the tenancy, except for fair wear and tear.",
    checklist: [
      "Floors: sweep, mop, vacuum",
      "Kitchen: oven, stovetop, range hood; cupboards and drawers",
      "Bathroom: toilet, basin, shower; remove mould and scale",
      "Windows and sills; light fittings and vents",
      "Walls: spot clean; cobwebs and dust",
      "Remove all rubbish and personal items",
    ],
    linkUrl: "https://nt.gov.au/property/renting",
    linkLabel: "NT Government – renting",
  },
};

export function getBondGuidelineForState(state: string | null): BondGuideline | null {
  if (!state || typeof state !== "string") return null;
  const key = state.toUpperCase().trim();
  return GUIDELINES[key] ?? null;
}
