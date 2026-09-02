# Google Sheets Integration Setup Guide

You have successfully replaced the n8n webhooks with direct Google Sheets integration. Now, your Node.js app will write directly to Google Sheets for free. 

To make this work, you just need to connect your Google account securely to the app using a **Service Account**.

### Step 1: Create a Google Cloud Project & Enable API
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (e.g., "ClinicIQ").
3. In the search bar at the top, type **"Google Sheets API"** and click **Enable**.

### Step 2: Create a Service Account (Your Bot's Google Account)
1. In the Google Cloud Console menu (top left), go to **IAM & Admin > Service Accounts**.
2. Click **+ CREATE SERVICE ACCOUNT** at the top.
3. Give it a name like `cliniciq-bot` and click **Create and Continue**, then **Done**.
4. You will see an email address generated for this account (e.g., `cliniciq-bot@...iam.gserviceaccount.com`). **Copy this email address.**

### Step 3: Generate a Private Key
1. Click on the newly created Service Account email in the list.
2. Go to the **Keys** tab.
3. Click **Add Key > Create new key**.
4. Choose **JSON** and click **Create**. A file will download to your computer.

### Step 4: Share Your Google Sheet with the Bot
1. Open the Google Sheet where you want to save the bookings.
2. Click the big **Share** button in the top right.
3. Paste the **Service Account email address** you copied in Step 2.
4. Give it **Editor** permissions and click Send.

> [!IMPORTANT]
> Make sure your Google Sheet has exactly these headers in the very first row (Row 1):
> `RowNumber` | `Name` | `Phone` | `Service` | `Day` | `Time` | `PatientType` | `BookedAt` | `Status`

### Step 5: Configure your Environment Variables
1. Look at the URL of your Google Sheet. It will look like this: `https://docs.google.com/spreadsheets/d/abc123DEF456/edit`. The ID is the long string of letters and numbers in the middle (e.g., `abc123DEF456`).
2. Open the downloaded JSON key file in any text editor.
3. Create a `.env` file in your `ClinicIQ` folder (I have already created a `.env.example` file for you) and add your details:

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account-email
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour key here...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEET_ID=your-sheet-id
```

Once this `.env` file is saved, start your app with `npm start`, and the bot will write directly to the sheet!
