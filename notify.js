const axios = require('axios')

const N8N_WEBHOOK_URL = 'https://cliniciq.app.n8n.cloud/webhook/ClinicIQ-Booking'
const CHECK_SLOT_URL = 'https://cliniciq.app.n8n.cloud/webhook/check-GLOBAL-slot'
const CANCEL_URL = 'https://cliniciq.app.n8n.cloud/webhook/ClinicIQ-Cancel'
const CUSTOMER_SERVICE_URL = 'https://cliniciq.app.n8n.cloud/webhook/ClinicIQ-CustomerService'

async function saveBooking(data, rowNumber) {
  try {
    const response = await axios.post(N8N_WEBHOOK_URL, {
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

    if (!response.data || response.data.success !== true) {
      console.error(' n8n reported failure or unexpected response:', response.data)
      return false
    }

    console.log(' booking confirmed written to sheet')
    return true
  } catch (err) {
    console.error(' n8n webhook error:', err.message)
    return false
  }
}

async function checkSlot(day, time) {
  try {
    const response = await axios.get(CHECK_SLOT_URL, {
      params: { day, time }
    })
    return response.data.available
  } catch (err) {
    console.error(' clash check error:', err.message)
    return true // if check fails, allow booking to continue
  }
}

async function cancelBooking(rowNumber) {
  try {
    await axios.post(CANCEL_URL, {
      rowNumber,
      status: 'Cancelled'
    })
    console.log(' sent cancellation to n8n')
  } catch (err) {
    console.error(' n8n cancel webhook error:', err.message)
  }
}

async function askCustomerService(sender, question) {
  try {
    const response = await axios.post(CUSTOMER_SERVICE_URL, { sender, question })
    if (response.data && response.data.reply) {
      return response.data.reply
    }
    console.error(' customer service webhook returned unexpected response:', response.data)
    return '⚠️ عذراً، حدث خطأ أثناء معالجة سؤالك. يرجى المحاولة لاحقاً أو التواصل معنا مباشرة على +20 103 117 7998.'
  } catch (err) {
    console.error(' n8n customer service webhook error:', err.message)
    return '⚠️ عذراً، حدث خطأ أثناء معالجة سؤالك. يرجى المحاولة لاحقاً أو التواصل معنا مباشرة على +20 103 117 7998.'
  }
}

module.exports = { saveBooking, checkSlot, cancelBooking, askCustomerService }