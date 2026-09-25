import { fetchPreStocks } from "@/lib/prestocks-api";
import { parsePreStockTransactions } from "@/lib/helius-history";
import { buildPortfolioSnapshot } from "@/lib/portfolio";
import { isSolanaAddress } from "@/lib/solana-address";
import { isWorkspacePreview } from "@/lib/env.server";
import { normalizeContractAddress } from "@/types/prestocks";
import type {
  PortfolioErr,
  PortfolioHistoryStatus,
  PortfolioResponse,
  PortfolioTransaction,
} from "@/types/portfolio";

const PRODUCTION_MESSAGES = {
  invalid_wallet: "Enter a valid Solana wallet address",
  unavailable: "Portfolio tracking is temporarily unavailable.",
  catalog: "Unable to load the PreStocks catalog.",
  wallet_read: "Unable to read this wallet right now.",
} as const;

/** Upstream error details: Grok workspace preview or non-production builds only. */
function detailEnabled() {
  return isWorkspacePreview() || (process.env.NODE_ENV ?? "").trim() !== "production";
}

function fail(
  error: PortfolioErr["error"],
  code: PortfolioErr["code"],
  detail: string,
): PortfolioErr {
  const production =
    code === "invalid_wallet"
      ? PRODUCTION_MESSAGES.invalid_wallet
      : code === "catalog"
        ? PRODUCTION_MESSAGES.catalog
        : code === "wallet_read"
          ? PRODUCTION_MESSAGES.wallet_read
          : PRODUCTION_MESSAGES.unavailable;
  return {
    ok: false,
    error,
    code,
    message: detailEnabled() ? detail : production,
  };
}

export async function loadPortfolio(
  rawWallet: string,
  options?: { fresh?: boolean },
): Promise<PortfolioResponse> {
  const wallet = rawWallet.trim();
  const valid = isSolanaAddress(wallet);
  if (!valid) {
    return fail(
      "INVALID_WALLET",
      "invalid_wallet",
      PRODUCTION_MESSAGES.invalid_wallet,
    );
  }

  let catalog;
  try {
    catalog = await fetchPreStocks({
      fresh: options?.fresh === true,
    });
  } catch (reason) {
    const detail =
      reason instanceof Error && reason.message
        ? reason.message
        : "PreStocks API request failed";
    return fail("PRESTOCKS_REQUEST_FAILED", "catalog", detail);
  }

  const mints = catalog
    .map((item) => normalizeContractAddress(item.contractAddress))
    .filter(Boolean);

  const helius = await import("@/lib/helius.server");
  let tokens;
  try {
    tokens = await helius.fetchWalletFungibles(wallet, {
      fresh: options?.fresh === true,
      mints,
    });
  } catch (reason) {
    if (reason instanceof helius.HeliusConfigError) {
      return fail("HELIUS_CONFIG_MISSING", "unavailable", reason.message);
    }
    if (reason instanceof helius.HeliusAuthError) {
      return fail("HELIUS_AUTH_ERROR", "unavailable", reason.message);
    }
    if (reason instanceof helius.HeliusRequestError) {
      return fail(
        "HELIUS_REQUEST_FAILED",
        "wallet_read",
        reason.rpcMessage || reason.message,
      );
    }
    const detail =
      reason instanceof Error && reason.message
        ? reason.message
        : "Unable to read this wallet right now.";
    return fail("HELIUS_REQUEST_FAILED", "wallet_read", detail);
  }

  let transactions: PortfolioTransaction[] = [];
  let historyStatus: PortfolioHistoryStatus = "ok";
  let historyMessage: string | null = null;
  let truncated = false;
  let truncatedMints: string[] = [];

  try {
    const history = await helius.fetchWalletHistory(wallet, {
      fresh: options?.fresh === true,
      mints,
    });
    truncated = history.truncated;
    truncatedMints = history.truncatedMints;
    transactions = parsePreStockTransactions(history.raw, wallet, catalog);
    if (truncated) {
      historyStatus = "partial";
      historyMessage =
        "Older transactions for some PreStocks were not loaded. Their cost basis is shown as unavailable.";
    }
  } catch (reason) {
    historyStatus = "unavailable";
    const configOrAuth =
      reason instanceof helius.HeliusConfigError ||
      reason instanceof helius.HeliusAuthError;
    if (configOrAuth) {
      historyMessage = "Transaction history is unavailable.";
    } else if (detailEnabled() && reason instanceof Error && reason.message) {
      historyMessage = reason.message;
    } else {
      historyMessage = "Unable to load transaction history.";
    }
  }

  const snapshot = buildPortfolioSnapshot(wallet, tokens.tokens, catalog, undefined, {
    transactions,
    status: historyStatus,
    message: historyMessage,
    truncated,
    truncatedMints,
  });

  return { ok: true, snapshot };
}
