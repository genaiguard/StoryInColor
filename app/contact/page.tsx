"use client";

import Link from "next/link";
import { useState, FormEvent } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { Loader2, AlertCircle, CheckCircle, Send } from "lucide-react";
import Header from "@/components/landing-page/header";
import Footer from "@/components/landing-page/footer";

const INPUT_CLASS =
  "w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-gray-500 transition-colors focus:border-white/30 focus:outline-none focus:ring-0";

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitResult(null);

    try {
      if (
        !formData.name ||
        !formData.email ||
        !formData.subject ||
        !formData.message
      ) {
        setSubmitResult({
          success: false,
          message: "Please fill in all fields",
        });
        setIsSubmitting(false);
        return;
      }

      const functions = getFunctions();
      const submitContactForm = httpsCallable(functions, "submitContactForm");
      const result = await submitContactForm(formData);
      const data = result.data as { success: boolean; message: string };

      setSubmitResult({
        success: true,
        message:
          data.message ||
          "Your message has been sent. We will get back to you soon.",
      });

      setFormData({ name: "", email: "", subject: "", message: "" });
    } catch (error: any) {
      setSubmitResult({
        success: false,
        message:
          error.message || "An error occurred. Please try again later.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <Header />

      <main className="flex-1 px-4 pb-16 pt-32 md:px-8 md:pt-36">
        <div className="container mx-auto max-w-3xl">
          <div className="mb-10 max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-gray-500">
              <span className="h-px w-8 bg-white/20" aria-hidden="true" />
              Contact
            </div>
            <h1
              className="text-3xl font-normal tracking-[-0.04em] sm:text-4xl md:text-5xl"
            >
              Get in{" "}
              <span className="italic font-light text-gray-400">touch.</span>
            </h1>
            <p className="mt-3 text-base text-gray-400 md:text-lg">
              We'd love to hear from you. Drop us a note and we'll write back.
            </p>
          </div>

          <div className="liquid-glass rounded-2xl p-6 md:p-8">
            {submitResult && (
              <div
                role={submitResult.success ? "status" : "alert"}
                className={`mb-6 flex items-start gap-2 rounded-xl border p-3 text-sm ${
                  submitResult.success
                    ? "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-200"
                    : "border-red-500/20 bg-red-500/[0.06] text-red-200"
                }`}
              >
                {submitResult.success ? (
                  <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                ) : (
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                )}
                <span>{submitResult.message}</span>
              </div>
            )}

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <label
                    htmlFor="name"
                    className="text-xs font-medium uppercase tracking-wider text-gray-400"
                  >
                    Name
                  </label>
                  <input
                    id="name"
                    value={formData.name}
                    onChange={handleChange}
                    disabled={isSubmitting}
                    required
                    className={INPUT_CLASS}
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="email"
                    className="text-xs font-medium uppercase tracking-wider text-gray-400"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    disabled={isSubmitting}
                    required
                    className={INPUT_CLASS}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="subject"
                  className="text-xs font-medium uppercase tracking-wider text-gray-400"
                >
                  Subject
                </label>
                <input
                  id="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  required
                  className={INPUT_CLASS}
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="message"
                  className="text-xs font-medium uppercase tracking-wider text-gray-400"
                >
                  Message
                </label>
                <textarea
                  id="message"
                  value={formData.message}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  required
                  className={`${INPUT_CLASS} h-36 resize-y`}
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:opacity-60 sm:w-auto"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Send message
                  </>
                )}
              </button>
            </form>
          </div>

          <p className="mt-6 text-xs text-gray-500">
            For account or billing issues, please include your account email
            so we can help you faster.{" "}
            <Link
              href="/dashboard"
              className="text-gray-300 transition-colors hover:text-white"
            >
              Back to dashboard
            </Link>
            .
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
