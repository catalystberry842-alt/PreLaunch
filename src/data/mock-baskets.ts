import type { Basket } from "../lib/types";

export const MOCK_BASKETS: Basket[] = [
  {
    id: "ai-infrastructure",
    name: "AI Infrastructure",
    category: "AI",
    creator: "mira.chen",
    featured: true,
    source: "catalog",
    createdAt: "2026-08-12T10:00:00.000Z",
    updatedAt: "2026-08-12T10:00:00.000Z",
    views: 0,
    saves: 0,
    description:
      "A basket focused on companies building the infrastructure behind the next generation of AI",
    thesis:
      "AI infrastructure is becoming one of the most important layers of the technology stack. This basket focuses on OpenAI and Anthropic as model-lab exposure, with Figure AI as a physical-systems sleeve. It is a thematic structure, not a forecast.",
    constituents: [
      { preStockId: "OPENAI", allocation: 40 },
      { preStockId: "ANTHROPIC", allocation: 35 },
      { preStockId: "FIGUREAI", allocation: 25 },
    ],
  },
  {
    id: "future-of-defense",
    name: "Future of Defense",
    category: "Defense",
    creator: "atlas.labs",
    featured: true,
    source: "catalog",
    createdAt: "2026-08-18T14:30:00.000Z",
    updatedAt: "2026-08-18T14:30:00.000Z",
    views: 0,
    saves: 0,
    description:
      "A basket focused on companies developing next-generation defense technology",
    thesis:
      "Software-defined defense and autonomy are the through-line. Anduril is the core weight; Figure AI and SpaceX add physical systems and adjacent launch infrastructure so the book is not a single prime. Not a view on procurement or geopolitics.",
    constituents: [
      { preStockId: "ANDURIL", allocation: 55 },
      { preStockId: "FIGUREAI", allocation: 25 },
      { preStockId: "SPACEX", allocation: 20 },
    ],
  },
  {
    id: "next-gen-fintech",
    name: "Next-Gen Fintech",
    category: "Fintech",
    creator: "north.park",
    featured: true,
    source: "catalog",
    createdAt: "2026-08-22T09:15:00.000Z",
    updatedAt: "2026-08-22T09:15:00.000Z",
    views: 0,
    saves: 0,
    description:
      "A basket focused on companies reshaping financial infrastructure",
    thesis:
      "Event markets are a distinct layer of financial infrastructure. Kalshi is the regulated sleeve; Polymarket is the crypto-native overlay. The book is split to compare two market designs — a feature of the thesis, not a forecast.",
    constituents: [
      { preStockId: "KALSHI", allocation: 55 },
      { preStockId: "POLYMARKET", allocation: 45 },
    ],
  },
  {
    id: "robotics-revolution",
    name: "Robotics Revolution",
    category: "Robotics",
    creator: "kline.works",
    source: "catalog",
    createdAt: "2026-09-04T11:45:00.000Z",
    updatedAt: "2026-09-04T11:45:00.000Z",
    views: 0,
    saves: 0,
    description:
      "Humanoids, neural interfaces, and autonomy packaged as a physical-AI theme",
    thesis:
      "If intelligence moves into the physical world, the relevant names are not only labs. This basket pairs a humanoid core with a brain-computer interface sleeve and a defense-autonomy satellite — a structure meant to be researched and simulated, not a tradable product from this page.",
    constituents: [
      { preStockId: "FIGUREAI", allocation: 50 },
      { preStockId: "NEURALINK", allocation: 35 },
      { preStockId: "ANDURIL", allocation: 15 },
    ],
  },
  {
    id: "future-of-space",
    name: "Future of Space",
    category: "Space",
    creator: "helix.orbit",
    source: "catalog",
    createdAt: "2026-09-01T16:00:00.000Z",
    updatedAt: "2026-09-01T16:00:00.000Z",
    views: 0,
    saves: 0,
    description:
      "Launch and adjacent defense names grouped as a space-economy book",
    thesis:
      "Space baskets in this catalog are structurally concentrated: SpaceX is the gravitational center, and Anduril is included as an adjacent defense-tech sleeve. The point is to show how a space thesis still has to disclose single-name risk.",
    constituents: [
      { preStockId: "SPACEX", allocation: 75 },
      { preStockId: "ANDURIL", allocation: 25 },
    ],
  },
  {
    id: "private-fintech-leaders",
    name: "Private Fintech Leaders",
    category: "Fintech",
    creator: "vale.studio",
    source: "catalog",
    createdAt: "2026-09-06T09:00:00.000Z",
    updatedAt: "2026-09-06T09:00:00.000Z",
    views: 0,
    saves: 0,
    description:
      "Regulated and crypto-native event markets as a private fintech core",
    thesis:
      "This book is a more even take on event-market infrastructure than a single-venue sleeve. Polymarket and Kalshi are weighted equally so concentration can be compared against Next-Gen Fintech.",
    constituents: [
      { preStockId: "POLYMARKET", allocation: 50 },
      { preStockId: "KALSHI", allocation: 50 },
    ],
  },
  {
    id: "ai-application-layer",
    name: "AI Application Layer",
    category: "AI",
    creator: "north.park",
    source: "catalog",
    createdAt: "2026-09-08T08:20:00.000Z",
    updatedAt: "2026-09-08T08:20:00.000Z",
    views: 0,
    saves: 0,
    description:
      "Model labs and physical AI grouped as an application-adjacent book",
    thesis:
      "An application-layer thesis still needs a model reference. OpenAI is the core, Anthropic is the second lab, and Figure AI is the physical-world sleeve. Not a claim these names form a real index.",
    constituents: [
      { preStockId: "OPENAI", allocation: 50 },
      { preStockId: "ANTHROPIC", allocation: 30 },
      { preStockId: "FIGUREAI", allocation: 20 },
    ],
  },
  {
    id: "defense-autonomy",
    name: "Defense Autonomy",
    category: "Defense",
    creator: "atlas.labs",
    source: "catalog",
    createdAt: "2026-09-10T13:10:00.000Z",
    updatedAt: "2026-09-10T13:10:00.000Z",
    views: 0,
    saves: 0,
    description:
      "Uncrewed systems, humanoids, and adjacent launch as a defense-autonomy book",
    thesis:
      "Autonomy is the shared thread: Anduril as the software-defined prime, Figure AI as a physical-systems satellite, and SpaceX as adjacent launch infrastructure. Multi-domain by design so the book is not a single-program bet.",
    constituents: [
      { preStockId: "ANDURIL", allocation: 60 },
      { preStockId: "FIGUREAI", allocation: 25 },
      { preStockId: "SPACEX", allocation: 15 },
    ],
  },
  {
    id: "frontier-stack",
    name: "Frontier Stack",
    category: "AI",
    creator: "mira.chen",
    source: "catalog",
    createdAt: "2026-09-12T10:00:00.000Z",
    updatedAt: "2026-09-12T10:00:00.000Z",
    views: 0,
    saves: 0,
    description:
      "Model labs, physical AI, defense autonomy, and launch as a five-name frontier book",
    thesis:
      "A frontier stack is not a single lab. This book splits model-lab exposure across OpenAI and Anthropic, then adds Figure AI as a physical-systems sleeve, Anduril as autonomy, and SpaceX as launch infrastructure. Five names, 100% allocated — a structure for research and simulation, not a tradable index.",
    constituents: [
      { preStockId: "OPENAI", allocation: 25 },
      { preStockId: "ANTHROPIC", allocation: 20 },
      { preStockId: "FIGUREAI", allocation: 20 },
      { preStockId: "ANDURIL", allocation: 20 },
      { preStockId: "SPACEX", allocation: 15 },
    ],
  },
];
