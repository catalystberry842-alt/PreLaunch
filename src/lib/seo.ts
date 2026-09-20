export const SITE_TITLE = "PreLaunch — Track PreStocks and build a strategy.";
export const SITE_DESCRIPTION =
  "PreLaunch gives you one place to track your PreStocks portfolio, research private-market exposure, build curated baskets, and simulate what-if scenarios.";

export function pageHead(title?: string, description = SITE_DESCRIPTION) {
  return {
    meta: [
      { title: title ? `${title} · PreLaunch` : SITE_TITLE },
      { name: "description", content: description },
    ],
  };
}
