import { isStripeTestMode } from "@/lib/stripe";

export function PaymentTestModeBanner() {
  if (!isStripeTestMode()) return null;
  return (
    <div className="w-full bg-orange-100 border-b border-orange-300 px-4 py-2 text-center text-sm text-orange-800">
      A preview-ben minden fizetés teszt módban történik.{" "}
      <a
        href="https://docs.lovable.dev/features/payments#test-and-live-environments"
        target="_blank"
        rel="noopener noreferrer"
        className="underline font-medium"
      >
        Részletek
      </a>
    </div>
  );
}
