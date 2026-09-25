import { formatAddress } from "@/lib/format";
import { SAMPLE_WALLET } from "@/lib/sample-wallet";

/** Small secondary action that fills a real public wallet holding PreStocks. */
export function SampleWalletHint({ onUse }: { onUse: (wallet: string) => void }) {
  return (
    <p className="mt-2 type-meta">
      <button
        type="button"
        onClick={() => onUse(SAMPLE_WALLET)}
        className="py-1 font-medium text-foreground/90 underline decoration-border underline-offset-4 hover:text-foreground hover:decoration-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
      >
        Try a sample wallet
      </button>
      <span>
        {" "}
        · sample public wallet{" "}
        <span className="font-mono">{formatAddress(SAMPLE_WALLET)}</span>, not
        affiliated with PreLaunch
      </span>
    </p>
  );
}
