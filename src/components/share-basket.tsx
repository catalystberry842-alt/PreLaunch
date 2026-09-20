import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { shareBasket } from "@/lib/share";
import type { Basket } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ShareBasketButton({
  basket,
  className,
  variant = "outline",
}: {
  basket: Pick<Basket, "id" | "name" | "thesis" | "source">;
  className?: string;
  variant?: "outline" | "default" | "secondary";
}) {
  async function onShare() {
    if (basket.source === "local") {
      toast("This basket only exists in this browser, so it can’t be opened elsewhere.");
      return;
    }
    const result = await shareBasket(basket);
    if (result === "copied") toast("Basket link copied");
    if (result === "failed") toast("Unable to share this basket");
  }

  return (
    <Button
      type="button"
      variant={variant}
      className={cn(className)}
      onClick={() => void onShare()}
    >
      <Share2 />
      Share Basket
    </Button>
  );
}
