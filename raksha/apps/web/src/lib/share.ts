import { smsLink, whatsappLink } from "@raksha/core";
import type { TrustedContact } from "../services/backend";

export async function shareText(text: string, url?: string): Promise<"shared" | "copied" | "failed"> {
  try {
    if (navigator.share) { await navigator.share({ title: "Raksha", text, url }); return "shared"; }
    await navigator.clipboard.writeText(url ? `${text} ${url}` : text);
    return "copied";
  } catch (e) {
    return (e as Error).name === "AbortError" ? "shared" : "failed";
  }
}
export const contactLinks = (c: TrustedContact, text: string) => ({ whatsapp: whatsappLink(c.phone, text), sms: smsLink(c.phone, text) });
