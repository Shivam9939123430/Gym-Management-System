const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "db.json");

const seed = {
  members: [
    {
      id: "mem_1001",
      name: "Aarav Mehta",
      phone: "98765 43210",
      email: "aarav@example.com",
      planId: "plan_premium",
      trainerId: "trainer_riya",
      status: "active",
      joinedAt: "2026-05-10",
      expiresAt: "2026-08-10",
      goal: "Muscle gain"
    },
    {
      id: "mem_1002",
      name: "Nisha Rao",
      phone: "99887 76655",
      email: "nisha@example.com",
      planId: "plan_standard",
      trainerId: "trainer_kabir",
      status: "active",
      joinedAt: "2026-06-01",
      expiresAt: "2026-07-01",
      goal: "Weight loss"
    },
    {
      id: "mem_1003",
      name: "Dev Shah",
      phone: "90909 11223",
      email: "dev@example.com",
      planId: "plan_basic",
      trainerId: "",
      status: "due",
      joinedAt: "2026-04-15",
      expiresAt: "2026-06-15",
      goal: "General fitness"
    }
  ],
  plans: [
    { id: "plan_basic", name: "Basic", price: 1499, durationDays: 30, perks: "Gym floor access" },
    { id: "plan_standard", name: "Standard", price: 2499, durationDays: 30, perks: "Classes + diet check-in" },
    { id: "plan_premium", name: "Premium", price: 6499, durationDays: 90, perks: "Trainer + classes + body analysis" }
  ],
  trainers: [
    { id: "trainer_riya", name: "Riya Kapoor", specialty: "Strength", phone: "90000 11111" },
    { id: "trainer_kabir", name: "Kabir Khan", specialty: "Fat loss", phone: "90000 22222" },
    { id: "trainer_maya", name: "Maya Iyer", specialty: "Yoga", phone: "90000 33333" }
  ],
  classes: [
    { id: "class_spinning", name: "Spinning", trainerId: "trainer_kabir", time: "07:00", capacity: 18 },
    { id: "class_strength", name: "Strength Lab", trainerId: "trainer_riya", time: "18:30", capacity: 14 },
    { id: "class_yoga", name: "Power Yoga", trainerId: "trainer_maya", time: "06:30", capacity: 20 }
  ],
  payments: [
    { id: "pay_9001", memberId: "mem_1001", amount: 6499, method: "UPI", paidAt: "2026-05-10", feeType: "new", note: "Premium 90 days" },
    { id: "pay_9002", memberId: "mem_1002", amount: 2499, method: "Card", paidAt: "2026-06-01", feeType: "renewal", note: "Standard monthly" }
  ],
  attendance: [
    { id: "att_7001", memberId: "mem_1001", date: todayISO(), checkIn: "06:45" },
    { id: "att_7002", memberId: "mem_1002", date: todayISO(), checkIn: "08:10" }
  ]
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) writeDb(seed);
}

function readDb() {
  ensureDb();
  const db = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  db.payments = (db.payments || []).map((payment) => ({ feeType: "renewal", ...payment }));
  return db;
}

function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
  });
}

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(5).toString("hex")}`;
}

function sanitizeMember(input) {
  return {
    name: String(input.name || "").trim(),
    phone: String(input.phone || "").trim(),
    email: String(input.email || "").trim(),
    planId: String(input.planId || "").trim(),
    trainerId: String(input.trainerId || "").trim(),
    status: String(input.status || "active").trim(),
    joinedAt: String(input.joinedAt || todayISO()).trim(),
    expiresAt: String(input.expiresAt || "").trim(),
    goal: String(input.goal || "").trim()
  };
}

function notFound(res) {
  sendJson(res, 404, { error: "Not found" });
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, requested));
  if (!filePath.startsWith(PUBLIC_DIR)) return notFound(res);

  fs.readFile(filePath, (err, content) => {
    if (err) return notFound(res);
    const ext = path.extname(filePath).toLowerCase();
    const types = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".svg": "image/svg+xml"
    };
    res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
    res.end(content);
  });
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const parts = url.pathname.split("/").filter(Boolean);
  const db = readDb();

  try {
    if (req.method === "GET" && url.pathname === "/api/overview") {
      const now = todayISO();
      const revenue = db.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      const active = db.members.filter((m) => m.status === "active" && (!m.expiresAt || m.expiresAt >= now)).length;
      const due = db.members.filter((m) => m.status === "due" || (m.expiresAt && m.expiresAt < now)).length;
      const todayVisits = db.attendance.filter((a) => a.date === now).length;
      return sendJson(res, 200, { active, due, todayVisits, revenue });
    }

    if (req.method === "GET" && parts[0] === "api" && ["members", "plans", "trainers", "classes", "payments", "attendance"].includes(parts[1])) {
      return sendJson(res, 200, db[parts[1]]);
    }

    if (req.method === "POST" && url.pathname === "/api/members") {
      const payload = sanitizeMember(await readBody(req));
      if (!payload.name || !payload.phone || !payload.planId) {
        return sendJson(res, 400, { error: "Name, phone, and plan are required." });
      }
      const member = { id: id("mem"), ...payload };
      db.members.unshift(member);
      writeDb(db);
      return sendJson(res, 201, member);
    }

    if (req.method === "PUT" && parts[0] === "api" && parts[1] === "members" && parts[2]) {
      const index = db.members.findIndex((member) => member.id === parts[2]);
      if (index === -1) return notFound(res);
      db.members[index] = { ...db.members[index], ...sanitizeMember(await readBody(req)), id: parts[2] };
      writeDb(db);
      return sendJson(res, 200, db.members[index]);
    }

    if (req.method === "DELETE" && parts[0] === "api" && parts[1] === "members" && parts[2]) {
      const before = db.members.length;
      db.members = db.members.filter((member) => member.id !== parts[2]);
      db.payments = db.payments.filter((payment) => payment.memberId !== parts[2]);
      db.attendance = db.attendance.filter((entry) => entry.memberId !== parts[2]);
      if (db.members.length === before) return notFound(res);
      writeDb(db);
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "POST" && url.pathname === "/api/payments") {
      const body = await readBody(req);
      const payment = {
        id: id("pay"),
        memberId: String(body.memberId || ""),
        amount: Number(body.amount || 0),
        method: String(body.method || "Cash"),
        paidAt: String(body.paidAt || todayISO()),
        feeType: ["new", "renewal"].includes(body.feeType) ? body.feeType : "renewal",
        note: String(body.note || "")
      };
      if (!payment.memberId || payment.amount <= 0) {
        return sendJson(res, 400, { error: "Member and positive amount are required." });
      }
      db.payments.unshift(payment);
      const member = db.members.find((item) => item.id === payment.memberId);
      if (member) member.status = "active";
      writeDb(db);
      return sendJson(res, 201, payment);
    }

    if (req.method === "POST" && url.pathname === "/api/attendance") {
      const body = await readBody(req);
      const entry = {
        id: id("att"),
        memberId: String(body.memberId || ""),
        date: String(body.date || todayISO()),
        checkIn: String(body.checkIn || new Date().toTimeString().slice(0, 5))
      };
      if (!db.members.some((member) => member.id === entry.memberId)) {
        return sendJson(res, 400, { error: "Choose a valid member." });
      }
      db.attendance.unshift(entry);
      writeDb(db);
      return sendJson(res, 201, entry);
    }

    notFound(res);
  } catch (error) {
    sendJson(res, 400, { error: error.message });
  }
}

function createServer() {
  return http.createServer((req, res) => {
  if (req.url.startsWith("/api/")) return handleApi(req, res);
  serveStatic(req, res);
  });
}

const server = createServer();

if (require.main === module) {
  server.listen(PORT, () => {
    ensureDb();
    console.log(`Gym management prototype running at http://localhost:${PORT}`);
  });
}

module.exports = { createServer, ensureDb };
