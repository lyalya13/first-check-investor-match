export const CATEGORIES = {
  "Health & Wellbeing": ["FemTech", "Women's Health", "Menstrual & Hormonal Health", "Fertility", "Mental Health", "Sleep", "Fitness", "Digital Therapeutics"],
  "Food & Nutrition": ["Nutrition Apps", "Meal Planning", "Food Waste", "Alternative Proteins", "Grocery Tech", "Restaurant Tech"],
  "Climate & Sustainability": ["Circular Economy", "Food Waste", "Textile Recycling", "Energy", "Carbon"],
  Fintech: ["Payments", "Personal Finance", "InsurTech", "Lending", "Financial Inclusion", "Embedded Finance"],
  AI: ["AI Agents", "Applied AI", "AI Infrastructure", "Computer Vision", "Voice AI", "AI Safety"],
  Education: ["Early Learning", "Learning Apps", "Teacher Tools", "Skills Training", "Language Learning", "Special Education"],
  "Consumer & E-commerce": ["Marketplaces", "Social Commerce", "Beauty Tech", "Parenting", "Creator Tools", "Resale"],
  "Enterprise Software": ["HR Tech", "Cybersecurity", "Developer Tools", "Workflow Automation", "Sales Tools", "Supply Chain"],
  Mobility: ["Electric Vehicles", "Charging", "Micromobility", "Fleet Software", "Public Transit", "Last-mile Delivery"],
  Other: ["Space Tech", "Robotics", "Travel Tech", "PropTech", "Legal Tech", "Pet Tech"],
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