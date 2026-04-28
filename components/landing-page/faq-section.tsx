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
      "Credits are how you pay for generations on StoryInColor. Each tool consumes a small number of credits per result, and new accounts start with 2 free credits.",
  },
  {
    value: "cost",
    question: "How much does each tool cost?",
    answer:
      "The Coloring Book is 1 credit per generation. All ten premium tools (palm reading, face reading, style audit, plant care, and more) are 10 credits each.",
  },
  {
    value: "privacy",
    question: "Are my photos private?",
    answer:
      "Yes. Your photos are only used to generate your result. We never sell your data and never share your uploads with anyone outside our processing pipeline.",
  },
  {
    value: "speed",
    question: "How long does generation take?",
    answer:
      "Most generations finish in under a minute. Larger or more detailed tools can take a little longer, but you'll see progress in real time.",
  },
  {
    value: "commercial",
    question: "Can I use the result commercially?",
    answer:
      "Personal use is always covered. For commercial use, please review our Terms — most outputs are fine for small-scale commercial projects, but some content types have restrictions.",
  },
  {
    value: "refund",
    question: "What if I don't like the result?",
    answer:
      "If a generation fails for technical reasons, your credits are refunded automatically. If you're unhappy with a successful result, contact us — we'll always try to make it right.",
  },
  {
    value: "storage",
    question: "Do you store my photo after generation?",
    answer:
      "We retain uploads as part of your generation history so you can re-download results from your dashboard. Photos are sent to our AI processing provider (OpenAI) for the generation step only and are not used for training. You can delete your account and all associated uploads at any time from your account settings.",
  },
  {
    value: "medical",
    question: "Is this medical or diagnostic?",
    answer:
      "No. StoryInColor's tools — including iridology, skincare, and the reading tools — are intended for entertainment and gentle wellness reflection only. They are not a substitute for medical, psychological, or professional advice.",
  },
]

export default function FAQSection() {
  return (
    <section id="faq" className="py-12 md:py-16 lg:py-20 bg-white">
      <div className="container mx-auto max-w-7xl px-4 md:px-6">
        <div className="flex flex-col items-center justify-center space-y-3 text-center">
          <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
            Frequently asked questions
          </h2>
          <p className="max-w-[720px] text-gray-600 md:text-lg">
            Everything you need to know about StoryInColor's AI photo tools.
          </p>
        </div>

        <div className="mx-auto max-w-3xl mt-10">
          <Accordion type="single" collapsible className="space-y-3">
            {FAQS.map((faq) => (
              <AccordionItem
                key={faq.value}
                value={faq.value}
                className="rounded-lg border bg-white px-6"
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
