import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"

export default function FAQSection() {
  return (
    <section id="faq" className="py-12 md:py-16 lg:py-20">
      <div className="container mx-auto max-w-7xl px-4 md:px-6">
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">Frequently Asked Questions</h2>
            <p className="max-w-[900px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
              Everything you need to know about StoryInColor's AI photo tools
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-3xl mt-12">
          <Accordion type="single" collapsible className="space-y-4">
            <AccordionItem value="photos" className="rounded-lg border bg-white px-6">
              <AccordionTrigger className="text-lg font-semibold text-left">What kinds of photos work best?</AccordionTrigger>
              <AccordionContent>
                <p className="text-gray-700">
                  Bright, in-focus photos with the subject clearly visible work best. For palm/face/iris readings, follow each tool's input hint for framing.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="credits" className="rounded-lg border bg-white px-6">
              <AccordionTrigger className="text-lg font-semibold text-left">How does the credit system work?</AccordionTrigger>
              <AccordionContent>
                <p className="text-gray-700">
                  Coloring book costs 1 credit per generation; the ten premium tools cost 10 credits each. New accounts start with 2 free credits — enough to try the coloring book twice. Top up any time.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="failures" className="rounded-lg border bg-white px-6">
              <AccordionTrigger className="text-lg font-semibold text-left">What if a generation fails?</AccordionTrigger>
              <AccordionContent>
                <p className="text-gray-700">
                  Your credits are automatically refunded if a generation fails for any reason. You'll see the refund in your usage history right away.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="readings" className="rounded-lg border bg-white px-6">
              <AccordionTrigger className="text-lg font-semibold text-left">Are the readings (palm, face, aura, iridology) real?</AccordionTrigger>
              <AccordionContent>
                <p className="text-gray-700">
                  Each reading tool is intended as a playful entertainment piece, not a medical, psychological, or spiritual diagnosis. Iridology and skincare results are presented as wellness reflections, never as health advice.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="expiry" className="rounded-lg border bg-white px-6">
              <AccordionTrigger className="text-lg font-semibold text-left">Do credits expire?</AccordionTrigger>
              <AccordionContent>
                <p className="text-gray-700">
                  Credits don't expire — use them whenever it's convenient.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </section>
  )
}
