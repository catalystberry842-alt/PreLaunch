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

export type PortfolioPosition = {
  symbol: string;
  name: string;
  image: string;
  initials: string;
  contractAddress: string;
  quantity: number;
  tokenPrice: number;
  value: number;
  allocation: number;
  costBasis: number | null;
  unrealizedPnl: number | null;
  unrealizedPnlPercent: number | null;
};

export type PortfolioHistoryStatus = "ok" | "unavailable" | "partial";

export type PortfolioSnapshot = {
  wallet: string;
  fetchedAt: string;
  totalValue: number;
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
