# ClinicIQ

**An end-to-end clinic operations pipeline** — patient intake, appointment orchestration, structured data storage, and a live analytics dashboard — built and running in production for **MeroSculp Clinic**, a cosmetic surgery clinic in Cairo.

No manual booking. No missed follow-ups. Every patient interaction becomes structured data the moment it happens.

---

## The problem

A clinic running on phone calls and unstructured WhatsApp threads has two failures baked in: bookings get lost or double-handled, and none of that interaction data is usable for anything afterward. There's no way to see demand by service, drop-off points, or no-show patterns if the "system" is a front desk and a notebook.

ClinicIQ replaces that with a pipeline: intake → storage → analytics, all running without a human in the loop.

## System overview

```
Patient (WhatsApp)
        │
        ▼
┌─────────────────────────┐
│  Intake bot              │  whatsapp-web.js — guided booking
│  (Node.js)                │  conversation, session state,
│                            │  validation and conflict checks
└───────────┬───────────────┘
            │ booking event
            ▼
┌─────────────────────────┐
│  Data layer                │  Google Sheets API directly
│  Sheets + database         │  integrated via Service Account
│                            │  (ops-facing, staff-editable)
└───────────┬───────────────┘
            │
            ▼
┌─────────────────────────┐
│  Dashboard                 │  live view: bookings over time,
│                            │  service demand, no-show rate,
│                            │  funnel drop-off by step
└─────────────────────────┘
```

Deployed on Railway for 24/7 uptime, with automatic reconnect on the intake layer.

## What each layer does

**Intake (Node.js + whatsapp-web.js)**
A patient messages the clinic's number and is walked through a structured booking flow — service, day, time, patient type, name, phone — with validation at every step (Egyptian phone formats, name formats, etc.). Session state is tracked per-sender so multiple patients can be mid-booking simultaneously.

**Storage (Google Sheets API)**
Once a booking is confirmed, Node.js directly handles the operational side, updating a live Google Sheet using a Service Account. Bookings land directly into the Google Sheet because that's the interface clinic staff already know and can act on directly. Structured data — service requested, day/time, new vs. returning, booking timestamp, and drop-off point for sessions that don't complete — not just message logs. 

**Dashboard**
A live view over the data: bookings per week, service demand, no-show rate, and where in the booking flow patients abandon the process. That last metric is the one that actually changes clinic decisions — it shows exactly which step of the flow is losing patients.

## Why it's structured this way (not LLM-based intake)

The booking flow is a deterministic menu system, not free-text NLU. That's a deliberate choice: for a booking flow where a misread request means a wrong surgical appointment, a constrained input surface is more reliable than open-ended language understanding. Free-text intent parsing is on the roadmap as an additive layer on top of this flow, not a replacement for it.

## Tech stack

| Layer | Tech |
|---|---|
| Intake / messaging | Node.js, whatsapp-web.js |
| Data Layer | Google Sheets API, google-spreadsheet |
| Dashboard | Live analytics |
| Hosting | Railway + VPS (Hetzner CX-tier) running under PM2 |

## Roadmap

- Instagram DM as a second intake channel, same pipeline
- Free-text intent parsing layered on top of the guided flow
- Predictive slot demand — using historical booking data to flag high-demand windows before they fill

## Status

Live in production at MeroSculp Clinic. Real patients, real bookings, real operational dashboard — not a portfolio simulation. Designed, built, and maintained end-to-end by me.

---

**Eyad Nada** — an aspiring Data Scientist and AI Engineer, GIU Cairo. Building real automation and data systems for real businesses.
[GitHub](https://github.com/EyadNada) · Open to internships and freelance work in data/AI engineering.
