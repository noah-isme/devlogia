import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

const faqs = [
  {
    id: "faq-1",
    question: "Can I migrate from WordPress?",
    answer: "Yes. We provide an automatic importer and an API for moving content across from WordPress, Ghost, and other platforms, and our support team can help you plan the migration.",
  },
  {
    id: "faq-2",
    question: "How is the AI quota calculated?",
    answer: "AI usage is metered per token (roughly four characters). The Free plan includes 1,000 tokens per month and Pro includes 50,000 tokens per month. Add-on token packs are available if you need more.",
  },
  {
    id: "faq-3",
    question: "Is there a plugin store?",
    answer: "Yes. The Devlogia Marketplace offers plugins, templates, and AI extensions built by the community, and you can publish and sell your own.",
  },
  {
    id: "faq-4",
    question: "Does it support team collaboration?",
    answer: "It does. Multi-tenancy and role-based access control let teams work together safely, and every member can hold a different role such as admin, editor, or contributor.",
  },
  {
    id: "faq-5",
    question: "What about self-hosting?",
    answer: "We ship a Docker image and a full deployment guide for self-hosting. The source is available on GitHub under the MIT licence, and Enterprise plans add a support agreement on top of it.",
  },
  {
    id: "faq-6",
    question: "Do you offer education discounts?",
    answer: "Yes. Educational institutions and nonprofits receive 50% off. Contact support from your institutional email address and we will verify your account.",
  },
];

export function FAQSection() {
  return (
    <section className="py-16 space-y-8">
      <ScrollReveal direction="up">
        <div className="text-center space-y-4">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Frequently asked questions
          </h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            Answers to the things people ask us most often.
          </p>
        </div>
      </ScrollReveal>

      <ScrollReveal direction="up" delay={150}>
        <div className="mx-auto max-w-3xl rounded-2xl border border-border/80 bg-card p-4 sm:p-6 shadow-sm">
          <Accordion>
            {faqs.map((faq) => (
              <AccordionItem key={faq.id} id={faq.id} className="border-border/60 transition-colors duration-200 hover:border-primary/30">
                <AccordionTrigger id={faq.id} className="text-left font-semibold hover:text-primary transition-colors">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent id={faq.id} className="text-muted-foreground leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </ScrollReveal>
    </section>
  );
}
