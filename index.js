// index.js — WhatsApp Bot using whatsapp-web.js
// More stable than Baileys — uses a real Chrome browser under the hood

const { Client, LocalAuth } = require('whatsapp-web.js')
const qrcode = require('qrcode-terminal')

const client = new Client({
  // LocalAuth saves your session so you only scan QR once
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'  // important for Windows/low-memory machines
    ]
  }
})

// Show QR code in terminal to scan with your phone
client.on('qr', (qr) => {
  console.log('\n📱 Scan this QR code with WhatsApp:\n')
  qrcode.generate(qr, { small: true })
})

// Bot is ready
client.on('ready', () => {
  console.log('✅ Bot is connected and ready!')
})

// Handle disconnection
// Handle disconnection (hibernate, network drop, etc.)
client.on('disconnected', (reason) => {
  console.log('⚠️ Bot disconnected:', reason)
  console.log('🔄 Restarting in 5 seconds...')
  setTimeout(() => {
    client.initialize()
  }, 5000)
})

client.on('auth_failure', (msg) => {
  console.log('❌ Auth failed:', msg)
  console.log('🔄 Restarting...')
  setTimeout(() => {
    client.initialize()
  }, 5000)
})

// Listen for messages
client.on('message', async (msg) => {
  const text = msg.body.toLowerCase().trim()

  console.log(`📩 From ${msg.from}: ${msg.body}`)

  if (text === 'hello' || text === 'hi' || text === 'مرحبا') {
    await msg.reply('👋 Hello! Welcome to our clinic.\n\nType *book* to book an appointment.')
  }

  if (text === 'book') {
    await msg.reply('🦷 Great! Let\'s book your appointment.\n\n(Booking flow coming next)')
  }
})

client.initialize()
