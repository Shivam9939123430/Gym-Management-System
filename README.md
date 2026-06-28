# Gym Management System Prototype

Dependency-free full-stack prototype built with Node.js, a JSON file database, and a browser UI.

## Run

```powershell
node server.js
```

Then open:

```text
http://localhost:3000
```

On Windows you can also double-click `run.bat`.

## Features

- Dashboard metrics for active members, dues, visits, and revenue
- Member create, edit, delete, search, plan assignment, and trainer assignment
- Payment recording with revenue totals
- Attendance check-ins
- Plans, trainers, and class schedule catalog
- Local persistence in `data/db.json`

This is a prototype, so authentication, role permissions, production database setup, and deployment hardening are intentionally left out.
