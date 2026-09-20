import { baskets } from "@/lib/baskets";
import type { Basket, CreatorProfile } from "@/lib/types";

const KNOWN: CreatorProfile[] = [
  {
    id: "mira-chen",
    name: "mira.chen",
    bio: "AI and frontier-stack baskets on PreLaunch.",
  },
  {
    id: "atlas-labs",
    name: "atlas.labs",
    bio: "Defense and autonomy baskets on PreLaunch.",
  },
  {
    id: "north-park",
    name: "north.park",
    bio: "Fintech and application-layer baskets on PreLaunch.",
  },
  {
    id: "kline-works",
    name: "kline.works",
    bio: "Robotics and physical-AI baskets on PreLaunch.",
  },
  {
    id: "helix-orbit",
    name: "helix.orbit",
    bio: "Space-economy baskets on PreLaunch.",
  },
  {
    id: "vale-studio",
    name: "vale.studio",
    bio: "Private fintech baskets on PreLaunch.",
  },
  {
    id: "anonymous-creator",
    name: "Anonymous Creator",
    bio: "Baskets launched from this browser.",
  },
];

export function creatorIdFromName(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "anonymous-creator";
}

export function getCreator(id: string): CreatorProfile {
  const match = KNOWN.find((item) => item.id === id);
  if (match) return match;
  const byName = KNOWN.find((item) => creatorIdFromName(item.name) === id);
  if (byName) return byName;
  const basketsForId = baskets
    .getAll()
    .filter((basket) => creatorIdFromName(basket.creator) === id);
  const name = basketsForId[0]?.creator ?? id.replace(/-/g, " ");
  return {
    id,
    name,
    bio: "PreLaunch creator. Baskets published from this browser.",
  };
}

export function basketsForCreator(id: string): Basket[] {
  return baskets
    .getAll()
    .filter((basket) => creatorIdFromName(basket.creator) === id);
}
