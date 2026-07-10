const fs = require('fs')
const COUNTER_FILE = './bookingCount.json'
const SESSIONS_FILE = './sessions.json'


function getBookingCount() {
  if (fs.existsSync(COUNTER_FILE)) {
    return JSON.parse(fs.readFileSync(COUNTER_FILE)).count
  }
  return 1
}

function incrementBookingCount() {
  const count = getBookingCount()
  fs.writeFileSync(COUNTER_FILE, JSON.stringify({ count: count + 1 }))
  return count
}

function loadSessions() {
  if (fs.existsSync(SESSIONS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(SESSIONS_FILE))
    } catch (err) {
      console.error('⚠️ Could not read sessions.json, starting fresh:', err.message)
      return {}
    }
  }
  return {}
}

function saveSessions() {
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions))
}

const { Client, LocalAuth } = require('whatsapp-web.js')
const qrcode = require('qrcode-terminal')
const { saveBooking, checkSlot, cancelBooking } = require('./notify')
const { parsePhoneNumberFromString } = require('libphonenumber-js')
const processedMessageIds = new Set()
const MAX_PROCESSED_IDS = 500

function isDuplicateMessage(msg) {
  const id = msg.id?._serialized || msg.id
  if (!id) return false
  if (processedMessageIds.has(id)) return true
  processedMessageIds.add(id)
  if (processedMessageIds.size > MAX_PROCESSED_IDS) {
    const oldest = processedMessageIds.values().next().value
    processedMessageIds.delete(oldest)
  }
  return false
}
const lastReplyTime = {}
const RATE_LIMIT_MS = 3000

function isRateLimited(sender) {
  const now = Date.now()
  const last = lastReplyTime[sender] || 0
  if (now - last < RATE_LIMIT_MS) return true
  lastReplyTime[sender] = now
  return false
}

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
    '1': '09:00',
    '2': '11:00',
    '3': '13:00',
    '4': '15:00',
    '5': '17:00',
  },
  days: {
    '1': 'Sunday',
    '2': 'Monday',
    '3': 'Tuesday',
    '4': 'Wednesday',
    '5': 'Thursday',
  }
}

const sessions = loadSessions()

function getSession(sender) {
  if (!sessions[sender]) {
    sessions[sender] = { step: 'idle', data: {} }
  }
  return sessions[sender]
}

function resetSession(sender) {
  const existingAppointment = sessions[sender]?.data?.appointment
    ? { ...sessions[sender].data }
    : {}
  sessions[sender] = { step: 'idle', data: existingAppointment }
}

const MAIN_MENU = `🏥 *MeroSculp* — Appointment Assistant | مساعد الحجز

1️⃣ Book an Appointment | حجز موعد
2️⃣ My Appointment | موعدي
3️⃣ Services | الخدمات
4️⃣ Contact Us | تواصل معنا
5️⃣ Cancel Appointment | إلغاء الموعد
6️⃣ Common Questions | الأسئلة الشائعة

_Reply with a number | اختر رقم من القائمة_`

const SERVICES_MENU = `💉 *Choose a Service* | *اختر الخدمة*

1️⃣ Rhinoplasty (Nose Job) | تجميل الأنف
2️⃣ Tummy Tuck | شد البطن
3️⃣ Facelift / Neck Lift | شد الوجه والرقبة
4️⃣ BBL – Brazilian Butt Lift | شد وتكبير الأرداف
5️⃣ Breast Lift | شد الثدي
6️⃣ Breast Reduction | تصغير الثدي
7️⃣ Arm Lift | شد الذراعين
8️⃣ Thigh Lift | شد الفخذين

0️⃣ Back | رجوع`

const DAYS_MENU = `📅 *Choose a Day* | *اختر اليوم*

1️⃣ Sunday | الأحد
2️⃣ Monday | الإثنين
3️⃣ Tuesday | الثلاثاء
4️⃣ Wednesday | الأربعاء
5️⃣ Thursday | الخميس

0️⃣ Back | رجوع`

const SLOTS_MENU = `🕐 *Choose a Time* | *اختر الوقت*

1️⃣ 9:00 AM | ٩:٠٠ ص
2️⃣ 11:00 AM | ١١:٠٠ ص
3️⃣ 1:00 PM | ١:٠٠ م
4️⃣ 3:00 PM | ٣:٠٠ م
5️⃣ 5:00 PM | ٥:٠٠ م

0️⃣ Back | رجوع`

const PATIENT_TYPE_MENU = `🏥 *Are you a* | *هل أنت*

1️⃣ New Patient | مريض جديد
2️⃣ Returning Patient | مريض عائد

0️⃣ Back | رجوع`

const SERVICES_INFO_MENU = `💉 *ما نقدمه في MeroSculp*

في MeroSculp، يقدم الدكتور خدمات تجميلية متخصصة بأحدث التقنيات وأعلى معايير السلامة، مع متابعة كاملة قبل وبعد العملية.

👃 *تجميل الأنف* — تعديل شكل الأنف لتحسين التناسق مع ملامح الوجه
🏃 *شد البطن* — إزالة الجلد الزائد وشد عضلات البطن
💆 *شد الوجه والرقبة* — تقليل علامات التقدم في السن وإعادة الشباب للملامح
🍑 *شد وتكبير الأرداف* — إعادة تشكيل الجسم عبر نقل الدهون
🎀 *شد الثدي* — رفع وتحسين شكل الثدي
🎀 *تصغير الثدي* — تقليل الحجم لراحة أكبر وتناسق أفضل
💪 *شد الذراعين* — إزالة الترهلات وشد الجلد
🦵 *شد الفخذين* — تحسين شكل ومظهر الفخذين

_للأسعار والتفاصيل، تواصل معنا مباشرة_

0️⃣ رجوع`

const CONTACT_MENU = `📞 *Contact MeroSculp* | *تواصل مع ميروسكلب*

📱 WhatsApp: +20 103 117 7998
📍 New Cairo | القاهرة الجديدة
🕐 Sun–Thu, 9AM–5PM | الأحد–الخميس، ٩ص–٥م

1️⃣ Book an Appointment | حجز موعد
0️⃣ Back | رجوع`

function buildSummary(data) {
  return `📋 *Appointment Summary* | *ملخص الموعد*

👤 Name | الاسم: ${data.name || '—'}
📱 Phone | الهاتف: ${data.phone || '—'}
💉 Service | الخدمة: ${data.service || '—'}
📅 Day | اليوم: ${data.day || '—'}
🕐 Time | الوقت: ${data.time || '—'}
🏥 Type | النوع: ${data.patientType || '—'}`
}

async function handleMessage(msg) {
  try {
    await handleMessageInner(msg)
  } finally {
    saveSessions()
  }
}

async function handleMessageInner(msg) {
  if (msg.fromMe) return
  if (msg.from.endsWith('@g.us')) return
  if (msg.from === 'status@broadcast') return
  if (msg.type !== 'chat') return
  //console.log('📞 Incoming from:', msg.from)

  // TESTING MODE — only respond to this number
  // const ALLOWED = ['201558533440@c.us', '214830002753718@lid', '966594544343@c.us']
  // if (!ALLOWED.includes(msg.from)) return

  if (isRateLimited(msg.from)) {          // ← add this
    console.log(`🚦 Rate-limited: ${msg.from}`)
    return
  }

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
      case '1':
        if (session.data.appointment) {
          return await msg.reply(`⚠️ You already have a booking | لديك حجز :\n\n${buildSummary(session.data)}\n\nCancel it first before booking again (option 5) | يرجى إلغاء الحجز الحالي قبل حجز موعد جديد (خيار ٥)`)
        }
        session.step = 'select_service'
        return await msg.reply(SERVICES_MENU)
      case '2':
        return await msg.reply(session.data.appointment ? buildSummary(session.data) + '\n\n0️⃣ Back | رجوع' : '❌ No upcoming appointment | لا يوجد موعد حالي\n\n0️⃣ Back | رجوع')
      case '3':
        session.step = 'prices'
        return await msg.reply(SERVICES_INFO_MENU)
      case '4':
        session.step = 'contact'
        return await msg.reply(CONTACT_MENU)
      case '5':
        if (session.data.appointment) {
          session.step = 'cancel_confirm'
          return await msg.reply(`⚠️ Are you sure you want to cancel your appointment? | هل أنت متأكد من إلغاء الموعد؟\n\n📅 *${session.data.day}* at *${session.data.time}*\n💉 ${session.data.service}\n\n1️⃣ Yes, cancel it | نعم، إلغاء\n2️⃣ No, keep it | لا، الاحتفاظ به`)
        }
        return await msg.reply('❌ No appointment to cancel | لا يوجد موعد لإلغائه\n\n0️⃣ Back | رجوع')
      default:
        return await msg.reply('⚠️ Choose 1–5 | اختر رقم من ١ إلى ٥\n\n' + MAIN_MENU)
    }
  }
if (session.step === 'cancel_confirm') {
    if (text === '1') {
      if (session.data.rowNumber) {
        await cancelBooking(session.data.rowNumber)
      }
      session.data = {}
      session.step = 'main_menu'
      return await msg.reply('✅ Your appointment has been cancelled | تم إلغاء موعدك\n\n' + MAIN_MENU)
    }
    if (text === '2') {
      session.step = 'main_menu'
      return await msg.reply('👍 Your appointment is kept | تم الاحتفاظ بموعدك\n\n' + MAIN_MENU)
    }
    return await msg.reply('⚠️ Reply 1 to cancel or 2 to keep your appointment | الرجاء الرد بـ ١ للإلغاء أو ٢ للاحتفاظ بالموعد')
  }

  if (session.step === 'prices') {
    if (text === '0') { session.step = 'main_menu'; return await msg.reply(MAIN_MENU) }
    return await msg.reply(SERVICES_INFO_MENU)
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
  return await msg.reply('⚠️ Choose 1–8 | اختر رقم من ١ إلى ٨\n\n' + SERVICES_MENU)  }

  if (session.step === 'patient_type') {
    if (text === '0') { session.step = 'select_service'; return await msg.reply(SERVICES_MENU) }
    if (text === '1' || text === '2') {
      session.data.patientType = text === '1' ? 'New Patient' : 'Returning Patient'
      session.step = 'select_day'
      return await msg.reply(DAYS_MENU)
    }
    return await msg.reply('⚠️ Reply 1 or 2 | الرجاء الرد بـ ١ أو ٢\n\n' + PATIENT_TYPE_MENU)
  }

  if (session.step === 'select_day') {
    if (text === '0') 
      { session.step = 'patient_type'; 
      return await msg.reply('⚠️ Reply 1 or 2 | الرجاء الرد بـ ١ أو ٢\n\n' + PATIENT_TYPE_MENU)
    }
    if (CLINIC.days[text]) {
      session.data.day = CLINIC.days[text]
      session.step = 'select_time'
      return await msg.reply(SLOTS_MENU)
    }
    return await msg.reply('⚠️ Choose 1–5 | اختر رقم من ١ إلى ٥\n\n' + DAYS_MENU)
  }

  if (session.step === 'select_time') {
    if (text === '0') { session.step = 'select_day'; return await msg.reply(DAYS_MENU) }
    if (CLINIC.slots[text]) {
      session.data.time = CLINIC.slots[text]

      // Check for clashes before proceeding
      const available = await checkSlot(session.data.day, session.data.time)
      if (!available) {
        return await msg.reply(`❌ Sorry, *${session.data.day}* at *${session.data.time}* is already booked | عذراً، هذا الموعد محجوز \n\nPlease choose another time | يرجى اختيار وقت آخر:\n\n` + SLOTS_MENU)
      }

      session.step = 'enter_name'
      return await msg.reply('✏️ *What is your full name?* | *ما هو اسمك الكامل؟*')
    }
    return await msg.reply('⚠️ Choose 1–5 | اختر رقم من ١ إلى ٥\n\n' + SLOTS_MENU)
  }

  if (session.step === 'enter_name') {
    const nameValid = /^[a-zA-Z\u0600-\u06FF\s]{3,50}$/.test(text)
    if (!nameValid) {
      return await msg.reply('⚠️ Please enter a valid full name (letters only, 3–50 characters) | الرجاء إدخال اسم صحيح (حروف فقط، ٣-٥٠ حرف)')
    }
    session.data.name = text.trim()
    session.step = 'enter_phone'
    return await msg.reply('📱 *Your phone number?* | *رقم هاتفك؟*\n_(for appointment confirmation | لتأكيد الموعد)_')
  }

  if (session.step === 'enter_phone') {
    if (text === '0') { session.step = 'enter_name'; return await msg.reply('✏️ *What is your full name?* | *ما هو اسمك الكامل؟*') }

    const phoneNumber = parsePhoneNumberFromString(text, 'EG') // defaults to Egypt if no + given

    if (!phoneNumber || !phoneNumber.isValid()) {
      return await msg.reply('⚠️ Please enter a valid phone number with country code | الرجاء إدخال رقم هاتف صحيح مع رمز الدولة\nExample | مثال: +201012345678 (Egypt), +966501234567 (Saudi), +971501234567 (UAE)')
    }

    session.data.phone = phoneNumber.number
    session.step = 'confirm'
    return await msg.reply(buildSummary(session.data) + `

1️⃣ Confirm | تأكيد
2️⃣ Start Over | البدء من جديد
0️⃣ Back | رجوع`)
  }

  if (session.step === 'confirm') {
    if (text === '0') { 
      session.step = 'main_menu'; 
      return await msg.reply(MAIN_MENU) 
    }
    if (text === '2') { 
      resetSession(sender); 
      sessions[sender].step = 'main_menu'; 
      return await msg.reply(MAIN_MENU) 
    }
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

      const rowNumber = incrementBookingCount()
      session.data.rowNumber = rowNumber
      const success = await saveBooking(session.data, rowNumber)

      if (!success) {
        return await msg.reply(`⚠️ Something went wrong saving your booking. Please try again or contact us directly.\n\n${CONTACT_MENU}`)
      }

      return await msg.reply(`🎉 *Booking Confirmed!* | *تم تأكيد الحجز!*

${buildSummary(session.data)}

See you on *${session.data.day}* at *${session.data.time}* | نراك يوم *${session.data.day}* الساعة *${session.data.time}* 🏥
Type *menu* anytime to manage your appointment | اكتب *menu* في أي وقت لإدارة موعدك

— MeroSculp Team`)

    }
    return await msg.reply('⚠️ Reply 1 to confirm or 2 to start over | الرجاء الرد بـ ١ للتأكيد أو ٢ للبدء من جديد')
  }

  const numberSteps = ['main_menu', 'select_service', 'patient_type', 'select_day', 'select_time', 'confirm', 'prices', 'contact', 'cancel_confirm']
  if (numberSteps.includes(session.step)) {
    if (numberSteps.includes(session.step)) {
    return await msg.reply('⚠️ Please reply with a number from the menu above | الرجاء الرد برقم من القائمة أعلاه')
  }
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
  if (isDuplicateMessage(msg)) {
    console.log('⏭️ Skipped duplicate message:', msg.id?._serialized)
    return
  }
  try { await handleMessage(msg) }
  catch (err) { console.error('Error:', err) }
})

client.initialize()