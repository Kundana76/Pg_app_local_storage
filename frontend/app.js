// ============================================================
// PG Manager — Frontend App (vanilla JS, no build step, offline)
// ============================================================

const API = "/api";
let STATE = {
  floors: [],
  rooms: [],
  tenants: [],
  currentRoute: "dashboard",
  settings: {},
};

// ---------------- fetch helper ----------------
async function api(path, options = {}) {
  const opts = { headers: {}, ...options };
  if (opts.body && !(opts.body instanceof FormData)) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(opts.body);
  }
  const res = await fetch(API + path, opts);
  if (!res.ok) {
    let msg = "Something went wrong";
    try { msg = (await res.json()).detail || msg; } catch (e) {}
    toast(msg, "error");
    throw new Error(msg);
  }
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res;
}

// ---------------- toast ----------------
function toast(msg, type = "success") {
  const wrap = document.getElementById("toastWrap");
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

// ---------------- modal ----------------
function openModal({ title, bodyHtml, onRender, footer }) {
  const root = document.getElementById("modalRoot");
  root.innerHTML = `
    <div class="modal-backdrop" id="modalBackdrop">
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">${title}</div>
          <button class="modal-close" id="modalCloseBtn">✕</button>
        </div>
        <div class="modal-body">${bodyHtml}</div>
        <div class="modal-footer" id="modalFooter"></div>
      </div>
    </div>`;
  document.getElementById("modalCloseBtn").onclick = closeModal;
  document.getElementById("modalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "modalBackdrop") closeModal();
  });
  if (footer) document.getElementById("modalFooter").innerHTML = footer;
  if (onRender) onRender();
}
function closeModal() {
  document.getElementById("modalRoot").innerHTML = "";
}

// ---------------- small helpers ----------------
function fmtMoney(n) {
  const cur = STATE.settings.currency || "₹";
  n = Number(n || 0);
  return cur + n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
function esc(s) {
  return (s ?? "").toString().replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
function badge(status) {
  const map = {
    Vacant: "muted", Occupied: "success", Reserved: "warning", Maintenance: "danger",
    Active: "success", "Notice Given": "warning", Vacated: "muted",
    Paid: "success", "Partially Paid": "warning", Pending: "danger",
  };
  const cls = map[status] || "muted";
  return `<span class="badge badge-${cls}">${esc(status)}</span>`;
}
function todayISO() { return new Date().toISOString().slice(0, 10); }
function thisMonth() { return new Date().toISOString().slice(0, 7); }
function monthLabel(m) {
  const [y, mo] = m.split("-");
  return new Date(y, mo - 1).toLocaleString(undefined, { month: "short", year: "numeric" });
}

// ---------------- routing ----------------
const ROUTES = {
  dashboard: { title: "Dashboard", sub: "Overview of your property", render: renderDashboard },
  floors: { title: "Floors", sub: "Manage building floors", render: renderFloors },
  rooms: { title: "Rooms & Beds", sub: "Manage rooms, occupancy and bed allocation", render: renderRooms },
  tenants: { title: "Tenants", sub: "Manage tenant records and allocations", render: renderTenants },
  staff: { title: "Staff", sub: "Manage staff, salary and attendance", render: renderStaff },
  rent: { title: "Rent Collection", sub: "Generate and track monthly rent", render: renderRent },
  income: { title: "Income", sub: "Track deposits, penalties and other income", render: renderIncome },
  expenses: { title: "Expenses", sub: "Track day to day operating expenses", render: renderExpenses },
  ledger: { title: "Ledger", sub: "Credit / debit overview — monthly, yearly, custom range or all time", render: renderLedger },
  backup: { title: "Backup & Restore", sub: "Keep your data safe", render: renderBackup },
  settings: { title: "Settings", sub: "Configure your PG profile", render: renderSettings },
};

function navigate(route) {
  STATE.currentRoute = route;
  document.querySelectorAll(".nav-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.route === route);
  });
  const r = ROUTES[route];
  document.getElementById("pageTitle").textContent = r.title;
  document.getElementById("pageSub").textContent = r.sub;
  document.getElementById("topbarActions").innerHTML = "";
  document.getElementById("content").innerHTML = `<div class="empty-state">Loading…</div>`;
  r.render();
}

document.querySelectorAll(".nav-item").forEach((el) => {
  el.addEventListener("click", () => {
    navigate(el.dataset.route);
    document.getElementById("app").classList.remove("sidebar-open");
  });
});

// ---------------- mobile sidebar toggle ----------------
document.getElementById("menuToggle").addEventListener("click", () => {
  document.getElementById("app").classList.toggle("sidebar-open");
});
document.getElementById("sidebarBackdrop").addEventListener("click", () => {
  document.getElementById("app").classList.remove("sidebar-open");
});

// ---------------- theme ----------------
const themeSwitch = document.getElementById("themeSwitch");
themeSwitch.addEventListener("change", () => {
  const theme = themeSwitch.checked ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("pg_theme", theme);
  api("/settings", { method: "PUT", body: { theme } }).catch(() => {});
});

// ============================================================
// DASHBOARD
// ============================================================
async function renderDashboard() {
  const content = document.getElementById("content");
  const [summary, charts] = await Promise.all([
    api("/dashboard/summary"),
    api("/dashboard/charts"),
  ]);

  const kpis = [
    ["Total Floors", summary.total_floors, "🏢", "primary", "floors"],
    ["Total Rooms", summary.total_rooms, "🚪", "primary", "rooms"],
    ["Vacant Rooms", summary.vacant_rooms, "🟢", "success", "rooms", "Vacant"],
    ["Occupied Rooms", summary.occupied_rooms, "🔵", "primary", "rooms", "Occupied"],
    ["Total Tenants", summary.total_tenants, "🧑‍🤝‍🧑", "primary", "tenants"],
    ["Beds Available", summary.beds_available, "🛏️", "success", "rooms", "Vacant"],
    ["Today's Collection", fmtMoney(summary.todays_collection), "💵", "success", "rent"],
    ["Monthly Income", fmtMoney(summary.monthly_income), "📈", "success", "ledger"],
    ["Monthly Expense", fmtMoney(summary.monthly_expense), "📉", "danger", "expenses"],
    ["Profit", fmtMoney(summary.profit), "🏆", summary.profit >= 0 ? "success" : "danger", "ledger"],
    ["Pending Rent", fmtMoney(summary.pending_rent), "⏳", "warning", "rent"],
    ["Due Amount", fmtMoney(summary.due_amount), "❗", "warning", "tenants"],
    ["Advance Amount", fmtMoney(summary.advance_amount), "🧾", "primary", "tenants"],
    ["Security Deposits", fmtMoney(summary.security_deposits), "🔒", "primary", "tenants"],
    ["Utility Expenses", fmtMoney(summary.utility_expenses), "🔌", "warning", "expenses"],
  ];

  content.innerHTML = `
    <div class="kpi-grid">
      ${kpis.map(([label, value, icon, tone, route, statusFilter], i) => `
        <div class="kpi-card kpi-clickable" data-kpi="${i}">
          <div class="kpi-icon" style="background:var(--${tone}-soft, var(--primary-soft));color:var(--${tone});">${icon}</div>
          <div class="kpi-label">${label}</div>
          <div class="kpi-value">${value}</div>
        </div>`).join("")}
    </div>

    <div class="chart-grid">
      <div class="card">
        <div class="card-header"><div class="card-title">Income vs Expense (last 6 months)</div></div>
        <canvas id="chartIncomeExpense" height="110"></canvas>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Occupancy Rate</div></div>
        <canvas id="chartOccupancy" height="110"></canvas>
      </div>
    </div>
    <div class="chart-grid-3">
      <div class="card">
        <div class="card-header"><div class="card-title">Rent Collection Trend</div></div>
        <canvas id="chartRentTrend" height="120"></canvas>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Expense by Category</div></div>
        <canvas id="chartExpenseCat" height="120"></canvas>
      </div>
    </div>
  `;

  content.querySelectorAll("[data-kpi]").forEach((el) => {
    const [, , , , route, statusFilter] = kpis[Number(el.dataset.kpi)];
    if (!route) return;
    el.onclick = () => {
      if (route === "rooms" && statusFilter) roomFilterStatus = statusFilter;
      navigate(route);
    };
  });

  const monthLabels = charts.months.map(monthLabel);

  new Chart(document.getElementById("chartIncomeExpense"), {
    type: "bar",
    data: {
      labels: monthLabels,
      datasets: [
        { label: "Income", data: charts.monthly_income, backgroundColor: "#4f6df5", borderRadius: 6 },
        { label: "Expense", data: charts.monthly_expense, backgroundColor: "#f04438", borderRadius: 6 },
      ],
    },
    options: { responsive: true, plugins: { legend: { position: "bottom" } } },
  });

  new Chart(document.getElementById("chartOccupancy"), {
    type: "doughnut",
    data: {
      labels: ["Occupied", "Vacant"],
      datasets: [{
        data: [charts.occupancy_rate, Math.max(0, 100 - charts.occupancy_rate)],
        backgroundColor: ["#4f6df5", "#e6e9f2"],
      }],
    },
    options: { plugins: { legend: { position: "bottom" } }, cutout: "70%" },
  });

  new Chart(document.getElementById("chartRentTrend"), {
    type: "line",
    data: {
      labels: monthLabels,
      datasets: [{ label: "Rent Collected", data: charts.monthly_income, borderColor: "#17b26a",
        backgroundColor: "rgba(23,177,106,.15)", fill: true, tension: 0.35 }],
    },
    options: { plugins: { legend: { display: false } } },
  });

  const catData = charts.expense_by_category;
  new Chart(document.getElementById("chartExpenseCat"), {
    type: "pie",
    data: {
      labels: catData.map((c) => c.category),
      datasets: [{ data: catData.map((c) => c.amount),
        backgroundColor: ["#4f6df5","#f79009","#17b26a","#f04438","#8f6dff","#06aed4","#f2a8b3","#9ca3af"] }],
    },
    options: { plugins: { legend: { position: "bottom" } } },
  });
}

// ============================================================
// FLOORS
// ============================================================
async function renderFloors() {
  const content = document.getElementById("content");
  document.getElementById("topbarActions").innerHTML = `
    <button class="btn" id="btnBulkFloor">＋ Bulk Create</button>
    <button class="btn btn-primary" id="btnAddFloor">＋ Add Floor</button>
  `;
  document.getElementById("btnAddFloor").onclick = openAddFloorModal;
  document.getElementById("btnBulkFloor").onclick = openBulkFloorModal;

  const floors = await api("/floors");
  STATE.floors = floors;
  const rooms = await api("/rooms");

  content.innerHTML = `
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Floor</th><th>Total Rooms</th><th>Occupied</th><th>Vacant</th><th></th></tr></thead>
          <tbody>
            ${floors.length ? floors.map((f) => {
              const fr = rooms.filter((r) => r.floor_id === f.id);
              const occ = fr.filter((r) => r.status === "Occupied").length;
              return `<tr>
                <td><strong>${esc(f.name)}</strong></td>
                <td>${fr.length}</td>
                <td>${occ}</td>
                <td>${fr.length - occ}</td>
                <td style="text-align:right"><button class="btn btn-sm btn-danger" data-del-floor="${f.id}">Delete</button></td>
              </tr>`;
            }).join("") : `<tr><td colspan="5"><div class="empty-state">No floors yet. Add your first floor to get started.</div></td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
  content.querySelectorAll("[data-del-floor]").forEach((btn) => {
    btn.onclick = async () => {
      if (!confirm("Delete this floor? All its rooms and beds will also be removed.")) return;
      await api(`/floors/${btn.dataset.delFloor}`, { method: "DELETE" });
      toast("Floor deleted");
      renderFloors();
    };
  });
}

function openAddFloorModal() {
  openModal({
    title: "Add Floor",
    bodyHtml: `<div class="field"><label>Floor Name</label><input id="floorName" placeholder="e.g. Ground Floor" /></div>`,
    footer: `<button class="btn" id="cancelBtn">Cancel</button><button class="btn btn-primary" id="saveBtn">Save</button>`,
    onRender() {
      document.getElementById("cancelBtn").onclick = closeModal;
      document.getElementById("saveBtn").onclick = async () => {
        const name = document.getElementById("floorName").value.trim();
        if (!name) return toast("Please enter a floor name", "error");
        await api("/floors", { method: "POST", body: { name } });
        toast("Floor added");
        closeModal();
        renderFloors();
      };
    },
  });
}

function openBulkFloorModal() {
  openModal({
    title: "Bulk Create Floors",
    bodyHtml: `
      <div class="form-grid">
        <div class="field field-check field-span-2">
          <input type="checkbox" id="bulkGround" checked /> <label style="margin:0">Include Ground Floor</label>
        </div>
        <div class="field"><label>Number of upper floors</label><input type="number" id="bulkCount" value="5" min="0" /></div>
        <div class="field"><label>Start numbering at</label><input type="number" id="bulkStart" value="1" min="1" /></div>
      </div>
      <p class="text-muted mt-8" style="font-size:12.5px">This will create "Ground Floor" (optional) plus "First Floor", "Second Floor" … up to the count you specify.</p>
    `,
    footer: `<button class="btn" id="cancelBtn">Cancel</button><button class="btn btn-primary" id="saveBtn">Create Floors</button>`,
    onRender() {
      document.getElementById("cancelBtn").onclick = closeModal;
      document.getElementById("saveBtn").onclick = async () => {
        const payload = {
          include_ground: document.getElementById("bulkGround").checked,
          count: Number(document.getElementById("bulkCount").value || 0),
          start_at: Number(document.getElementById("bulkStart").value || 1),
        };
        const created = await api("/floors/bulk", { method: "POST", body: payload });
        toast(`${created.length} floor(s) created`);
        closeModal();
        renderFloors();
      };
    },
  });
}

// ============================================================
// ROOMS & BEDS
// ============================================================
let roomFilterFloor = "";
let roomFilterStatus = "";

async function renderRooms() {
  const content = document.getElementById("content");
  document.getElementById("topbarActions").innerHTML = `
    <button class="btn" id="btnBulkRoom">＋ Bulk Create</button>
    <button class="btn btn-primary" id="btnAddRoom">＋ Add Room</button>
  `;
  const floors = await api("/floors");
  STATE.floors = floors;
  if (!floors.length) {
    content.innerHTML = `<div class="card"><div class="empty-state">Create a floor first before adding rooms.</div></div>`;
    document.getElementById("btnAddRoom").onclick = () => toast("Please add a floor first", "error");
    document.getElementById("btnBulkRoom").onclick = () => toast("Please add a floor first", "error");
    return;
  }
  document.getElementById("btnAddRoom").onclick = () => openRoomModal();
  document.getElementById("btnBulkRoom").onclick = () => openBulkRoomModal();

  const [rooms, beds] = await Promise.all([api("/rooms"), api("/rooms/beds/all")]);
  STATE.rooms = rooms;

  const bedsAvailable = (roomIds) => beds.filter((b) => roomIds.has(b.room_id) && b.status === "Vacant").length;
  const bedsTotal = (roomIds) => beds.filter((b) => roomIds.has(b.room_id)).length;

  content.innerHTML = `
    <div class="pill-row" id="floorPills"></div>
    <div class="pill-row" id="statusPills">
      ${["", "Vacant", "Occupied", "Reserved", "Maintenance"].map((s) =>
        `<div class="pill ${roomFilterStatus === s ? "active" : ""}" data-status="${s}">${s || "All statuses"}</div>`).join("")}
    </div>
    <div id="floorSections"></div>
  `;

  const pillsEl = document.getElementById("floorPills");
  pillsEl.innerHTML = [{ id: "", name: "All Floors" }, ...floors].map((f) => {
    const label = f.id === "" ? f.name : `${esc(f.name)} · ${bedsAvailable(new Set(rooms.filter((r) => r.floor_id === f.id).map((r) => r.id)))} free`;
    return `<div class="pill ${roomFilterFloor === String(f.id) ? "active" : ""}" data-floor="${f.id}">${label}</div>`;
  }).join("");
  pillsEl.querySelectorAll("[data-floor]").forEach((p) => p.onclick = () => { roomFilterFloor = p.dataset.floor; renderRooms(); });
  document.getElementById("statusPills").querySelectorAll("[data-status]").forEach((p) => p.onclick = () => { roomFilterStatus = p.dataset.status; renderRooms(); });

  let filtered = rooms;
  if (roomFilterFloor) filtered = filtered.filter((r) => String(r.floor_id) === roomFilterFloor);
  if (roomFilterStatus) filtered = filtered.filter((r) => r.status === roomFilterStatus);

  const sectionsEl = document.getElementById("floorSections");
  const visibleFloors = roomFilterFloor ? floors.filter((f) => String(f.id) === roomFilterFloor) : floors;

  if (!filtered.length) {
    sectionsEl.innerHTML = `<div class="card"><div class="empty-state">No rooms match this filter.</div></div>`;
  } else {
    sectionsEl.innerHTML = visibleFloors.map((f) => {
      const floorRooms = filtered.filter((r) => r.floor_id === f.id);
      if (!floorRooms.length) return "";
      const floorRoomIds = new Set(rooms.filter((r) => r.floor_id === f.id).map((r) => r.id));
      const free = bedsAvailable(floorRoomIds);
      const total = bedsTotal(floorRoomIds);
      return `
        <div class="card">
          <div class="card-header">
            <div class="card-title">${esc(f.name)}</div>
            <span class="badge ${free > 0 ? "badge-success" : "badge-muted"}">${free} / ${total} beds available</span>
          </div>
          <div class="room-grid">
            ${floorRooms.map((r) => `
              <div class="room-tile" data-room="${r.id}">
                <div class="rt-number">${esc(r.number)}</div>
                <div class="rt-meta">${r.bed_count} bed(s) · ${fmtMoney(r.monthly_rent)}/mo</div>
                <div style="margin-top:8px">${badge(r.status)}</div>
              </div>`).join("")}
          </div>
        </div>`;
    }).join("");
    sectionsEl.querySelectorAll("[data-room]").forEach((tile) => {
      tile.onclick = () => openRoomModal(filtered.find((r) => r.id == tile.dataset.room));
    });
  }
}

function openRoomModal(room) {
  const floors = STATE.floors;
  openModal({
    title: room ? `Room ${room.number}` : "Add Room",
    bodyHtml: `
      <div class="form-grid">
        <div class="field"><label>Room Number</label><input id="rNumber" value="${room ? esc(room.number) : ""}" /></div>
        <div class="field"><label>Floor</label>
          <select id="rFloor">${floors.map((f) => `<option value="${f.id}" ${room && room.floor_id === f.id ? "selected" : ""}>${esc(f.name)}</option>`).join("")}</select>
        </div>
        <div class="field"><label>Number of Beds</label><input type="number" id="rBeds" min="1" value="${room ? room.bed_count : 1}" /></div>
        <div class="field"><label>Monthly Rent</label><input type="number" id="rRent" value="${room ? room.monthly_rent : ""}" /></div>
        <div class="field"><label>Deposit Amount</label><input type="number" id="rDeposit" value="${room ? room.deposit_amount : ""}" /></div>
        <div class="field"><label>Status</label>
          <select id="rStatus">${["Vacant","Occupied","Reserved","Maintenance"].map((s) => `<option ${room && room.status === s ? "selected" : ""}>${s}</option>`).join("")}</select>
        </div>
        <div class="field field-check"><input type="checkbox" id="rBathroom" ${room && room.attached_bathroom ? "checked" : ""} /><label style="margin:0">Attached Bathroom</label></div>
        <div class="field field-check"><input type="checkbox" id="rAC" ${room && room.ac ? "checked" : ""} /><label style="margin:0">AC</label></div>
        <div class="field field-check"><input type="checkbox" id="rBalcony" ${room && room.balcony ? "checked" : ""} /><label style="margin:0">Balcony</label></div>
      </div>
    `,
    footer: `
      ${room ? `<button class="btn btn-danger" id="deleteBtn" style="margin-right:auto">Delete Room</button>` : ""}
      <button class="btn" id="cancelBtn">Cancel</button>
      <button class="btn btn-primary" id="saveBtn">${room ? "Save Changes" : "Create Room"}</button>
    `,
    onRender() {
      document.getElementById("cancelBtn").onclick = closeModal;
      if (room) document.getElementById("deleteBtn").onclick = async () => {
        if (!confirm("Delete this room?")) return;
        await api(`/rooms/${room.id}`, { method: "DELETE" });
        toast("Room deleted"); closeModal(); renderRooms();
      };
      document.getElementById("saveBtn").onclick = async () => {
        const payload = {
          number: document.getElementById("rNumber").value.trim(),
          floor_id: Number(document.getElementById("rFloor").value),
          bed_count: Number(document.getElementById("rBeds").value || 1),
          monthly_rent: Number(document.getElementById("rRent").value || 0),
          deposit_amount: Number(document.getElementById("rDeposit").value || 0),
          status: document.getElementById("rStatus").value,
          attached_bathroom: document.getElementById("rBathroom").checked,
          ac: document.getElementById("rAC").checked,
          balcony: document.getElementById("rBalcony").checked,
        };
        if (!payload.number) return toast("Please enter a room number", "error");
        if (room) await api(`/rooms/${room.id}`, { method: "PUT", body: payload });
        else await api("/rooms", { method: "POST", body: payload });
        toast(room ? "Room updated" : "Room created");
        closeModal(); renderRooms();
      };
    },
  });
}

function openBulkRoomModal() {
  const floors = STATE.floors;
  openModal({
    title: "Bulk Create Rooms",
    bodyHtml: `
      <div class="form-grid">
        <div class="field field-span-2"><label>Floor</label>
          <select id="bFloor">${floors.map((f) => `<option value="${f.id}">${esc(f.name)}</option>`).join("")}</select>
        </div>
        <div class="field"><label>Start Room No.</label><input type="number" id="bStart" value="101" /></div>
        <div class="field"><label>End Room No.</label><input type="number" id="bEnd" value="120" /></div>
        <div class="field"><label>Beds per Room</label><input type="number" id="bBeds" value="1" min="1" /></div>
        <div class="field"><label>Monthly Rent (each)</label><input type="number" id="bRent" value="0" /></div>
        <div class="field"><label>Deposit (each)</label><input type="number" id="bDeposit" value="0" /></div>
      </div>
      <p class="text-muted mt-8" style="font-size:12.5px">Example: Start 101, End 120 creates rooms 101–120 automatically.</p>
    `,
    footer: `<button class="btn" id="cancelBtn">Cancel</button><button class="btn btn-primary" id="saveBtn">Create Rooms</button>`,
    onRender() {
      document.getElementById("cancelBtn").onclick = closeModal;
      document.getElementById("saveBtn").onclick = async () => {
        const payload = {
          floor_id: Number(document.getElementById("bFloor").value),
          start: Number(document.getElementById("bStart").value),
          end: Number(document.getElementById("bEnd").value),
          bed_count: Number(document.getElementById("bBeds").value || 1),
          monthly_rent: Number(document.getElementById("bRent").value || 0),
          deposit_amount: Number(document.getElementById("bDeposit").value || 0),
        };
        const created = await api("/rooms/bulk", { method: "POST", body: payload });
        toast(`${created.length} room(s) created`);
        closeModal(); renderRooms();
      };
    },
  });
}

// ============================================================
// TENANTS
// ============================================================
let tenantFilterStatus = "";
let tenantSearch = "";

async function renderTenants() {
  const content = document.getElementById("content");
  document.getElementById("topbarActions").innerHTML = `
    <div class="search-box"><span>🔎</span><input id="tenantSearchInput" placeholder="Search name / phone / room" value="${esc(tenantSearch)}" /></div>
    <button class="btn btn-primary" id="btnAddTenant">＋ Add Tenant</button>
  `;
  document.getElementById("btnAddTenant").onclick = () => openTenantModal();
  document.getElementById("tenantSearchInput").oninput = (e) => { tenantSearch = e.target.value; renderTenantTable(); };

  const [tenants, rooms, floors] = await Promise.all([api("/tenants"), api("/rooms"), api("/floors")]);
  STATE.tenants = tenants; STATE.rooms = rooms; STATE.floors = floors;

  content.innerHTML = `
    <div class="pill-row">
      ${["", "Active", "Notice Given", "Vacated"].map((s) =>
        `<div class="pill ${tenantFilterStatus === s ? "active" : ""}" data-status="${s}">${s || "All"}</div>`).join("")}
    </div>
    <div class="card"><div class="table-wrap" id="tenantTableWrap"></div></div>
  `;
  content.querySelectorAll("[data-status]").forEach((p) => p.onclick = () => { tenantFilterStatus = p.dataset.status; renderTenants(); });
  renderTenantTable();
}

function roomLabel(roomId) {
  const room = STATE.rooms.find((r) => r.id === roomId);
  if (!room) return "—";
  const floor = STATE.floors.find((f) => f.id === room.floor_id);
  return `${room.number}${floor ? " · " + floor.name : ""}`;
}

function renderTenantTable() {
  const wrap = document.getElementById("tenantTableWrap");
  let list = STATE.tenants;
  if (tenantFilterStatus) list = list.filter((t) => t.status === tenantFilterStatus);
  if (tenantSearch) {
    const q = tenantSearch.toLowerCase();
    list = list.filter((t) => [t.full_name, t.phone, roomLabel(t.room_id)].join(" ").toLowerCase().includes(q));
  }
  wrap.innerHTML = `
    <table>
      <thead><tr><th>Name</th><th>Phone</th><th>Room / Bed</th><th>Rent</th><th>Due</th><th>Status</th><th></th></tr></thead>
      <tbody>
        ${list.length ? list.map((t) => `
          <tr>
            <td><strong>${esc(t.full_name)}</strong></td>
            <td>${esc(t.phone || "—")}</td>
            <td>${roomLabel(t.room_id)}</td>
            <td>${fmtMoney(t.rent_amount)}</td>
            <td>${t.due_amount ? `<span style="color:var(--danger)">${fmtMoney(t.due_amount)}</span>` : "—"}</td>
            <td>${badge(t.status)}</td>
            <td style="text-align:right;white-space:nowrap">
              <button class="btn btn-sm" data-edit-tenant="${t.id}">Edit</button>
              ${t.status === "Active" ? `<button class="btn btn-sm btn-danger" data-checkout="${t.id}">Checkout</button>` : ""}
            </td>
          </tr>`).join("") : `<tr><td colspan="7"><div class="empty-state">No tenants found.</div></td></tr>`}
      </tbody>
    </table>`;
  wrap.querySelectorAll("[data-edit-tenant]").forEach((btn) => btn.onclick = () => openTenantModal(STATE.tenants.find((t) => t.id == btn.dataset.editTenant)));
  wrap.querySelectorAll("[data-checkout]").forEach((btn) => btn.onclick = async () => {
    if (!confirm("Check out this tenant? Their bed will be freed.")) return;
    await api(`/tenants/${btn.dataset.checkout}/checkout`, { method: "POST" });
    toast("Tenant checked out"); renderTenants();
  });
}

async function openTenantModal(tenant) {
  const rooms = STATE.rooms;
  const roomOptions = rooms.map((r) => `<option value="${r.id}" ${tenant && tenant.room_id === r.id ? "selected" : ""}>${esc(roomLabel(r.id))}</option>`).join("");
  let beds = [];
  if (tenant && tenant.room_id) beds = await api(`/rooms/${tenant.room_id}/beds`);

  openModal({
    title: tenant ? "Edit Tenant" : "Add Tenant",
    bodyHtml: `
      <div class="tabs">
        <div class="tab active" data-tab="basic">Basic Info</div>
        <div class="tab" data-tab="alloc">Allocation & Rent</div>
        <div class="tab" data-tab="docs">Documents & Address</div>
      </div>
      <div data-panel="basic">
        <div class="form-grid">
          <div class="field field-span-2"><label>Full Name *</label><input id="tName" value="${tenant ? esc(tenant.full_name) : ""}" /></div>
          <div class="field"><label>Father's Name</label><input id="tFather" value="${tenant ? esc(tenant.father_name || "") : ""}" /></div>
          <div class="field"><label>Gender</label>
            <select id="tGender"><option></option><option ${tenant?.gender==="Male"?"selected":""}>Male</option><option ${tenant?.gender==="Female"?"selected":""}>Female</option><option ${tenant?.gender==="Other"?"selected":""}>Other</option></select>
          </div>
          <div class="field"><label>Date of Birth</label><input type="date" id="tDob" value="${tenant?.dob || ""}" /></div>
          <div class="field"><label>Phone</label><input id="tPhone" value="${tenant ? esc(tenant.phone || "") : ""}" /></div>
          <div class="field"><label>WhatsApp</label><input id="tWhatsapp" value="${tenant ? esc(tenant.whatsapp || "") : ""}" /></div>
          <div class="field"><label>Emergency Contact</label><input id="tEmergency" value="${tenant ? esc(tenant.emergency_contact || "") : ""}" /></div>
          <div class="field"><label>Email</label><input id="tEmail" value="${tenant ? esc(tenant.email || "") : ""}" /></div>
          <div class="field"><label>Occupation</label><input id="tOccupation" value="${tenant ? esc(tenant.occupation || "") : ""}" /></div>
          <div class="field"><label>Company</label><input id="tCompany" value="${tenant ? esc(tenant.company || "") : ""}" /></div>
        </div>
      </div>
      <div data-panel="alloc" style="display:none">
        <div class="form-grid">
          <div class="field"><label>Room</label><select id="tRoom"><option value="">— Unassigned —</option>${roomOptions}</select></div>
          <div class="field"><label>Bed</label><select id="tBed"><option value="">— Select room first —</option>${beds.map((b) => `<option value="${b.id}" ${tenant && tenant.bed_id === b.id ? "selected" : ""}>${b.label} (${b.status})</option>`).join("")}</select></div>
          <div class="field"><label>Joining Date</label><input type="date" id="tJoin" value="${tenant?.joining_date || todayISO()}" /></div>
          <div class="field"><label>Leaving Date</label><input type="date" id="tLeave" value="${tenant?.leaving_date || ""}" /></div>
          <div class="field"><label>Monthly Rent</label><input type="number" id="tRent" value="${tenant ? tenant.rent_amount : ""}" /></div>
          <div class="field"><label>Deposit (non-refundable)</label><input type="number" id="tDeposit" value="${tenant ? tenant.deposit : 1500}" /></div>
          <div class="field"><label>Advance Paid</label><input type="number" id="tAdvance" value="${tenant ? tenant.advance_paid : ""}" /></div>
          <div class="field"><label>Payment Mode</label>
            <select id="tPayMode">${["Cash","UPI","Bank","Card","Cheque"].map((m) => `<option ${tenant?.payment_mode===m?"selected":""}>${m}</option>`).join("")}</select>
          </div>
          <div class="field"><label>Status</label>
            <select id="tStatus">${["Active","Notice Given","Vacated"].map((s) => `<option ${tenant?.status===s?"selected":""}>${s}</option>`).join("")}</select>
          </div>
        </div>
      </div>
      <div data-panel="docs" style="display:none">
        <div class="form-grid">
          <div class="field"><label>Aadhaar No.</label><input id="tAadhaar" value="${tenant ? esc(tenant.aadhaar || "") : ""}" /></div>
          <div class="field"><label>PAN No.</label><input id="tPan" value="${tenant ? esc(tenant.pan || "") : ""}" /></div>
          <div class="field field-span-2"><label>Permanent Address</label><textarea id="tPermAddr" rows="2">${tenant ? esc(tenant.permanent_address || "") : ""}</textarea></div>
          <div class="field field-span-2"><label>Current Address</label><textarea id="tCurrAddr" rows="2">${tenant ? esc(tenant.current_address || "") : ""}</textarea></div>
          <div class="field field-span-2"><label>Notes</label><textarea id="tNotes" rows="2">${tenant ? esc(tenant.notes || "") : ""}</textarea></div>
        </div>
      </div>
    `,
    footer: `
      ${tenant ? `<button class="btn btn-danger" id="deleteBtn" style="margin-right:auto">Delete</button>` : ""}
      <button class="btn" id="cancelBtn">Cancel</button>
      <button class="btn btn-primary" id="saveBtn">${tenant ? "Save Changes" : "Add Tenant"}</button>
    `,
    onRender() {
      document.querySelectorAll(".tab").forEach((tab) => {
        tab.onclick = () => {
          document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
          tab.classList.add("active");
          document.querySelectorAll("[data-panel]").forEach((p) => p.style.display = p.dataset.panel === tab.dataset.tab ? "" : "none");
        };
      });
      document.getElementById("tRoom").onchange = async (e) => {
        const bedSel = document.getElementById("tBed");
        if (!e.target.value) { bedSel.innerHTML = `<option value="">— Select room first —</option>`; return; }
        const roomBeds = await api(`/rooms/${e.target.value}/beds`);
        bedSel.innerHTML = `<option value="">— Unassigned —</option>` + roomBeds.map((b) => `<option value="${b.id}">${b.label} (${b.status})</option>`).join("");
        const room = STATE.rooms.find((r) => r.id == e.target.value);
        if (room && !tenant) document.getElementById("tRent").value = room.monthly_rent;
      };
      document.getElementById("cancelBtn").onclick = closeModal;
      if (tenant) document.getElementById("deleteBtn").onclick = async () => {
        if (!confirm("Delete this tenant record permanently?")) return;
        await api(`/tenants/${tenant.id}`, { method: "DELETE" });
        toast("Tenant deleted"); closeModal(); renderTenants();
      };
      document.getElementById("saveBtn").onclick = async () => {
        const name = document.getElementById("tName").value.trim();
        if (!name) return toast("Full name is required", "error");
        const payload = {
          full_name: name,
          father_name: document.getElementById("tFather").value,
          gender: document.getElementById("tGender").value,
          dob: document.getElementById("tDob").value || null,
          phone: document.getElementById("tPhone").value,
          whatsapp: document.getElementById("tWhatsapp").value,
          emergency_contact: document.getElementById("tEmergency").value,
          email: document.getElementById("tEmail").value,
          occupation: document.getElementById("tOccupation").value,
          company: document.getElementById("tCompany").value,
          room_id: document.getElementById("tRoom").value ? Number(document.getElementById("tRoom").value) : null,
          bed_id: document.getElementById("tBed").value ? Number(document.getElementById("tBed").value) : null,
          joining_date: document.getElementById("tJoin").value || null,
          leaving_date: document.getElementById("tLeave").value || null,
          rent_amount: Number(document.getElementById("tRent").value || 0),
          deposit: Number(document.getElementById("tDeposit").value || 0),
          advance_paid: Number(document.getElementById("tAdvance").value || 0),
          payment_mode: document.getElementById("tPayMode").value,
          status: document.getElementById("tStatus").value,
          aadhaar: document.getElementById("tAadhaar").value,
          pan: document.getElementById("tPan").value,
          permanent_address: document.getElementById("tPermAddr").value,
          current_address: document.getElementById("tCurrAddr").value,
          notes: document.getElementById("tNotes").value,
        };
        if (tenant) await api(`/tenants/${tenant.id}`, { method: "PUT", body: payload });
        else await api("/tenants", { method: "POST", body: payload });
        toast(tenant ? "Tenant updated" : "Tenant added");
        closeModal(); renderTenants();
      };
    },
  });
}

// ============================================================
// STAFF
// ============================================================
const STAFF_ROLES = ["Chef","Sweeper","Watchman","Electrician","Plumber","Housekeeping","Security","Manager","Receptionist","Others"];

async function renderStaff() {
  const content = document.getElementById("content");
  document.getElementById("topbarActions").innerHTML = `<button class="btn btn-primary" id="btnAddStaff">＋ Add Staff</button>`;
  document.getElementById("btnAddStaff").onclick = () => openStaffModal();

  const staff = await api("/staff");
  content.innerHTML = `
    <div class="card"><div class="table-wrap">
      <table>
        <thead><tr><th>Name</th><th>Role</th><th>Phone</th><th>Salary</th><th>Status</th><th>Today</th><th></th></tr></thead>
        <tbody>
          ${staff.length ? staff.map((s) => `
            <tr>
              <td><strong>${esc(s.full_name)}</strong></td>
              <td>${esc(s.role)}</td>
              <td>${esc(s.phone || "—")}</td>
              <td>${fmtMoney(s.monthly_salary)}</td>
              <td>${badge(s.status)}</td>
              <td><button class="btn btn-sm" data-mark="${s.id}">Mark Present</button></td>
              <td style="text-align:right"><button class="btn btn-sm" data-edit-staff="${s.id}">Edit</button></td>
            </tr>`).join("") : `<tr><td colspan="7"><div class="empty-state">No staff added yet.</div></td></tr>`}
        </tbody>
      </table>
    </div></div>
  `;
  content.querySelectorAll("[data-edit-staff]").forEach((btn) => btn.onclick = () => openStaffModal(staff.find((s) => s.id == btn.dataset.editStaff)));
  content.querySelectorAll("[data-mark]").forEach((btn) => btn.onclick = async () => {
    await api("/staff/attendance", { method: "POST", body: { staff_id: Number(btn.dataset.mark), date: todayISO(), status: "Present" } });
    toast("Attendance marked for today");
  });
}

function openStaffModal(staff) {
  openModal({
    title: staff ? "Edit Staff" : "Add Staff",
    bodyHtml: `
      <div class="form-grid">
        <div class="field field-span-2"><label>Full Name *</label><input id="sName" value="${staff ? esc(staff.full_name) : ""}" /></div>
        <div class="field"><label>Role</label><select id="sRole">${STAFF_ROLES.map((r) => `<option ${staff?.role===r?"selected":""}>${r}</option>`).join("")}</select></div>
        <div class="field"><label>Phone</label><input id="sPhone" value="${staff ? esc(staff.phone || "") : ""}" /></div>
        <div class="field"><label>Monthly Salary</label><input type="number" id="sSalary" value="${staff ? staff.monthly_salary : ""}" /></div>
        <div class="field"><label>Advance Paid</label><input type="number" id="sAdvance" value="${staff ? staff.advance_paid : ""}" /></div>
        <div class="field"><label>Joining Date</label><input type="date" id="sJoin" value="${staff?.joining_date || todayISO()}" /></div>
        <div class="field"><label>Status</label><select id="sStatus"><option ${staff?.status==="Active"?"selected":""}>Active</option><option ${staff?.status==="Inactive"?"selected":""}>Inactive</option></select></div>
      </div>
    `,
    footer: `
      ${staff ? `<button class="btn btn-danger" id="deleteBtn" style="margin-right:auto">Delete</button>` : ""}
      <button class="btn" id="cancelBtn">Cancel</button>
      <button class="btn btn-primary" id="saveBtn">${staff ? "Save Changes" : "Add Staff"}</button>
    `,
    onRender() {
      document.getElementById("cancelBtn").onclick = closeModal;
      if (staff) document.getElementById("deleteBtn").onclick = async () => {
        if (!confirm("Delete this staff member?")) return;
        await api(`/staff/${staff.id}`, { method: "DELETE" });
        toast("Staff deleted"); closeModal(); renderStaff();
      };
      document.getElementById("saveBtn").onclick = async () => {
        const name = document.getElementById("sName").value.trim();
        if (!name) return toast("Name is required", "error");
        const payload = {
          full_name: name, role: document.getElementById("sRole").value,
          phone: document.getElementById("sPhone").value,
          monthly_salary: Number(document.getElementById("sSalary").value || 0),
          advance_paid: Number(document.getElementById("sAdvance").value || 0),
          joining_date: document.getElementById("sJoin").value || null,
          status: document.getElementById("sStatus").value,
        };
        if (staff) await api(`/staff/${staff.id}`, { method: "PUT", body: payload });
        else await api("/staff", { method: "POST", body: payload });
        toast(staff ? "Staff updated" : "Staff added");
        closeModal(); renderStaff();
      };
    },
  });
}

// ============================================================
// RENT COLLECTION
// ============================================================
let rentMonth = thisMonth();

async function renderRent() {
  const content = document.getElementById("content");
  document.getElementById("topbarActions").innerHTML = `
    <input type="month" id="rentMonthPicker" value="${rentMonth}" class="btn" style="cursor:auto" />
    <button class="btn btn-primary" id="btnGenerate">Generate Rent for Month</button>
  `;
  document.getElementById("rentMonthPicker").onchange = (e) => { rentMonth = e.target.value; renderRent(); };
  document.getElementById("btnGenerate").onclick = async () => {
    const res = await api("/rent/generate", { method: "POST", body: { month: rentMonth } });
    toast(`${res.created} rent record(s) generated for ${monthLabel(rentMonth)}`);
    renderRent();
  };

  const [records, tenants] = await Promise.all([api(`/rent?month=${rentMonth}`), api("/tenants")]);
  STATE.tenants = tenants;

  const totalDue = records.reduce((a, r) => a + r.amount_due + r.late_fee, 0);
  const totalPaid = records.reduce((a, r) => a + r.amount_paid, 0);

  content.innerHTML = `
    <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)">
      <div class="kpi-card"><div class="kpi-label">Total Due (${monthLabel(rentMonth)})</div><div class="kpi-value">${fmtMoney(totalDue)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Collected</div><div class="kpi-value" style="color:var(--success)">${fmtMoney(totalPaid)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Outstanding</div><div class="kpi-value" style="color:var(--danger)">${fmtMoney(totalDue - totalPaid)}</div></div>
    </div>
    <div class="card"><div class="table-wrap">
      <table>
        <thead><tr><th>Tenant</th><th>Amount Due</th><th>Late Fee</th><th>Paid</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${records.length ? records.map((r) => {
            const t = tenants.find((tn) => tn.id === r.tenant_id);
            return `<tr>
              <td><strong>${t ? esc(t.full_name) : "Tenant #" + r.tenant_id}</strong></td>
              <td>${fmtMoney(r.amount_due)}</td>
              <td>${fmtMoney(r.late_fee)}</td>
              <td>${fmtMoney(r.amount_paid)}</td>
              <td>${badge(r.status)}</td>
              <td style="text-align:right"><button class="btn btn-sm" data-pay="${r.id}">Record Payment</button></td>
            </tr>`;
          }).join("") : `<tr><td colspan="6"><div class="empty-state">No rent generated for this month yet. Click "Generate Rent for Month" above.</div></td></tr>`}
        </tbody>
      </table>
    </div></div>
  `;
  content.querySelectorAll("[data-pay]").forEach((btn) => btn.onclick = () => openRentPayModal(records.find((r) => r.id == btn.dataset.pay)));
}

function openRentPayModal(record) {
  const remaining = Math.max(record.amount_due + record.late_fee - record.amount_paid, 0);
  openModal({
    title: "Record Rent Payment",
    bodyHtml: `
      <div class="form-grid">
        <div class="field"><label>Amount Due</label><input value="${fmtMoney(record.amount_due)}" disabled /></div>
        <div class="field"><label>Already Paid</label><input value="${fmtMoney(record.amount_paid)}" disabled /></div>
        <div class="field"><label>Late Fee</label><input type="number" id="pLate" value="${record.late_fee}" /></div>
        <div class="field"><label>Remaining</label><input value="${fmtMoney(remaining)}" disabled /></div>
        <div class="field"><label>Payment Amount</label><input type="number" id="pPaid" value="${remaining || ""}" placeholder="Amount being paid now" /></div>
        <div class="field"><label>Payment Mode</label><select id="pMode">${["Cash","UPI","Bank","Card","Cheque"].map((m) => `<option ${record.payment_mode===m?"selected":""}>${m}</option>`).join("")}</select></div>
        <div class="field"><label>Payment Date</label><input type="date" id="pDate" value="${todayISO()}" /></div>
      </div>
    `,
    footer: `<button class="btn" id="cancelBtn">Cancel</button><button class="btn btn-primary" id="saveBtn">Save Payment</button>`,
    onRender() {
      document.getElementById("cancelBtn").onclick = closeModal;
      document.getElementById("saveBtn").onclick = async () => {
        const amount = Number(document.getElementById("pPaid").value || 0);
        if (amount <= 0) { toast("Enter a payment amount greater than zero", "error"); return; }
        await api(`/rent/${record.id}/pay`, { method: "POST", body: {
          amount,
          late_fee: Number(document.getElementById("pLate").value || 0),
          payment_mode: document.getElementById("pMode").value,
          payment_date: document.getElementById("pDate").value,
        }});
        toast("Payment recorded");
        closeModal(); renderRent();
      };
    },
  });
}

// ============================================================
// INCOME
// ============================================================
const INCOME_CATEGORIES = ["Rent Collection","Security Deposit","Advance Payment","Penalty","Late Fee","Parking Fee","Other Income"];

async function renderIncome() {
  const content = document.getElementById("content");
  document.getElementById("topbarActions").innerHTML = `<button class="btn btn-primary" id="btnAddIncome">＋ Add Income</button>`;
  document.getElementById("btnAddIncome").onclick = openIncomeModal;
  const items = await api("/income");
  content.innerHTML = `
    <div class="card"><div class="table-wrap">
      <table>
        <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Mode</th><th>Amount</th><th></th></tr></thead>
        <tbody>
          ${items.length ? items.map((i) => `
            <tr>
              <td>${i.date}</td><td>${esc(i.category)}</td><td>${esc(i.description || "—")}</td>
              <td>${esc(i.payment_mode)}</td><td style="color:var(--success);font-weight:600">${fmtMoney(i.amount)}</td>
              <td style="text-align:right"><button class="btn btn-sm btn-danger" data-del="${i.id}">Delete</button></td>
            </tr>`).join("") : `<tr><td colspan="6"><div class="empty-state">No income recorded yet.</div></td></tr>`}
        </tbody>
      </table>
    </div></div>
  `;
  content.querySelectorAll("[data-del]").forEach((btn) => btn.onclick = async () => {
    await api(`/income/${btn.dataset.del}`, { method: "DELETE" }); toast("Deleted"); renderIncome();
  });
}

function openIncomeModal() {
  openModal({
    title: "Add Income",
    bodyHtml: `
      <div class="form-grid">
        <div class="field"><label>Category</label><select id="iCat">${INCOME_CATEGORIES.map((c) => `<option>${c}</option>`).join("")}</select></div>
        <div class="field"><label>Amount</label><input type="number" id="iAmount" /></div>
        <div class="field"><label>Date</label><input type="date" id="iDate" value="${todayISO()}" /></div>
        <div class="field"><label>Payment Mode</label><select id="iMode">${["Cash","UPI","Bank","Card","Cheque"].map((m) => `<option>${m}</option>`).join("")}</select></div>
        <div class="field field-span-2"><label>Description</label><input id="iDesc" /></div>
      </div>
    `,
    footer: `<button class="btn" id="cancelBtn">Cancel</button><button class="btn btn-primary" id="saveBtn">Save</button>`,
    onRender() {
      document.getElementById("cancelBtn").onclick = closeModal;
      document.getElementById("saveBtn").onclick = async () => {
        const amount = Number(document.getElementById("iAmount").value || 0);
        if (!amount) return toast("Please enter an amount", "error");
        await api("/income", { method: "POST", body: {
          category: document.getElementById("iCat").value,
          amount, date: document.getElementById("iDate").value,
          payment_mode: document.getElementById("iMode").value,
          description: document.getElementById("iDesc").value,
        }});
        toast("Income added"); closeModal(); renderIncome();
      };
    },
  });
}

// ============================================================
// EXPENSES
// ============================================================
const EXPENSE_CATEGORIES = ["Vegetables","Groceries","Milk","Rice","Gas","Electricity","Water","Internet","Cleaning",
  "Maintenance","Electrician","Plumber","Repairs","Cook Salary","Sweeper Salary","Watchman Salary","Housekeeping",
  "Furniture","Appliances","Laundry","Transportation","Medical","Miscellaneous"];

async function renderExpenses() {
  const content = document.getElementById("content");
  document.getElementById("topbarActions").innerHTML = `<button class="btn btn-primary" id="btnAddExpense">＋ Add Expense</button>`;
  document.getElementById("btnAddExpense").onclick = openExpenseModal;
  const items = await api("/expenses");
  content.innerHTML = `
    <div class="card"><div class="table-wrap">
      <table>
        <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Mode</th><th>Amount</th><th></th></tr></thead>
        <tbody>
          ${items.length ? items.map((e) => `
            <tr>
              <td>${e.date}</td><td>${esc(e.category)}</td><td>${esc(e.description || "—")}</td>
              <td>${esc(e.payment_mode)}</td><td style="color:var(--danger);font-weight:600">${fmtMoney(e.amount)}</td>
              <td style="text-align:right"><button class="btn btn-sm btn-danger" data-del="${e.id}">Delete</button></td>
            </tr>`).join("") : `<tr><td colspan="6"><div class="empty-state">No expenses recorded yet.</div></td></tr>`}
        </tbody>
      </table>
    </div></div>
  `;
  content.querySelectorAll("[data-del]").forEach((btn) => btn.onclick = async () => {
    await api(`/expenses/${btn.dataset.del}`, { method: "DELETE" }); toast("Deleted"); renderExpenses();
  });
}

function openExpenseModal() {
  openModal({
    title: "Add Expense",
    bodyHtml: `
      <div class="form-grid">
        <div class="field"><label>Category</label>
          <select id="eCat">${EXPENSE_CATEGORIES.map((c) => `<option>${c}</option>`).join("")}<option value="__custom">Custom…</option></select>
        </div>
        <div class="field" id="eCustomWrap" style="display:none"><label>Custom Category</label><input id="eCustom" /></div>
        <div class="field"><label>Amount</label><input type="number" id="eAmount" /></div>
        <div class="field"><label>Date</label><input type="date" id="eDate" value="${todayISO()}" /></div>
        <div class="field"><label>Payment Mode</label><select id="eMode">${["Cash","UPI","Bank","Card","Cheque"].map((m) => `<option>${m}</option>`).join("")}</select></div>
        <div class="field field-span-2"><label>Description</label><input id="eDesc" /></div>
      </div>
    `,
    footer: `<button class="btn" id="cancelBtn">Cancel</button><button class="btn btn-primary" id="saveBtn">Save</button>`,
    onRender() {
      document.getElementById("eCat").onchange = (e) => {
        document.getElementById("eCustomWrap").style.display = e.target.value === "__custom" ? "" : "none";
      };
      document.getElementById("cancelBtn").onclick = closeModal;
      document.getElementById("saveBtn").onclick = async () => {
        const amount = Number(document.getElementById("eAmount").value || 0);
        if (!amount) return toast("Please enter an amount", "error");
        const catSel = document.getElementById("eCat").value;
        const category = catSel === "__custom" ? (document.getElementById("eCustom").value.trim() || "Miscellaneous") : catSel;
        await api("/expenses", { method: "POST", body: {
          category, amount, date: document.getElementById("eDate").value,
          payment_mode: document.getElementById("eMode").value,
          description: document.getElementById("eDesc").value,
        }});
        toast("Expense added"); closeModal(); renderExpenses();
      };
    },
  });
}

// ============================================================
// LEDGER
// ============================================================
let ledgerFilter = { mode: "month", month: thisMonth(), year: String(new Date().getFullYear()), start: thisMonth() + "-01", end: todayISO() };

function ledgerInRange(dateStr) {
  if (!dateStr) return false;
  if (ledgerFilter.mode === "all") return true;
  if (ledgerFilter.mode === "month") return dateStr.slice(0, 7) === ledgerFilter.month;
  if (ledgerFilter.mode === "year") return dateStr.slice(0, 4) === ledgerFilter.year;
  if (ledgerFilter.mode === "custom") return dateStr >= ledgerFilter.start && dateStr <= ledgerFilter.end;
  return true;
}

async function renderLedger() {
  const content = document.getElementById("content");
  document.getElementById("topbarActions").innerHTML = "";
  const entries = await api("/dashboard/ledger");
  const filtered = entries.filter((e) => ledgerInRange(e.date));
  const credit = filtered.filter((e) => e.type === "Credit").reduce((a, e) => a + e.amount, 0);
  const debit = filtered.filter((e) => e.type === "Debit").reduce((a, e) => a + e.amount, 0);

  const modePills = [
    ["month", "Monthly"], ["year", "Yearly"], ["custom", "Custom Range"], ["all", "All Time"],
  ].map(([m, label]) => `<div class="pill ${ledgerFilter.mode === m ? "active" : ""}" data-mode="${m}">${label}</div>`).join("");

  const rangeControl =
    ledgerFilter.mode === "month" ? `<input type="month" id="ledgerMonth" class="btn" style="cursor:auto" value="${ledgerFilter.month}" />` :
    ledgerFilter.mode === "year" ? `<input type="number" id="ledgerYear" class="btn" style="cursor:auto;width:110px" value="${ledgerFilter.year}" />` :
    ledgerFilter.mode === "custom" ? `
      <input type="date" id="ledgerStart" class="btn" style="cursor:auto" value="${ledgerFilter.start}" />
      <span class="text-muted">to</span>
      <input type="date" id="ledgerEnd" class="btn" style="cursor:auto" value="${ledgerFilter.end}" />` : "";

  content.innerHTML = `
    <div class="pill-row">${modePills}</div>
    ${rangeControl ? `<div class="flex-between" style="justify-content:flex-start;gap:10px;margin-bottom:14px">${rangeControl}</div>` : ""}
    <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)">
      <div class="kpi-card"><div class="kpi-label">Credit (Income + Rent)</div><div class="kpi-value" style="color:var(--success)">${fmtMoney(credit)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Debit (Expenses)</div><div class="kpi-value" style="color:var(--danger)">${fmtMoney(debit)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Net</div><div class="kpi-value" style="color:${credit - debit >= 0 ? "var(--success)" : "var(--danger)"}">${fmtMoney(credit - debit)}</div></div>
    </div>
    <div class="card"><div class="table-wrap">
      <table>
        <thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Description</th><th>Amount</th><th>Running Balance</th></tr></thead>
        <tbody>
          ${filtered.length ? filtered.map((e) => `
            <tr>
              <td>${e.date || "—"}</td>
              <td>${e.type === "Credit" ? `<span class="badge badge-success">Credit</span>` : `<span class="badge badge-danger">Debit</span>`}</td>
              <td>${esc(e.category)}</td><td>${esc(e.description)}</td>
              <td style="color:${e.type === "Credit" ? "var(--success)" : "var(--danger)"};font-weight:600">${e.type === "Credit" ? "+" : "-"}${fmtMoney(e.amount)}</td>
              <td>${fmtMoney(e.running_balance)}</td>
            </tr>`).join("") : `<tr><td colspan="6"><div class="empty-state">No ledger entries for this period.</div></td></tr>`}
        </tbody>
      </table>
    </div></div>
  `;

  content.querySelectorAll("[data-mode]").forEach((el) => {
    el.onclick = () => { ledgerFilter.mode = el.dataset.mode; renderLedger(); };
  });
  const monthEl = document.getElementById("ledgerMonth");
  if (monthEl) monthEl.onchange = (e) => { ledgerFilter.month = e.target.value; renderLedger(); };
  const yearEl = document.getElementById("ledgerYear");
  if (yearEl) yearEl.onchange = (e) => { ledgerFilter.year = e.target.value; renderLedger(); };
  const startEl = document.getElementById("ledgerStart");
  if (startEl) startEl.onchange = (e) => { ledgerFilter.start = e.target.value; renderLedger(); };
  const endEl = document.getElementById("ledgerEnd");
  if (endEl) endEl.onchange = (e) => { ledgerFilter.end = e.target.value; renderLedger(); };
}

// ============================================================
// BACKUP & RESTORE
// ============================================================
async function renderBackup() {
  const content = document.getElementById("content");
  document.getElementById("topbarActions").innerHTML = "";
  const backups = await api("/backup/list");
  content.innerHTML = `
    <div class="card">
      <div class="card-header"><div class="card-title">Create a Backup</div></div>
      <p class="text-muted mb-8">Save a snapshot of your entire database. Keep copies on a USB drive or another computer for safety.</p>
      <button class="btn btn-primary" id="btnCreateBackup">💾 Create Local Backup</button>
      <a class="btn" href="/api/backup/download" style="margin-left:8px">⬇ Download Backup File</a>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">Restore from Backup</div></div>
      <p class="text-muted mb-8">Restoring will replace your current data. A safety copy of the current database is kept automatically.</p>
      <input type="file" id="restoreFile" accept=".db" />
      <button class="btn btn-danger" id="btnRestore" style="margin-left:8px">Restore</button>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">Local Backups on This Computer</div></div>
      <div class="table-wrap">
        <table><thead><tr><th>File</th><th>Size</th></tr></thead>
        <tbody>${backups.length ? backups.map((b) => `<tr><td>${esc(b.name)}</td><td>${b.size_kb} KB</td></tr>`).join("") : `<tr><td colspan="2"><div class="empty-state">No backups yet.</div></td></tr>`}</tbody></table>
      </div>
    </div>
  `;
  document.getElementById("btnCreateBackup").onclick = async () => {
    await api("/backup/create", { method: "POST" }); toast("Backup created"); renderBackup();
  };
  document.getElementById("btnRestore").onclick = async () => {
    const file = document.getElementById("restoreFile").files[0];
    if (!file) return toast("Please choose a backup file", "error");
    if (!confirm("This will replace all current data. Continue?")) return;
    const fd = new FormData(); fd.append("file", file);
    const res = await api("/backup/restore", { method: "POST", body: fd });
    if (res.ok) toast(res.message); else toast(res.error, "error");
  };
}

// ============================================================
// SETTINGS
// ============================================================
async function renderSettings() {
  const content = document.getElementById("content");
  document.getElementById("topbarActions").innerHTML = "";
  const s = await api("/settings");
  content.innerHTML = `
    <div class="card">
      <div class="card-header"><div class="card-title">PG Profile</div></div>
      <div class="form-grid">
        <div class="field"><label>PG Name</label><input id="stPgName" value="${esc(s.pg_name)}" /></div>
        <div class="field"><label>Owner Name</label><input id="stOwner" value="${esc(s.owner_name)}" /></div>
        <div class="field"><label>Phone</label><input id="stPhone" value="${esc(s.phone)}" /></div>
        <div class="field"><label>Currency Symbol</label><input id="stCurrency" value="${esc(s.currency)}" /></div>
        <div class="field"><label>Receipt Prefix</label><input id="stPrefix" value="${esc(s.receipt_prefix)}" /></div>
        <div class="field"><label>GST No. (Optional)</label><input id="stGst" value="${esc(s.gst)}" /></div>
        <div class="field field-span-2"><label>Address</label><textarea id="stAddress" rows="2">${esc(s.address)}</textarea></div>
      </div>
      <button class="btn btn-primary mt-8" id="btnSaveSettings">Save Settings</button>
    </div>
  `;
  document.getElementById("btnSaveSettings").onclick = async () => {
    const payload = {
      pg_name: document.getElementById("stPgName").value,
      owner_name: document.getElementById("stOwner").value,
      phone: document.getElementById("stPhone").value,
      currency: document.getElementById("stCurrency").value,
      receipt_prefix: document.getElementById("stPrefix").value,
      gst: document.getElementById("stGst").value,
      address: document.getElementById("stAddress").value,
    };
    STATE.settings = await api("/settings", { method: "PUT", body: payload });
    applyBranding();
    toast("Settings saved");
  };
}

function applyBranding() {
  const name = STATE.settings.pg_name || "My PG";
  document.getElementById("brandName").textContent = name;
  document.getElementById("brandInitial").textContent = name.slice(0, 2).toUpperCase();
}

// ============================================================
// INIT
// ============================================================
(async function init() {
  const savedTheme = localStorage.getItem("pg_theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);
  document.getElementById("themeSwitch").checked = savedTheme === "dark";

  try {
    STATE.settings = await api("/settings");
    applyBranding();
    if (STATE.settings.theme && !localStorage.getItem("pg_theme")) {
      document.documentElement.setAttribute("data-theme", STATE.settings.theme);
      document.getElementById("themeSwitch").checked = STATE.settings.theme === "dark";
    }
  } catch (e) {}

  navigate("dashboard");
})();
