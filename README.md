# Browski Consulting Site

A saveable Next.js starter for your Money Print ORB website.

## What is included
- Landing page
- Signup and login screens
- User dashboard
- Admin approval dashboard
- Mock backend routes so the app runs locally without a database
- Stripe Checkout session route
- Stripe webhook starter

## How to run

1. Unzip this folder.
2. Open the folder in VS Code.
3. Open a terminal in VS Code.
4. Run:
   ```bash
   npm install
   ```
5. Copy `.env.example` to a new file named `.env.local`
6. Put your real Stripe values in `.env.local`
7. Run:
   ```bash
   npm run dev
   ```
8. Open:
   `http://localhost:3000`

## Notes
- The current auth and admin flow uses a simple in-memory mock store so you can test the site without setting up a database yet.
- Stripe Checkout uses your real Stripe test key and Price ID.
- After you confirm the frontend flow works, the next step is deployment.