import { useState, useEffect, useRef } from "react";

// ═══════════════════════════════════════════════════════════════
//  PASTE YOUR GOOGLE APPS SCRIPT WEB APP URL HERE:
// ═══════════════════════════════════════════════════════════════
const SHEET_URL = "https://docs.google.com/spreadsheets/d/1cpPmRYqlKMMNzRJhseKj93R9DWBvvvK-c_upwgxsMiU/edit?gid=1524388003#gid=1524388003";
// ═══════════════════════════════════════════════════════════════

const STORAGE_KEY = "taxi_shifts_v3";
const fmt = (v) => `Rf ${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtTips = (v) => Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const todayKey = () => new Date().toISOString().slice(0, 10);
const weekStartKey = () => {
  const d = new Date(); const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(new Date().setDate(diff)).toISOString().slice(0, 10);
};
const monthKey = () => new Date().toISOString().slice(0, 7);
const dayName = () => new Date().toLocaleDateString("en-US", { weekday: "long" });
const dateStr = () => new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" });
const netOf = (s) => (Number(s.fares)||0) + (Number(s.tips)||0) - (Number(s.expenses)||0);
const isConfigured = () => SHEET_URL && SHEET_URL !== "YOUR_APPS_SCRIPT_URL_HERE";

// ── Google Sheets API helpers ─────────────────────────────────
async function sheetFetch() {
  const res = await fetch(SHEET_URL);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error);
  return data.shifts;
}
async function sheetSave(shift) {
  await fetch(SHEET_URL, {
    method: "POST",
    body: JSON.stringify({ action: "save", shift }),
  });
}
async function sheetDelete(id) {
  await fetch(SHEET_URL, {
    method: "POST",
    body: JSON.stringify({ action: "delete", id }),
  });
}

// ── DONUT ─────────────────────────────────────────────────────
function DonutChart({ data, total }) {
  const size = 200, stroke = 30, r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const slices = data.map((d) => {
    const dash = total > 0 ? (d.value / total) * circ : 0;
    const s = { ...d, dash, gap: circ - dash, offset };
    offset += dash;
    return s;
  });
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#ede9fe" strokeWidth={stroke} />
      {slices.map((s, i) => (
        <circle key={i} cx={size/2} cy={size/2} r={r} fill="none"
          stroke={s.color} strokeWidth={stroke}
          strokeDasharray={`${s.dash} ${s.gap}`}
          strokeDashoffset={-s.offset}
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

// ── SYNC STATUS BADGE ─────────────────────────────────────────
function SyncBadge({ status }) {
  const cfg = {
    syncing: { bg:"#ede9fe", color:"#7c3aed", dot:"#a78bfa", text:"Syncing…"   },
    synced:  { bg:"#d1fae5", color:"#059669", dot:"#34d399", text:"Synced ✓"   },
    offline: { bg:"#fef3c7", color:"#d97706", dot:"#fbbf24", text:"Local only" },
    error:   { bg:"#fee2e2", color:"#dc2626", dot:"#f87171", text:"Sync error" },
  }[status] || null;
  if (!cfg) return null;
  return (
    <div style={{ display:"inline-flex", alignItems:"center", gap:5, background:cfg.bg, borderRadius:20, padding:"4px 10px" }}>
      <div style={{ width:6, height:6, borderRadius:"50%", background:cfg.dot }} />
      <span style={{ fontSize:11, fontWeight:600, color:cfg.color }}>{cfg.text}</span>
    </div>
  );
}

// ── HOME ──────────────────────────────────────────────────────
function HomeScreen({ shifts, daily, weekly, monthly, yearly, syncStatus, onRefresh, onNav }) {
  return (
    <div style={{ paddingBottom: 20 }}>
      <div style={{ background:"linear-gradient(160deg,#6d28d9 0%,#8b5cf6 60%,#a78bfa 100%)", borderRadius:"0 0 36px 36px", padding:"52px 22px 40px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
          <div>
            <div style={{ color:"rgba(255,255,255,0.7)", fontSize:13 }}>Welcome back 👋</div>
            <div style={{ color:"#fff", fontSize:22, fontWeight:800 }}>Aslam</div>
          </div>
          <button onClick={onRefresh} style={{ width:42,height:42,background:"rgba(255,255,255,0.15)",borderRadius:14,border:"none",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,cursor:"pointer" }}>🔄</button>
        </div>
        <div style={{ background:"rgba(255,255,255,0.12)", backdropFilter:"blur(10px)", borderRadius:22, padding:"20px 22px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
            <div style={{ color:"rgba(255,255,255,0.75)", fontSize:12 }}>Current Balance (This Year)</div>
            <SyncBadge status={isConfigured() ? syncStatus : "offline"} />
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div style={{ color:"#fff", fontSize:34, fontWeight:900, letterSpacing:"-1px" }}>{fmt(yearly)}</div>
            <button onClick={() => onNav("log")} style={{ width:46,height:46,background:"#fff",borderRadius:15,border:"none",fontSize:24,cursor:"pointer",color:"#6d28d9",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 20px rgba(0,0,0,0.15)" }}>+</button>
          </div>
        </div>
      </div>

      <div style={{ padding:"22px 18px 0" }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:22 }}>
          {[
            { label:"Today",      val:daily,   icon:"☀️", c:"#7c3aed", bg:"#f5f3ff", border:"#ddd6fe" },
            { label:"This Week",  val:weekly,  icon:"📅", c:"#0284c7", bg:"#f0f9ff", border:"#bae6fd" },
            { label:"This Month", val:monthly, icon:"🗓️", c:"#059669", bg:"#f0fdf4", border:"#bbf7d0" },
            { label:"This Year",  val:yearly,  icon:"📊", c:"#d97706", bg:"#fffbeb", border:"#fde68a" },
          ].map(({ label, val, icon, c, bg, border }) => (
            <div key={label} style={{ background:bg, borderRadius:20, padding:"16px", border:`1px solid ${border}` }}>
              <div style={{ width:38,height:38,background:"#fff",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,marginBottom:10,boxShadow:"0 2px 8px rgba(0,0,0,0.06)" }}>{icon}</div>
              <div style={{ fontSize:11, color:"#9ca3af", fontWeight:500, marginBottom:4 }}>{label}</div>
              <div style={{ fontSize:15, fontWeight:800, color:c }}>{fmt(val)}</div>
            </div>
          ))}
        </div>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div style={{ fontWeight:700, fontSize:16, color:"#1e1b4b" }}>Recent Shifts</div>
          <div onClick={() => onNav("history")} style={{ fontSize:13, color:"#7c3aed", cursor:"pointer", fontWeight:600 }}>See all</div>
        </div>

        {shifts.length === 0 ? (
          <div style={{ textAlign:"center", padding:"36px 20px", color:"#c4b5fd", fontSize:14 }}>
            <div style={{ fontSize:40, marginBottom:8 }}>🚕</div>
            No shifts yet — tap + to log one!
          </div>
        ) : shifts.slice(0, 5).map(s => (
          <div key={s.id} style={{ background:"#fff", borderRadius:18, padding:"14px 16px", marginBottom:10, display:"flex", justifyContent:"space-between", alignItems:"center", boxShadow:"0 2px 12px rgba(109,40,217,0.06)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:44,height:44,background:"linear-gradient(135deg,#ede9fe,#ddd6fe)",borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20 }}>🚕</div>
              <div>
                <div style={{ fontWeight:700, fontSize:14, color:"#1e1b4b" }}>Taxi Shift</div>
                <div style={{ fontSize:11, color:"#9ca3af", marginTop:2 }}>{s.date} · {s.time}</div>
              </div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontWeight:800, fontSize:15, color: netOf(s)>=0?"#059669":"#dc2626" }}>
                {netOf(s)>=0?"+":""}{fmt(netOf(s))}
              </div>
              <div style={{ fontSize:10, color:"#c4b5fd", marginTop:2 }}>net income</div>
            </div>
          </div>
        ))}

        {/* Setup banner if URL not configured */}
        {!isConfigured() && (
          <div style={{ background:"#fef9c3", border:"1px solid #fde68a", borderRadius:16, padding:"16px", marginTop:10 }}>
            <div style={{ fontWeight:700, fontSize:13, color:"#92400e", marginBottom:4 }}>📋 Google Sheets not connected</div>
            <div style={{ fontSize:12, color:"#b45309", lineHeight:1.5 }}>
              Paste your Apps Script URL into the <code style={{background:"#fde68a",borderRadius:4,padding:"1px 4px"}}>SHEET_URL</code> variable at the top of the React file to enable cloud sync.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── LOG ───────────────────────────────────────────────────────
function LogScreen({ fares, tips, expenses, setFares, setTips, setExpenses, onSave, saving, saved, onBack }) {
  const preview = (parseFloat(fares)||0) + (parseFloat(tips)||0) - (parseFloat(expenses)||0);
  return (
    <div style={{ padding:"0 18px 30px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, padding:"52px 0 20px" }}>
        <button onClick={onBack} style={{ width:42,height:42,background:"#fff",border:"none",borderRadius:14,fontSize:20,cursor:"pointer",boxShadow:"0 2px 10px rgba(0,0,0,0.08)",color:"#6d28d9" }}>‹</button>
        <div style={{ fontWeight:800, fontSize:20, color:"#1e1b4b" }}>Log Shift</div>
      </div>

      <div style={{ background:"linear-gradient(135deg,#6d28d9,#8b5cf6)", borderRadius:24, padding:"22px", marginBottom:22, color:"#fff" }}>
        <div style={{ fontSize:12, opacity:0.8 }}>{dayName()} · {dateStr()}</div>
        <div style={{ fontSize:34, fontWeight:900, letterSpacing:"-1px", marginTop:4 }}>{fmt(preview)}</div>
        <div style={{ fontSize:12, opacity:0.65, marginTop:2 }}>Net income preview</div>
      </div>

      {[
        { label:"Fares",    icon:"💵", val:fares,    set:setFares,    hint:"Total fares collected", c:"#7c3aed" },
        { label:"Tips",     icon:"💰", val:tips,     set:setTips,     hint:"Tips received",         c:"#059669" },
        { label:"Expenses", icon:"⛽", val:expenses, set:setExpenses, hint:"Fuel, tolls, etc.",     c:"#d97706" },
      ].map(({ label, icon, val, set, hint, c }) => (
        <div key={label} style={{ background:"#fff", borderRadius:20, padding:"18px", marginBottom:14, boxShadow:"0 2px 12px rgba(0,0,0,0.05)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
            <div style={{ width:36,height:36,background:"#f5f3ff",borderRadius:11,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17 }}>{icon}</div>
            <div>
              <div style={{ fontWeight:700, fontSize:14, color:"#1e1b4b" }}>{label}</div>
              <div style={{ fontSize:11, color:"#9ca3af" }}>{hint}</div>
            </div>
          </div>
          <input
            type="text"
            inputMode="decimal"
            pattern="[0-9]*\.?[0-9]*"
            placeholder="0.00"
            value={val}
            onChange={e => { if (/^[0-9]*\.?[0-9]*$/.test(e.target.value)) set(e.target.value); }}
            style={{ width:"100%", border:"none", borderBottom:`2px solid ${val?"#ede9fe":"#f3f4f6"}`, background:"transparent", fontSize:28, fontWeight:900, color:c, outline:"none", padding:"4px 0", boxSizing:"border-box" }}
          />
        </div>
      ))}

      <button onClick={onSave} disabled={saving}
        style={{ width:"100%", padding:"18px", borderRadius:20, border:"none", background: saved?"linear-gradient(135deg,#059669,#34d399)": saving?"#c4b5fd":"linear-gradient(135deg,#6d28d9,#8b5cf6)", color:"#fff", fontSize:15, fontWeight:800, cursor: saving?"not-allowed":"pointer", marginTop:4, boxShadow:"0 8px 28px rgba(109,40,217,0.3)", letterSpacing:"0.02em", transition:"background 0.3s" }}>
        {saved ? "✓  Shift Saved!" : saving ? "Saving…" : "Save Shift"}
      </button>
    </div>
  );
}

// ── ACTIVITY ──────────────────────────────────────────────────
function ActivityScreen({ shifts, daily, weekly, monthly, yearly, totalFares, totalTips, totalExpenses, onBack }) {
  const [tab, setTab] = useState("income");

  // Income donut: fares + tips
  const incomeDonutData = [
    { label:"Fares", value:totalFares, color:"#7c3aed" },
    { label:"Tips",  value:totalTips,  color:"#a78bfa" },
  ].filter(d => d.value > 0);
  const incomeTotal = totalFares + totalTips;

  // Expenses donut (single slice for now, extensible)
  const expDonutData = [
    { label:"Expenses", value:totalExpenses, color:"#f59e0b" },
  ].filter(d => d.value > 0);

  // Per-period helpers
  const sumFares   = (fn) => shifts.filter(s => fn(s.date)).reduce((a,s) => a+(Number(s.fares)||0), 0);
  const sumTips    = (fn) => shifts.filter(s => fn(s.date)).reduce((a,s) => a+(Number(s.tips)||0), 0);
  const sumExp     = (fn) => shifts.filter(s => fn(s.date)).reduce((a,s) => a+(Number(s.expenses)||0), 0);

  const periods = [
    { label:"Today",      icon:"☀️", fn: d => d === todayKey() },
    { label:"This Week",  icon:"📅", fn: d => d >= weekStartKey() },
    { label:"This Month", icon:"🗓️", fn: d => d.startsWith(monthKey()) },
    { label:"This Year",  icon:"📊", fn: d => d.startsWith(new Date().getFullYear().toString()) },
  ];

  const netAll = totalFares + totalTips - totalExpenses;

  const Pill = ({ id, label }) => (
    <button onClick={() => setTab(id)} style={{
      flex:1, padding:"10px 0", borderRadius:50, border:"none", cursor:"pointer",
      fontWeight:700, fontSize:13, letterSpacing:"0.02em",
      background: tab===id ? (id==="income" ? "linear-gradient(135deg,#6d28d9,#8b5cf6)" : "linear-gradient(135deg,#d97706,#fbbf24)") : "transparent",
      color: tab===id ? "#fff" : "#9ca3af",
      transition:"all 0.25s",
      boxShadow: tab===id ? "0 4px 14px rgba(109,40,217,0.25)" : "none",
    }}>{label}</button>
  );

  return (
    <div style={{ padding:"0 18px 20px" }}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"52px 0 16px" }}>
        <button onClick={onBack} style={{ width:42,height:42,background:"#fff",border:"none",borderRadius:14,fontSize:20,cursor:"pointer",boxShadow:"0 2px 10px rgba(0,0,0,0.08)",color:"#6d28d9" }}>‹</button>
        <div style={{ fontWeight:800, fontSize:18, color:"#1e1b4b" }}>Activity</div>
        <div style={{ width:42 }} />
      </div>

      {/* Pill tabs */}
      <div style={{ display:"flex", background:"#ede9fe", borderRadius:50, padding:4, marginBottom:20, gap:4 }}>
        <Pill id="income"   label="💰 Income" />
        <Pill id="expenses" label="⛽ Expenses" />
      </div>

      {/* ── INCOME TAB ── */}
      {tab === "income" && (
        <>
          {/* Summary card */}
          <div style={{ background:"linear-gradient(150deg,#ede9fe 0%,#ddd6fe 100%)", borderRadius:24, padding:"22px 20px 28px", marginBottom:18 }}>
            <div style={{ fontSize:12, color:"#7c3aed", fontWeight:600 }}>Total Income (All Time)</div>
            <div style={{ fontSize:28, fontWeight:900, color:"#4c1d95", marginBottom:4, letterSpacing:"-0.5px" }}>{fmt(incomeTotal)}</div>
            <div style={{ fontSize:11, color:"#7c3aed", marginBottom:20 }}>Net after expenses: <strong>{fmt(netAll)}</strong></div>
            <div style={{ display:"flex", justifyContent:"center", position:"relative" }}>
              <DonutChart data={incomeDonutData} total={incomeTotal} />
              <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", textAlign:"center", pointerEvents:"none" }}>
                <div style={{ fontSize:17, fontWeight:900, color:"#4c1d95" }}>{fmt(incomeTotal)}</div>
                <div style={{ fontSize:10, color:"#7c3aed", fontWeight:600 }}>Earned</div>
              </div>
            </div>
          </div>

          {/* Fares vs Tips breakdown */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20 }}>
            {[
              { l:"Total Fares", v:totalFares, c:"#7c3aed", bg:"#f5f3ff", pct: incomeTotal>0 ? Math.round(totalFares/incomeTotal*100) : 0 },
              { l:"Total Tips",  v:totalTips,  c:"#8b5cf6", bg:"#f5f3ff", pct: incomeTotal>0 ? Math.round(totalTips/incomeTotal*100)  : 0, plain:true },
            ].map(({ l, v, c, bg, pct, plain }) => (
              <div key={l} style={{ background:bg, borderRadius:18, padding:"16px 14px" }}>
                <div style={{ fontSize:10, color:"#9ca3af", marginBottom:6 }}>{l}</div>
                <div style={{ fontSize:18, fontWeight:900, color:c, marginBottom:6 }}>{plain ? fmtTips(v) : fmt(v)}</div>
                <div style={{ background:"#ddd6fe", borderRadius:10, height:6 }}>
                  <div style={{ width:`${pct}%`, background:c, borderRadius:10, height:6, transition:"width 0.5s" }} />
                </div>
                <div style={{ fontSize:10, color:c, marginTop:4, fontWeight:600 }}>{pct}% of income</div>
              </div>
            ))}
          </div>

          {/* Period breakdown */}
          <div style={{ fontWeight:700, fontSize:15, color:"#1e1b4b", marginBottom:12 }}>Period Breakdown</div>
          {periods.map(({ label, icon, fn }) => {
            const f = sumFares(fn), t = sumTips(fn), net = f + t;
            return (
              <div key={label} style={{ background:"#fff", borderRadius:16, padding:"14px 16px", marginBottom:10, boxShadow:"0 2px 10px rgba(0,0,0,0.04)" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:16 }}>{icon}</span>
                    <span style={{ fontWeight:700, color:"#1e1b4b", fontSize:14 }}>{label}</span>
                  </div>
                  <span style={{ fontWeight:900, color:"#6d28d9", fontSize:15 }}>{fmt(net)}</span>
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <div style={{ flex:1, background:"#f5f3ff", borderRadius:10, padding:"8px 10px" }}>
                    <div style={{ fontSize:9, color:"#9ca3af", marginBottom:2 }}>FARES</div>
                    <div style={{ fontSize:13, fontWeight:800, color:"#7c3aed" }}>{fmt(f)}</div>
                  </div>
                  <div style={{ flex:1, background:"#f0fdf4", borderRadius:10, padding:"8px 10px" }}>
                    <div style={{ fontSize:9, color:"#9ca3af", marginBottom:2 }}>TIPS</div>
                    <div style={{ fontSize:13, fontWeight:800, color:"#059669" }}>{fmtTips(t)}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* ── EXPENSES TAB ── */}
      {tab === "expenses" && (
        <>
          {/* Summary card */}
          <div style={{ background:"linear-gradient(150deg,#fef9c3 0%,#fde68a 100%)", borderRadius:24, padding:"22px 20px 28px", marginBottom:18 }}>
            <div style={{ fontSize:12, color:"#92400e", fontWeight:600 }}>Total Expenses (All Time)</div>
            <div style={{ fontSize:28, fontWeight:900, color:"#92400e", marginBottom:4, letterSpacing:"-0.5px" }}>{fmt(totalExpenses)}</div>
            <div style={{ fontSize:11, color:"#b45309", marginBottom:20 }}>
              {incomeTotal > 0 ? `${Math.round(totalExpenses/incomeTotal*100)}% of gross income` : "No income recorded"}
            </div>
            <div style={{ display:"flex", justifyContent:"center", position:"relative" }}>
              <DonutChart data={expDonutData} total={totalExpenses || 1} />
              <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", textAlign:"center", pointerEvents:"none" }}>
                <div style={{ fontSize:17, fontWeight:900, color:"#92400e" }}>{fmt(totalExpenses)}</div>
                <div style={{ fontSize:10, color:"#b45309", fontWeight:600 }}>Spent</div>
              </div>
            </div>
          </div>

          {/* Net impact card */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20 }}>
            <div style={{ background:"#fff7ed", borderRadius:18, padding:"16px 14px" }}>
              <div style={{ fontSize:10, color:"#9ca3af", marginBottom:6 }}>Gross Income</div>
              <div style={{ fontSize:16, fontWeight:900, color:"#059669" }}>{fmt(incomeTotal)}</div>
              <div style={{ fontSize:10, color:"#6b7280", marginTop:4 }}>Fares + Tips</div>
            </div>
            <div style={{ background:"#fff7ed", borderRadius:18, padding:"16px 14px" }}>
              <div style={{ fontSize:10, color:"#9ca3af", marginBottom:6 }}>Net Profit</div>
              <div style={{ fontSize:16, fontWeight:900, color: netAll>=0?"#059669":"#dc2626" }}>{fmt(netAll)}</div>
              <div style={{ fontSize:10, color:"#6b7280", marginTop:4 }}>After expenses</div>
            </div>
          </div>

          {/* Period breakdown */}
          <div style={{ fontWeight:700, fontSize:15, color:"#1e1b4b", marginBottom:12 }}>Period Breakdown</div>
          {periods.map(({ label, icon, fn }) => {
            const e = sumExp(fn), inc = sumFares(fn) + sumTips(fn);
            const pct = inc > 0 ? Math.round(e/inc*100) : 0;
            return (
              <div key={label} style={{ background:"#fff", borderRadius:16, padding:"14px 16px", marginBottom:10, boxShadow:"0 2px 10px rgba(0,0,0,0.04)" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:16 }}>{icon}</span>
                    <span style={{ fontWeight:700, color:"#1e1b4b", fontSize:14 }}>{label}</span>
                  </div>
                  <span style={{ fontWeight:900, color:"#d97706", fontSize:15 }}>{fmt(e)}</span>
                </div>
                {/* Expense vs income bar */}
                <div style={{ background:"#f3f4f6", borderRadius:10, height:8, marginBottom:6, overflow:"hidden" }}>
                  <div style={{ width:`${Math.min(pct,100)}%`, background:"linear-gradient(90deg,#f59e0b,#fbbf24)", borderRadius:10, height:8, transition:"width 0.5s" }} />
                </div>
                <div style={{ fontSize:11, color:"#9ca3af" }}>
                  <span style={{ color:"#d97706", fontWeight:700 }}>{pct}%</span> of income · Income: {fmt(inc)}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

// ── HISTORY ───────────────────────────────────────────────────
function HistoryScreen({ shifts, onDelete, onBack }) {
  return (
    <div style={{ padding:"0 18px 20px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, padding:"52px 0 20px" }}>
        <button onClick={onBack} style={{ width:42,height:42,background:"#fff",border:"none",borderRadius:14,fontSize:20,cursor:"pointer",boxShadow:"0 2px 10px rgba(0,0,0,0.08)",color:"#6d28d9" }}>‹</button>
        <div style={{ fontWeight:800, fontSize:20, color:"#1e1b4b" }}>All Shifts</div>
      </div>
      {shifts.length === 0 ? (
        <div style={{ textAlign:"center", padding:"40px", color:"#c4b5fd", fontSize:14 }}>
          <div style={{ fontSize:40, marginBottom:8 }}>🚕</div>No shifts logged yet.
        </div>
      ) : shifts.map(s => (
        <div key={s.id} style={{ background:"#fff", borderRadius:20, padding:"16px", marginBottom:12, boxShadow:"0 2px 12px rgba(0,0,0,0.05)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <div>
              <div style={{ fontWeight:700, fontSize:14, color:"#1e1b4b" }}>{s.date}</div>
              <div style={{ fontSize:11, color:"#9ca3af", marginTop:2 }}>{s.time}</div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ fontWeight:900, fontSize:16, color: netOf(s)>=0?"#059669":"#dc2626" }}>{fmt(netOf(s))}</div>
              <button onClick={() => onDelete(s.id)} style={{ background:"#fee2e2",border:"none",borderRadius:10,width:30,height:30,cursor:"pointer",fontSize:12,color:"#dc2626",display:"flex",alignItems:"center",justifyContent:"center" }}>✕</button>
            </div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            {[["Fares",s.fares,"#f5f3ff","#7c3aed",fmt],["Tips",s.tips,"#f0fdf4","#059669",fmtTips],["Exp.",s.expenses,"#fffbeb","#d97706",fmt]].map(([l,v,bg,col,f])=>(
              <div key={l} style={{ flex:1,background:bg,borderRadius:12,padding:"10px 12px" }}>
                <div style={{ fontSize:10,color:col,fontWeight:600,marginBottom:2 }}>{l}</div>
                <div style={{ fontSize:13,fontWeight:800,color:col }}>{f(Number(v))}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── APP ───────────────────────────────────────────────────────
export default function App() {
  const [shifts, setShifts]   = useState([]);
  const [screen, setScreen]   = useState("home");
  const [fares, setFares]     = useState("");
  const [tips, setTips]       = useState("");
  const [expenses, setExpenses] = useState("");
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [syncStatus, setSyncStatus] = useState("synced");

  // Load: try Sheets first, fall back to localStorage
  const loadShifts = async () => {
    if (isConfigured()) {
      try {
        setSyncStatus("syncing");
        const remote = await sheetFetch();
        setShifts(remote);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(remote));
        setSyncStatus("synced");
      } catch {
        setSyncStatus("error");
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) setShifts(JSON.parse(raw));
      }
    } else {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setShifts(JSON.parse(raw));
    }
  };

  useEffect(() => { loadShifts(); }, []);

  const sumBy = (fn) => shifts.filter(s => fn(s.date)).reduce((a, s) => a + netOf(s), 0);
  const daily   = sumBy(d => d === todayKey());
  const weekly  = sumBy(d => d >= weekStartKey());
  const monthly = sumBy(d => d.startsWith(monthKey()));
  const yearly  = sumBy(d => d.startsWith(new Date().getFullYear().toString()));
  const totalFares    = shifts.reduce((a,s)=>a+(Number(s.fares)||0),0);
  const totalTips     = shifts.reduce((a,s)=>a+(Number(s.tips)||0),0);
  const totalExpenses = shifts.reduce((a,s)=>a+(Number(s.expenses)||0),0);

  const handleSave = async () => {
    if (!fares && !tips && !expenses) return;
    const entry = {
      id: String(Date.now()), date: todayKey(),
      time: new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }),
      fares: parseFloat(fares)||0, tips: parseFloat(tips)||0, expenses: parseFloat(expenses)||0,
    };
    // Optimistic update
    const updated = [entry, ...shifts];
    setShifts(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setFares(""); setTips(""); setExpenses("");
    setSaving(true);
    if (isConfigured()) {
      try {
        setSyncStatus("syncing");
        await sheetSave(entry);
        setSyncStatus("synced");
      } catch {
        setSyncStatus("error");
      }
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDelete = async (id) => {
    const updated = shifts.filter(s => s.id !== id);
    setShifts(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    if (isConfigured()) {
      try {
        setSyncStatus("syncing");
        await sheetDelete(id);
        setSyncStatus("synced");
      } catch {
        setSyncStatus("error");
      }
    }
  };

  const navItems = [
    { icon:"🏠", label:"Home",     sc:"home" },
    { icon:"📊", label:"Activity", sc:"activity" },
    { icon:"➕", label:"Log",      sc:"log", main:true },
    { icon:"📋", label:"History",  sc:"history" },
  ];

  return (
    <div style={{ minHeight:"100vh", background:"#f5f3ff", fontFamily:"'DM Sans','Segoe UI',sans-serif", maxWidth:430, margin:"0 auto", position:"relative", paddingBottom:90 }}>

      {screen === "home" && (
        <HomeScreen shifts={shifts} daily={daily} weekly={weekly} monthly={monthly} yearly={yearly}
          syncStatus={syncStatus} onRefresh={loadShifts} onNav={setScreen} />
      )}
      {screen === "log" && (
        <LogScreen fares={fares} tips={tips} expenses={expenses}
          setFares={setFares} setTips={setTips} setExpenses={setExpenses}
          onSave={handleSave} saving={saving} saved={saved}
          onBack={() => setScreen("home")} />
      )}
      {screen === "activity" && (
        <ActivityScreen shifts={shifts} daily={daily} weekly={weekly} monthly={monthly} yearly={yearly}
          totalFares={totalFares} totalTips={totalTips} totalExpenses={totalExpenses}
          onBack={() => setScreen("home")} />
      )}
      {screen === "history" && (
        <HistoryScreen shifts={shifts} onDelete={handleDelete} onBack={() => setScreen("home")} />
      )}

      <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:430, background:"rgba(255,255,255,0.95)", backdropFilter:"blur(12px)", borderTop:"1px solid #ede9fe", padding:"10px 24px 22px", display:"flex", justifyContent:"space-around", alignItems:"center", zIndex:100 }}>
        {navItems.map(({ icon, label, sc, main }) => (
          <button key={sc} onClick={() => setScreen(sc)}
            style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3, background: main?"linear-gradient(135deg,#6d28d9,#8b5cf6)":"none", border:"none", borderRadius: main?"50%":"none", width: main?58:"auto", height: main?58:"auto", cursor:"pointer", padding: main?0:"4px 8px", boxShadow: main?"0 6px 24px rgba(109,40,217,0.4)":"none", marginTop: main?-26:0, justifyContent:"center" }}>
            <span style={{ fontSize: main?24:20 }}>{icon}</span>
            {!main && <span style={{ fontSize:10, color: screen===sc?"#6d28d9":"#9ca3af", fontWeight: screen===sc?700:400 }}>{label}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
