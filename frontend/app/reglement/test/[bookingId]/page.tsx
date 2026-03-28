import { notFound } from "next/navigation";

import { TestPaymentPageClient } from "@/components/payments/test-payment-page-client";

const INTERNAL_TEST_PAGES_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_INTERNAL_TEST_PAGES === "true";

export default function TestPaymentPage() {
  if (!INTERNAL_TEST_PAGES_ENABLED) {
    notFound();
  }

  return <TestPaymentPageClient />;
}
