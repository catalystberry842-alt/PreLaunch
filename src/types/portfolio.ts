export type WalletToken = {
  mint: string;
  quantity: number;
};

export type PortfolioTxType =
  | "buy"
  | "sell"
  | "transfer_in"
  | "transfer_out"
  | "transfer";

export type PortfolioTxDirection = "in" | "out";

export type PortfolioTransaction = {
  walletAddress: string;
  signature: string | null;
  timestamp: string | null;
  mint: string;
  symbol: string;
  name: string;
  quantity: number;
  direction: PortfolioTxDirection;
  type: PortfolioTxType;
  typeLabel: string;
  unitPriceUsd: number | null;
  valueUsd: number | null;
  costBasisEligible: boolean;
};

/**
 * One PreStock held by the wallet, matched to the catalog by mint.
 * `null` always means "unavailable" — never an estimate.
 */
export type PortfolioPosition = {
  symbol: string;
  name: string;
  image: string;
  initials: string;
  /** Mint address from the PreStocks catalog (the matching key). */
  contractAddress: string;
  /** On-chain token quantity (UI amount, decimals applied). */
  quantity: number;
  /** Current catalog `tokenPrice` in USD; null when the catalog has no usable price. */
  tokenPrice: number | null;
  /** quantity × tokenPrice; null when the price is unavailable. */
  value: number | null;
  /** Share of priced portfolio value, in percent; null when unpriced. */
  allocation: number | null;
  /** Remaining average-cost basis; null when history cannot support it. */
  costBasis: number | null;
  unrealizedPnl: number | null;
  unrealizedPnlPercent: number | null;
};

/**
 * `ok`: history loaded without truncation. `partial`: older pages were not
 * loaded. `unavailable`: history could not be read at all.
 */
export type PortfolioHistoryStatus = "ok" | "unavailable" | "partial";

export type PortfolioSnapshot = {
  wallet: string;
  fetchedAt: string;
  /** Sum of priced position values. Excludes positions in `unpricedCount`. */
  totalValue: number;
  /** Positions held but without a usable catalog price (excluded from totals). */
  unpricedCount: number;
  totalCostBasis: number | null;
  unrealizedPnl: number | null;
  realizedPnl: number | null;
  costBasisMethod: "average_cost";
  positions: PortfolioPosition[];
  transactions: PortfolioTransaction[];
  historyStatus: PortfolioHistoryStatus;
  historyMessage: string | null;
  historyTruncated: boolean;
};

export type PortfolioErrorCode =
  | "invalid_wallet"
  | "unavailable"
  | "catalog"
  | "wallet_read";

export type PortfolioErrorName =
  | "INVALID_WALLET"
  | "HELIUS_CONFIG_MISSING"
  | "HELIUS_AUTH_ERROR"
  | "HELIUS_REQUEST_FAILED"
  | "PRESTOCKS_REQUEST_FAILED";

export type PortfolioOk = {
  ok: true;
  snapshot: PortfolioSnapshot;
};

export type PortfolioErr = {
  ok: false;
  error: PortfolioErrorName;
  code: PortfolioErrorCode;
  message: string;
};

export type PortfolioResponse = PortfolioOk | PortfolioErr;
