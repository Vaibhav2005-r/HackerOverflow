import { useState } from "react";
import { ArrowLeft, Trash2, UserPlus } from "lucide-react";
import { useSession } from "../store/session";
import { navigate } from "../lib/router";
import { normalizePhone, PHONE_RE } from "../lib/phone";
import { useT } from "../i18n";

export default function Circle() {
  const t = useT();
  const { circle, save, remove } = useSession();
  const [f, setF] = useState({ name: "", phone: "", relation: "" });
  const [err, setErr] = useState("");
  const add = async () => {
    const phone = normalizePhone(f.phone);
    if (!f.name.trim() || !PHONE_RE.test(phone)) { setErr(t("circle.invalidPhone")); return; }
    setErr("");
    try { await save({ name: f.name.trim(), phone, relation: f.relation.trim() || undefined }); setF({ name: "", phone: "", relation: "" }); } catch { setErr(t("circle.max")); }
  };
  return (
    <div className="absolute inset-0 z-20 overflow-y-auto bg-bg-0 px-5 safe-top safe-bottom" data-testid="circle">
      <div className="flex items-center gap-2 py-2"><button className="btn !min-h-11" onClick={() => navigate("/")} aria-label={t("common.back")}><ArrowLeft size={20} /></button><h1 className="text-xl font-bold">{t("circle.title")}</h1></div>
      {circle.length === 0 && <p className="mt-4 text-text-2">{t("circle.empty")}</p>}
      <ul className="mt-3 space-y-2">
        {circle.map((c) => (
          <li key={c.id} className="card flex items-center gap-3 p-3" data-testid="circle-item"><div className="flex-1"><p className="font-semibold">{c.name}{c.relation ? <span className="font-normal text-text-2"> · {c.relation}</span> : null}</p><p className="text-sm text-text-2">{c.phone}</p></div>
            <button className="btn !min-h-11 !px-3" onClick={() => void remove(c.id)} aria-label={`${t("common.delete")} ${c.name}`}><Trash2 size={18} /></button></li>
        ))}
      </ul>
      {circle.length < 5 ? (
        <div className="mt-6 space-y-2">
          <input className="field" placeholder={t("circle.name")} value={f.name} maxLength={40} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <input className="field" inputMode="tel" placeholder={t("circle.phone")} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          <input className="field" placeholder={t("circle.relation")} value={f.relation} maxLength={20} onChange={(e) => setF({ ...f, relation: e.target.value })} />
          <p className="h-5 text-sm text-extra-care" role="alert">{err}</p>
          <button className="btn btn-primary btn-lg w-full" onClick={() => void add()}><UserPlus />{t("circle.add")}</button>
        </div>
      ) : <p className="mt-6 text-sm text-text-2">{t("circle.max")}</p>}
    </div>
  );
}
