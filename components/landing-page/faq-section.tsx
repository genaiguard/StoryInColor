import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { CinematicSection } from "@/components/cinematic/cinematic-section";

interface FAQ {
  value: string;
  question: string;
  answer: string;
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
      "The coloring page uses 1 credit. Readings — palm, face, aura, iridology, handwriting, style audit, skincare, plate, plant care, room vibes — use 10 credits each. Credit packs start at $3.50 for 5 credits.",
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
];

export default function FAQSection() {
  return (
    <CinematicSection
      id="faq"
      eyebrow="FAQ"
      title={
        <>
          Frequently{" "}
          <span className="italic font-light text-gray-400">asked.</span>
        </>
      }
      description="The honest answers, before you sign up."
      topBorder
    >
      <div className="mx-auto max-w-3xl">
        <Accordion type="single" collapsible className="space-y-3">
          {FAQS.map((faq) => (
            <AccordionItem
              key={faq.value}
              value={faq.value}
              className="liquid-glass overflow-hidden rounded-2xl px-6 [&[data-state=open]]:bg-white/[0.04]"
            >
              <AccordionTrigger className="text-left text-base font-medium text-white hover:no-underline md:text-lg">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-gray-300">{faq.answer}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </CinematicSection>
  );
}
