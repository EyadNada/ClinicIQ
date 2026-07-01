# ClinicIQ

A WhatsApp booking assistant running in production for **MeroSculp Clinic**, a cosmetic surgery clinic in Cairo. Patients book appointments entirely inside a WhatsApp chat — no app, no call, no front-desk bottleneck.

Built and maintained solo, from first line of code to the version currently handling live patient bookings.

---

## Why this exists

Before ClinicIQ, every appointment request at the clinic went through a phone call or a manually-tracked WhatsApp thread. That doesn't scale past a handful of patients a day, and it falls apart entirely outside business hours. ClinicIQ replaces that with a structured conversation flow: a patient messages the clinic's WhatsApp number, works through a menu-driven booking process, and the appointment is written straight to the clinic's Google Sheet — no staff involvement required.

This isn't a demo. It's the system MeroSculp Clinic uses today to take real bookings from real patients.

## What it does

- **Guided booking flow** — service selection, day, time slot, new vs. returning patient, name and phone capture, with validation at every step (Egyptian phone number format, name format, etc.)
- **Session-based conversations** — each patient's progress through the flow is tracked independently, so multiple people can be mid-booking at once without state bleeding between them
- **Appointment management** — patients can view their upcoming appointment or cancel it by texting the clinic back
- **Services & pricing menu** — always-current price list served directly in-chat
- **Google Sheets as the source of truth** — every confirmed booking is appended to a live sheet (patient name, phone, service, day, time, patient type, timestamp, status), which the clinic staff already knew how to use
- **Bilingual entry points** — recognizes both English and Arabic greetings to start a session
- **Auto-reconnect** — recovers from WhatsApp Web disconnects and auth failures without manual intervention

## What it deliberately isn't (yet)

To be upfront: this is a **deterministic, menu-driven flow**, not an LLM-based conversational agent. A patient replies with numbers, not free text like "I want a nose job next Tuesday." That's a design choice, not a limitation I'm hiding — for a clinic booking flow where mistakes mean a wrong appointment, a constrained input surface is more reliable than open-ended NLU. The roadmap below is where that changes.

## Architecture

```
Patient's WhatsApp
        │
        ▼
whatsapp-web.js (Puppeteer-driven WhatsApp Web client)
        │
        ▼
index.js — session state machine (per-sender step tracking)
        │
        ▼
sheets.js — Google Sheets API (googleapis)
        │
        ▼
Live appointments sheet (clinic staff's operational view)
```

Deployed on Railway for 24/7 uptime, with automatic reinitialization on disconnect.

## Tech stack

| Layer | Choice |
|---|---|
| Runtime | Node.js |
| Messaging | [whatsapp-web.js](https://wwebjs.dev/) |
| Data store | Google Sheets API (`googleapis`) |
| Hosting | Railway |
| Session state | In-memory, keyed by sender |

## Data captured

Every booking generates structured data, not just a message thread: service requested, day/time preference, new vs. returning patient, and where in the flow a session was abandoned if it doesn't complete. That last part matters — drop-off point is exactly the kind of signal that turns into a real analysis: which step loses patients, which services get the most inquiries vs. actual bookings, and where slot demand clusters. That's the dataset the roadmap below builds on.

## Roadmap

- **n8n integration** — moving notification/reminder logic (booking confirmations, day-before reminders, no-show follow-ups) out of the Node process and into n8n workflows, so the clinic's ops logic is visual, editable, and not gated behind a code deploy
- **Lightweight clinic dashboard** — a simple view over the Sheets data: bookings per week, service demand, no-show rate
- **Instagram DM support** — same booking flow, second channel
- **Free-text intent parsing** — layering NLU on top of the current flow for patients who don't want to navigate menus, while keeping the structured flow as a fallback

## Setup

```bash
git clone https://github.com/EyadNada/ClinicIQ.git
cd ClinicIQ
npm install
```

You'll need:
1. A Google Cloud service account with Sheets API access — save the credentials as `credentials.json` in the project root (not committed, see `.gitignore`)
2. A target spreadsheet ID, set in `sheets.js`
3. Run `npm start` and scan the printed QR code with the WhatsApp account you want the bot to run on

## Status

In active, unpaid-downtime use at MeroSculp Clinic. Built and maintained by me — no team, no framework doing the heavy lifting, just a clinic that needed its booking process to stop depending on someone being at a desk to answer the phone.

---

**Eyad Nada** — Data Science student, GIU Cairo. Building small, real systems for real businesses.
[GitHub](https://github.com/EyadNada) · Open to internships and freelance work in data/AI engineering.
