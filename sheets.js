const { google } = require('googleapis')
const creds = require('./credentials.json')

const SHEET_ID = 'YOUR_SHEET_ID_HERE'

async function saveBooking(data, rowNumber) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    })

    const sheets = google.sheets({ version: 'v4', auth })

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'Sheet1!A:I',
      valueInputOption: 'RAW',
      resource: {
        values: [[
          rowNumber,
          data.name,
          data.phone,
          data.service,
          data.day,
          data.time,
          data.patientType,
          data.bookedAt,
          'Confirmed'
        ]]
      }
    })

    console.log('📊 Saved to Google Sheets cleanly')
  } catch (err) {
    console.error('❌ Sheets error:', err.message)
  }
}

module.exports = { saveBooking }