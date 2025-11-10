import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
  {
    id: "faq-1",
    question: "Apakah bisa migrasi dari WordPress?",
    answer: "Ya, kami menyediakan importer otomatis dan API untuk migrasi konten dari WordPress, Ghost, dan platform lainnya. Tim support kami siap membantu proses migrasi Anda.",
  },
  {
    id: "faq-2",
    question: "Bagaimana kuota AI dihitung?",
    answer: "Kuota AI dihitung per token (sekitar 4 karakter). Plan Free dapat 1000 tokens/bulan, Pro mendapat 50k tokens/bulan. Anda bisa membeli add-on tokens jika diperlukan.",
  },
  {
    id: "faq-3",
    question: "Apakah ada plugin store?",
    answer: "Ya, Devlogia Marketplace menyediakan plugin, template, dan AI extensions yang dibuat oleh komunitas. Anda juga bisa menjual plugin sendiri.",
  },
  {
    id: "faq-4",
    question: "Apakah mendukung tim kolaborasi?",
    answer: "Tentu! Sistem multi-tenant dan role-based access control memungkinkan tim berkolaborasi dengan aman. Setiap anggota bisa punya role berbeda (admin, editor, contributor).",
  },
  {
    id: "faq-5",
    question: "Bagaimana dengan self-hosting?",
    answer: "Kami menyediakan Docker image dan deployment guide lengkap untuk self-hosting. Source code tersedia di GitHub dengan lisensi MIT untuk plan Enterprise.",
  },
  {
    id: "faq-6",
    question: "Apakah ada diskon untuk edukasi?",
    answer: "Ya, kami memberikan diskon 50% untuk institusi pendidikan dan nonprofit. Silakan hubungi support dengan email institusi Anda untuk verifikasi.",
  },
];

export function FAQSection() {
  return (
    <section className="py-16 space-y-8">
      <div className="text-center space-y-4">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Pertanyaan Umum
        </h2>
        <p className="mx-auto max-w-2xl text-muted-foreground">
          Temukan jawaban untuk pertanyaan yang sering ditanyakan.
        </p>
      </div>
      <div className="mx-auto max-w-3xl">
        <Accordion>
          {faqs.map((faq) => (
            <AccordionItem key={faq.id} id={faq.id}>
              <AccordionTrigger id={faq.id}>{faq.question}</AccordionTrigger>
              <AccordionContent id={faq.id}>{faq.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
