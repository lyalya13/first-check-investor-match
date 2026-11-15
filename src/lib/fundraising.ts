export const CATEGORIES = {
  "Health & Wellbeing": ["FemTech", "Women's Health", "Fertility", "Pregnancy and postpartum", "Menopause", "Cycle tracking", "Sexual health", "Mental health therapy", "Sleep monitoring", "Fitness coaching", "Digital therapeutics"],
  "Food & Nutrition": ["Meal Planning", "Personalized nutrition", "Food Waste", "Alternative Proteins", "Precision fermentation", "Grocery inventory", "Restaurant ordering", "Nutrition Apps"],
  Climate: ["Circular packaging", "Food Waste", "Textile Recycling", "Battery recycling", "Solar energy", "Grid storage", "Carbon removal", "Carbon accounting"],
  "Fintech & Insurance Tech": ["Cross-border payments", "Personal budgeting", "Embedded insurance", "SME lending", "Financial inclusion", "Embedded payments", "Fraud detection"],
  AI: ["Customer support agents", "Coding agents", "Model infrastructure", "Industrial computer vision", "Voice assistants", "AI evaluation", "AI safety"],
  Education: ["Early literacy", "Math learning", "Teacher planning", "Workforce reskilling", "Language learning", "Special education", "Student assessment"],
  "E-commerce": ["B2C marketplaces", "Social commerce", "Personalized skincare", "Parenting support", "Creator monetization", "Fashion resale", "Subscription commerce"],
  "Enterprise Software": ["Recruitment software", "Cloud security", "Developer tooling", "Workflow automation", "Sales intelligence", "Supply chain planning", "Employee learning"],
  Mobility: ["Electric vehicle batteries", "EV charging", "Shared micromobility", "Fleet optimization", "Public transit planning", "Last-mile Delivery", "Autonomous logistics"],
  "Something Else": ["Satellite analytics", "Warehouse robotics", "Travel booking", "Property management", "Legal automation", "Pet health"],
  Cleantech: ["Circular packaging", "Textile Recycling", "Battery recycling", "Water purification"],
  Energy: ["Solar energy", "Grid storage", "Electric vehicle batteries", "EV charging"],
  "Medtech & Pharma": ["Digital therapeutics", "Medical diagnostics", "Surgical devices", "Drug discovery"],
  Biotech: ["Precision fermentation", "Cell therapy", "Synthetic biology"],
  "Agricultural Tech": ["Precision farming", "Crop monitoring", "Farm robotics"],
  "Clothing & Fashion": ["Fashion resale", "Textile Recycling", "Sustainable clothing"],
  "Home & Living": ["Property management", "Smart home", "Home furnishings"],
  "Social Impact": ["Financial inclusion", "Accessibility", "Community services"],
  Gaming: ["Game studios", "Game infrastructure", "Esports"],
  "Travel & Leisure": ["Travel booking", "Hospitality software", "Outdoor recreation"],
} as const;
export type Category = keyof typeof CATEGORIES;
export type NicheSelection = { category: Category; name: string };
export type InvestorFilter = "All" | "Angels first" | "Funds";

export function guidanceTier(amount: number) {
  if (amount <= 50000) return "small";
  if (amount <= 150000) return "angels";
  if (amount <= 1000000) return "preseed";
  return "seed";
}
export function defaultFilter(amount: number): InvestorFilter {
  return amount <= 150000 ? "Angels first" : "All";
}
export function ticketFit(ticket: number | null, raise: number) {
  if (ticket == null || ticket <= 0 || raise <= 0) return null;
  return ticket > 5 * raise ? "bigger" : "fits";
}
export function filterInvestors<T extends { type: "angel" | "fund" }>(investors: T[], filter: InvestorFilter): T[] {
  if (filter === "Funds") return investors.filter((i) => i.type === "fund");
  if (filter === "Angels first") return [...investors.filter((i) => i.type === "angel"), ...investors.filter((i) => i.type === "fund")];
  return investors;
}
export const INDUSTRIES: Category[] = ["Health & Wellbeing", "Food & Nutrition", "Fintech & Insurance Tech", "Climate", "Cleantech", "Energy", "Mobility", "Education", "Enterprise Software", "AI", "E-commerce", "Medtech & Pharma", "Biotech", "Agricultural Tech", "Clothing & Fashion", "Home & Living", "Social Impact", "Gaming", "Travel & Leisure", "Something Else"];
export function dealSearchIndustries(input: { category: string; secondaryIndustry?: string | undefined }) {
  return [...new Set([input.category, input.secondaryIndustry].filter((s): s is string => !!s))].slice(0, 2);
}
export const INVESTOR_TYPES = ["All", "Angels", "VCs", "Corporate VCs"] as const;
export type InvestorKind = "Angel" | "VC" | "Corporate VC" | "Unknown";
export type InvestorTypeFilter = typeof INVESTOR_TYPES[number];
export function verifiedInvestorKind(value?: string): InvestorKind {
  if (!value) return "Unknown";
  if (/corporate (?:venture capital|vc)|corporate venture|investment arm/i.test(value)) return "Corporate VC";
  if (/venture capital|\bvc\b|venture fund/i.test(value)) return "VC";
  if (/angel investor|^angel$/i.test(value)) return "Angel";
  return "Unknown";
}
export function filterInvestorKind<T extends { kind?: InvestorKind }>(rows: T[], filter: InvestorTypeFilter): T[] {
  const kind = filter === "Angels" ? "Angel" : filter === "VCs" ? "VC" : "Corporate VC";
  return filter === "All" ? rows : rows.filter((row) => row.kind === kind);
}
