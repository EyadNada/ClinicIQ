const axios = require('axios')

const N8N_WEBHOOK_URL = 'https://cliniciq.app.n8n.cloud/webhook/ClinicIQ-Booking'

async function saveBooking(data, rowNumber) {
  try {
    await axios.post(N8N_WEBHOOK_URL, {
      rowNumber,
      name: data.name,
      phone: data.phone,
      service: data.service,
      day: data.day,
      time: data.time,
      patientType: data.patientType,
      bookedAt: data.bookedAt,
      status: 'Confirmed'
    })
    console.log('📤 Sent booking to n8n')
    return true
  } catch (err) {
    console.error('❌ n8n webhook error:', err.message)
    return false
  }
}

async function checkSlot(day, time) {
  try {
    const response = await axios.get('https://cliniciq.app.n8n.cloud/webhook/check-GLOBAL-slot', {
      params: { day, time }
    })
    return response.data.available
  } catch (err) {
    console.error('❌ Clash check error:', err.message)
    return true // if check fails, allow booking to continue
  }
}

async function cancelBooking(rowNumber) {
  try {
    await axios.post('https://cliniciq.app.n8n.cloud/webhook/ClinicIQ-Cancel', {
      rowNumber,
      status: 'Cancelled'
    })
    console.log('📤 Sent cancellation to n8n')
  } catch (err) {
    console.error('❌ n8n cancel webhook error:', err.message)
  }
}

module.exports = { saveBooking, checkSlot, cancelBooking }
