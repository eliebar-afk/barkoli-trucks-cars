// Stock Tracker — Firebase connection settings.
//
// 1. Go to https://console.firebase.google.com and sign in with your existing
//    Google account (no new signup needed).
// 2. Click "Add project", give it a name, and create it.
// 3. Build → Authentication → Sign-in method → enable "Google" as a provider.
// 4. Build → Firestore Database → Create database (any region, production mode).
// 5. In the Firestore "Rules" tab, paste the contents of firebase/firestore.rules
//    from this repo, replace ALLOWED_EMAIL with your own Google account email,
//    and click Publish.
// 6. Project settings (gear icon) → General → "Your apps" → Add app → Web (</>).
//    Register it, then copy the values from the firebaseConfig object shown
//    into the object below.
//
// These values are safe to publish in client-side code — access is enforced by
// the Firestore security rules (firebase/firestore.rules), not by secrecy here.

window.STOCK_CONFIG = {
  firebaseConfig: {
    apiKey: "AIzaSyAE4g7LhBgFJ09ZCElCrGOZsVtdf80og5c",
    authDomain: "barkoli-stock-management.firebaseapp.com",
    projectId: "barkoli-stock-management",
    storageBucket: "barkoli-stock-management.firebasestorage.app",
    messagingSenderId: "416823525801",
    appId: "1:416823525801:web:f5169cd7900953746584b8",
  },
  // Only this Google account is allowed to sign in (checked client-side; the
  // real access control is the matching email check in firestore.rules).
  allowedEmail: "info@barkoli.de",
};
