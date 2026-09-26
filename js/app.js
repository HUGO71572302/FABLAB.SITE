import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const cfg = window.FABLAB_CONFIG || {};
export const supabaseReady =
  cfg.supabaseUrl &&
  cfg.supabaseAnonKey &&
  !cfg.supabaseUrl.includes("YOUR_PROJECT") &&
  cfg.supabaseAnonKey !== "YOUR_ANON_KEY";

export const supabase = supabaseReady
  ? createClient(cfg.supabaseUrl, cfg.supabaseAnonKey)
  : null;

export const OPENING = {
  1: { start: 8, end: 18 },
  2: { start: 8, end: 18 },
  3: { start: 8, end: 18 },
  4: { start: 8, end: 18 },
  5: { start: 8, end: 18 },
  6: { start: 9, end: 13 },
  0: null
};

export const STATUS_LABEL = {
  disponible: "Disponible",
  panne: "En panne",
  maintenance: "Maintenance",
  en_attente: "En attente",
  confirmee: "Confirmée",
  refusee: "Refusée",
  annulee: "Annulée"
};

export function toast(el, message, ok = false) {
  if (!el) return;
  el.textContent = message;
  el.classList.remove("hidden");
  el.className =
    "rounded-lg px-4 py-3 text-sm " +
    (ok ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-800 border border-red-200");
}

export async function getSession() {
  if (!supabase) return { user: null, profile: null };
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user ?? null;
  if (!user) return { user: null, profile: null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  return { user, profile };
}

export function requireConfigBanner() {
  if (supabaseReady) return;
  const b = document.createElement("div");
  b.className = "bg-amber-100 text-amber-950 text-sm px-4 py-2 text-center border-b border-amber-200";
  b.innerHTML =
    "Configure <code class='font-mono'>js/config.js</code> avec l’URL et la clé anon Supabase (voir README).";
  document.body.prepend(b);
}

export function renderNav(active, { user, profile } = {}) {
  const isMgr = profile?.role === "fabmanager";
  const links = [
    ["index.html", "Accueil", "home"],
    ["machines.html", "Machines", "machines"],
    user ? ["reservation.html", "Réserver", "resa"] : ["connexion.html", "Réserver", "resa"],
    user ? ["mes-reservations.html", "Mes réservations", "mine"] : null,
    isMgr ? ["fabmanager.html", "FabManager", "mgr"] : null
  ].filter(Boolean);

  const authBtn = user
    ? `<button type="button" id="logout-btn" class="text-sm font-medium text-stone-600 hover:text-orange-600">Déconnexion</button>`
    : `<a href="connexion.html" class="text-sm font-semibold text-orange-600 ${active === "auth" ? "underline" : ""}">Connexion</a>`;

  return `
  <header class="sticky top-0 z-40 bg-stone-50/95 backdrop-blur border-b border-stone-200">
    <div class="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
      <a href="index.html" class="flex items-center gap-2 font-bold tracking-tight text-stone-900">
        <span class="inline-flex h-7 w-7 items-center justify-center rounded bg-orange-500 text-white text-xs">FL</span>
        FabLab
      </a>
      <button type="button" id="menu-btn" class="md:hidden p-2 rounded border border-stone-300" aria-label="Menu">☰</button>
      <nav id="main-nav" class="hidden md:flex items-center gap-5">
        ${links
          .map(
            ([href, label, key]) =>
              `<a href="${href}" class="text-sm ${active === key ? "font-semibold text-orange-600" : "text-stone-600 hover:text-stone-900"}">${label}</a>`
          )
          .join("")}
        ${authBtn}
      </nav>
    </div>
    <nav id="mobile-nav" class="hidden md:hidden border-t border-stone-200 px-4 py-3 space-y-2 bg-stone-50">
      ${links.map(([href, label]) => `<a class="block py-1 text-stone-800" href="${href}">${label}</a>`).join("")}
      ${user ? `<button type="button" id="logout-btn-m" class="block py-1 text-stone-600">Déconnexion</button>` : `<a class="block py-1 text-orange-600 font-semibold" href="connexion.html">Connexion</a>`}
    </nav>
  </header>`;
}

export function bindNav() {
  const btn = document.getElementById("menu-btn");
  const mobile = document.getElementById("mobile-nav");
  btn?.addEventListener("click", () => mobile?.classList.toggle("hidden"));
  const logout = async () => {
    await supabase?.auth.signOut();
    location.href = "index.html";
  };
  document.getElementById("logout-btn")?.addEventListener("click", logout);
  document.getElementById("logout-btn-m")?.addEventListener("click", logout);
}

export function statusBadge(status) {
  const map = {
    disponible: { icon: "●", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
    panne: { icon: "⚠", cls: "bg-red-50 text-red-800 border-red-200" },
    maintenance: { icon: "🔧", cls: "bg-amber-50 text-amber-900 border-amber-200" },
    en_attente: { icon: "⏳", cls: "bg-amber-50 text-amber-900 border-amber-200" },
    confirmee: { icon: "✓", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
    refusee: { icon: "✕", cls: "bg-red-50 text-red-800 border-red-200" },
    annulee: { icon: "–", cls: "bg-stone-100 text-stone-600 border-stone-200" }
  };
  const m = map[status] || { icon: "·", cls: "bg-stone-100 text-stone-700 border-stone-200" };
  return `<span class="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full border ${m.cls}"><span aria-hidden="true">${m.icon}</span>${STATUS_LABEL[status] || status}</span>`;
}

export function fmtDate(iso) {
  return new Date(iso).toLocaleString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function slotsForDay(date, durationMin) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const hours = OPENING[d.getDay()];
  if (!hours) return [];
  const slots = [];
  const start = new Date(d);
  start.setHours(hours.start, 0, 0, 0);
  const endDay = new Date(d);
  endDay.setHours(hours.end, 0, 0, 0);
  const step = 30 * 60 * 1000;
  const dur = durationMin * 60 * 1000;
  for (let t = start.getTime(); t + dur <= endDay.getTime(); t += step) {
    slots.push({ start: new Date(t), end: new Date(t + dur) });
  }
  return slots;
}

export function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

export function next7Days() {
  const days = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    days.push(d);
  }
  return days;
}

export function machineCard(m) {
  return `
  <a href="machine.html?id=${m.id}" class="block rounded-xl border border-stone-200 bg-white p-4 hover:border-orange-300 hover:shadow-sm transition">
    <div class="flex items-start justify-between gap-2">
      <h3 class="font-semibold text-stone-900">${escapeHtml(m.name)}</h3>
      ${statusBadge(m.status)}
    </div>
    <p class="text-xs uppercase tracking-wide text-stone-500 mt-1">${escapeHtml(m.category)} · ${escapeHtml(m.level_required)}</p>
    <p class="text-sm text-stone-600 mt-2 line-clamp-2">${escapeHtml(m.description)}</p>
  </a>`;
}

export function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function layoutShell(innerFooter = true) {
  return innerFooter
    ? `<footer class="mt-16 border-t border-stone-200 py-8 text-center text-sm text-stone-500">© 2026 FabLab scolaire — atelier de fabrication numérique</footer>`
    : "";
}
