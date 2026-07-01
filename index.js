let bookingCount = 1

const { Client, LocalAuth } = require('whatsapp-web.js')
const qrcode = require('qrcode-terminal')
const { saveBooking } = require('./notify')

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  }
})

const CLINIC = {
  name: 'ClinicIQ',
  phone: '+20 100 000 0000',
  services: {
    '1': { name: 'Rhinoplasty (Nose Job) 👃', duration: '3 hrs' },
    '2': { name: 'Tummy Tuck 🏃', duration: '4 hrs' },
    '3': { name: 'Facelift / Neck Lift 💆', duration: '3 hrs' },
    '4': { name: 'BBL – Brazilian Butt Lift 🍑', duration: '4 hrs' },
    '5': { name: 'Breast Lift 🎀', duration: '3 hrs' },
    '6': { name: 'Breast Reduction 🎀', duration: '4 hrs' },
    '7': { name: 'Arm Lift 💪', duration: '3 hrs' },
    '8': { name: 'Thigh Lift 🦵', duration: '4 hrs' },
  },
  slots: {
    '1': '9:00 AM',
    '2': '11:00 AM',
    '3': '1:00 PM',
    '4': '3:00 PM',
    '5': '5:00 PM',
  },
  days: {
    '1': 'Sunday',
    '2': 'Monday',
    '3': 'Tuesday',
    '4': 'Wednesday',
    '5': 'Thursday',
  }
}

const sessions = {}

function getSession(sender) {
  if (!sessions[sender]) sessions[sender] = { step: 'idle', data: {} }
  return sessions[sender]
}

function resetSession(sender) {
  sessions[sender] = { step: 'idle', data: {} }
}

const MAIN_MENU = `🏥 *ClinicIQ* — Your Smart Clinic Assistant

1️⃣ Book an Appointment
2️⃣ My Appointment
3️⃣ Services & Prices
4️⃣ Contact Us
5️⃣ Cancel Appointment

_Reply with a number_`

const SERVICES_MENU = `💉 *Choose a Service:*

1️⃣ Rhinoplasty (Nose Job)
2️⃣ Tummy Tuck
3️⃣ Facelift / Neck Lift
4️⃣ BBL – Brazilian Butt Lift
5️⃣ Breast Lift
6️⃣ Breast Reduction
7️⃣ Arm Lift
8️⃣ Thigh Lift

0️⃣ ↩️ Back`

const DAYS_MENU = `📅 *Choose a Day:*

1️⃣ Sunday
2️⃣ Monday
3️⃣ Tuesday
4️⃣ Wednesday
5️⃣ Thursday

0️⃣ ↩️ Back`

const SLOTS_MENU = `🕐 *Choose a Time:*

1️⃣ 9:00 AM
2️⃣ 11:00 AM
3️⃣ 1:00 PM
4️⃣ 3:00 PM
5️⃣ 5:00 PM

0️⃣ ↩️ Back`

const PATIENT_TYPE_MENU = `🏥 *Are you a:*

1️⃣ New Patient
2️⃣ Returning Patient

0️⃣ ↩️ Back`

const PRICES_MENU = `💰 *Services & Prices:*

👃 Rhinoplasty — 100,000 EGP
🏃 Tummy Tuck — 100,000 EGP
💆 Facelift / Neck Lift — 100,000 EGP
🍑 BBL — 125,000 EGP
🎀 Breast Lift — 50,000 EGP
🎀 Breast Reduction — 50,000 EGP
💪 Arm Lift — 75,000 EGP
🦵 Thigh Lift — 50,000 EGP

_Prices include surgeon fee + facility_

0️⃣ ↩️ Back`

const CONTACT_MENU = `📞 *Contact ClinicIQ:*

📱 WhatsApp: +20 100 000 0000
📍 Cairo, Egypt
🕐 Sun–Thu, 9AM–5PM

1️⃣ Book an Appointment
0️⃣ ↩️ Back`

function buildSummary(data) {
  return `📋 *Appointment Summary:*

👤 Name: ${data.name || '—'}
📱 Phone: ${data.phone || '—'}
💉 Service: ${data.service || '—'}
📅 Day: ${data.day || '—'}
🕐 Time: ${data.time || '—'}
🏥 Type: ${data.patientType || '—'}`
}

async function handleMessage(msg) {
  if (msg.fromMe) return
  if (msg.from.endsWith('@g.us')) return
  if (msg.from === 'status@broadcast') return
  if (msg.type !== 'chat') return

  // TESTING MODE — only respond to this number
  const ALLOWED = ['201558533440@c.us']
  if (!ALLOWED.includes(msg.from)) return

  const sender = msg.from
  const text = msg.body.trim()
  const session = getSession(sender)

  console.log(`📩 [${sender}] Step: ${session.step} | Msg: ${text}`)

  const triggers = ['hi', 'hello', 'hey', 'مرحبا', 'هاي', 'start', 'menu']
  if (triggers.includes(text.toLowerCase()) || session.step === 'idle') {
    resetSession(sender)
    sessions[sender].step = 'main_menu'
    return await msg.reply(MAIN_MENU)
  }

  if (session.step === 'main_menu') {
    switch (text) {
      case '1': session.step = 'select_service'; return await msg.reply(SERVICES_MENU)
      case '2': return await msg.reply(session.data.appointment ? buildSummary(session.data) + '\n\n0️⃣ ↩️ Back' : '❌ No upcoming appointment.\n\n0️⃣ ↩️ Back')
      case '3': session.step = 'prices'; return await msg.reply(PRICES_MENU)
      case '4': session.step = 'contact'; return await msg.reply(CONTACT_MENU)
      case '5':
        if (session.data.appointment) {
          session.data = {}
          session.step = 'main_menu'
          return await msg.reply('✅ Appointment cancelled.\n\n' + MAIN_MENU)
        }
        return await msg.reply('❌ No appointment to cancel.\n\n0️⃣ ↩️ Back')
      default: return await msg.reply('⚠️ Choose 1–5\n\n' + MAIN_MENU)
    }
  }

  if (session.step === 'prices') {
    if (text === '0') { session.step = 'main_menu'; return await msg.reply(MAIN_MENU) }
    return await msg.reply(PRICES_MENU)
  }

  if (session.step === 'contact') {
    if (text === '0') { session.step = 'main_menu'; return await msg.reply(MAIN_MENU) }
    if (text === '1') { session.step = 'select_service'; return await msg.reply(SERVICES_MENU) }
    return await msg.reply(CONTACT_MENU)
  }

  if (session.step === 'select_service') {
    if (text === '0') { session.step = 'main_menu'; return await msg.reply(MAIN_MENU) }
    if (CLINIC.services[text]) {
      session.data.service = CLINIC.services[text].name
      session.step = 'patient_type'
      return await msg.reply(PATIENT_TYPE_MENU)
    }
    return await msg.reply('⚠️ Choose 1–8\n\n' + SERVICES_MENU)
  }

  if (session.step === 'patient_type') {
    if (text === '0') { session.step = 'select_service'; return await msg.reply(SERVICES_MENU) }
    if (text === '1' || text === '2') {
      session.data.patientType = text === '1' ? 'New Patient' : 'Returning Patient'
      session.step = 'select_day'
      return await msg.reply(DAYS_MENU)
    }
    return await msg.reply('⚠️ Reply 1 or 2\n\n' + PATIENT_TYPE_MENU)
  }

  if (session.step === 'select_day') {
    if (text === '0') { session.step = 'patient_type'; return await msg.reply(PATIENT_TYPE_MENU) }
    if (CLINIC.days[text]) {
      session.data.day = CLINIC.days[text]
      session.step = 'select_time'
      return await msg.reply(SLOTS_MENU)
    }
    return await msg.reply('⚠️ Choose 1–5\n\n' + DAYS_MENU)
  }

  if (session.step === 'select_time') {
    if (text === '0') { session.step = 'select_day'; return await msg.reply(DAYS_MENU) }
    if (CLINIC.slots[text]) {
      session.data.time = CLINIC.slots[text]
      session.step = 'enter_name'
      return await msg.reply('✏️ *What is your full name?*')
    }
    return await msg.reply('⚠️ Choose 1–5\n\n' + SLOTS_MENU)
  }

  if (session.step === 'enter_name') {
    const nameValid = /^[a-zA-Z\u0600-\u06FF\s]{3,50}$/.test(text)
    if (!nameValid) {
      return await msg.reply('⚠️ Please enter a valid full name (letters only, 3–50 characters)')
    }
    session.data.name = text.trim()
    session.step = 'enter_phone'
    return await msg.reply('📱 *Your phone number?*\n_(for appointment confirmation)_')
  }

  if (session.step === 'enter_phone') {
    const phone = text.replace(/\s+/g, '').replace(/^00/, '+')
    const egyptPhone = /^(\+20|0)(10|11|12|15)\d{8}$/
    if (!egyptPhone.test(phone)) {
      return await msg.reply('⚠️ Please enter a valid Egyptian number\nExample: 01012345678 or +201012345678')
    }
    session.data.phone = phone.startsWith('0') ? '+2' + phone : phone
    session.step = 'confirm'
    return await msg.reply(buildSummary(session.data) + `

1️⃣ ✅ Confirm
2️⃣ 🔄 Start Over
0️⃣ ↩️ Back`)
  }

  if (session.step === 'confirm') {
    if (text === '0') { session.step = 'main_menu'; return await msg.reply(MAIN_MENU) }
    if (text === '2') { resetSession(sender); sessions[sender].step = 'main_menu'; return await msg.reply(MAIN_MENU) }
    if (text === '1') {
      session.data.appointment = true
      session.data.bookedAt = new Date().toLocaleString('en-EG')
      session.step = 'main_menu'

      console.log(`\n✅ NEW BOOKING`)
      console.log(`   Name:    ${session.data.name}`)
      console.log(`   Phone:   ${session.data.phone}`)
      console.log(`   Service: ${session.data.service}`)
      console.log(`   Day:     ${session.data.day}`)
      console.log(`   Time:    ${session.data.time}`)
      console.log(`   Type:    ${session.data.patientType}`)
      console.log(`   At:      ${session.data.bookedAt}\n`)

      await saveBooking(session.data, bookingCount++)

      return await msg.reply(`🎉 *Booking Confirmed!*

${buildSummary(session.data)}

See you on *${session.data.day}* at *${session.data.time}* 🏥
Type *menu* anytime to manage your appointment.

— ClinicIQ Team`)
    }
    return await msg.reply('⚠️ Reply 1 to confirm or 2 to start over')
  }

  return
}

client.on('qr', (qr) => {
  console.log('\n📱 Scan QR code:\n')
  qrcode.generate(qr, { small: true })
})

client.on('ready', () => console.log('✅ ClinicIQ is live!'))

client.on('disconnected', (reason) => {
  console.log('⚠️ Disconnected:', reason)
  setTimeout(() => client.initialize(), 5000)
})

client.on('auth_failure', () => {
  console.log('❌ Auth failed — restarting...')
  setTimeout(() => client.initialize(), 5000)
})

client.on('message', async (msg) => {
  if (msg.fromMe) return
  try { await handleMessage(msg) }
  catch (err) { console.error('Error:', err) }
})

client.initialize()