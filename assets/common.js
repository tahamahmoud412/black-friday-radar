// Shared helpers for the home page and the product page.
(function () {
  const CATS = { phones: "موبايلات", electronics: "إلكترونيات", appliances: "أجهزة منزلية", home: "مطبخ وبيت", fashion: "موضة وأحذية", beauty: "جمال وعناية", baby: "أطفال", grocery: "سوبرماركت", other: "حاجات تانية" };
  const DAY = 86400000;
  const BF = new Date("2026-11-27T00:00:00+02:00");
  const nf2 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
  const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
  const df = new Intl.DateTimeFormat("ar-EG-u-nu-latn", { day: "numeric", month: "long" });

  const fmt = v => (v >= 1000 ? nf0 : nf2).format(v);
  const disc = d => (d.oldPrice > d.price ? Math.round((1 - d.price / d.oldPrice) * 100) : 0);
  const saving = d => (d.oldPrice > d.price ? d.oldPrice - d.price : 0);
  const isNew = d => Date.now() - Date.parse(d.addedAt) < DAY;
  const expired = d => d.endsAt && Date.parse(d.endsAt + "T23:59:59+02:00") < Date.now();
  const dayLabel = iso => df.format(new Date(iso.length === 10 ? iso + "T12:00:00+02:00" : iso));
  function ago(iso) {
    const t = Date.parse(iso); if (!t) return "";
    const m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return "لسه نازل"; if (m < 60) return "من " + m + " دقيقة";
    const h = Math.round(m / 60); if (h < 24) return "من " + h + " ساعة";
    const d = Math.round(h / 24); return d === 1 ? "من يوم" : "من " + d + " أيام";
  }
  function safeUrl(u) { try { const x = new URL(u); return x.protocol === "https:" || x.protocol === "http:" ? x.href : null; } catch (e) { return null; } }
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  const productUrl = d => "product.html?id=" + encodeURIComponent(d.id);

  function picture(d, cls) {
    const box = el("div", cls || "pic");
    const ph = () => { box.textContent = ""; box.appendChild(el("span", "ph", d.store)); };
    const src = safeUrl(d.image);
    if (src) {
      const im = document.createElement("img");
      im.src = src; im.alt = d.title; im.loading = "lazy"; im.decoding = "async"; im.referrerPolicy = "no-referrer"; im.onerror = ph;
      box.appendChild(im);
    } else ph();
    return box;
  }

  function discountTag(d, cls) {
    const p = disc(d); if (!p) return null;
    const t = el("span", (cls || "tag") + " num", "-" + p + "%"); t.dir = "ltr"; return t;
  }

  // One deal card. Clicking anywhere opens the product page; the store button goes straight to the store.
  function card(d, opts) {
    opts = opts || {};
    const c = el("article", "deal" + (opts.flash ? " flash" : ""));
    const tg = discountTag(d); if (tg) c.appendChild(tg);
    c.appendChild(picture(d));
    const m = el("div", "meta");
    m.appendChild(el("span", "store", d.store));
    if (CATS[d.category]) m.appendChild(el("span", "cat", CATS[d.category]));
    if (isNew(d)) m.appendChild(el("span", "new", "● جديد"));
    c.appendChild(m);
    const h = el("h3", "title"); const a = el("a", null, d.title); a.href = productUrl(d); h.appendChild(a); c.appendChild(h);
    const pr = el("div", "prices num");
    pr.appendChild(el("span", "price", (d.priceFrom ? "من " : "") + fmt(d.price) + " ج.م"));
    if (d.oldPrice > d.price) { pr.appendChild(el("span", "old", fmt(d.oldPrice))); pr.appendChild(el("span", "save", "هتوفّر " + fmt(Math.round(saving(d))) + " ج.م")); }
    c.appendChild(pr);
    const info = []; if (d.note) info.push(d.note); if (d.endsAt) info.push("لحد " + dayLabel(d.endsAt));
    c.appendChild(info.length ? el("p", "dnote", info.join(" · ")) : el("span"));
    const f = el("div", "foot");
    f.appendChild(el("span", "num", ago(d.addedAt)));
    const u = safeUrl(d.url);
    if (u) { const g = el("a", "go", "من " + d.store + " ←"); g.href = u; g.target = "_blank"; g.rel = "noopener nofollow"; f.appendChild(g); }
    c.appendChild(f);
    return c;
  }

  async function loadData() {
    const r = await fetch("data/deals.json?t=" + Date.now(), { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json();
    return {
      lastCheck: j.lastCheck || null,
      campaigns: (j.campaigns || []).filter(c => c && c.start && c.end),
      deals: (j.deals || []).filter(d => d && d.id && d.title && typeof d.price === "number"),
      coupons: (j.coupons || []).filter(c => c && c.id && c.store && c.title && c.off && (c.kind !== "code" || c.code))
    };
  }

  function setStatus(lastCheck, ok) {
    const t = document.getElementById("statusText"), dot = document.getElementById("dot");
    if (!t) return;
    if (ok) { t.textContent = lastCheck ? "آخر تحديث " + ago(lastCheck) : ""; dot.className = "dot live"; }
    else { t.textContent = "مش قادر يجيب آخر تحديث دلوقتي"; dot.className = "dot"; }
  }

  // Simple "more like this": same category first, then shared brand/model words, similar price, bigger discount.
  function recommend(base, all, n) {
    const words = s => new Set((s.match(/[A-Za-z0-9][A-Za-z0-9.+-]{2,}/g) || []).map(w => w.toLowerCase()));
    const bw = words(base.title);
    return all
      .filter(d => d.id !== base.id && !expired(d))
      .map(d => {
        let s = 0;
        if (d.category === base.category) s += 5;
        for (const w of words(d.title)) if (bw.has(w)) s += 2;
        const ratio = d.price / base.price;
        if (ratio > 0.5 && ratio < 2) s += 2;
        if (d.store !== base.store) s += 0.5;
        s += disc(d) / 25;
        return { d, s };
      })
      .sort((a, b) => b.s - a.s)
      .slice(0, n)
      .map(x => x.d);
  }

  // ---------- coupons ----------
  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); return true; } catch (e) {}
    const x = document.createElement("textarea"); x.value = t; x.setAttribute("readonly", ""); x.style.position = "fixed"; x.style.opacity = "0";
    document.body.appendChild(x); x.select();
    let ok = false; try { ok = document.execCommand("copy"); } catch (e) {}
    x.remove(); return ok;
  }
  // Codes before no-code offers, newest first, then take turns between stores so one store doesn't fill the top.
  function mixCoupons(list) {
    const order = { code: 0, bank: 1, auto: 2 };
    const sorted = list.slice().sort((a, b) => (order[a.kind] ?? 3) - (order[b.kind] ?? 3) || (b.addedAt || "").localeCompare(a.addedAt || ""));
    const groups = new Map();
    for (const c of sorted) { const k = c.kind + "|" + c.store; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(c); }
    const out = [];
    for (const kind of ["code", "bank", "auto"]) {
      const qs = [...groups].filter(([k]) => k.startsWith(kind + "|")).map(([, v]) => v.slice());
      while (qs.some(q => q.length)) for (const q of qs) if (q.length) out.push(q.shift());
    }
    return out;
  }
  function copyButton(code, label, cls) {
    const btn = el("button", cls); btn.type = "button"; btn.setAttribute("aria-label", "انسخ الكود " + code);
    const idle = () => { btn.textContent = label; };
    idle();
    btn.onclick = async e => {
      e.preventDefault(); e.stopPropagation();
      const ok = await copyText(code);
      btn.textContent = ok ? "اتنسخ ✓" : "انسخه بإيدك"; btn.classList.toggle("done", ok);
      setTimeout(() => { btn.classList.remove("done"); idle(); }, 1800);
    };
    return btn;
  }
  // Small ticket for the home page strip: badge, store + what you get, and the code (tap to copy).
  function couponMini(c) {
    const k = el("article", "coupon mini");
    k.appendChild(el("div", "off num", c.off)).dir = "auto";
    const b = el("div", "body");
    const t = el("p", "line"); t.appendChild(el("b", null, c.store + " · ")); t.appendChild(document.createTextNode(c.title)); t.title = c.title; b.appendChild(t);
    if (c.kind === "code") {
      const row = el("div", "code");
      row.appendChild(el("b", null, c.code));
      row.appendChild(copyButton(c.code, "انسخ"));
      b.appendChild(row);
    } else b.appendChild(el("span", "nocode", c.kind === "bank" ? "من غير كود · بالكارت" : "من غير كود"));
    k.appendChild(b);
    return k;
  }
  // Full ticket for the coupons page: badge, title, code + copy, terms and a link to the store's page.
  function couponCard(c) {
    const k = el("article", "coupon");
    const off = el("div", "off"); off.appendChild(el("span", "num", c.off)).dir = "auto"; off.appendChild(el("small", null, c.kind === "bank" ? "بالكارت" : "خصم")); k.appendChild(off);
    const b = el("div", "body");
    const m = el("div", "meta"); m.appendChild(el("span", "store", c.store)); if (isNew(c)) m.appendChild(el("span", "new", "● جديد")); b.appendChild(m);
    b.appendChild(el("h3", null, c.title));
    if (c.kind === "code") {
      const row = el("div", "code"); row.appendChild(el("b", null, c.code)); row.appendChild(copyButton(c.code, "انسخ الكود")); b.appendChild(row);
    } else b.appendChild(el("span", "nocode", c.kind === "bank" ? "من غير كود · الخصم بيتطبق لما تدفع بالكارت" : "من غير كود · الخصم بيتطبق لوحده"));
    const t = []; if (c.minOrder) t.push("أقل طلب " + fmt(c.minOrder) + " ج.م"); if (c.maxOff) t.push("أقصى خصم " + fmt(c.maxOff) + " ج.م"); if (c.endsAt) t.push("لحد " + dayLabel(c.endsAt)); if (c.note) t.push(c.note);
    if (t.length) b.appendChild(el("p", "terms num", t.join(" · ")));
    const u = safeUrl(c.url);
    if (u) { const s = el("div", "src"); const a = el("a", null, "شوف الشروط عند " + c.store + " ←"); a.href = u; a.target = "_blank"; a.rel = "noopener nofollow"; s.appendChild(a); b.appendChild(s); }
    k.appendChild(b);
    return k;
  }

  // Footer credit: a shop receipt signed by the site's maker. The barcode is drawn from the letters of the name.
  const MAKER = { ar: "طه محمود", en: "TAHA MAHMOUD", link: "https://github.com/tahamahmoud412", handle: "@tahamahmoud412" };
  function barcode(text) {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "bars"); svg.setAttribute("aria-hidden", "true"); svg.setAttribute("preserveAspectRatio", "none");
    let x = 0; const parts = [];
    const bar = (w, on) => { if (on) parts.push([x, w]); x += w; };
    bar(2, 1); bar(1, 0); bar(2, 1); bar(2, 0);
    for (const ch of text.replace(/\s/g, "")) {
      const c = ch.charCodeAt(0);
      for (let i = 0; i < 6; i++) bar(1 + ((c >> i) & 1) * 2, i % 2 === 0);
      bar(1, 0);
    }
    bar(2, 1); bar(1, 0); bar(2, 1);
    svg.setAttribute("viewBox", "0 0 " + x + " 40");
    for (const [px, w] of parts) { const r = document.createElementNS(NS, "rect"); r.setAttribute("x", px); r.setAttribute("y", 0); r.setAttribute("width", w); r.setAttribute("height", 40); svg.appendChild(r); }
    return svg;
  }
  function credit(info) {
    const host = document.getElementById("credit"); if (!host) return;
    info = info || {};
    host.textContent = "";
    const r = el("div", "receipt"); r.setAttribute("role", "group"); r.setAttribute("aria-label", "الموقع من تصميم وتنفيذ " + MAKER.ar);
    r.appendChild(el("p", "tnote", "الموقع ببلاش… والتوفير كله ليك"));
    r.appendChild(barcode(MAKER.en));
    r.appendChild(el("div", "spell", MAKER.en));
    const th = el("div", "thanks"); th.appendChild(document.createTextNode("شكرًا لزيارتك · ")); const a = el("a", null, MAKER.handle); a.href = MAKER.link; a.target = "_blank"; a.rel = "noopener"; th.appendChild(a); r.appendChild(th);
    host.appendChild(r);
  }
  function creditFrom(deals) {
    const live = deals.filter(d => !expired(d));
    credit({ deals: live.length, stores: new Set(live.map(d => d.store)).size, max: live.length ? Math.max(...live.map(disc)) : 0 });
  }

  window.BFR = { copyText, mixCoupons, couponMini, couponCard, credit, creditFrom, CATS, DAY, BF, fmt, disc, saving, isNew, expired, dayLabel, ago, safeUrl, el, productUrl, picture, discountTag, card, loadData, setStatus, recommend };
})();
