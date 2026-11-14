import { describe, it, expect } from "vitest";
import { aggregateInvestors, isActive } from "@/lib/aggregate";

const now = new Date("2026-11-14");
describe("aggregateInvestors", () => {
  const res = aggregateInvestors(
    [
      { company: "A", investors: ["Fund X", "Angel Y"], lead: "Fund X", amount: 100, date: "2026-05-01" },
      { company: "B", investors: ["Fund X"], amount: 300, date: "2024-02-01" },
    ],
    now,
  );
  it("counts deals and leads", () => {
    const x = res.find((r) => r.name === "Fund X")!;
    expect(x.deals).toBe(2);
    expect(x.led).toBe(1);
    expect(x.typicalTicket).toBe(200);
    expect(x.latestDate).toBe("2026-05-01");
  });
  it("marks active only within 12 months", () => {
    expect(isActive("2025-12-01", now)).toBe(true);
    expect(isActive("2025-10-01", now)).toBe(false);
  });
});
