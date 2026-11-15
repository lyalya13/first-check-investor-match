import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { outreachStatus, type SavedPerson } from "@/lib/saved-items";

export function OutreachStatusPill({ person, onCycle }: { person: SavedPerson; onCycle: (id: string) => void }) {
  const name = person.role === "investor" ? person.investor.name : person.name;
  const status = outreachStatus(person);
  return <Button size="sm" variant={status === "Not contacted" ? "outline" : "secondary"} className="min-w-36 justify-between" aria-label={`Outreach status for ${name}: ${status}`} title="Change outreach status" onClick={() => onCycle(person.id)}>{status}<ChevronRight className="size-3" /></Button>;
}