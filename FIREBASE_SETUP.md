# 🔥 Firebase/Firestore Setup Guide

This guide will help you set up Firebase/Firestore to permanently store your app's data in the cloud. This ensures that user data, balances, and transactions persist even when you redeploy your app.

## Why Firestore?

- **Persistent Storage**: Data is stored in the cloud and survives deployments
- **Real-time Access**: You can view and manage your data from the Firebase Console anytime
- **Scalable**: Automatically scales with your user base
- **Secure**: Built-in security rules and authentication

## Step 1: Create a Firebase Project

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"** or select an existing project
3. Follow the setup wizard:
   - Enter a project name (e.g., "my-game-app")
   - (Optional) Enable Google Analytics
   - Click "Create project"

## Step 2: Enable Firestore Database

1. In your Firebase project, click **"Firestore Database"** in the left sidebar
2. Click **"Create database"**
3. Choose **"Start in test mode"** (you can configure security rules later)
4. Select your region (choose the closest to your users, e.g., `us-central1`)
5. Click **"Enable"**

## Step 3: Generate Service Account Credentials

1. In your Firebase project, click the **⚙️ gear icon** (Project Settings)
2. Go to the **"Service accounts"** tab
3. Click **"Generate new private key"**
4. Click **"Generate key"** in the confirmation dialog
5. A JSON file will download - **keep this file safe and never commit it to GitHub!**

## Step 4: Set Up Environment Variables

You need to add three environment variables to your app. There are two ways to do this:

### Option A: Using Render (Recommended for Production)

1. Go to your Render dashboard
2. Select your web service
3. Go to **"Environment"** tab
4. Add these environment variables:

```
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----"
```

**How to get these values from your service account JSON file:**

- Open the JSON file you downloaded in Step 3
- `FIREBASE_PROJECT_ID` = the value of `"project_id"`
- `FIREBASE_CLIENT_EMAIL` = the value of `"client_email"`
- `FIREBASE_PRIVATE_KEY` = the value of `"private_key"` (include the quotes, and make sure the `\n` characters are preserved)

**Important for FIREBASE_PRIVATE_KEY:**
- Copy the entire private key including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`
- Make sure to keep the `\n` characters (they represent newlines)
- Wrap the entire key in double quotes

4. Click **"Save Changes"**
5. Render will automatically redeploy your app with the new environment variables

### Option B: Using .env File (For Local Development)

1. Create a `.env` file in your project root (if it doesn't exist)
2. Add these lines:

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----"
```

3. Make sure `.env` is in your `.gitignore` file (it should be by default)

**⚠️ NEVER commit the .env file or service account JSON to GitHub!**

## Step 5: Migrate Your Existing Data

If you have existing data in JSON files that you want to preserve, run the migration script:

```bash
# Make sure your Firebase environment variables are set first!
npm run migrate-firestore
```

Or if using tsx directly:

```bash
tsx server/migrate-to-firestore.ts
```

This will:
- Read all your existing JSON files from the `data` directory
- Upload them to Firestore
- Preserve all user balances, transactions, and game data

## Step 6: Deploy Your App

After setting up the environment variables:

1. **On Render**: Just push your code to GitHub - Render will automatically redeploy
2. **Locally**: Restart your development server

Your app will now use Firestore for all data storage! 🎉

## Verifying It Works

1. Check your server logs - you should see: `✅ Using Firestore for data storage`
2. Go to the Firebase Console → Firestore Database
3. You should see collections like `users`, `transactions`, `games`, etc.
4. Any new users or transactions will appear here in real-time

## Viewing Your Data

You can always access your data through the Firebase Console:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click "Firestore Database" in the left sidebar
4. Browse your collections and documents

## Security (Important!)

Currently, your database is in "test mode" which allows all reads and writes. For production, you should set up security rules:

1. Go to Firebase Console → Firestore Database → Rules
2. Set up rules like this:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Only allow reads/writes from your backend server (not from client apps)
    match /{document=**} {
      allow read, write: if false; // Deny all client access
    }
  }
}
```

Since you're using the Admin SDK from your backend server, it will bypass these rules and still have full access.

## Troubleshooting

### "Missing Firebase credentials" error

- Make sure all three environment variables are set: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`
- Check that there are no extra spaces or line breaks in the values
- Verify the private key includes the full BEGIN and END lines

### "Permission denied" errors

- Make sure you enabled Firestore in Step 2
- Check that your service account has the correct permissions in Firebase Console → Project Settings → Service Accounts

### Data not migrating

- Make sure your JSON files exist in the `data` directory
- Check the migration script output for any error messages
- Verify your Firebase credentials are correct

## Support

If you run into any issues:

1. Check the Firebase Console for any error messages
2. Look at your server logs for details
3. Make sure your environment variables are correctly set

Your user data is now safe and will persist across all deployments! 🎊
