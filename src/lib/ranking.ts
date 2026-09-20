export function rankScore(input: {
  views: number;
  saves: number;
  constituents: number;
  createdAt: string;
  now?: number;
}) {
  const now = input.now ?? Date.now();
  const created = Date.parse(input.createdAt);
  const ageDays = Number.isFinite(created)
    ? Math.max(0, (now - created) / 86_400_000)
    : 30;
  const recency = Math.max(0, 30 - ageDays) * 2;
  return input.views * 2 + input.saves * 5 + input.constituents * 3 + recency;
}

export function basketSearchText(basket: {
  name: string;
  category: string;
  description: string;
  thesis: string;
  creator: string;
  constituents: { preStockId: string }[];
}) {
  return [
    basket.name,
    basket.category,
    basket.description,
    basket.thesis,
    basket.creator,
    ...basket.constituents.map((item) => item.preStockId),
  ]
    .join(" ")
    .toLowerCase();
}

export function matchesBasketText(
  basket: {
    name: string;
    category: string;
    description: string;
    thesis: string;
    creator: string;
    constituents: { preStockId: string }[];
  },
  query: string,
  extra = "",
) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return `${basketSearchText(basket)} ${extra.toLowerCase()}`.includes(q);
}
