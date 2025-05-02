export default function FAQSection() {
  return (
    <section id="faq" className="py-12 md:py-16 lg:py-20">
      <div className="container mx-auto max-w-7xl px-4 md:px-6">
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">Frequently Asked Questions</h2>
            <p className="max-w-[900px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
              Everything you need to know about our custom coloring pages
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-3xl mt-12 space-y-6">
          <div className="rounded-lg border bg-white p-6">
            <h3 className="text-lg font-bold">How long does it take to receive my coloring pages?</h3>
            <p className="mt-2 text-gray-700">
              Your custom coloring pages are generated into a PDF file almost instantly after purchase.
              You'll receive a download link via email and can also access it from your dashboard.
            </p>
          </div>

          <div className="rounded-lg border bg-white p-6">
            <h3 className="text-lg font-bold">What type of photos work best?</h3>
            <p className="mt-2 text-gray-700">
              Clear photos with good lighting work best. Photos with distinct subjects and minimal background clutter
              convert most effectively into coloring pages. We recommend uploading high-resolution images for the best
              results.
            </p>
          </div>

          <div className="rounded-lg border bg-white p-6">
            <h3 className="text-lg font-bold">Can I create coloring books of my pets?</h3>
            <p className="mt-2 text-gray-700">
              Pet portraits make wonderful coloring pages. Our AI technology works great with dogs, cats, and other
              pets. Just upload clear photos of your furry friends, and we'll transform them into delightful coloring
              pages.
            </p>
          </div>

          <div className="rounded-lg border bg-white p-6">
            <h3 className="text-lg font-bold">Can I preview my coloring book before ordering?</h3>
            <p className="mt-2 text-gray-700">
              Yes! You can preview your custom coloring pages. This allows you to make adjustments or replace photos if needed.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

