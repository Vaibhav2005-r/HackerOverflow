import { useEffect, useState } from "react";
import { getBackend, type AccountInfo } from "../services/backend";
import { toast } from "../store/toast";
import { useT } from "../i18n";

type Step = "idle" | "link-code" | "signin-email" | "signin-code";

/** Settings → Account. Only in Supabase mode. Anonymous users can attach an email (same data), or sign in to an existing account. */
export function AccountCard() {
  const t = useT();
  const b = getBackend();
  const [info, setInfo] = useState<AccountInfo | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const refresh = () => void b.accountInfo().then(setInfo);
  useEffect(() => { void b.signIn().then(refresh); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!info?.supported) return null;
  const run = async (fn: () => Promise<void>, next?: Step, done?: string) => {
    setBusy(true); setErr("");
    try { await fn(); if (next) setStep(next); if (done) toast(done); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="card mt-6 p-4" data-testid="account-card">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-text-2">{t("acct.title")}</h2>
      {!info.anonymous ? (
        <>
          <p className="mt-2 text-[15px]" data-testid="account-email">{t("acct.signedIn", { email: info.email ?? "" })}</p>
          <p className="mt-1 text-xs text-text-2">{t("acct.signedInHint")}</p>
          <button className="btn mt-3 w-full" onClick={() => void run(async () => { await b.signOut(); location.reload(); })}>{t("acct.signOut")}</button>
        </>
      ) : (
        <>
          {step === "idle" && (
            <>
              <p className="mt-2 text-sm text-text-2">{t("acct.anonHint")}</p>
              <input className="field mt-3" type="email" inputMode="email" autoComplete="email" placeholder={t("acct.email")} value={email} onChange={(e) => setEmail(e.target.value)} data-testid="acct-email" />
              <button className="btn btn-primary mt-2 w-full" disabled={busy || !email.includes("@")} data-testid="acct-save" onClick={() => void run(() => b.linkEmail(email.trim()), "link-code")}>{t("acct.save")}</button>
              <button className="mt-3 text-sm font-semibold underline" style={{ color: "var(--brand-soft)" }} onClick={() => setStep("signin-email")}>{t("acct.haveOne")}</button>
            </>
          )}
          {step === "signin-email" && (
            <>
              <p className="mt-2 text-sm text-text-2">{t("acct.signInHint")}</p>
              <input className="field mt-3" type="email" inputMode="email" placeholder={t("acct.email")} value={email} onChange={(e) => setEmail(e.target.value)} data-testid="acct-signin-email" />
              <button className="btn btn-primary mt-2 w-full" disabled={busy || !email.includes("@")} onClick={() => void run(() => b.signInWithEmail(email.trim()), "signin-code")}>{t("acct.sendCode")}</button>
              <button className="mt-3 text-sm underline text-text-2" onClick={() => setStep("idle")}>{t("common.back")}</button>
            </>
          )}
          {(step === "link-code" || step === "signin-code") && (
            <>
              <p className="mt-2 text-sm text-text-2">{t("acct.codeSent", { email })}</p>
              <input className="field mt-3 text-center text-xl tracking-[.4em]" inputMode="numeric" maxLength={8} placeholder="••••••" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} data-testid="acct-code" />
              <button className="btn btn-primary mt-2 w-full" disabled={busy || code.length < 6} data-testid="acct-verify"
                onClick={() => void run(async () => { if (step === "link-code") { await b.confirmEmail(email.trim(), code); refresh(); } else { await b.confirmSignIn(email.trim(), code); location.reload(); } }, step === "link-code" ? "idle" : undefined, t("acct.done"))}>{t("acct.verify")}</button>
            </>
          )}
          {err && <p className="mt-2 text-sm" role="alert" style={{ color: "var(--cls-extra-care)" }}>{err}</p>}
        </>
      )}
    </div>
  );
}
