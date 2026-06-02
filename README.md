# TeleCaafimaad MVP

**Telemedicine platform connecting anonymous Somali patients with diaspora volunteer physicians.**  
Built by AfyaMeet Limited. Pilot: Banadir District, Somalia. 2026.

---

## Quick Start

1. Extract the zip to any folder on your computer.
2. Open `index.html` in a browser (Chrome or Firefox recommended).
3. No server, no installation, no internet connection required after first load.
4. Google Fonts loads from the internet on first visit only. Works offline afterwards if fonts are cached.

**That is all. The app is fully self-contained.**

---

## File Structure

```
telecaafimaad/
├── index.html           Role selector — entry point
├── patient.html         Patient interface (Somali/English)
├── doctor.html          Doctor clinical interface
├── admin.html           Administration and reporting
├── css/
│   ├── base.css         Reset, CSS variables, typography, Google Fonts import
│   └── app.css          All layout and component styles for all four pages
├── js/
│   ├── db.js            Data layer — localStorage API and seed data
│   ├── patient.js       Patient flow logic
│   ├── doctor.js        Doctor interface logic
│   └── admin.js         Admin and reporting logic
└── README.md            This file
```

**db.js must be loaded before any other script.** It is already in the correct order in all HTML files.

---

## Data Layer (db.js)

### How it works

All data is stored in the browser's `localStorage` as JSON. When any page loads, it calls `DB.init()` which checks whether data already exists. If not, it writes the seed data. If data already exists (from a previous session), it leaves it untouched.

This means:
- A case submitted on `patient.html` will appear in the doctor queue on `doctor.html` in the same browser.
- A case closed by the doctor will update the admin stats on `admin.html`.
- Schedule availability set on `doctor.html` persists across page refreshes.
- All data survives closing and reopening the browser.

### localStorage keys

| Key | Contents |
|-----|----------|
| `tc_cases` | Array of all cases (pending + closed) |
| `tc_doctors` | Array of doctor records |
| `tc_availability` | Object mapping time slot keys to boolean (available/not) |
| `tc_dhis2_log` | Array of DHIS2 push log entries |
| `tc_sessions` | Object mapping session tokens to case IDs |

### Resetting data

Open `admin.html`, click the **Reset Demo Data** button in the top-right of the header. This wipes all five localStorage keys and reseeds the original data, then reloads the page.

You can also reset manually in the browser developer console on any page:
```javascript
DB.reset(); location.reload();
```

### Seed data on first load

When the app is opened for the first time in a browser:

- **25 closed cases** — historical consultations spanning March to May 2026. These populate the admin Case Log, Overview stats, and Doctor My Cases view.
- **5 pending cases** — currently waiting in the doctor queue (TC-2026-0026 through TC-2026-0030).
- **5 doctors** — Dr. Amina Hassan (Cardiology, Toronto), Dr. Omar Farah (Paediatrics, London), Dr. Fadumo Warsame (General Practice, Dubai), Dr. Mahad Idle (Internal Medicine, Minneapolis), Dr. Asad Warsame (Obstetrics, Oslo).
- **DHIS2 log** — 20 push entries corresponding to the first 20 closed cases.

### Case object schema

```json
{
  "id": "TC-2026-0031",
  "status": "pending | closed",
  "created_at": "2026-05-25T10:30:00.000Z",
  "closed_at": "2026-05-25T14:22:00.000Z",
  "age": 34,
  "sex": "Female",
  "body_area": "Chest",
  "symptoms": ["Fever", "Cough", "Fatigue"],
  "duration": "1–3 days",
  "complaint": "Patient-submitted free text description.",
  "district": "Banadir",
  "urgency": "high | medium | low",
  "assigned_doctor": "Dr. Amina Hassan",
  "specialty": "Cardiology",
  "diagnosis": "Upper Respiratory Infection",
  "pathway": "prescription | lab | referral | followup | noaction",
  "clinical_notes": "Doctor's notes written at consultation.",
  "pathway_data": {
    "medication": "Paracetamol 500mg",
    "dosage": "1 tablet",
    "frequency": "Three times daily",
    "duration": "5 days",
    "pharmacy": "Isha Pharmacy — Mogadishu"
  },
  "dhis2_status": "Pending | Pushed | Failed"
}
```

---

## index.html — Role Selector

The entry point. Displays three options:

- **Bukaanka / Patient** → `patient.html`
- **Dhakhtar / Doctor** → `doctor.html`
- **Maamulka / Administration** → `admin.html`

No authentication. No form. This simulates the routing layer of the production system where a URL subdomain or token determines the interface shown.

---

## patient.html — Patient Interface

### Language toggle

A button in the top-right corner switches all labels between Somali (default) and English. This is implemented via CSS classes (`lang-so` and `lang-en`) on the `<body>` element. Elements with class `t-so` are hidden when `lang-en` is active, and vice versa. The toggle button text also flips to show the language you will switch to.

### Step 1 — Phone Number

The patient enters a phone number with the `+252` Somalia prefix pre-filled.

Clicking **Koodka Dir / Send Code**:
- Validates that the number is at least 8 digits.
- Displays a mock 6-digit code in a confirmation message (e.g. "Code sent to +25261234567: 482910 (demo)").
- Shows the OTP entry field.
- In production, this step would trigger an actual SMS via Africa's Talking.

Clicking **Xaqiiji / Verify**:
- Accepts any 6-digit number (demo mode — no real code validation).
- Generates a session token stored in memory and later saved to `tc_sessions` in localStorage when the case is submitted.
- Advances to Step 2.

### Step 2 — Symptom Intake

Structured form fields only. Free text is limited to a single presenting complaint field.

| Field | Type | Values |
|-------|------|--------|
| Body Area | Dropdown | Head, Chest, Abdomen, Limbs, Skin, General |
| Symptoms | Multi-select checkboxes | Fever, Pain, Cough, Fatigue, Shortness of breath, Vomiting, Diarrhoea, Rash, Dizziness, Other |
| Duration | Dropdown | Less than 1 day, 1–3 days, 4–7 days, More than 1 week |
| Age | Number input | 1–120 |
| Sex | Dropdown | Male, Female, Prefer not to say |
| Presenting Complaint | Textarea | Free text, optional |

Clicking **Kiiska Dir / Submit Case**:
- Validates that Body Area, Duration, Age, and Sex are filled, and at least one symptom is selected.
- Assigns an urgency level automatically: `high` if fever or shortness of breath is selected; `medium` if vomiting or dizziness is present or age is under 12; `low` otherwise.
- Creates a new case object with a sequential ID (TC-2026-XXXX) generated by `DB.generateCaseId()`.
- Saves the case to `tc_cases` via `DB.addCase()`.
- Saves the session token to `tc_sessions` so the case can be retrieved later.
- **This case now appears in the doctor queue in real time.**
- Advances to Step 3.

### Step 3 — Confirmation

Displays the generated case reference number, status (Awaiting Doctor), estimated response time (24 hours), and assigned doctor.

Clicking **Natiijada Arag / View Result (Demo)** checks `tc_sessions` for the current session token. If the doctor has already closed this case during the same browser session, it attempts to display the real response. Otherwise it advances to Step 4 with the default mock prescription.

### Step 4 — Consultation Result

Shows a complete consultation outcome. In demo mode this always shows a prescription card:

- **Diagnosis:** Upper Respiratory Infection — ICD-10: J06.9
- **Medication:** Paracetamol 500mg, 1 tablet three times daily, 5 days
- **Pharmacy:** Isha Pharmacy — Mogadishu
- **Verification code:** TC-PX-7823 (present this at the pharmacy counter)

In a live session where the doctor has already responded, the diagnosis and clinical notes update to reflect the doctor's actual input.

---

## doctor.html — Doctor Interface

Logged in as Dr. Amina Hassan (Cardiology, Toronto) for the demo. The sidebar is always visible on desktop. On mobile it collapses and opens via the hamburger button.

### Case Queue

Shows all cases with `status: "pending"` from `tc_cases`, sorted by submission time (newest first by default from how addCase works — newest are at the end, so the array is iterated in order).

Each case card shows:
- Case ID (accent colour)
- Patient sex and age, body area
- Symptom list, duration, district
- Submission time (relative: "Just now", "2 hours ago", etc.)
- Urgency badge: High (red), Medium (amber), Low (green)

The badge count in the sidebar and mobile header reflects the live count of pending cases. **When a new case is submitted on patient.html in the same browser, refreshing doctor.html will show it in the queue.**

Clicking a case opens the Case Detail view.

### Case Detail

Left panel shows all patient intake data in a structured grid.

Right panel contains the clinical response form:

**Diagnosis** — Free text or ICD-10 code. Required before submitting.

**Pathway** — Dropdown. Selecting a pathway shows a dynamic sub-form:

| Pathway | Fields shown |
|---------|-------------|
| Prescription | Medication name, dosage, frequency, duration, pharmacy selection (3 options) |
| Lab Order | Test name, laboratory selection (2 options), priority (Normal/Urgent) |
| Referral | Facility name, reason for referral, urgency (Routine/Urgent/Emergency) |
| Follow-up | Date picker, patient instructions |
| No Action Required | Reason field |

**Clinical Notes** — Textarea for observations and instructions.

Clicking **Close Case & Submit**:
1. Validates that both diagnosis and pathway are filled.
2. Calls `DB.updateCase()` to update the case status to `closed`, stores `closed_at`, `diagnosis`, `pathway`, `clinical_notes`, `pathway_data`, and sets `dhis2_status` to `Pending`.
3. Increments the case count for Dr. Amina Hassan in `tc_doctors`.
4. Adds a new entry to `tc_dhis2_log` with status `Pending`.
5. After 2.5 seconds, simulates a DHIS2 push: 92% chance of `Success` (HTTP 200), 8% chance of `Failed` (HTTP 422). Updates both the case record and the DHIS2 log entry.
6. Removes the case from the queue (it no longer appears because its status is `closed`).
7. Adds it to My Cases.
8. Returns to the Case Queue view.

### My Cases

Shows all closed cases from `tc_cases` with:
- Case ID
- Diagnosis
- Pathway type and date closed
- DHIS2 push status badge (updates from Pending to Pushed/Failed after the 2.5-second simulation)

### Schedule

A 7-day grid (current week, Sunday to Saturday) with 7 UTC time slots per day (08:00 to 20:00 at 2-hour intervals).

Click any slot to toggle it between available (highlighted) and unavailable (plain). Availability state is saved to `tc_availability` in localStorage immediately on every click. It persists across page refreshes.

### Profile

Static view of doctor details and NHPC verification checklist. All items are marked as verified for Dr. Amina Hassan.

---

## admin.html — Administration Interface

### Reset Demo Data button

Located in the top-right of the header. Clicking it confirms with a dialog, then wipes all localStorage keys and reloads the page with fresh seed data.

### Overview tab

All metrics are computed live from `tc_cases` and `tc_doctors` via `DB.getStats()`.

| Metric | Source |
|--------|--------|
| Total consultations | Count of cases with `status: "closed"` |
| This week | Closed cases where `closed_at` is within the last 7 days |
| Active doctors | Count of doctors with `status: "Active"` |
| DHIS2 push success rate | Successful pushes / total pushes in log |
| Prescriptions issued | Closed cases with `pathway: "prescription"` |
| Referrals issued | Closed cases with `pathway: "referral"` |
| Follow-ups completed | Closed cases with `pathway: "followup"` |

Pathway Breakdown and District Activity are computed from the same data.

### Case Log tab

Paginated table of all cases (pending + closed), 10 per page, newest first. Columns:

- **Case ID** — unique identifier
- **Date** — `closed_at` for closed cases, `created_at` for pending
- **District** — Banadir, Bay, or Lower Shabelle
- **Specialty** — assigned doctor's specialty
- **Diagnosis** — doctor's diagnosis, or "Pending" in italic if still open
- **Pathway** — outcome type, or "Awaiting" if still open
- **DHIS2** — push status badge

Pagination controls update the table. The meta line shows the current range and total.

### Doctor Registry tab

Lists all five doctors from `tc_doctors`. Each row shows name, specialty, location, status badge, and cases closed.

Clicking any row expands it to show:
- Full name, specialty, location
- Qualification and license details
- Cases closed (updates in real time as doctor closes cases)
- NHPC verification status (Verified or In Review)

Only one row can be expanded at a time.

### DHIS2 Sync tab

**Reconciliation summary** (top row) shows:
- Last sync time (derived from the most recent log entry timestamp)
- Records pushed successfully today
- Pending retries
- Failed records

**Push log table** shows the 30 most recent entries from `tc_dhis2_log`:

| Column | Description |
|--------|-------------|
| Timestamp | ISO datetime in UTC |
| Case ID | The case this push corresponds to |
| District | Patient's district |
| Status | Success (green), Retry/Pending (amber), Failed (red) |
| HTTP | Response code: 200, 503, 422 |
| Message | Human-readable description of the push result |

New entries appear at the top when a doctor closes a case and the DHIS2 simulation runs.

---

## Cross-Interface Data Flow

This diagram shows how a patient submission connects to every other interface:

```
patient.html                     doctor.html                   admin.html
───────────                      ───────────                   ──────────
1. Patient enters phone
2. Verifies OTP (any 6 digits)
3. Fills symptom form
4. Clicks Submit
   └── DB.addCase(newCase)
       └── writes to tc_cases
                                 5. Doctor refreshes page
                                    DB.getPendingCases()
                                    └── reads tc_cases
                                        → new case appears in queue
                                 6. Doctor opens case
                                 7. Fills diagnosis + pathway
                                 8. Clicks Close Case
                                    DB.updateCase(id, {...})
                                    └── status → "closed"
                                    DB.addDHIS2Entry({...})
                                    └── status → "Pending"
                                 9. After 2.5 seconds:
                                    DB.updateCase(id, {dhis2_status})
                                    DB.updateDHIS2Entry(id, {status, code})
                                                          10. Admin refreshes
                                                              DB.getStats()
                                                              → stats update
                                                              DB.getDHIS2Log()
                                                              → push log shows
```

All three interfaces read from and write to the same localStorage keys. No server is involved.

---

## Known Limitations

These are intentional simplifications for the MVP demo. Each has a known production solution.

| Limitation | Production solution |
|-----------|-------------------|
| Any 6-digit OTP is accepted | Africa's Talking SMS gateway with real code generation and expiry |
| All cases assign Dr. Amina Hassan | Case matching engine based on doctor specialty, urgency, and availability |
| Patient sees mock prescription in Step 4 even if doctor hasn't responded | Real-time check: Step 4 polls `tc_cases` for case status change |
| No real DHIS2 API call | Supabase Edge Function with job queue, validation against DHIS2 metadata, and exponential backoff |
| Doctor interface is always logged in as Dr. Amina Hassan | Supabase Auth with JWT-based session, role-based routing |
| localStorage can be cleared by the user | Server-side PostgreSQL database with Supabase |
| No image upload for clinical photos | Supabase Storage bucket with compression at upload |
| No real SMS delivery | Africa's Talking API with Somalia carrier routing |
| DHIS2 push is simulated with a random 92/8 success rate | Real push with validation against DHIS2 Tracker program metadata |
| No video consultation | Jitsi Meet integration (opt-in, bandwidth-checked before opening) |

---

## Production Architecture

When built for production, this MVP maps to the following infrastructure:

```
Patient PWA (React, TypeScript, Vite)
    ↓
Supabase (PostgreSQL + Auth + Realtime + Edge Functions + Storage)
    ↓                           ↓                      ↓
Doctor interface          Africa's Talking       PDFShift API
(React, same backend)     (SMS delivery)         (prescription PDFs)
    ↓
Deno Edge Function — DHIS2 push pipeline
    ↓
Somalia national DHIS2 instance
(/api/tracker — Tracker program per consultation)
```

The localStorage data layer in this MVP is a direct analogue of the PostgreSQL schema. `tc_cases` maps to the `cases` table, `tc_doctors` maps to `doctors`, and so on. Migrating to a backend is a matter of replacing the `DB.*` calls with Supabase client calls.

---

*TeleCaafimaad MVP — AfyaMeet Limited — May 2026*
