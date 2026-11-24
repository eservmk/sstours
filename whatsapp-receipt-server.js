// Booking + availability + automatic WhatsApp receipts. Node 18+.  Run: node whatsapp-receipt-server.js
// Customers get the receipt as a PDF document on WhatsApp.
// Admin page: set ADMIN_KEY to a long secret, open admin.html and sign in with it.
// Env: WA_TEMPLATE (optional, approved template with a DOCUMENT header, body vars: name, booking id, vehicle, travel date), WA_TOKEN, WA_PHONE_ID (WhatsApp Cloud API, optional), OWNER_NUMBERS (optional, comma separated; default Gautam + Kartik),
//      ALLOW_ORIGIN (your website URL), ADMIN_KEY (secret to cancel/release dates), PORT
// Bookings are saved in bookings.json next to this file, so every visitor sees the same booked dates.
// Meta only allows free text inside 24h after the customer messages you; for new customers use an approved template.

const crypto = require("crypto"), http = require("http"), fs = require("fs"), path = require("path");
// Every booking (PDF receipt only, no text message) goes automatically to Gautam Mewara and Kartik Mewara.
const OWNERS = (process.env.OWNER_NUMBERS || "919166304454,918387932376").split(",").map((x) => x.trim()).filter(Boolean);
const { WA_TEMPLATE, WA_TOKEN, WA_PHONE_ID, OWNER_NUMBER, ADMIN_KEY, ALLOW_ORIGIN = "*" } = process.env;
const FILE = path.join(__dirname, "bookings.json");
let DB = [];
const FAILS = {};
try { DB = JSON.parse(fs.readFileSync(FILE, "utf8")); } catch (e) {}
const save = () => fs.writeFileSync(FILE, JSON.stringify(DB, null, 1));

const send = (payload) => !WA_TOKEN ? Promise.resolve() :
  fetch(`https://graph.facebook.com/v20.0/${WA_PHONE_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
  }).then((r) => { if (!r.ok) throw new Error("WhatsApp API " + r.status); });

function rowsOf(b){const D=t=>/^\d{4}-\d\d-\d\d$/.test(t)?new Date(t+"T00:00:00Z").toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"}):t;const m=n=>n==null?"Amount after quote":"Rs. "+Number(n).toLocaleString("en-IN");
const r=[["Name",b.name],["WhatsApp","+91 "+b.phone],["Vehicle",b.veh],["Travel date",D(b.d1)],["Return date",b.d2?D(b.d2):"-"],["Pickup",b.from],["Destination",b.to],["Passengers",b.pax],["Package",b.pkg],["Duration",b.dur],["Package rate",b.rate?m(b.rate):"To be confirmed"],["Payment option",String(b.pay).replace(/\u20B9/g,"Rs. ")],["Pay now",m(b.now)]];
if(b.bal)r.push(["Balance due",m(b.bal)]);r.push(["Requirements",b.req]);return r}
function makePdf(b){const A=t=>String(t).replace(/\u20B9/g,"Rs. ").replace(/[^\x20-\x7E]/g,"?").replace(/[\\()]/g,"\\$&");
let c="",y=672;const T=(x,yy,t,s,f,col)=>{c+="BT /"+f+" "+s+" Tf "+(col||"0 0 0")+" rg "+x+" "+yy+" Td ("+A(t)+") Tj ET\n"};
const wrap=(t,n)=>{const o=[];let l="";String(t).split(/\s+/).forEach(w=>{if((l+" "+w).trim().length>n){o.push(l);l=w}else l=(l+" "+w).trim()});o.push(l);return o};
c+="0.059 0.165 0.125 rg 0 752 595 90 re f\n";
T(40,806,"Shree Sawariya Seth Tour & Travels",19,"F2","0.89 0.79 0.56");
T(40,787,"Pali Road, Bar, Rajasthan  |  +91 91663 04454  |  +91 83879 32376",9,"F1","0.98 0.96 0.93");
T(40,765,"BOOKING RECEIPT",11,"F2","0.89 0.79 0.56");
T(40,722,"Booking ID: "+b.id,17,"F2","0.059 0.165 0.125");T(40,705,"Issued: "+b.issued,9,"F1","0.4 0.4 0.4");
rowsOf(b).forEach(([k,v])=>{const L=wrap(v,58);T(40,y,k,10,"F1","0.4 0.4 0.4");L.forEach((t,i)=>T(190,y-i*14,t,11,"F2"));y-=L.length*14+4;c+="0.85 0.8 0.7 RG 40 "+(y+9)+" m 555 "+(y+9)+" l S\n";y-=10});
y-=6;const S=wrap("Status: Booking confirmed in our system for the dates above. Your vehicle is secured once the payment is received and acknowledged by us. Please keep this receipt and your Booking ID for reference.",92);
c+="0.98 0.965 0.925 rg 40 "+(y-S.length*13-6)+" 515 "+(S.length*13+14)+" re f\n0.79 0.64 0.36 rg 40 "+(y-S.length*13-6)+" 3 "+(S.length*13+14)+" re f\n";
S.forEach((t,i)=>T(52,y-i*13,t,9.5,"F1","0.14 0.15 0.14"));
T(40,50,"Safe | Reliable | Affordable - Thank you for choosing Shree Sawariya Seth Tour & Travels.",9,"F1","0.4 0.4 0.4");
const O=["<</Type/Catalog/Pages 2 0 R>>","<</Type/Pages/Kids[3 0 R]/Count 1>>","<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R/F2 6 0 R>>>>>>",
"<</Length "+c.length+">>\nstream\n"+c+"endstream","<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>","<</Type/Font/Subtype/Type1/BaseFont/Helvetica-Bold>>"];
let p="%PDF-1.4\n";const off=[];O.forEach((o,i)=>{off.push(p.length);p+=(i+1)+" 0 obj\n"+o+"\nendobj\n"});
const x=p.length;p+="xref\n0 "+(O.length+1)+"\n0000000000 65535 f \n"+off.map(n=>String(n).padStart(10,"0")+" 00000 n \n").join("")+"trailer\n<</Size "+(O.length+1)+"/Root 1 0 R>>\nstartxref\n"+x+"\n%%EOF";return p}

const GRAPH = `https://graph.facebook.com/v20.0/${WA_PHONE_ID}`;
async function upload(buf, name) {
  const f = new FormData();
  f.append("messaging_product", "whatsapp"); f.append("type", "application/pdf");
  f.append("file", new Blob([buf], { type: "application/pdf" }), name);
  const r = await fetch(GRAPH + "/media", { method: "POST", headers: { Authorization: `Bearer ${WA_TOKEN}` }, body: f });
  if (!r.ok) throw new Error("media upload " + r.status);
  return (await r.json()).id;
}
async function sendPdf(to, b, forOwner) {
  if (!WA_TOKEN) return;
  const filename = `Booking-Receipt-${b.id}.pdf`;
  const id = await upload(Buffer.from(makePdf(b), "latin1"), filename);
  if (WA_TEMPLATE && !forOwner)
    return send({ to, type: "template", template: { name: WA_TEMPLATE, language: { code: "en" }, components: [
      { type: "header", parameters: [{ type: "document", document: { id, filename } }] },
      { type: "body", parameters: [b.name, b.id, b.veh, b.d1].map((text) => ({ type: "text", text: String(text) })) } ] } });
  return send({ to, type: "document", document: { id, filename, caption: forOwner ? "New booking " + b.id : "Your booking receipt " + b.id + ". Shree Sawariya Seth Tour & Travels" } });
}
const iso = /^\d{4}-\d{2}-\d{2}$/;
const reply = (res, code, obj) => res.writeHead(code, { "Content-Type": "application/json" }).end(JSON.stringify(obj));
const today = () => new Date().toISOString().slice(0, 10);

http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", ALLOW_ORIGIN);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.writeHead(204).end();

  // Public: only vehicle + dates, no personal data
  if (req.method === "GET" && req.url === "/bookings")
    return reply(res, 200, DB.filter((b) => b.e >= today()).map(({ v, s, e }) => ({ v, s, e })));

  if (req.method !== "POST") return res.writeHead(404).end();
  let body = ""; req.on("data", (c) => (body += c));
  req.on("end", async () => {
    try {
      const j = JSON.parse(body);

      // ---------- Admin API (used by admin.html). Every call needs the ADMIN_KEY ----------
      if (req.url.startsWith("/admin/") || req.url === "/cancel") {
        const ip = req.socket.remoteAddress; let f = FAILS[ip] || { n: 0, t: 0 };
        if (Date.now() - f.t > 9e5) f = { n: 0, t: 0 };
        if (f.n >= 10) return reply(res, 429, { ok: false });
        const a = Buffer.from(String(j.key || "")), k = Buffer.from(ADMIN_KEY || "");
        if (!ADMIN_KEY || a.length !== k.length || !crypto.timingSafeEqual(a, k)) {
          FAILS[ip] = { n: f.n + 1, t: Date.now() }; return reply(res, 403, { ok: false });
        }
        delete FAILS[ip];
        if (req.url === "/admin/list") return reply(res, 200, { ok: true, bookings: DB });
        if (req.url === "/admin/delete" || req.url === "/cancel") { // release dates
          DB = DB.filter((b) => b.id !== j.id); save(); return reply(res, 200, { ok: true });
        }
        if (req.url === "/admin/status") {
          const b = DB.find((x) => x.id === j.id);
          if (!b || !["pending", "paid"].includes(j.status)) return reply(res, 400, { ok: false });
          b.status = j.status; save(); return reply(res, 200, { ok: true });
        }
        if (req.url === "/admin/add") { // block dates for an offline / phone booking
          const veh = String(j.veh || "").slice(0, 60);
          if (!veh || !iso.test(j.s) || !iso.test(j.e) || j.e < j.s) return reply(res, 400, { ok: false });
          const c = DB.find((x) => x.v === veh && x.s <= j.e && x.e >= j.s);
          if (c) return reply(res, 409, { ok: false, range: c.s === c.e ? c.s : c.s + " to " + c.e });
          DB.push({ id: "MAN-" + Date.now().toString(36).toUpperCase(), v: veh, veh, s: j.s, e: j.e,
            name: String(j.name || "Manual block").slice(0, 80), phone: String(j.phone || "").replace(/\D/g, "").slice(-10),
            note: String(j.note || "").slice(0, 200), status: "paid", manual: true, at: new Date().toISOString() });
          save(); return reply(res, 200, { ok: true });
        }
        if (req.url === "/admin/resend") { // send the PDF receipt again
          const b = DB.find((x) => x.id === j.id);
          if (!b || b.manual || !b.phone) return reply(res, 400, { ok: false });
          await sendPdf("91" + b.phone, b, false);
          for (const o of OWNERS) await sendPdf(o, b, true);
          return reply(res, 200, { ok: true });
        }
        return res.writeHead(404).end();
      }

      if (req.url === "/book") {
        const b = j.booking;
        if (!b || !iso.test(b.s) || !iso.test(b.e) || b.e < b.s || b.s < today() || !/^91[6-9]\d{9}$/.test("91" + b.phone))
          return reply(res, 400, { ok: false });
        // Overlap rule: same vehicle and the date ranges touch at all (travel date to return date, inclusive)
        const c = DB.find((x) => x.v === b.veh && x.s <= b.e && x.e >= b.s);
        if (c) return reply(res, 409, { ok: false, range: c.s === c.e ? c.s : c.s + " to " + c.e });
        DB.push({ ...b, v: b.veh, status: "pending", at: new Date().toISOString() });
        save(); // single-threaded, check + save happen together, so two people cannot take the same dates
        sendPdf("91" + b.phone, b, false).catch(console.error);
        for (const o of OWNERS) { sendPdf(o, b, true).catch(console.error); }
        return reply(res, 200, { ok: true });
      }
      res.writeHead(404).end();
    } catch (e) { console.error(e.message); reply(res, 500, { ok: false }); }
  });
}).listen(process.env.PORT || 3000, () => console.log("Booking server running"));
