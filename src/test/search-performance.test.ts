import { describe, expect, it, vi } from "vitest";
import { CALA_TIMEOUT_MS, parallelMap, progressiveMap } from "@/lib/search-performance";

describe("live search performance", () => {
  it("limits each Cala call to 20 seconds", () => { expect(CALA_TIMEOUT_MS).toBe(20000); });
  it("starts all five niches concurrently", async () => {
    let running = 0, peak = 0;
    const result = await parallelMap([1, 2, 3, 4, 5], async (n) => {
      running++; peak = Math.max(peak, running);
      await Promise.resolve(); running--; return n;
    });
    expect(peak).toBe(5); expect(result).toEqual([1, 2, 3, 4, 5]);
  });
  it("respects the six-connection production limit", async () => {
    let running = 0, peak = 0;
    await parallelMap(Array.from({ length: 20 }, (_, n) => n), async () => {
      running++; peak = Math.max(peak, running); await Promise.resolve(); running--;
    });
    expect(peak).toBe(6);
  });
  it("delivers a fast profile before a slow one finishes", async () => {
    let finishSlow: (value: string) => void = () => {};
    const slow = new Promise<string>((resolve) => { finishSlow = resolve; });
    const onResult = vi.fn();
    const pending = progressiveMap(["slow", "fast"], (item) => item === "slow" ? slow : Promise.resolve("fast profile"), onResult);
    await Promise.resolve(); await Promise.resolve();
    expect(onResult).toHaveBeenCalledWith("fast profile", "fast");
    expect(onResult).not.toHaveBeenCalledWith("slow profile", "slow");
    finishSlow("slow profile"); await pending;
    expect(onResult).toHaveBeenCalledWith("slow profile", "slow");
  });
});