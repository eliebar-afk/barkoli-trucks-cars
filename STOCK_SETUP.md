# Stock Tracker — Setup

The stock tracker (`stock.html`) is a private page for managing your car inventory:
buying price, unlimited extra cost line items per car (transport, repairs, registration...),
auto-computed total cost, and profit once a car is sold. It is not linked from the
public site's navigation and is excluded from search engines.

It uses [Supabase](https://supabase.com) (free tier is enough) for login and cloud
storage, so your data syncs across any device you log in from.

## 1. Create a Supabase project

1. Go to https://supabase.com, sign up / log in, and create a new project.
2. Wait for it to finish provisioning (~1-2 minutes).

## 2. Create the database tables

1. In your project, open **SQL Editor → New query**.
2. Paste the contents of `supabase/schema.sql` from this repo and run it.
   This creates the `cars` and `car_costs` tables with row-level security,
   so each account only ever sees its own data.

## 3. Create your login

1. Go to **Authentication → Users → Add user**.
2. Create yourself a user with your email and a password.
   (Sign-up isn't exposed on the page on purpose — only accounts you create
   here can log in.)

## 4. Connect the page to your project

1. Go to **Project Settings → API**.
2. Copy the **Project URL** and the **anon public** key.
3. Open `assets/stock/config.js` and paste them in:

   ```js
   window.STOCK_CONFIG = {
     supabaseUrl: "https://xxxxxxxx.supabase.co",
     supabaseAnonKey: "eyJ..."
   };
   ```

4. Commit and deploy. Open `/stock.html` and log in with the user you created in step 3.

The anon key is safe to keep in this public file — it only grants what the
row-level security policies allow, so a signed-in user can only ever read or
write their own cars and costs.

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
