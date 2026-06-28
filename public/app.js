const state = {
  members: [],
  plans: [],
  trainers: [],
  classes: [],
  payments: [],
  attendance: [],
  overview: {},
  collectionMonth: new Date().getMonth(),
  search: ""
};

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

const today = () => new Date().toISOString().slice(0, 10);
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function load() {
  const [overview, members, plans, trainers, classes, payments, attendance] = await Promise.all([
    api("/api/overview"),
    api("/api/members"),
    api("/api/plans"),
    api("/api/trainers"),
    api("/api/classes"),
    api("/api/payments"),
    api("/api/attendance")
  ]);
  Object.assign(state, { overview, members, plans, trainers, classes, payments, attendance });
  render();
}

function planName(id) {
  return state.plans.find((plan) => plan.id === id)?.name || "No plan";
}

function trainerName(id) {
  return state.trainers.find((trainer) => trainer.id === id)?.name || "Unassigned";
}

function memberName(id) {
  return state.members.find((member) => member.id === id)?.name || "Unknown member";
}

function filteredMembers() {
  const query = state.search.toLowerCase().trim();
  if (!query) return state.members;
  return state.members.filter((member) =>
    [member.name, member.phone, member.email, member.goal, planName(member.planId), trainerName(member.trainerId)]
      .join(" ")
      .toLowerCase()
      .includes(query)
  );
}

function setOptions(select, rows, placeholder) {
  select.innerHTML = [
    placeholder ? `<option value="">${placeholder}</option>` : "",
    ...rows.map((row) => `<option value="${row.id}">${row.name}</option>`)
  ].join("");
}

function fillSelects() {
  document.querySelectorAll('select[name="planId"]').forEach((select) => setOptions(select, state.plans));
  document.querySelectorAll('select[name="trainerId"]').forEach((select) => setOptions(select, state.trainers, "No trainer"));
  document.querySelectorAll('select[name="memberId"]').forEach((select) => setOptions(select, state.members));
}

function renderOverview() {
  document.querySelector("#activeMembers").textContent = state.overview.active || 0;
  document.querySelector("#dueMembers").textContent = state.overview.due || 0;
  document.querySelector("#todayVisits").textContent = state.overview.todayVisits || 0;
  document.querySelector("#revenue").textContent = currency.format(state.overview.revenue || 0);

  const recent = [...state.members].slice(0, 5);
  document.querySelector("#recentMembers").innerHTML = recent.map((member) => `
    <tr>
      <td>${escapeHtml(member.name)}</td>
      <td>${escapeHtml(planName(member.planId))}</td>
      <td><span class="badge ${member.status}">${escapeHtml(member.status)}</span></td>
      <td>${escapeHtml(member.expiresAt || "-")}</td>
    </tr>
  `).join("");

  const todayRows = state.attendance.filter((entry) => entry.date === today()).slice(0, 7);
  document.querySelector("#todayAttendance").innerHTML = todayRows.length ? todayRows.map((entry) => `
    <div class="activity-item"><strong>${escapeHtml(memberName(entry.memberId))}</strong><span>${escapeHtml(entry.checkIn)}</span></div>
  `).join("") : `<p class="empty">No check-ins yet today.</p>`;
}

function renderMembers() {
  const members = filteredMembers();
  document.querySelector("#memberCount").textContent = `${members.length} member${members.length === 1 ? "" : "s"}`;
  document.querySelector("#memberCards").innerHTML = members.map((member) => `
    <article class="member-card">
      <header>
        <div>
          <h3>${escapeHtml(member.name)}</h3>
          <p>${escapeHtml(member.phone)} · ${escapeHtml(member.email || "No email")}</p>
        </div>
        <span class="badge ${member.status}">${escapeHtml(member.status)}</span>
      </header>
      <p><strong>${escapeHtml(planName(member.planId))}</strong> · ${escapeHtml(trainerName(member.trainerId))}</p>
      <p>Goal: ${escapeHtml(member.goal || "Not set")}</p>
      <p>Membership: ${escapeHtml(member.joinedAt || "-")} to ${escapeHtml(member.expiresAt || "-")}</p>
      <div class="card-actions">
        <button data-edit="${member.id}">Edit</button>
        <button class="danger" data-delete="${member.id}">Delete</button>
      </div>
    </article>
  `).join("");
}

function renderBilling() {
  renderMonthPicker();
  renderMonthlyCollection();
  document.querySelector("#paymentsTable").innerHTML = state.payments.map((payment) => `
    <tr>
      <td>${escapeHtml(memberName(payment.memberId))}</td>
      <td>${currency.format(payment.amount)}</td>
      <td><span class="badge ${payment.feeType === "new" ? "active" : "paused"}">${payment.feeType === "new" ? "New" : "Renewal"}</span></td>
      <td>${escapeHtml(payment.method)}</td>
      <td>${escapeHtml(payment.paidAt)}</td>
    </tr>
  `).join("");
}

function paymentMonth(payment) {
  const date = new Date(`${payment.paidAt}T00:00:00`);
  return Number.isNaN(date.getTime()) ? -1 : date.getMonth();
}

function monthlyTotals() {
  return monthNames.map((name, month) => {
    const rows = state.payments.filter((payment) => paymentMonth(payment) === month);
    const newTotal = rows
      .filter((payment) => payment.feeType === "new")
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const renewalTotal = rows
      .filter((payment) => payment.feeType !== "new")
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    return { name, month, newTotal, renewalTotal, total: newTotal + renewalTotal };
  });
}

function renderMonthPicker() {
  const select = document.querySelector("#collectionMonth");
  select.innerHTML = monthNames.map((name, index) => `<option value="${index}">${name}</option>`).join("");
  select.value = String(state.collectionMonth);
}

function renderMonthlyCollection() {
  const totals = monthlyTotals();
  const selected = totals[state.collectionMonth];
  document.querySelector("#selectedMonthTotal").textContent = currency.format(selected.total);
  document.querySelector("#newCollection").textContent = currency.format(selected.newTotal);
  document.querySelector("#renewalCollection").textContent = currency.format(selected.renewalTotal);
  document.querySelector("#monthlyCollection").innerHTML = totals.map((item) => `
    <button class="month-tile ${item.month === state.collectionMonth ? "active" : ""}" data-month="${item.month}">
      <span>${item.name}</span>
      <strong>${currency.format(item.total)}</strong>
    </button>
  `).join("");
}

function renderAttendance() {
  document.querySelector("#attendanceLog").innerHTML = state.attendance.map((entry) => `
    <div class="activity-item">
      <div><strong>${escapeHtml(memberName(entry.memberId))}</strong><span>${escapeHtml(entry.date)}</span></div>
      <span>${escapeHtml(entry.checkIn)}</span>
    </div>
  `).join("");
}

function renderCatalog() {
  document.querySelector("#catalog").innerHTML = `
    <div class="catalog-group">
      <h3>Plans</h3>
      ${state.plans.map((plan) => `<div class="catalog-row"><strong>${escapeHtml(plan.name)} · ${currency.format(plan.price)}</strong><span>${plan.durationDays} days · ${escapeHtml(plan.perks)}</span></div>`).join("")}
    </div>
    <div class="catalog-group">
      <h3>Trainers</h3>
      ${state.trainers.map((trainer) => `<div class="catalog-row"><strong>${escapeHtml(trainer.name)}</strong><span>${escapeHtml(trainer.specialty)} · ${escapeHtml(trainer.phone)}</span></div>`).join("")}
    </div>
    <div class="catalog-group">
      <h3>Classes</h3>
      ${state.classes.map((item) => `<div class="catalog-row"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(trainerName(item.trainerId))} · ${escapeHtml(item.time)} · ${item.capacity} seats</span></div>`).join("")}
    </div>
  `;
}

function render() {
  fillSelects();
  renderOverview();
  renderMembers();
  renderBilling();
  renderAttendance();
  renderCatalog();
  document.querySelectorAll('input[type="date"]').forEach((input) => {
    if (!input.value) input.value = today();
  });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function toast(message) {
  const node = document.querySelector("#toast");
  node.textContent = message;
  node.classList.add("show");
  setTimeout(() => node.classList.remove("show"), 2200);
}

function switchView(id) {
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === id));
  document.querySelectorAll(".nav button").forEach((button) => button.classList.toggle("active", button.dataset.view === id));
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function editMember(id) {
  const member = state.members.find((item) => item.id === id);
  if (!member) return;
  const form = document.querySelector("#memberForm");
  Object.entries(member).forEach(([key, value]) => {
    if (form.elements[key]) form.elements[key].value = value;
  });
  document.querySelector("#memberFormTitle").textContent = "Edit Member";
  switchView("members");
}

function resetMemberForm() {
  const form = document.querySelector("#memberForm");
  form.reset();
  form.elements.id.value = "";
  form.elements.joinedAt.value = today();
  form.elements.expiresAt.value = today();
  document.querySelector("#memberFormTitle").textContent = "Add Member";
}

document.addEventListener("click", async (event) => {
  const nav = event.target.closest("[data-view], [data-view-target]");
  if (nav) switchView(nav.dataset.view || nav.dataset.viewTarget);

  const edit = event.target.closest("[data-edit]");
  if (edit) editMember(edit.dataset.edit);

  const remove = event.target.closest("[data-delete]");
  if (remove && confirm("Delete this member and linked records?")) {
    await api(`/api/members/${remove.dataset.delete}`, { method: "DELETE" });
    toast("Member deleted");
    await load();
  }
});

document.querySelector("#search").addEventListener("input", (event) => {
  state.search = event.target.value;
  renderMembers();
});

document.querySelector("#resetMemberForm").addEventListener("click", resetMemberForm);

document.querySelector("#collectionMonth").addEventListener("change", (event) => {
  state.collectionMonth = Number(event.target.value);
  renderBilling();
});

document.querySelector("#monthlyCollection").addEventListener("click", (event) => {
  const tile = event.target.closest("[data-month]");
  if (!tile) return;
  state.collectionMonth = Number(tile.dataset.month);
  renderBilling();
});

document.querySelector("#memberForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = formData(form);
  const method = data.id ? "PUT" : "POST";
  const path = data.id ? `/api/members/${data.id}` : "/api/members";
  delete data.id;
  await api(path, { method, body: JSON.stringify(data) });
  resetMemberForm();
  toast("Member saved");
  await load();
});

document.querySelector("#paymentForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  await api("/api/payments", { method: "POST", body: JSON.stringify(formData(event.currentTarget)) });
  event.currentTarget.reset();
  toast("Payment recorded");
  await load();
});

document.querySelector("#attendanceForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  await api("/api/attendance", { method: "POST", body: JSON.stringify(formData(event.currentTarget)) });
  event.currentTarget.reset();
  toast("Attendance marked");
  await load();
});

load().catch((error) => toast(error.message));
