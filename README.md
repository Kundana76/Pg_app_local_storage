

# PG Manager — Offline PG Management System

A 100% offline, single-computer desktop application for managing a Paying
Guest (PG) accommodation business: floors, rooms, beds, tenants, staff,
rent collection, income/expenses, a running ledger, dashboard KPIs & charts,
and one-click backup/restore. All data is stored locally in a SQLite file —
nothing is sent over the internet.

## Why this tech stack (a note on the build)

The original spec asked for React + TypeScript + Electron on the frontend
and Python/FastAPI on the backend. That's two separate toolchains (Node.js
*and* Python) bundled together. To keep this genuinely simple to install and
maintain — and just as offline, just as SQLite-backed, just as "double-click
to open" — this build uses **one stack**:

- **Backend:** FastAPI + SQLAlchemy + SQLite (`/backend`)
- **Frontend:** Plain HTML/CSS/JS (no build step, no CDN — Chart.js is
  vendored locally in `/frontend/vendor`) — served by the same FastAPI app
- **Desktop shell:** `pywebview`, which opens the app in a native window
  (`run_desktop.py`), and can be frozen into a single Windows `.exe` with
  PyInstaller

Everything the spec asked for functionally (offline, no login API, no
hosting, SQLite, portable backups) is delivered — just with a simpler,
one-language toolchain.

## What's implemented in this version

- Dashboard with all requested KPIs + 4 charts (income vs expense,
  occupancy doughnut, rent collection trend, expense-by-category pie).
  Every KPI card is clickable and jumps to the relevant page (e.g. "Vacant
  Rooms" → Rooms filtered to Vacant, "Pending Rent" → Rent Collection)
- Floors: single + bulk creation ("Ground + Floor 1..5" style)
- Rooms: single + bulk creation (e.g. 101–120), beds auto-generated per room,
  AC/attached-bathroom/balcony flags, rent/deposit, status
- Beds: auto-created/synced from a room's bed count, occupancy tracked.
  The Rooms & Beds page groups rooms into per-floor sections, each showing
  a live "X / Y beds available" count (bed-level, not just room status)
- Tenants: full profile (identity, contact, address, documents, emergency
  contact), room/bed allocation with double-booking prevention, checkout
  workflow that frees the bed automatically. Default security deposit is
  ₹1500 (non-refundable), editable per tenant
- Staff: role-based records (Chef, Sweeper, Watchman, etc.), salary,
  advance, and daily attendance marking
- Rent Collection: one-click monthly rent generation for all active
  tenants; each payment is recorded as its own dated installment (not a
  single overwritable total), so partial payments made on different days
  are tracked and reported accurately. Status (Pending / Partially Paid /
  Paid) and tenant "due amount" (including late fees) stay in sync
  automatically, including when a rent record is edited, deleted, or a
  new month is generated
- Income & Expenses: categorized entries (custom expense categories
  supported), payment mode tracking
- Ledger: unified running-balance view across rent, income and expenses,
  with Monthly / Yearly / Custom Range / All Time filters and Credit /
  Debit / Net summary cards for whichever period is selected
- Settings: PG name/owner/phone/address/GST/currency, reflected in the
  sidebar branding
- Backup & Restore: one-click local backup, download-to-file, and restore
  from a `.db` file (a safety copy of the current DB is kept automatically).
  In addition, the database is auto-snapshotted after **every** change (a
  rolling "latest" copy plus one dated copy per day), so recent data isn't
  lost even if you forget to back up manually
- Responsive layout: the sidebar collapses behind a hamburger menu below
  ~900px width, and forms/tables reflow for narrow (tablet/phone) screens
- Dark / light theme toggle

### Not yet built (flagged honestly, not hidden)

The original spec is extremely large — visitor logs, complaint tracking,
inventory management, invoice/QR/receipt generation, notifications, staff
salary slips, role-based login, audit logs, and multi-PG support are **not**
in this first version. The data model and API are structured so any of
these can be added as their own module without reworking what's here — happy
to build out any of them next if you tell me which matter most.

## Running it

### Option A — quick run (any OS with Python 3.10+)

```bash
cd pg-app
pip install -r requirements.txt
python run_desktop.py
```

This opens a native desktop window pointed at a local FastAPI server
running on `127.0.0.1:8642`. Close the window to stop the app.

If `pywebview` has trouble on your system, you can instead run the server
directly and open it in your normal browser — it works identically:

```bash
cd pg-app/backend
python -m uvicorn main:app --host 127.0.0.1 --port 8642
# then open http://127.0.0.1:8642 in your browser
```

### Option B — build a Windows .exe (no Python needed for the end user)

On a Windows machine (PyInstaller builds for the OS it runs on):

```bash
pip install -r requirements.txt
pyinstaller --noconfirm --onefile --windowed ^
  --add-data "frontend;frontend" ^
  --name "PGManager" ^
  run_desktop.py
```

The finished `PGManager.exe` will be in `dist/`. Copy the `dist/PGManager.exe`
file to the target computer — no Python or Node install required there.
The app creates its `data/` folder (with the SQLite database) next to
wherever it's run from, so keep the exe in its own folder.

> Note: I can't run PyInstaller for Windows from this Linux environment, so
> the `.exe` itself isn't included — the command above needs to be run once
> on an actual Windows machine (or via GitHub Actions on a `windows-latest`
> runner) to produce it. The Python source works as-is on Windows, macOS, and
> Linux via Option A in the meantime.

## Project structure

```
pg-app/
├── backend/
│   ├── main.py              FastAPI app + static file serving
│   ├── database.py          SQLite engine/session
│   ├── models.py            SQLAlchemy models
│   ├── schemas.py           Pydantic request/response schemas
│   └── routers/
│       ├── floors.py
│       ├── rooms.py
│       ├── tenants.py
│       ├── staff.py
│       ├── expenses.py
│       ├── income.py
│       ├── rent.py
│       ├── dashboard.py
│       ├── settings.py
│       └── backup.py
├── frontend/
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   └── vendor/chart.umd.min.js   (Chart.js, vendored — no CDN/internet needed)
├── data/                     SQLite database + backups live here (created at runtime)
├── run_desktop.py            Desktop launcher (pywebview)
└── requirements.txt
```

## Backing up your data manually

Your entire database is one file: `pg-app/data/pg_management.db`. Copying
that file anywhere (USB drive, another folder) *is* a full backup. The
in-app "Backup & Restore" page does exactly this for you with one click,
and the app also keeps `data/backups/autobackup_latest.db` (updated after
every change) and one `autobackup_YYYY-MM-DD.db` per day automatically.

## Credits

Developed by  Pusuluri Kundana contact mail: kundanasri.07@gmail.com
