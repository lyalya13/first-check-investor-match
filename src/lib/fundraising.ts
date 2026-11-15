export const CATEGORIES = {
  "Health & Wellbeing": ["FemTech", "Women's Health", "Fertility", "Pregnancy and postpartum", "Menopause", "Cycle tracking", "Sexual health", "Mental health therapy", "Sleep monitoring", "Fitness coaching", "Digital therapeutics"],
  "Food & Nutrition": ["Meal Planning", "Personalized nutrition", "Food Waste", "Alternative Proteins", "Precision fermentation", "Grocery inventory", "Restaurant ordering", "Nutrition Apps"],
  "Climate & Sustainability": ["Circular packaging", "Food Waste", "Textile Recycling", "Battery recycling", "Solar energy", "Grid storage", "Carbon removal", "Carbon accounting"],
  Fintech: ["Cross-border payments", "Personal budgeting", "Embedded insurance", "SME lending", "Financial inclusion", "Embedded payments", "Fraud detection"],
  AI: ["Customer support agents", "Coding agents", "Model infrastructure", "Industrial computer vision", "Voice assistants", "AI evaluation", "AI safety"],
  Education: ["Early literacy", "Math learning", "Teacher planning", "Workforce reskilling", "Language learning", "Special education", "Student assessment"],
  "Consumer & E-commerce": ["B2C marketplaces", "Social commerce", "Personalized skincare", "Parenting support", "Creator monetization", "Fashion resale", "Subscription commerce"],
  "Enterprise Software": ["Recruitment software", "Cloud security", "Developer tooling", "Workflow automation", "Sales intelligence", "Supply chain planning", "Employee learning"],
  Mobility: ["Electric vehicle batteries", "EV charging", "Shared micromobility", "Fleet optimization", "Public transit planning", "Last-mile Delivery", "Autonomous logistics"],
  Other: ["Satellite analytics", "Warehouse robotics", "Travel booking", "Property management", "Legal automation", "Pet health"],
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