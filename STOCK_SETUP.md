# Stock Tracker — Setup

The stock tracker (`stock.html`) is a private page for managing your car inventory:
buying price, unlimited extra cost line items per car (transport, repairs, registration...),
auto-computed total cost, and profit once a car is sold. It is not linked from the
public site's navigation and is excluded from search engines.

It uses [Firebase](https://firebase.google.com) (free tier is enough) for login and
cloud storage, so your data syncs across any device you sign in from. You sign in with
your existing Google account — no new account to create.

## 1. Create a Firebase project

1. Go to https://console.firebase.google.com and sign in with your Google account.
2. Click **Add project**, give it a name (e.g. "barkoli-stock"), and create it.

## 2. Enable Google sign-in

1. In the project, go to **Build → Authentication → Get started**.
2. Under **Sign-in method**, enable the **Google** provider.

## 3. Create the database

1. Go to **Build → Firestore Database → Create database**.
2. Pick any region close to you, start in **production mode**.

## 4. Lock the data down to your account

1. In Firestore, open the **Rules** tab.
2. Paste the contents of `firebase/firestore.rules` from this repo, replacing
   `ALLOWED_EMAIL` with your own Google account email (the one you'll sign in with).
3. Click **Publish**.

This means only that one Google account can ever read or write your cars — not
just anyone who finds the page or has the public config values.

## 5. Connect the page to your project

1. Go to **Project settings** (gear icon) → **General** → scroll to **Your apps**.
2. Click **Add app → Web** (`</>`), give it a nickname, and register it.
3. Copy the `firebaseConfig` values shown.
4. Open `assets/stock/config.js` and paste them in, and set `allowedEmail` to the
   same Google account email you used in step 4:

   ```js
   window.STOCK_CONFIG = {
     firebaseConfig: {
       apiKey: "...",
       authDomain: "your-project.firebaseapp.com",
       projectId: "your-project",
       storageBucket: "your-project.appspot.com",
       messagingSenderId: "...",
       appId: "...",
     },
     allowedEmail: "you@gmail.com",
   };
   ```

5. Commit and deploy. Open `/stock.html` and sign in with Google.

These values are safe to keep in this public file — access is enforced by the
Firestore security rules (step 4), not by keeping them secret.

## Using it

- **Add car**: make, model, year, VIN/plate, purchase date, buying price, notes.
- Click a car to open its detail view: edit its basic fields, add/remove as
  many extra cost line items as you need, and see the auto-computed total
  cost.
- **Mark as sold**: enter a selling price and date — profit is calculated
  automatically (selling price − total cost).
- Tabs at the top filter between In Stock / Sold / All, and the summary
  cards show total capital currently invested in stock and total profit
  from sold cars.
- **Pull down** from the top of the dashboard on a touch device to refresh
  the data, or add the page to your phone's home screen for an app-like feel.
