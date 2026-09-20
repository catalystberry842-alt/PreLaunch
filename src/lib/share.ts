import type { Basket } from "@/lib/types";

export async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

export function basketShareUrl(id: string) {
  if (typeof window === "undefined") return `/basket/${id}`;
  return new URL(`/basket/${id}`, window.location.origin).toString();
}

export function basketShareText(basket: Pick<Basket, "name" | "thesis">) {
  const thesis = basket.thesis.trim().replace(/\s+/g, " ");
  const short = thesis.length > 160 ? `${thesis.slice(0, 157)}…` : thesis;
  return short ? `${basket.name} — ${short}` : `${basket.name} on PreLaunch`;
}

export async function shareBasket(basket: Pick<Basket, "id" | "name" | "thesis">) {
  const url = basketShareUrl(basket.id);
  const text = basketShareText(basket);
  try {
    if (typeof navigator.share === "function") {
      await navigator.share({ title: basket.name, text, url });
      return "shared";
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return "aborted";
  }
  const ok = await copyText(`${text}\n${url}`);
  return ok ? "copied" : "failed";
}
