# Stripe Setup Instructions

## Fix for "Stripe public key is not configured" error

The checkout process is failing because the Stripe publishable key is missing from your environment variables.

### Step 1: Get your Stripe publishable key

1. Log in to your [Stripe Dashboard](https://dashboard.stripe.com/)
2. Go to Developers > API keys
3. Copy your "Publishable key" (it should start with `pk_test_` for test mode or `pk_live_` for live mode)

### Step 2: Add the key to your environment variables

Add the following line to your `.env.local` file:

```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_publishable_key_here
```

Replace `your_publishable_key_here` with the key you copied from Stripe.

### Step 3: Restart your Next.js development server

After updating the `.env.local` file, restart your Next.js development server for the changes to take effect:

```bash
npm run dev
# or
yarn dev
```

This should resolve the "Stripe public key is not configured" error.

## Note about Stripe keys

- The **publishable key** is used on the client-side and is safe to include in front-end code
- The **secret key** should only be used on the server-side (already configured in your Firebase functions) 