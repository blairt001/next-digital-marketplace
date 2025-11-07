import Stripe from "stripe";

let stripeClient: Stripe;

if (process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.includes("your_")) {
  stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY, {
    // Use the API version that matches the installed Stripe types
    apiVersion: "2025-02-24.acacia",
    typescript: true,
  });
} else {
  // Avoid throwing during dev when key is not provided. Create a proxy that
  // surfaces a clear error if any Stripe method is called.
  const handler: ProxyHandler<Record<string, unknown>> = {
    get: () => {
      throw new Error(
        "Stripe is not configured. Set STRIPE_SECRET_KEY in your environment to use Stripe features."
      );
    },
  };

  // Cast to Stripe to satisfy imports elsewhere; accessing methods will throw.
  stripeClient = new Proxy({}, handler) as unknown as Stripe;
}

export const stripe = stripeClient;
