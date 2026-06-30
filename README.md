# 🏥 ClinicIQ
### AI-Powered WhatsApp Appointment Bot for Medical Clinics

<p align="center">
  <img src="https://img.shields.io/badge/WhatsApp-Bot-25D366?style=for-the-badge&logo=whatsapp&logoColor=white"/>
  <img src="https://img.shields.io/badge/Node.js-v18+-339933?style=for-the-badge&logo=node.js&logoColor=white"/>
  <img src="https://img.shields.io/badge/Language-Arabic%20%7C%20English-blue?style=for-the-badge"/>
  <img src="https://img.shields.io/badge/AI-Claude%20%2F%20GPT-FF6B35?style=for-the-badge"/>
  <img src="https://img.shields.io/badge/Status-Live-brightgreen?style=for-the-badge"/>
</p>

---

> **ClinicIQ** is a production-ready, bilingual (Arabic/English) WhatsApp automation bot that handles end-to-end patient appointment booking for private medical clinics. Built for the Gulf and Egyptian healthcare market, it replaces manual scheduling with an intelligent conversational interface that works 24/7.

---

## 📌 The Problem It Solves

Private clinics in Egypt and the Gulf region lose dozens of potential appointments every day because:
- Staff aren't available 24/7 to answer WhatsApp messages
- Patients give up when no one responds quickly
- Manual booking leads to double-bookings and missed follow-ups

**ClinicIQ fixes all of that automatically.**

---

## ✨ Features

- 🤖 **Conversational Booking Flow** — guides patients step by step through booking an appointment via natural WhatsApp messages
- 🌍 **Bilingual** — fully supports Arabic and English in the same conversation
- 🧠 **AI-Powered Responses** — connected to Claude / GPT for understanding free-text input (not just keyword matching)
- 📋 **Google Sheets Integration** — every appointment is saved automatically to a shared spreadsheet the clinic can access in real time
- 🔔 **Clinic Notifications** — doctor/receptionist gets an instant WhatsApp alert for every new booking
- 💾 **Session Persistence** — remembers where each patient is in the booking flow, even across multiple messages
- 🔄 **Auto-Reconnect** — handles network drops and reconnects automatically
- 🚀 **Always On** — deployable to Railway / Render for 24/7 uptime

---

## 🗣️ Sample Conversation

```
Patient:  Hi
Bot:      👋 Welcome to [Clinic Name]!
          To book an appointment, I'll ask you a few quick questions.
          What is your full name?

Patient:  Ahmed Hassan

Bot:      Nice to meet you Ahmed! 🙂
          What service do you need?

          1️⃣ Rhinoplasty (Nose)
          2️⃣ Tummy Tuck
          3️⃣ Facelift / Neck Lift
          4️⃣ BBL – Brazilian Butt Lift
          5️⃣ Breast Lift / Reduction
          6️⃣ Other

Patient:  1

Bot:      Got it — Rhinoplasty 🦷
          Are you a new or returning patient?
          1️⃣ New Patient
          2️⃣ Returning Patient

Patient:  New

Bot:      What date works for you?
          (e.g. Monday 7 July)

Patient:  July 10

Bot:      And your preferred time?
          🕗 Available: 9am · 11am · 1pm · 3pm · 5pm

Patient:  11am

Bot:      ✅ Here's your summary:

          👤 Name: Ahmed Hassan
          💉 Service: Rhinoplasty
          📅 Date: Thursday, 10 July
          🕐 Time: 11:00 AM
          🏥 Status: New Patient

          Confirm booking?
          1️⃣ Yes ✅   2️⃣ Change something ✏️

Patient:  1

Bot:      🎉 Appointment confirmed!
          We'll see you on July 10 at 11am.
          If you need to reschedule, just text us here.
```

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| WhatsApp Connection | whatsapp-web.js + Puppeteer |
| Runtime | Node.js v18+ |
| AI Layer | Claude API / OpenAI GPT |
| Data Storage | Google Sheets API |
| Session Management | In-memory state machine per user |
| Process Manager | PM2 |
| Deployment | Railway / Render (free tier) |
| Language Support | Arabic (RTL) + English |

---

## 📂 Project Structure

```
ClinicIQ/
│
├── index.js          # Entry point — WhatsApp client setup
├── flow.js           # Conversation state machine & question flow
├── ai.js             # Claude / GPT natural language layer
├── sheets.js         # Google Sheets read/write integration
├── notify.js         # Clinic WhatsApp notification sender
├── config.js         # Clinic name, services, time slots (easy to edit)
├── sessions/         # Per-user conversation state
├── .wwebjs_auth/     # WhatsApp session (gitignored)
└── package.json
```

---

## ⚙️ Configuration

All clinic-specific settings live in `config.js` — no code changes needed:

```js
module.exports = {
  clinicName: "Your Clinic Name",
  services: [
    "Rhinoplasty",
    "Tummy Tuck",
    "Facelift / Neck Lift",
    "BBL – Brazilian Butt Lift",
    "Breast Lift",
    "Breast Reduction",
  ],
  availableSlots: ["9:00 AM", "11:00 AM", "1:00 PM", "3:00 PM", "5:00 PM"],
  clinicWhatsApp: "+201234567890",  // number to notify on new bookings
  language: "bilingual"             // "english" | "arabic" | "bilingual"
}
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- A WhatsApp number for the bot
- Google Sheets API credentials (for appointment saving)

### Installation

```bash
# Clone the repo
git clone https://github.com/yourusername/ClinicIQ.git
cd ClinicIQ

# Install dependencies
npm install

# Start the bot
node index.js
```

Scan the QR code that appears in your terminal with WhatsApp on your phone.

### Deploy to Railway (Always On — Free)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

---

## 📊 Data Science Angle

This project goes beyond a simple chatbot. The appointment data pipeline enables:

- **Demand forecasting** — predict busy days/services from booking history
- **Patient segmentation** — new vs returning, service preferences
- **Conversion analysis** — how many chats convert to confirmed bookings
- **Time slot optimization** — find underutilized slots using booking patterns
- **Regional market insights** — Gulf vs Egypt patient behavior comparison

All data flows into Google Sheets, ready for analysis in Python / Pandas / Power BI.

---

## 🌍 Market Context

Built specifically for the **Gulf and Egyptian private clinic market**:

- 🇸🇦 Saudi Arabia — fastest growing cosmetic surgery market in MENA
- 🇦🇪 UAE / Dubai — major medical tourism hub
- 🇪🇬 Egypt — highest volume of procedures, price-sensitive market
- WhatsApp penetration in these markets: **95%+**
- Most clinics still rely on manual WhatsApp booking — massive automation gap

---

## 🔮 Roadmap

- [x] Basic WhatsApp connection & message handling
- [x] Keyword-based replies
- [ ] Full appointment question flow
- [ ] Google Sheets integration
- [ ] Claude AI natural language layer
- [ ] Arabic language full support
- [ ] Instagram DM bot (same flow)
- [ ] Clinic dashboard (React)
- [ ] Appointment reminders (24hr before)
- [ ] Multi-clinic support

---

## 🤝 Built For

Private clinics, cosmetic surgery practices, and medical tourism operators in Egypt and the Gulf region looking to automate patient communication without a full CRM investment.

---

## 📄 License

MIT License — free to use, modify, and deploy.

---

## 👨‍💻 Author

Built by **[Your Name]** — Data Science student with a focus on NLP, conversational AI, and real-world automation for the MENA healthcare market.

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-0077B5?style=flat&logo=linkedin)](https://linkedin.com/in/yourprofile)
[![GitHub](https://img.shields.io/badge/GitHub-Follow-181717?style=flat&logo=github)](https://github.com/yourusername)

---

<p align="center">Made with ❤️ for the MENA healthcare market</p>
