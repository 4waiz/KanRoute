import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ForgeRelay — Webhook Infrastructure (Synthetic Demo Target)",
  description:
    "ForgeRelay is a fictional webhook delivery platform used as a synthetic demonstration target for KanForge.",
};

const claims: { text: string; note: string }[] = [
  {
    text: "GET /api/demo/health returns an OK status and the current API version.",
    note: "Health endpoint",
  },
  {
    text: "Failed webhook deliveries are retried exactly three times.",
    note: "Delivery guarantees",
  },
  {
    text: "Every webhook request is signed with an HMAC SHA-256 signature.",
    note: "Request signing",
  },
  {
    text: "ForgeRelay is SOC 2 Type II compliant.",
    note: "Compliance",
  },
  {
    text: "ForgeRelay maintains a 99.99% uptime SLA on all paid plans.",
    note: "Reliability",
  },
  {
    text: "Developers consistently rate ForgeRelay the most loved webhook platform.",
    note: "Marketing",
  },
];

export default function DemoTargetPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0b] text-zinc-200">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="mb-10 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <p className="text-sm font-medium text-amber-300">
            Synthetic demonstration target — not a real company.
          </p>
          <p className="mt-1 text-xs text-amber-200/70">
            ForgeRelay is fictional. This page exists solely so KanForge has a
            stable, public set of technical claims to verify. Every statement
            below is invented for demonstration purposes.
          </p>
        </div>

        <h1 className="text-4xl font-semibold tracking-tight text-white">
          ForgeRelay
        </h1>
        <p className="mt-3 text-lg text-zinc-400">
          Reliable webhook delivery infrastructure for modern applications.
        </p>

        <section className="mt-12">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
            Platform documentation
          </h2>

          <div className="mt-6 space-y-6 text-[15px] leading-relaxed">
            <div>
              <h3 className="font-medium text-white">Health and versioning</h3>
              <p className="mt-2 text-zinc-400">
                GET /api/demo/health returns an OK status and the current API
                version. Clients should poll this endpoint to confirm
                availability before beginning a delivery batch.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-white">Delivery guarantees</h3>
              <p className="mt-2 text-zinc-400">
                Failed webhook deliveries are retried exactly three times using
                exponential backoff. After the final retry the delivery is moved
                to the dead letter queue for manual inspection.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-white">Request signing</h3>
              <p className="mt-2 text-zinc-400">
                Every webhook request is signed with an HMAC SHA-256 signature.
                The signature is supplied in the x-forgerelay-signature header
                and should be verified in constant time before the payload is
                trusted.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-white">Compliance</h3>
              <p className="mt-2 text-zinc-400">
                ForgeRelay is SOC 2 Type II compliant. Audit reports are
                available to enterprise customers under NDA.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-white">Reliability</h3>
              <p className="mt-2 text-zinc-400">
                ForgeRelay maintains a 99.99% uptime SLA on all paid plans, and
                developers consistently rate ForgeRelay the most loved webhook
                platform available today.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-14">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
            Claims on this page
          </h2>
          <ul className="mt-5 space-y-2">
            {claims.map((c) => (
              <li
                key={c.text}
                className="rounded-md border border-white/5 bg-white/[0.02] px-4 py-3 text-sm text-zinc-300"
              >
                <span className="mr-2 text-[11px] uppercase tracking-wider text-zinc-600">
                  {c.note}
                </span>
                <br />
                {c.text}
              </li>
            ))}
          </ul>
        </section>

        <footer className="mt-16 border-t border-white/5 pt-6 text-xs text-zinc-600">
          ForgeRelay is a synthetic demonstration target created for KanForge.
          It does not describe, impersonate, or reference any real company or
          product.
        </footer>
      </div>
    </main>
  );
}
