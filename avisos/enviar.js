// Envía los avisos de preguntas pendientes. Lo ejecuta GitHub Actions cada hora.
const webpush = require("web-push");

const FIREBASE_URL = (process.env.FIREBASE_URL || "").replace(/\/+$/, "");
const PUB = process.env.VAPID_PUBLIC, PRIV = process.env.VAPID_PRIVATE;
const APP_URL = process.env.APP_URL || "./";
if (!FIREBASE_URL || !PUB || !PRIV) { console.log("Avisos sin configurar: falta el secreto VAPID_PRIVATE. No se envía nada."); process.exit(0); }
const BASE = FIREBASE_URL + "/mazosOposicion";
webpush.setVapidDetails("mailto:avisos@mazos-oposicion.app", PUB, PRIV);

const get = async p => { const r = await fetch(BASE + p + ".json"); if (!r.ok) throw new Error(p + " HTTP " + r.status); return r.json(); };
const put = (p, v) => fetch(BASE + p + ".json", { method: "PUT", body: JSON.stringify(v) });
const del = p => fetch(BASE + p + ".json", { method: "DELETE" });

function madrid(d = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" })
    .formatToParts(d).map(x => [x.type, x.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

function mensaje(res, date, slot, first) {
  const rows = (res && res.dias && res.dias[date]) || null;
  if (!rows) return { title: "Mazos Oposición", body: "Abre la app para ver tus preguntas de hoy." };
  const total = rows.reduce((s, r) => s + r[1] + r[2], 0);
  const temas = rows.length;
  const hoyAct = res.hoy === date;
  const hechas = hoyAct ? res.respondidasHoy || 0 : 0, ok = hoyAct ? res.aciertosHoy || 0 : 0;
  if (!total) {
    return { title: hechas ? "Hoy lo tienes todo al día ✓" : "Sin preguntas pendientes hoy",
      body: hechas ? `${hechas} respondidas · ${Math.round(ok * 100 / hechas)} % de acierto` : "Puedes adelantar preguntas nuevas si te apetece." };
  }
  const lista = rows.slice(0, 5).map(r => `${r[0]}: ${r[1] + r[2]}${r[1] ? ` (${r[1]} nuevas)` : ""}`).join("\n") + (temas > 5 ? `\n… y ${temas - 5} temas más` : "");
  let title;
  if (first) title = `Buenos días · ${total} preguntas para hoy en ${temas} ${temas === 1 ? "tema" : "temas"}`;
  else if (slot >= 18) title = `Te quedan ${total} preguntas de hoy`;
  else title = `${total} preguntas pendientes${hechas ? ` · llevas ${hechas} hoy` : ""}`;
  return { title, body: lista };
}

(async () => {
  const { date, hour } = madrid();
  const subs = (await get("/push")) || {};
  const ids = Object.keys(subs);
  if (!ids.length) { console.log("No hay dispositivos suscritos."); return; }
  let res = null;
  try { const doc = await get("/resumen/main"); res = doc && doc.json ? JSON.parse(doc.json) : null; } catch (e) { console.log("Sin resumen:", e.message); }
  const sent = (await get("/enviados")) || {};
  for (const id of ids) {
    const s = subs[id]; if (!s || !s.sub) continue;
    const hours = (s.hours || [7, 13, 19]).map(Number).sort((a, b) => a - b);
    // El hueco que toca: la hora configurada más reciente, con hasta 2 h de margen por retrasos de GitHub.
    const slot = hours.filter(h => h <= hour && hour - h < 2).pop();
    if (slot === undefined) continue;
    const key = `${date}-${slot}`;
    if (sent[id] && sent[id][key]) continue;
    const msg = mensaje(res, date, slot, slot === hours[0]);
    try {
      await webpush.sendNotification(JSON.parse(s.sub), JSON.stringify({ ...msg, url: APP_URL, tag: "mazos-pendientes" }), { TTL: 3 * 3600 });
      await put(`/enviados/${id}`, { [key]: Date.now() });
      console.log(`Enviado a ${id} (${key}): ${msg.title}`);
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) { await del(`/push/${id}`); console.log(`Suscripción caducada eliminada: ${id}`); }
      else console.log(`Error con ${id}:`, e.statusCode || e.message);
    }
  }
})().catch(e => { console.error(e); process.exit(1); });
