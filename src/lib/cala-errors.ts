export function calaSearchError(message: string): string {
  if (message === "MISSING_KEY") return "The Cala API key hasn't been added yet.";
  if (message === "CALA_RATE_LIMIT" || message === "Cala 429") return "Cala is busy, try again in a minute";
  if (message === "CALA_TIMEOUT") return "Cala took too long to respond, even after trying again. Please try again in a minute.";
  return "We couldn't reach Cala right now. Please try again.";
}