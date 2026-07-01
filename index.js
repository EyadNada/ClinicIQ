
let bookingCount = 1
const { Client, LocalAuth } = require('whatsapp-web.js')
const qrcode = require('qrcode-terminal')
const { saveBooking } = require('./notify')  // was './sheets'
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