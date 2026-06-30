ClinicIQ

WhatsApp appointment bot currently running in production at MeroSculp Clinic — a private cosmetic surgery clinic serving patients across Egypt and the Gulf.

Patients text the clinic, the bot handles the entire booking conversation, and the appointment lands in the clinic's system. No staff needed. No missed messages.


Real usage


Live at MeroSculp Clinic
Handles inbound patient bookings 24/7
Bilingual — Arabic and English in the same conversation
Used by real patients booking real appointments



What it does

A patient texts the clinic's WhatsApp number. The bot takes it from there — understands what they want, walks them through the booking, confirms the appointment, and notifies the clinic. The whole thing happens in a normal WhatsApp conversation. No app to download, no form to fill out, no waiting for a human to respond.


Stack


Node.js
whatsapp-web.js
Google Sheets (appointment storage)
Deployable to Railway / Render for 24/7 uptime



Why it matters (data side)

Every conversation generates structured data — service requested, time preferences, new vs returning patient, drop-off point in the flow. That feeds directly into a sheet ready for analysis. Demand forecasting, conversion tracking, slot optimization — all possible from the data this bot passively collects.


Status

In active use. Roadmap includes Instagram DM support and a lightweight clinic dashboard.


Built by Eyad — Ai Engineer and Data Scientist.
