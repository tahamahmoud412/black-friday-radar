// Checks data/deals.json before it is pushed. Run: node scripts/check.mjs
// Exits with code 1 and lists the problems if anything is wrong.
import { readFileSync } from "node:fs";

const CATS = ["phones", "electronics", "appliances", "home", "fashion", "beauty", "baby", "grocery", "other"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const errors = [];

let data;
try {
  data = JSON.parse(readFileSync(new URL("../data/deals.json", import.meta.url), "utf8"));
} catch (e) {
  console.error("data/deals.json is not valid JSON:", e.message);
  process.exit(1);
}

if (!Array.isArray(data.deals)) errors.push("deals must be an array");
if (!Array.isArray(data.campaigns)) errors.push("campaigns must be an array");
if (data.lastCheck && isNaN(Date.parse(data.lastCheck))) errors.push("lastCheck is not a date");

const ids = new Set();
const urls = new Set();
for (const [i, d] of (data.deals || []).entries()) {
  const at = `deals[${i}] (${d && d.id})`;
  if (!d || typeof d !== "object") { errors.push(`${at}: not an object`); continue; }
  if (!/^[A-Za-z0-9-]+$/.test(d.id || "")) errors.push(`${at}: bad id`);
  if (ids.has(d.id)) errors.push(`${at}: duplicate id`);
  ids.add(d.id);
  if (!d.title || typeof d.title !== "string") errors.push(`${at}: missing title`);
  if (!d.store || typeof d.store !== "string") errors.push(`${at}: missing store`);
  if (!CATS.includes(d.category)) errors.push(`${at}: category must be one of ${CATS.join(", ")}`);
  if (typeof d.price !== "number" || !(d.price > 0)) errors.push(`${at}: price must be a positive number`);
  if (d.oldPrice != null && (typeof d.oldPrice !== "number" || d.oldPrice <= 0)) errors.push(`${at}: oldPrice must be a positive number`);
  try { const u = new URL(d.url); if (u.protocol !== "https:") errors.push(`${at}: url must be https`); }
  catch { errors.push(`${at}: bad url`); }
  if (d.image != null) {
    try { if (new URL(d.image).protocol !== "https:") errors.push(`${at}: image must be https`); }
    catch { errors.push(`${at}: bad image url`); }
  }
  if (urls.has(d.url)) errors.push(`${at}: duplicate url`);
  urls.add(d.url);
  if (isNaN(Date.parse(d.addedAt))) errors.push(`${at}: addedAt is not a date`);
  if (d.endsAt != null && !DATE.test(d.endsAt)) errors.push(`${at}: endsAt must be YYYY-MM-DD`);
}
for (const [i, c] of (data.campaigns || []).entries()) {
  const at = `campaigns[${i}] (${c && c.id})`;
  if (!c.id || !c.store || !c.name) errors.push(`${at}: needs id, store and name`);
  if (!DATE.test(c.start || "") || !DATE.test(c.end || "")) errors.push(`${at}: start and end must be YYYY-MM-DD`);
}

const KINDS = ["code", "bank", "auto"];
if (data.coupons != null && !Array.isArray(data.coupons)) errors.push("coupons must be an array");
const cids = new Set();
for (const [i, c] of (data.coupons || []).entries()) {
  const at = `coupons[${i}] (${c && c.id})`;
  if (!c || typeof c !== "object") { errors.push(`${at}: not an object`); continue; }
  if (!/^[A-Za-z0-9-]+$/.test(c.id || "")) errors.push(`${at}: bad id`);
  if (cids.has(c.id)) errors.push(`${at}: duplicate id`);
  cids.add(c.id);
  if (!c.store || typeof c.store !== "string") errors.push(`${at}: missing store`);
  if (!KINDS.includes(c.kind)) errors.push(`${at}: kind must be one of ${KINDS.join(", ")}`);
  if (c.kind === "code" && !/^[A-Za-z0-9_-]{2,30}$/.test(c.code || "")) errors.push(`${at}: kind "code" needs a code (letters, digits, - or _)`);
  if (c.kind !== "code" && c.code != null) errors.push(`${at}: only kind "code" may have a code`);
  if (!c.title || typeof c.title !== "string") errors.push(`${at}: missing title`);
  if (!c.off || typeof c.off !== "string" || c.off.length > 12) errors.push(`${at}: off must be a short string like "10%" or "300 ج.م"`);
  for (const k of ["minOrder", "maxOff"]) if (c[k] != null && (typeof c[k] !== "number" || c[k] <= 0)) errors.push(`${at}: ${k} must be a positive number`);
  try { if (new URL(c.url).protocol !== "https:") errors.push(`${at}: url must be https`); }
  catch { errors.push(`${at}: bad url`); }
  if (isNaN(Date.parse(c.addedAt))) errors.push(`${at}: addedAt is not a date`);
  if (c.endsAt != null && !DATE.test(c.endsAt)) errors.push(`${at}: endsAt must be YYYY-MM-DD`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`OK: ${data.deals.length} deals, ${data.campaigns.length} campaigns, ${(data.coupons || []).length} coupons`);
