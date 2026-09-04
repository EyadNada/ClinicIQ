require('dotenv').config()

const CREDENTIALS = {
  client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  private_key: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : '',
}
const SHEET_ID = process.env.GOOGLE_SHEET_ID

let doc;
let sheet;

async function initSheet() {
  if (!doc) {
    if (!CREDENTIALS.client_email || !CREDENTIALS.private_key || !SHEET_ID) {
      console.warn('⚠️ Google Sheets configuration missing in .env')
      return null
    }
    
    // Import GoogleSpreadsheet and JWT dynamically so it doesn't crash if packages aren't fully resolved yet
    const { GoogleSpreadsheet } = require('google-spreadsheet')
    const { JWT } = require('google-auth-library')

    const serviceAccountAuth = new JWT({
      email: CREDENTIALS.client_email,
      key: CREDENTIALS.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })

    doc = new GoogleSpreadsheet(SHEET_ID, serviceAccountAuth)
    await doc.loadInfo() 
    
    // Assumes the first sheet (index 0) in your document is the bookings sheet
    sheet = doc.sheetsByIndex[0]
  }
  return sheet
}

async function saveBooking(data, rowNumber) {
  try {
    const s = await initSheet()
    if (!s) return false

    await s.addRow({
      RowNumber: rowNumber,
      Name: data.name,
      Phone: data.phone,
      Service: data.service,
      Day: data.day,
      Time: data.time,
      PatientType: data.patientType,
      BookedAt: data.bookedAt,
      Status: 'Confirmed'
    })

    console.log('✅ booking confirmed written directly to Google Sheets')
    return true
  } catch (err) {
    console.error('❌ google sheets webhook error:', err.message)
    return false
  }
}

async function checkSlot(day, time) {
  try {
    const s = await initSheet()
    if (!s) return true // default to allow booking if not configured
    
    const rows = await s.getRows()
    const isBooked = rows.some(r => r.get('Day') === day && r.get('Time') === time && r.get('Status') !== 'Cancelled')
    
    return !isBooked 
  } catch (err) {
    console.error('❌ sheet clash check error:', err.message)
    return true 
  }
}

async function cancelBooking(rowNumber) {
  try {
    const s = await initSheet()
    if (!s) return
    
    const rows = await s.getRows()
    const rowToCancel = rows.find(r => r.get('RowNumber') == rowNumber)
    if (rowToCancel) {
      rowToCancel.set('Status', 'Cancelled')
      await rowToCancel.save()
      console.log('✅ sent cancellation directly to Google Sheets')
    }
  } catch (err) {
    console.error('❌ sheet cancel error:', err.message)
  }
}

async function askCustomerService(sender, question) {
  // Since n8n is removed, customer service fallback directly to front desk phone
  return '⚠️ عذراً، لا يمكن معالجة الأسئلة حالياً. يرجى التواصل معنا مباشرة على +2001031177998.'
}

module.exports = { saveBooking, checkSlot, cancelBooking, askCustomerService }