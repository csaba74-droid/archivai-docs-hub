import { useState } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment, hasStripePublishableKey } from "@/lib/stripe";
import { createCheckoutSession } from "@/utils/payments.functions";

interface Props {
  priceId: string;
  customerEmail?: string;
  userId: string;
  returnUrl?: string;
}

export function StripeEmbeddedCheckout({ priceId, customerEmail, userId, returnUrl }: Props) {
  const [error, setError] = useState<string | null>(null);

  // Verify the Stripe publishable key is configured before mounting the provider.
  if (!hasStripePublishableKey()) {
    return (
      <div className="p-6 text-sm text-destructive">
        Stripe nincs konfigurálva (hiányzik a VITE_PAYMENTS_CLIENT_TOKEN vagy VITE_STRIPE_PUBLISHABLE_KEY).
      </div>
    );
  }

  const fetchClientSecret = async (): Promise<string> => {
    try {
      console.log("[StripeCheckout] requesting client_secret", { priceId, userId, env: getStripeEnvironment() });
      const secret = await createCheckoutSession({
        data: {
          priceId,
          customerEmail,
          userId,
          returnUrl: returnUrl || `${window.location.origin}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
          environment: getStripeEnvironment(),
        },
      });
      if (!secret) throw new Error("Üres válasz a szervertől (nincs client_secret)");
      console.log("[StripeCheckout] got client_secret");
      return secret;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[StripeCheckout] fetchClientSecret failed", err);
      setError(message);
      throw err;
    }
  };

  if (error) {
    return (
      <div className="p-6 space-y-2">
        <p className="text-sm font-medium text-destructive">A fizetés nem indítható el.</p>
        <p className="text-xs text-muted-foreground break-words">{error}</p>
      </div>
    );
  }

  return (
    <div id="checkout" className="w-full">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
