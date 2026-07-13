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
      console.error(' could not read sessions.json, starting fresh:', err.message)
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
const lastMessage = {}
const RATE_LIMIT_MS = 1500

function isRateLimited(sender, text) {
  const now = Date.now()
  const last = lastMessage[sender]
  if (last && last.text === text && (now - last.time) < RATE_LIMIT_MS) {
    return true
  }
  lastMessage[sender] = { text, time: now }
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
    '1': { name: 'Rhinoplasty (Nose Job) ', duration: '3 hrs' },
    '2': { name: 'Tummy Tuck ', duration: '4 hrs' },
    '3': { name: 'Facelift / Neck Lift ', duration: '3 hrs' },
    '4': { name: 'BBL – Brazilian Butt Lift ', duration: '4 hrs' },
    '5': { name: 'Breast Lift ', duration: '3 hrs' },
    '6': { name: 'Breast Reduction ', duration: '4 hrs' },
    '7': { name: 'Arm Lift ', duration: '3 hrs' },
    '8': { name: 'Thigh Lift ', duration: '4 hrs' },
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

const MAIN_MENU = `🏥 *MeroSculp* — مساعد الحجز

1️⃣ حجز موعد
2️⃣ موعدي
3️⃣ الخدمات
4️⃣ تواصل معنا
5️⃣ إلغاء الموعد

_اختر رقم من القائمة_`

const SERVICES_MENU = `💉 *اختر الخدمة*

1️⃣ تجميل الأنف
2️⃣ شد البطن
3️⃣ شد الوجه والرقبة
4️⃣ شد وتكبير الأرداف
5️⃣ شد الثدي
6️⃣ تصغير الثدي
7️⃣ شد الذراعين
8️⃣ شد الفخذين

0️⃣ رجوع`

const DAYS_MENU = `📅 *اختر اليوم*

1️⃣ الأحد
2️⃣ الإثنين
3️⃣ الثلاثاء
4️⃣ الأربعاء
5️⃣ الخميس

0️⃣ رجوع`

const SLOTS_MENU = `🕐 *اختر الوقت*

1️⃣ ٩:٠٠ ص
2️⃣ ١١:٠٠ ص
3️⃣ ١:٠٠ م
4️⃣ ٣:٠٠ م
5️⃣ ٥:٠٠ م

0️⃣ رجوع`

const PATIENT_TYPE_MENU = `🏥 *هل أنت*

1️⃣ مريض جديد
2️⃣ مريض عائد

0️⃣ رجوع`

const SERVICES_INFO_MENU = `💉 *ما نقدمه في MeroSculp*

في MeroSculp، يقدم الدكتور خدمات تجميلية متخصصة بأحدث التقنيات وأعلى معايير السلامة، مع متابعة كاملة قبل وبعد العملية.

 *تجميل الأنف* — تعديل شكل الأنف لتحسين التناسق مع ملامح الوجه
 *شد البطن* — إزالة الجلد الزائد وشد عضلات البطن
 *شد الوجه والرقبة* — تقليل علامات التقدم في السن وإعادة الشباب للملامح
 *شد وتكبير الأرداف* — إعادة تشكيل الجسم عبر نقل الدهون
 *شد الثدي* — رفع وتحسين شكل الثدي
 *تصغير الثدي* — تقليل الحجم لراحة أكبر وتناسق أفضل
 *شد الذراعين* — إزالة الترهلات وشد الجلد
 *شد الفخذين* — تحسين شكل ومظهر الفخذين

_للأسعار والتفاصيل، تواصل معنا مباشرة_

0️⃣ رجوع`

const CONTACT_MENU = `📞 *تواصل مع ميروسكلب*

📱 WhatsApp: +20 103 117 7998
📍 القاهرة الجديدة
🕐 الأحد–الخميس، ٩ص–٥م

1️⃣ حجز موعد
0️⃣ رجوع`

function buildSummary(data) {
  return `📋 *ملخص الموعد*

👤 الاسم: ${data.name || '—'}
📱 الهاتف: ${data.phone || '—'}
💉 الخدمة: ${data.service || '—'}
📅 اليوم: ${data.day || '—'}
🕐 الوقت: ${data.time || '—'}`
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
  //console.log(' Incoming from:', msg.from)

   //TESTING MODE — only respond to this number
   //const ALLOWED = ['201558533440@c.us', '214830002753718@lid', '966594544343@c.us', '172868155510964@lid']
  //if (!ALLOWED.includes(msg.from)) return

  const sender = msg.from
  const text = msg.body.trim()

  if (isRateLimited(sender, text)) {
    console.log(`🚦 Rate-limited duplicate: ${sender} | Msg: ${text}`)
    return
  }

  const session = getSession(sender)

  console.log(`📩 [${sender}] Step: ${session.step} | Msg: ${text}`)

  const triggers = ['hi', 'hello', 'hey', 'مرحبا', 'هاي', 'start', 'menu']
  const canReset = session.step === 'idle' || session.step === 'main_menu'
  if (canReset && (triggers.includes(text.toLowerCase()) || session.step === 'idle')) {
    resetSession(sender)
    sessions[sender].step = 'main_menu'
    return await msg.reply(MAIN_MENU)
  }

  if (session.step === 'main_menu') {
    switch (text) {
      case '1':
        case '1':
        if (session.data.appointment) {
          return await msg.reply(` لديك حجز :\n\n${buildSummary(session.data)}\n\n5️⃣ Cancel it first before booking again | يرجى إلغاء الحجز الحالي أولاً قبل حجز موعد جديد`)
        }
        session.step = 'select_service'
        return await msg.reply(SERVICES_MENU)
      case '2':
        return await msg.reply(session.data.appointment ? buildSummary(session.data) + '\n\n0️⃣ Back | رجوع' : ' No upcoming appointment | لا يوجد موعد حالي\n\n0️⃣ Back | رجوع')
      case '3':
        session.step = 'prices'
        return await msg.reply(SERVICES_INFO_MENU)
      case '4':
        session.step = 'contact'
        return await msg.reply(CONTACT_MENU)
      case '5':
        if (session.data.appointment) {
          session.step = 'cancel_confirm'
          return await msg.reply(` هل أنت متأكد من إلغاء الموعد؟\n\n📅 *${session.data.day}* at *${session.data.time}*\n💉 ${session.data.service}\n\n1️⃣ Yes, cancel it | نعم، إلغاء\n2️⃣ No, keep it | لا، الاحتفاظ به`)
        }
        return await msg.reply('لا يوجد موعد لإلغائه\n\n0️⃣ Back | رجوع')
      default:
        return await msg.reply(' ⚠️اختر رقم من ١ إلى ٥\n\n' + MAIN_MENU)
    }
  }
if (session.step === 'cancel_confirm') {
    if (text === '1') {
      if (session.data.rowNumber) {
        await cancelBooking(session.data.rowNumber)
      }
      session.data = {}
      session.step = 'main_menu'
      return await msg.reply('تم إلغاء موعدك\n\n' + MAIN_MENU)
    }
    if (text === '2') {
      session.step = 'main_menu'
      return await msg.reply('تم الاحتفاظ بموعدك\n\n' + MAIN_MENU)
    }
    return await msg.reply(' ⚠️الرجاء الرد بـ ١ للإلغاء أو ٢ للاحتفاظ بالموعد')
  }

  if (session.step === 'prices') {
    if (text === '0') { session.step = 'main_menu'; return await msg.reply(MAIN_MENU) }
    return await msg.reply(' ⚠️الرجاء الرد بـ 0️⃣ للرجوع\n\n' + SERVICES_INFO_MENU)
  }

  if (session.step === 'contact') {
    if (text === '0') { session.step = 'main_menu'; return await msg.reply(MAIN_MENU) }
    if (text === '1') { session.step = 'select_service'; return await msg.reply(SERVICES_MENU) }
    return await msg.reply('⚠️الرجاء الرد بـ 0 للرجوع أو 1 للحجز\n\n' + CONTACT_MENU)
  }

  if (session.step === 'select_service') {
    if (text === '0') { session.step = 'main_menu'; return await msg.reply(MAIN_MENU) }
    if (CLINIC.services[text]) {
      session.data.service = CLINIC.services[text].name
      session.step = 'patient_type'
      return await msg.reply(PATIENT_TYPE_MENU)
    }
  return await msg.reply('⚠️ اختر رقم من ١ إلى ٨\n\n' + SERVICES_MENU)  }

  if (session.step === 'patient_type') {
    if (text === '0') { session.step = 'select_service'; return await msg.reply(SERVICES_MENU) }
    if (text === '1' || text === '2') {
      session.data.patientType = text === '1' ? 'New Patient' : 'Returning Patient'
      session.step = 'select_day'
      return await msg.reply(DAYS_MENU)
    }
    return await msg.reply('⚠️الرجاء الرد بـ ١ أو ٢\n\n' + PATIENT_TYPE_MENU)
  }

  if (session.step === 'select_day') {
    if (text === '0') { 
      session.step = 'patient_type'
      return await msg.reply(PATIENT_TYPE_MENU)
    }
    if (CLINIC.days[text]) {
      session.data.day = CLINIC.days[text]
      session.step = 'select_time'
      return await msg.reply(SLOTS_MENU)
    }
    return await msg.reply('⚠️ اختر رقم من ١ إلى ٥\n\n' + DAYS_MENU)
  }

  if (session.step === 'select_time') {
    if (text === '0') { session.step = 'select_day'; return await msg.reply(DAYS_MENU) }
    if (CLINIC.slots[text]) {
      session.data.time = CLINIC.slots[text]

      // Check for clashes before proceeding
      const available = await checkSlot(session.data.day, session.data.time)
      if (!available) {
        return await msg.reply(` Sorry, *${session.data.day}* at *${session.data.time}* is already booked | عذراً، هذا الموعد محجوز \n\nPlease choose another time | يرجى اختيار وقت آخر:\n\n` + SLOTS_MENU)
      }

      session.step = 'enter_name'
      return await msg.reply('*ما هو اسمك الكامل؟*')
    }
    return await msg.reply('⚠️اختر رقم من ١ إلى ٥\n\n' + SLOTS_MENU)
  }

  if (session.step === 'enter_name') {
    const nameValid = /^[a-zA-Z\u0600-\u06FF\s]{3,50}$/.test(text)
    if (!nameValid) {
      return await msg.reply('⚠️الرجاءإدخال اسمك الكامل - )')
    }
    session.data.name = text.trim()
    session.step = 'enter_phone'
    return await msg.reply('*رقم هاتفك؟*\n_(لتأكيد الموعد)_')
  }

  if (session.step === 'enter_phone') {
    if (text === '0') { session.step = 'enter_name'; return await msg.reply('*ما هو اسمك الكامل؟*') }

    const phoneNumber = parsePhoneNumberFromString(text, 'EG') // defaults to Egypt if no + given

    if (!phoneNumber || !phoneNumber.isValid()) {
      return await msg.reply('⚠️الرجاء إدخال رقم هاتف صحيح مع رمز الدولة\nExample | +201558766773 (Egypt), +966501234567 (Saudi), +971501234567 (UAE)')
    }

    session.data.phone = phoneNumber.number
    session.step = 'confirm'
    return await msg.reply(buildSummary(session.data) + `

1️⃣ تأكيد
2️⃣ البدء من جديد
0️⃣ رجوع`)
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
      console.log(`\n✅ NEW BOOKING`)
      console.log(`   Name:    ${session.data.name}`)
      console.log(`   Phone:   ${session.data.phone}`)
      console.log(`   Service: ${session.data.service}`)
      console.log(`   Day:     ${session.data.day}`)
      console.log(`   Time:    ${session.data.time}`)
      console.log(`   Type:    ${session.data.patientType}`)

      const rowNumber = incrementBookingCount()
      const bookedAt = new Date().toLocaleString('en-EG')
      const success = await saveBooking({
        name: session.data.name,
        phone: session.data.phone,
        service: session.data.service,
        day: session.data.day,
        time: session.data.time,
        patientType: session.data.patientType,
        bookedAt: bookedAt
      }, rowNumber)

      if (!success) {
        return await msg.reply(`⚠️ Something went wrong saving your booking. Please try again or contact us directly.\n\n${CONTACT_MENU}`)
      }

      session.data.appointment = true
      session.data.bookedAt = bookedAt
      session.data.rowNumber = rowNumber
      session.step = 'main_menu'

      console.log(`   At:      ${bookedAt}\n`)

      return await msg.reply(`🎉*تم تأكيد الحجز!*

${buildSummary(session.data)}

See you on *${session.data.day}* at *${session.data.time}* | نراك يوم *${session.data.day}* الساعة *${session.data.time}* 🏥
اكتب *menu* في أي وقت لإدارة موعدك

— MeroSculp Team`)
    }
    return await msg.reply('⚠️الرجاء الرد بـ ١ للتأكيد أو ٢ للبدء من جديد')
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