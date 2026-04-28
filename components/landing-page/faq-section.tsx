import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"

interface FAQ {
  value: string
  question: string
  answer: string
}

const FAQS: FAQ[] = [
  {
    value: "credits",
    question: "What are credits?",
    answer:
      "Credits are how you pay for readings on StoryInColor. Each reading uses a small number of credits, and new accounts start with free credits to get going.",
  },
  {
    value: "cost",
    question: "How much does a reading cost?",
    answer:
      "The coloring book reading uses 1 credit. Other readings — palm, face, aura, iridology, handwriting, style audit, skincare, plate, plant care, room vibes — use 10 credits each. Credit packs start at $3.50 for 5 credits.",
  },
  {
    value: "photos",
    question: "What kind of photo should I bring?",
    answer:
      "It depends on the reading. The palm reading wants a clear photo of your open palm. The plate reading wants a top-down meal photo. Each reading page tells you exactly what to upload — and the clearer the photo, the better the result.",
  },
  {
    value: "privacy",
    question: "Are my photos private?",
    answer:
      "Yes. Your photos are used to generate your reading and are kept on your account so you can re-download. We don't sell your data and don't use your photos to train models. You can delete your account and uploads at any time from your settings.",
  },
  {
    value: "speed",
    question: "How long does a reading take?",
    answer:
      "Roughly 20 to 40 seconds. You stay on the result page while we work and the finished spread appears as soon as it's ready.",
  },
  {
    value: "commercial",
    question: "Can I use the result commercially?",
    answer:
      "Personal use is always covered. For commercial use, please review our Terms — most readings are fine for small-scale commercial projects, but some content types have restrictions.",
  },
  {
    value: "refund",
    question: "What if I don't like the reading?",
    answer:
      "If a reading fails for technical reasons, your credits are refunded automatically. If you're unhappy with a successful one, contact us — we'll always try to make it right.",
  },
  {
    value: "medical",
    question: "Is this medical or diagnostic?",
    answer:
      "No. StoryInColor's readings — including iridology, skincare, and plate analysis — are intended for entertainment and gentle wellness reflection only. They are not a substitute for medical, psychological, or professional advice.",
  },
]

export default function FAQSection() {
  return (
    <section id="faq" className="bg-white py-24 md:py-32">
      <div className="container mx-auto max-w-7xl px-6 md:px-8">
        <div className="mb-12 max-w-2xl">
          <h2 className="text-4xl font-bold tracking-[-0.02em] text-gray-900 md:text-5xl">
            Frequently asked.
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            The honest answers, before you sign up.
          </p>
        </div>

        <div className="mx-auto max-w-3xl">
          <Accordion type="single" collapsible className="space-y-3">
            {FAQS.map((faq) => (
              <AccordionItem
                key={faq.value}
                value={faq.value}
                className="rounded-2xl border border-gray-200 bg-white px-6"
              >
                <AccordionTrigger className="text-base md:text-lg font-semibold text-left">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-gray-700">{faq.answer}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  )
}
