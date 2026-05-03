import type { Metadata } from "next";
import { faqs } from "@/data/faq";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Answers to common questions about Worldwide Studio Space.",
};

export default function FaqPage() {
  return (
    <main className="section">
      <div className="mx-auto max-w-4xl space-y-8">
        <div>
          <p className="section-kicker">FAQ</p>
          <h1 className="section-title">Fast answers for quick decisions</h1>
        </div>
        <div className="space-y-4">
          {faqs.map((faq) => (
            <div key={faq.question} className="card p-6">
              <h2 className="text-base font-semibold">{faq.question}</h2>
              <p className="mt-2 text-sm text-neutral-600">{faq.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
