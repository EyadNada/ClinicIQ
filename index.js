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
const { saveBooking, checkSlot, cancelBooking, askCustomerService } = require('./notify')
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
  name: 'MeroSculp',
  phone: '+20 103 117 7998',
  services: {
    '1': { name: 'Rhinoplasty (Nose Job)' },
    '2': { name: 'Tummy Tuck' },
    '3': { name: 'Facelift / Neck Lift' },
    '4': { name: 'BBL – Brazilian Butt Lift' },
    '5': { name: 'Breast Lift' },
    '6': { name: 'Breast Reduction' },
    '7': { name: 'Arm Lift' },
    '8': { name: 'Thigh Lift' },
    '9': { name: 'Otoplasty (Ear Reshaping)' },
    '10': { name: 'Gynecomastia Treatment' },
    '11': { name: 'Back Lift & Butt Lift' },
    '12': { name: 'Liposuction & Body Contouring' },
    '13': { name: 'Mommy Makeover' },
  },
  slots: {
    '1': '17:00',
    '2': '18:00',
    '3': '19:00',
    '4': '20:00',
    '5': '21:00',
    '6': '22:00',
  }
}

const ARABIC_DAY_NAMES = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

function formatDateArabic(dateStr) {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-').map(Number)
  const dateObj = new Date(y, m - 1, d)
  const dayName = ARABIC_DAY_NAMES[dateObj.getDay()]
  const dd = String(d).padStart(2, '0')
  const mm = String(m).padStart(2, '0')
  return `${dayName} ${dd}/${mm}`
}

function formatTime12h(timeStr) {
  if (!timeStr) return '—'
  const [h] = timeStr.split(':').map(Number)
  const h12 = h > 12 ? h - 12 : h
  return `${h12}:00 م`
}

// Generates the next available consultation dates: starts tomorrow, looks
// up to 7 calendar days ahead, skips Friday/Saturday (clinic closed).
// Always yields exactly 5 dates since any 7-day window contains exactly
// one Friday and one Saturday.
function getAvailableDates() {
  const dates = []
  const today = new Date()
  for (let offset = 1; offset <= 7 && dates.length < 5; offset++) {
    const d = new Date(today)
    d.setDate(d.getDate() + offset)
    const dow = d.getDay() // 0=Sun ... 6=Sat
    if (dow === 5 || dow === 6) continue
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    dates.push(`${yyyy}-${mm}-${dd}`)
  }
  return dates
}

const DAY_NUM_EMOJI = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣']

function buildDaysMenu() {
  const dates = getAvailableDates()
  const map = {}
  const lines = dates.map((dateStr, i) => {
    const num = String(i + 1)
    map[num] = dateStr
    return `${DAY_NUM_EMOJI[i]} ${formatDateArabic(dateStr)}`
  })
  const menuText = `📅 *اختر يوم الاستشارة*\n\n${lines.join('\n')}\n\n0️⃣ رجوع\n\n🕔 مواعيد العمل: من الساعة ٥ م حتى ١١ م`
  return { menuText, map }
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

const MAIN_MENU = `🏥 *مرحبًا بك في MeroSculp* 🌷

يسعدنا خدمتك والإجابة على جميع استفساراتك.
يرجى اختيار رقم من القائمة التالية:

1️⃣ 📅 حجز استشارة مجانية اون لاين
2️⃣ 🔪 الخدمات والعمليات
3️⃣ 🎉 العروض الحالية
4️⃣ ❓ الأسئلة الشائعة
5️⃣ 🗒️ موعدي
6️⃣ 💬 الشكاوى والاستفسارات

✨ يرجى الرد برقم الخيار المطلوب، وسيتم خدمتك في أسرع وقت`

const SERVICES_MENU = `🔪 *اختر العملية التي ترغب في حجز استشارة مجانية بشأنها*

يرجى الرد برقم العملية المطلوبة:

1️⃣ تجميل الأنف
2️⃣ شد البطن
3️⃣ شد الوجه والرقبة
4️⃣ شد وتكبير الأرداف (BBL)
5️⃣ رفع الثدي
6️⃣ تصغير الثدي
7️⃣ شد الذراعين
8️⃣ شد الفخذين
9️⃣ تجميل الأذن
🔟 علاج التثدي
1️⃣1️⃣ شد الظهر ورفع المؤخرة
1️⃣2️⃣ شفط الدهون ونحت الجسم
1️⃣3️⃣ مامي ميك أوفر (Mommy Makeover)

0️⃣ الرجوع للقائمة الرئيسية

💬 يرجى إرسال رقم العملية، وسيتم حجز استشارة ومساعدتك في أسرع وقت`

const SLOTS_MENU = `🕐 *اختر وقت الاستشارة*

1️⃣ 5:00 م – 6:00 م
2️⃣ 6:00 م – 7:00 م
3️⃣ 7:00 م – 8:00 م
4️⃣ 8:00 م – 9:00 م
5️⃣ 9:00 م – 10:00 م
6️⃣ 10:00 م – 11:00 م

0️⃣ رجوع`

const PATIENT_TYPE_MENU = `🏥 *هل أنت*

1️⃣ مريض جديد
2️⃣ مريض عائد

0️⃣ رجوع`

const SERVICES_INFO_MENU = `🔪 *ما نقدمه في MeroSculp*

في MeroSculp، يقدم الدكتور خدمات تجميلية متخصصة بأحدث التقنيات وأعلى معايير السلامة، مع متابعة كاملة قبل وبعد العملية.

 *تجميل الأنف* — تعديل شكل الأنف لتحسين التناسق مع ملامح الوجه
 *شد البطن* — إزالة الجلد الزائد وشد عضلات البطن
 *شد الوجه والرقبة* — تقليل علامات التقدم في السن وإعادة الشباب للملامح
 *شد وتكبير الأرداف* — إعادة تشكيل الجسم عبر نقل الدهون
 *رفع الثدي* — رفع وتحسين شكل الثدي
 *تصغير الثدي* — تقليل الحجم لراحة أكبر وتناسق أفضل
 *شد الذراعين* — إزالة الترهلات وشد الجلد
 *شد الفخذين* — تحسين شكل ومظهر الفخذين
 *تجميل الأذن* — إعادة تشكيل الأذن لمظهر متناسق
 *علاج التثدي* — إزالة الأنسجة الدهنية والغدية الزائدة لدى الرجال
 *شد الظهر ورفع المؤخرة* — شد الجلد المترهل ورفع المؤخرة
 *شفط الدهون ونحت الجسم* — إزالة الدهون الموضعية وتحسين تناسق الجسم
 *مامي ميك أوفر* — باقة شاملة لإعادة تشكيل الجسم بعد الحمل والولادة

_للأسعار والتفاصيل، تواصل معنا مباشرة_

0️⃣ رجوع`

const OFFERS_MENU = `🎉 *العروض الحالية*

للاطلاع على أحدث العروض والخصومات، يُرجى زيارة صفحتنا على Instagram، حيث يتم تحديث العروض بشكل مستمر.

✨ قد تجد أيضًا:

- عروض موسمية لفترة محدودة
- عروض خاصة للمرضى السابقين
- خصومات عند إجراء أكثر من عملية في نفس الوقت
- باقات وعروض حصرية قد لا تكون متاحة في أي مكان آخر

📲 يرجى زيارة صفحتنا على Instagram لمعرفة أحدث العروض المتاحة

0️⃣ القائمة الرئيسية`

// TODO: placeholder; FAQ
const FAQ_MENU = `❓ *الأسئلة الشائعة*

_سيتم إضافة الأسئلة الشائعة قريباً._

0️⃣ رجوع`

const MANAGE_MENU = `🗒️ *إدارة موعدي*

اختر الخدمة المطلوبة:

1️⃣ 📋 عرض تفاصيل الموعد
2️⃣ ✏️ تعديل الموعد
3️⃣ ❌ إلغاء الموعد
4️⃣ ⏰ تذكيري بموعدي
6️⃣ 📞 التواصل مع خدمة العملاء

0️⃣ 🏠 القائمة الرئيسية

💬 يرجى الرد برقم الخيار المطلوب`

const REMINDER_MENU = `⏰ *تذكير بموعد الاستشارة*

اختر موعد التذكير المناسب:

1️⃣ قبل الموعد بيومين
2️⃣ قبل الموعد بيوم
3️⃣ قبل الموعد بـ 6 ساعات
4️⃣ قبل الموعد بساعة
5️⃣ إيقاف التذكير

0️⃣ 🏠 القائمة الرئيسية`

const CUSTOMER_SERVICE_INTRO = `💬 *الشكاوى والاستفسارات*

اكتب سؤالك أو استفسارك وسنقوم بالرد عليك في أقرب وقت.

0️⃣ رجوع للقائمة الرئيسية`

const REMINDER_LABELS = {
  '1': 'قبل الموعد بيومين',
  '2': 'قبل الموعد بيوم',
  '3': 'قبل الموعد بـ 6 ساعات',
  '4': 'قبل الموعد بساعة',
  '5': 'تم إيقاف التذكير',
}

function buildSummary(data) {
  return `📋 *ملخص الحجز*

👤 الاسم: ${data.name || '—'}
📱 رقم الهاتف: ${data.phone || '—'}
🔪 العملية: ${data.service || '—'}
📅 اليوم: ${formatDateArabic(data.day)}
🕐 الوقت: ${formatTime12h(data.time)}`
}

function buildBookingReview(data) {
  return `${buildSummary(data)}

اختر أحد الخيارات التالية:

1️⃣ ✅ تأكيد الحجز
2️⃣ ✏️ تعديل البيانات
0️⃣ 🏠 القائمة الرئيسية`
}

function buildConfirmationMessage(data) {
  return `🎉 *تم تأكيد حجز الاستشارة بنجاح!*

📋 تفاصيل الموعد:

👤 الاسم: ${data.name}
📱 رقم الهاتف: ${data.phone}
🔪 العملية: ${data.service}
📅 اليوم: ${formatDateArabic(data.day)}
🕐 الوقت: ${formatTime12h(data.time)}

💻 الاستشارة ستكون أونلاين عبر Google Meet.

📲 سيتم إرسال رابط الاستشارة على نفس رقم الواتساب قبل الموعد، ويكفي الضغط على الرابط في موعد الاستشارة للدخول والتحدث مباشرة مع الدكتور.

⏰ يرجى التواجد قبل الموعد بـ 5 دقائق والتأكد من وجود اتصال جيد بالإنترنت.

🌷 نتمنى لك تجربة مميزة، وفي انتظار حضورك.

اكتب *menu* في أي وقت للرجوع إلى القائمة الرئيسية.

— فريق MeroSculp`
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
  const ALLOWED = ['201558533440@c.us', '214830002753718@lid', '966594544343@c.us', '172868155510964@lid', '238830783328471@lid']
  if (!ALLOWED.includes(msg.from)) return
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
        if (session.data.appointment) {
          return await msg.reply(`لديك حجز حالي:\n\n${buildSummary(session.data)}\n\nيرجى إلغاء الحجز الحالي أولاً من "5️⃣ موعدي" قبل حجز استشارة جديدة.`)
        }
        session.step = 'select_service'
        return await msg.reply(SERVICES_MENU)
      case '2':
        session.step = 'services_info'
        return await msg.reply(SERVICES_INFO_MENU)
      case '3':
        session.step = 'offers'
        return await msg.reply(OFFERS_MENU)
      case '4':
        session.step = 'faq'
        return await msg.reply(FAQ_MENU)
      case '5':
        if (session.data.appointment) {
          session.step = 'manage_appointment'
          return await msg.reply(MANAGE_MENU)
        }
        return await msg.reply('🗒️ لا يوجد لديك موعد حالياً.\n\n' + MAIN_MENU)
      case '6':
        session.step = 'customer_service'
        return await msg.reply(CUSTOMER_SERVICE_INTRO)
      default:
        return await msg.reply(' ⚠️اختر رقم من ١ إلى ٦\n\n' + MAIN_MENU)
    }
  }

  if (session.step === 'services_info') {
    if (text === '0') { session.step = 'main_menu'; return await msg.reply(MAIN_MENU) }
    return await msg.reply(' ⚠️الرجاء الرد بـ 0️⃣ للرجوع\n\n' + SERVICES_INFO_MENU)
  }

  if (session.step === 'offers') {
    if (text === '0') { session.step = 'main_menu'; return await msg.reply(MAIN_MENU) }
    return await msg.reply(' ⚠️الرجاء الرد بـ 0️⃣ للرجوع\n\n' + OFFERS_MENU)
  }

  if (session.step === 'faq') {
    if (text === '0') { session.step = 'main_menu'; return await msg.reply(MAIN_MENU) }
    return await msg.reply(' ⚠️الرجاء الرد بـ 0️⃣ للرجوع\n\n' + FAQ_MENU)
  }

  if (session.step === 'manage_appointment') {
    switch (text) {
      case '1':
        return await msg.reply(buildSummary(session.data) + '\n\n' + MANAGE_MENU)
      case '2':
        if (session.data.rowNumber) {
          await cancelBooking(session.data.rowNumber)
        }
        session.data = {}
        session.step = 'select_service'
        return await msg.reply('✏️ *تعديل الموعد*\n\nسنقوم بحجز استشارة جديدة بالبيانات المعدّلة.\n\n' + SERVICES_MENU)
      case '3':
        session.step = 'cancel_confirm'
        return await msg.reply(`هل أنت متأكد من إلغاء الموعد؟\n\n📅 *${formatDateArabic(session.data.day)}* الساعة *${formatTime12h(session.data.time)}*\n🔪 ${session.data.service}\n\n1️⃣ نعم، إلغاء\n2️⃣ لا، الاحتفاظ به`)
      case '4':
        session.step = 'reminder_menu'
        return await msg.reply(REMINDER_MENU)
      case '6':
        session.step = 'customer_service'
        return await msg.reply(CUSTOMER_SERVICE_INTRO)
      case '0':
        session.step = 'main_menu'
        return await msg.reply(MAIN_MENU)
      default:
        return await msg.reply('⚠️ اختر رقم من الخيارات المتاحة\n\n' + MANAGE_MENU)
    }
  }

  if (session.step === 'reminder_menu') {
    if (REMINDER_LABELS[text]) {
      session.data.reminderPref = text
      session.step = 'main_menu'
      return await msg.reply(`✅ تم ضبط التذكير: ${REMINDER_LABELS[text]}\n\n` + MAIN_MENU)
    }
    if (text === '0') { session.step = 'main_menu'; return await msg.reply(MAIN_MENU) }
    return await msg.reply('⚠️ اختر رقم من ١ إلى ٥\n\n' + REMINDER_MENU)
  }

  if (session.step === 'customer_service') {
    if (text === '0' || text.toLowerCase() === 'back' || text === 'رجوع') {
      session.step = 'main_menu'
      return await msg.reply(MAIN_MENU)
    }
    const reply = await askCustomerService(sender, text)
    return await msg.reply(reply + '\n\n_اكتب سؤالك التالي، أو 0️⃣ للرجوع للقائمة الرئيسية_')
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

  if (session.step === 'select_service') {
    if (text === '0') { session.step = 'main_menu'; return await msg.reply(MAIN_MENU) }
    if (CLINIC.services[text]) {
      session.data.service = CLINIC.services[text].name
      session.step = 'patient_type'
      return await msg.reply(PATIENT_TYPE_MENU)
    }
    return await msg.reply('⚠️ اختر رقم من ١ إلى ١٣\n\n' + SERVICES_MENU)
  }

  if (session.step === 'patient_type') {
    if (text === '0') { session.step = 'select_service'; return await msg.reply(SERVICES_MENU) }
    if (text === '1' || text === '2') {
      session.data.patientType = text === '1' ? 'New Patient' : 'Returning Patient'
      session.step = 'select_day'
      return await msg.reply(buildDaysMenu().menuText)
    }
    return await msg.reply('⚠️الرجاء الرد بـ ١ أو ٢\n\n' + PATIENT_TYPE_MENU)
  }

  if (session.step === 'select_day') {
    if (text === '0') {
      session.step = 'patient_type'
      return await msg.reply(PATIENT_TYPE_MENU)
    }
    const { menuText, map } = buildDaysMenu()
    if (map[text]) {
      session.data.day = map[text] // stored as YYYY-MM-DD
      session.step = 'select_time'
      return await msg.reply(SLOTS_MENU)
    }
    return await msg.reply('⚠️ اختر رقم من الأيام المتاحة\n\n' + menuText)
  }

  if (session.step === 'select_time') {
    if (text === '0') { session.step = 'select_day'; return await msg.reply(buildDaysMenu().menuText) }
    if (CLINIC.slots[text]) {
      session.data.time = CLINIC.slots[text]

      // Check for clashes before proceeding
      const available = await checkSlot(session.data.day, session.data.time)
      if (!available) {
        return await msg.reply(` عذراً، هذا الموعد محجوز بالفعل.\n\nيرجى اختيار وقت آخر:\n\n` + SLOTS_MENU)
      }

      session.step = 'enter_name'
      return await msg.reply('👤 *يرجى كتابة اسمك الثنائي*')
    }
    return await msg.reply('⚠️اختر رقم من ١ إلى ٦\n\n' + SLOTS_MENU)
  }

  if (session.step === 'enter_name') {
    const nameValid = /^[a-zA-Z\u0600-\u06FF\s]{3,50}$/.test(text)
    if (!nameValid) {
      return await msg.reply('⚠️الرجاء إدخال اسمك الثنائي')
    }
    session.data.name = text.trim()
    session.step = 'enter_phone'
    return await msg.reply('📱 *يرجى كتابة رقم هاتفك*\n_(لتأكيد الموعد)_')
  }

  if (session.step === 'enter_phone') {
    if (text === '0') { session.step = 'enter_name'; return await msg.reply('👤 *يرجى كتابة اسمك الثنائي*') }

    const phoneNumber = parsePhoneNumberFromString(text, 'EG') // defaults to Egypt if no + given

    if (!phoneNumber || !phoneNumber.isValid()) {
      return await msg.reply('⚠️الرجاء إدخال رقم هاتف صحيح مع رمز الدولة\nExample | +201558766773 (Egypt), +966501234567 (Saudi), +971501234567 (UAE)')
    }

    session.data.phone = phoneNumber.number
    session.step = 'confirm'
    return await msg.reply('📋 *مراجعة بيانات الحجز*\n\nيرجى مراجعة البيانات التالية قبل تأكيد الموعد:\n\n' + buildBookingReview(session.data))
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
        return await msg.reply(`⚠️ Something went wrong saving your booking. Please try again or contact us directly at ${CLINIC.phone}.`)
      }

      session.data.appointment = true
      session.data.bookedAt = bookedAt
      session.data.rowNumber = rowNumber
      session.step = 'main_menu'

      console.log(`   At:      ${bookedAt}\n`)

      return await msg.reply(buildConfirmationMessage(session.data))
    }
    return await msg.reply('⚠️الرجاء الرد بـ ١ للتأكيد أو ٢ لتعديل البيانات')
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

client.on('message_create', async (msg) => {
  console.log('🔍 RAW EVENT:', { from: msg.from, to: msg.to, type: msg.type, fromMe: msg.fromMe, body: msg.body })
  
  if (msg.fromMe) {
    const text = msg.body.trim().toLowerCase()
    const patientId = msg.to
    if (text === '//pause' || text === '//mute') {
      const session = getSession(patientId)
      session.mutedUntil = Date.now() + (24 * 60 * 60 * 1000) // 24 hours
      saveSessions()
      console.log(`🔇 Muted bot for ${patientId}`)
      await msg.reply('🔇 [System]: Bot paused for 24 hours for this patient.')
    } else if (text === '//resume' || text === '//unmute') {
      const session = getSession(patientId)
      session.mutedUntil = 0
      saveSessions()
      console.log(`🔊 Resumed bot for ${patientId}`)
      await msg.reply('🔊 [System]: Bot resumed for this patient.')
    }
    return
  }

  if (isDuplicateMessage(msg)) {
    console.log('⏭️ Skipped duplicate message:', msg.id?._serialized)
    return
  }
  try {
    // Ignore if patient is muted
    const sender = msg.from
    const session = getSession(sender)
    if (session.mutedUntil && Date.now() < session.mutedUntil) {
      console.log(`🔇 Ignored incoming message from ${sender} (Bot is paused)`)
      return
    }

    await handleMessage(msg)
  }
  catch (err) { console.error('Error:', err) }
})

client.initialize()