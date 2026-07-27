import { useState } from "react";
import { toast } from "sonner";
import {
  HelpCircle,
  Search,
  QrCode,
  Users,
  ShieldAlert,
  Send,
  Loader2,
  PhoneCall,
  Mail,
  Clock,
  FileSpreadsheet,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqList = [
  {
    id: "faq-1",
    category: "Absensi QR",
    question: "Bagaimana cara memindai QR Code untuk absensi KKN?",
    answer:
      "Buka menu 'Pindai QR' pada akun Mahasiswa, izinkan akses kamera pada browser peramban Anda, lalu arahkan kamera ke kode QR yang ditayangkan oleh Dosen Pembimbing Lapangan (DPL). Pastikan Anda berada di lokasi KKN yang sesuai.",
  },
  {
    id: "faq-2",
    category: "Absensi QR",
    question: "Mengapa kamera tidak dapat memindai QR Code?",
    answer:
      "Pastikan Anda telah memberikan izin (permission) akses kamera pada peramban web (Chrome/Safari/Edge). Jika kamera belum terbuka, coba perbarui halaman atau gunakan mode penyamaran/incognito. Pastikan pencahayaan cukup.",
  },
  {
    id: "faq-3",
    category: "Rekap & Laporan",
    question: "Bagaimana cara DPL mengunduh Rekap Kehadiran dalam PDF/CSV?",
    answer:
      "Masuk ke menu 'Rekap Kehadiran' pada akun Dosen, pilih rentang tanggal atau sesi yang diinginkan, kemudian klik tombol 'Cetak PDF' atau 'Ekspor CSV' di pojok kanan atas tabel.",
  },
  {
    id: "faq-4",
    category: "Akun & Profil",
    question: "Apa yang harus dilakukan jika nama mahasiswa belum muncul di kelompok DPL?",
    answer:
      "Pastikan mahasiswa telah mendaftar dengan memilih kelompok KKN yang sesuai saat pendaftaran. DPL juga dapat menambahkan atau memverifikasi data mahasiswa melalui menu 'Mahasiswa' pada dashboard DPL.",
  },
  {
    id: "faq-5",
    category: "Akun & Profil",
    question: "Bagaimana cara mengganti kata sandi atau email akun?",
    answer:
      "Buka menu 'Settings' pada sidebar kiri, lalu masuk ke bagian 'Keamanan Kata Sandi' untuk memasukkan kata sandi baru. Untuk pembaruan email kampus, gunakan fitur pembaruan email pada menu profil.",
  },
];

export function HelpSupportPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketMessage, setTicketMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const filteredFaqs = faqList.filter(
    (item) =>
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  async function handleSendTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!ticketSubject.trim() || !ticketMessage.trim()) {
      toast.error("Subjek dan pesan bantuan tidak boleh kosong.");
      return;
    }

    setSubmitting(true);
    // Simulate server response delay
    await new Promise((resolve) => setTimeout(resolve, 800));
    setSubmitting(false);

    toast.success("Tiket bantuan Anda berhasil terkirim! Tim dukungan teknis akan mengontak Anda via email.");
    setTicketSubject("");
    setTicketMessage("");
  }

  return (
    <div className="space-y-6 w-full pb-10">
      <PageHeader
        title="Help & Support"
        description="Pusat bantuan teknis, panduan penggunaan, dan layanan informasi sistem absensi KKN."
      />

      {/* Hero Banner Search Bar */}
      <Card className="border-border/60 bg-gradient-to-r from-primary/10 via-background to-muted/40 shadow-2xs overflow-hidden">
        <CardContent className="p-8 text-center space-y-4 max-w-2xl mx-auto">
          <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <HelpCircle className="size-6" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Ada yang bisa kami bantu?
          </h2>
          <p className="text-xs text-muted-foreground">
            Cari jawaban cepat untuk kendala pemindaian QR, rekap data kehadiran, atau pertanyaan seputar akun KKN.
          </p>

          <div className="relative pt-2">
            <Search className="absolute left-3.5 top-5 size-4 text-muted-foreground" />
            <Input
              placeholder="Cari topik bantuan (misal: 'QR Code', 'PDF', 'Password')..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 text-xs bg-background/80 backdrop-blur-xs border-muted-foreground/30 shadow-xs rounded-xl"
            />
          </div>
        </CardContent>
      </Card>

      {/* 3 Kategori Panduan Cepat */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border/60 hover:border-primary/50 transition-all cursor-pointer shadow-2xs group">
          <CardContent className="p-5 space-y-2.5">
            <div className="size-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <QrCode className="size-5" />
            </div>
            <h3 className="font-bold text-sm text-foreground">Panduan Absen QR</h3>
            <p className="text-xs text-muted-foreground">
              Petunjuk memindai QR Code untuk mahasiswa dan cara membuat sesi absen aktif bagi DPL.
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 hover:border-primary/50 transition-all cursor-pointer shadow-2xs group">
          <CardContent className="p-5 space-y-2.5">
            <div className="size-9 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <FileSpreadsheet className="size-5" />
            </div>
            <h3 className="font-bold text-sm text-foreground">Rekap & Laporan PDF/CSV</h3>
            <p className="text-xs text-muted-foreground">
              Cara mudah mengunduh dan mencetak rekapitulasi kehadiran mingguan atau harian.
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 hover:border-primary/50 transition-all cursor-pointer shadow-2xs group">
          <CardContent className="p-5 space-y-2.5">
            <div className="size-9 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Users className="size-5" />
            </div>
            <h3 className="font-bold text-sm text-foreground">Manajemen Kelompok KKN</h3>
            <p className="text-xs text-muted-foreground">
              Pengelolaan anggota mahasiswa binaan, penyesuaian status kehadiran manual, dan lokasi KKN.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: FAQ (Left) + Form Tiket Bantuan (Right) */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* FAQ List (2 Kolom) */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-border/60 shadow-2xs">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-base font-bold">Pertanyaan Sering Diajukan (FAQ)</CardTitle>
                  <CardDescription className="text-xs">
                    Jawaban ringkas untuk masalah yang sering ditemui pengguna.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs font-normal">
                  {filteredFaqs.length} Artikel FAQ
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {filteredFaqs.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground space-y-2">
                  <ShieldAlert className="size-8 mx-auto text-muted-foreground/60" />
                  <p>Tidak ditemukan artikel FAQ yang cocok dengan kata kunci "{searchQuery}".</p>
                </div>
              ) : (
                <Accordion type="single" collapsible className="w-full space-y-2">
                  {filteredFaqs.map((faq) => (
                    <AccordionItem
                      key={faq.id}
                      value={faq.id}
                      className="border border-border/60 rounded-xl px-4 py-1"
                    >
                      <AccordionTrigger className="text-xs font-semibold text-foreground hover:no-underline text-left">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px] font-normal shrink-0">
                            {faq.category}
                          </Badge>
                          <span>{faq.question}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="text-xs text-muted-foreground leading-relaxed pt-2 border-t mt-2">
                        {faq.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar: Tiket Pengaduan & Layanan */}
        <div className="space-y-6">
          {/* Form Tiket Kendala */}
          <Card className="border-border/60 shadow-2xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Send className="size-4 text-primary" />
                Kirim Tiket Bantuan
              </CardTitle>
              <CardDescription className="text-xs">
                Ada kendala khusus? Sampaikan langsung pada tim bantuan teknis kami.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSendTicket} className="space-y-3.5">
                <Field>
                  <FieldLabel htmlFor="subject" className="text-xs font-semibold">
                    Subjek Kendala
                  </FieldLabel>
                  <Input
                    id="subject"
                    value={ticketSubject}
                    onChange={(e) => setTicketSubject(e.target.value)}
                    placeholder="Contoh: Kamera QR tidak terbuka"
                    className="text-xs"
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="message" className="text-xs font-semibold">
                    Detail Pesan Kendala
                  </FieldLabel>
                  <Textarea
                    id="message"
                    rows={4}
                    value={ticketMessage}
                    onChange={(e) => setTicketMessage(e.target.value)}
                    placeholder="Jelaskan masalah atau pesan kesalahan yang Anda alami..."
                    className="text-xs resize-none"
                  />
                </Field>

                <Button type="submit" disabled={submitting} size="sm" className="w-full text-xs font-semibold">
                  {submitting && <Loader2 className="size-3.5 animate-spin" />}
                  Kirim Pesan Bantuan
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Contact Direct Info */}
          <Card className="border-border/60 shadow-2xs bg-muted/20">
            <CardContent className="p-4 space-y-3 text-xs">
              <h4 className="font-bold text-foreground">Kontak Langsung Tim KKN</h4>
              <div className="space-y-2 text-muted-foreground">
                <div className="flex items-center gap-2.5">
                  <Mail className="size-4 text-primary shrink-0" />
                  <span>support@kkn.ac.id</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <PhoneCall className="size-4 text-primary shrink-0" />
                  <span>+62 812-3456-7890 (WhatsApp Helpdesk)</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Clock className="size-4 text-primary shrink-0" />
                  <span>Senin - Jumat (08:00 - 16:00 WIB)</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
