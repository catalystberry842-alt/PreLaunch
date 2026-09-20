export const CATEGORIES = [
  "AI",
  "Robotics",
  "Defense",
  "Fintech",
  "Space",
  "Infrastructure",
  "Consumer",
  "Private Markets",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export type FilterCategory = "All" | Category;

export type PreStockStatus = "catalog";

export interface PreStocksApiItem {
  name: string;
  symbol: string;
  description: string;
  image: string;
  external_url: string;
  contract_address: string;
  markPrice: number;
  markValuation: number;
  tokenPrice: number;
  impliedValuation: number;
  supply: number;
}

export interface PreStock {
  id: string;
  name: string;
  officialName: string;
  symbol: string;
  category: Category;
  initials: string;
  image: string;
  description: string;
  externalUrl: string;
  contractAddress: string;
  markPrice: number;
  markValuation: number;
  tokenPrice: number;
  impliedValuation: number;
  supply: number;
}

export interface BasketConstituent {
  preStockId: string;
  allocation: number;
}

export type BasketSource = "catalog" | "local";

export interface Basket {
  id: string;
  name: string;
  category: Category;
  creator: string;
  featured?: boolean;
  source: BasketSource;
  createdAt: string;
  updatedAt: string;
  description: string;
  thesis: string;
  constituents: BasketConstituent[];
  views: number;
  saves: number;
}

export interface ResolvedConstituent extends BasketConstituent {
  stock: PreStock;
}

export interface BasketHolding extends BasketConstituent {
  stock: PreStock | null;
}

export interface BasketDraft {
  name: string;
  description: string;
  category: Category;
  creator: string;
  selectedIds: string[];
  allocations: Record<string, number>;
  thesis: string;
}

export type CatalogSort = "featured" | "name" | "category";

export type BasketSort = "newest" | "views" | "saves" | "name";

export type ConstituentCountFilter = "any" | "2" | "3" | "4plus";

export type DiscoverTab = "all" | "baskets" | "prestocks" | "saved";

export interface CreatorProfile {
  id: string;
  name: string;
  bio: string;
}
