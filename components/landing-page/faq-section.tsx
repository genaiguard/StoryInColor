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
    value: "cost",
    question: "How much does a reading cost?",
    answer:
      "Pay-as-you-go. Single Issue is $9.99 for one reading. The Three pack is $24 ($8 each, 20% off). The Six pack is $39 ($6.50 each, 35% off). Signing up is free.",
  },
  {
    value: "subscription",
    question: "Is there a subscription?",
    answer:
      "No. Every reading is a single purchase. Your readings never expire, and we don't auto-charge you for anything.",
  },
  {
    value: "photos",
    question: "What kind of photo should I bring?",
    answer:
      "It depends on the reading. The palm reading wants a clear photo of your open palm. The face reading wants a front-facing selfie. The handwriting reading wants a written sample. Each reading page tells you exactly what to upload — and the clearer the photo, the better the result.",
  },
  {
    value: "privacy",
    question: "Are my photos private?",
    answer:
      "Yes. Your photos are used only to generate your reading and are kept on your account so you can re-download. We don't sell your data. You can delete your account and uploads at any time from your settings.",
  },
  {
    value: "speed",
    question: "How long does a reading take?",
    answer:
      "Up to 2 minutes. You stay on the result page while we work and the finished reading appears as soon as it's ready.",
  },
  {
    value: "commercial",
    question: "Can I use the result commercially?",
    answer:
      "Personal use is always covered. For commercial use, please review our Terms — most readings are fine for small-scale commercial projects, but some content types have restrictions.",
  },
  {
    value: "refund",
    question: "What if a reading fails?",
    answer:
      "If a reading fails for technical reasons, the reading is automatically refunded to your balance. If you're unhappy with a successful one, contact us — we'll always try to make it right.",
  },
  {
    value: "medical",
    question: "Is this medical or diagnostic?",
    answer:
      "No. StoryInColor's readings — including iridology and skincare — are intended for entertainment and gentle wellness reflection only. They are not a substitute for medical, psychological, or professional advice.",
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
