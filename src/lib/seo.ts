export const SITE_TITLE = "PreLaunch — Curated PreStock Baskets";
export const SITE_DESCRIPTION =
  "Create, discover, research and simulate curated baskets built from PreStocks.";

export function pageHead(title?: string, description = SITE_DESCRIPTION) {
  return {
    meta: [
      { title: title ? `${title} · PreLaunch` : SITE_TITLE },
      { name: "description", content: description },
    ],
  };
}
