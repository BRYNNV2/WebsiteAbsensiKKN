import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { id as localeID } from "date-fns/locale";

export interface LogbookEntryItem {
  id?: string;
  week_number: number;
  entry_date: string;
  day_name: string;
  time_range: string;
  activity_name: string;
  activity_description: string;
  documentation_url?: string | null;
  status?: string;
  dosen_notes?: string | null;
}

export interface StudentLogbookProfile {
  full_name: string;
  student_id: string; // NIM
  faculty_prodi?: string;
  group_name?: string;
  group_location?: string;
  dosen_name?: string;
  lurah_head_name?: string;
}

const ROMAN_WEEKS = ["I (PERTAMA)", "II (KEDUA)", "III (KETIGA)", "IV (KEEMPAT)", "V (KELIMA)"];

export async function exportLogbookToDocx(
  student: StudentLogbookProfile,
  entries: LogbookEntryItem[],
  weeklyNotes: string[] = [],
  weekNumber: number = 1
) {
  try {
    let response = await fetch("/templates/template_logbook_kkn_prepared.docx");
    if (!response.ok) {
      response = await fetch("/templates/template_logbook_kkn.docx");
    }
    if (!response.ok) {
      throw new Error("File template_logbook_kkn.docx tidak ditemukan di public/templates/");
    }

    const content = await response.arrayBuffer();
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    const weekText = ROMAN_WEEKS[weekNumber - 1] || `${weekNumber}`;

    const formattedEntries = entries.map((item, index) => ({
      no: index + 1,
      day_name: item.day_name || "",
      entry_date: item.entry_date
        ? format(new Date(item.entry_date), "dd/MM/yyyy")
        : "",
      time_range: item.time_range || "",
      activity_name: item.activity_name || "",
      activity_description: item.activity_description || "",
      documentation: item.documentation_url ? "Ada Dokumentasi" : "-",
    }));

    const data = {
      full_name: student.full_name || "",
      student_id: student.student_id || "",
      faculty_prodi: student.faculty_prodi || "FTTK / Teknik Informatika",
      group_location: student.group_location || student.group_name || "-",
      dosen_name: student.dosen_name || "-",
      year: new Date().getFullYear().toString(),
      week_label: `MINGGU ${weekText}`,
      group_info: `${student.full_name} / ${student.student_id} / ${student.group_name || "-"}`,
      entries: formattedEntries,
      note_1: weeklyNotes[0] || "-",
      note_2: weeklyNotes[1] || "-",
      note_3: weeklyNotes[2] || "-",
    };

    doc.render(data);
    const out = doc.getZip().generate({
      type: "blob",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    const fileName = `LOGBOOK_KKN_MINGGU_${weekNumber}_${student.student_id}.docx`;
    saveAs(out, fileName);
  } catch (err) {
    console.error("Gagal mengunduh file DOCX:", err);
    throw err;
  }
}

export function exportLogbookToPdf(
  student: StudentLogbookProfile,
  entries: LogbookEntryItem[],
  weeklyNotes: string[] = [],
  weekNumber: number = 1
) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const weekText = ROMAN_WEEKS[weekNumber - 1] || `${weekNumber}`;

  // --- HALAMAN 1: COVER / SAMPUL ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("BUKU CATATAN HARIAN (LOGBOOK)", 105, 30, { align: "center" });
  doc.text("KULIAH KERJA NYATA (KKN)", 105, 38, { align: "center" });
  doc.text("UNIVERSITAS MARITIM RAJA ALI HAJI", 105, 46, { align: "center" });

  // Frame Foto 4x6
  doc.rect(87, 65, 36, 48);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Foto 4x6", 105, 91, { align: "center" });

  // Tabel Identitas Sampul
  autoTable(doc, {
    startY: 125,
    margin: { left: 25, right: 25 },
    theme: "grid",
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0] },
    body: [
      ["NAMA", student.full_name || "-"],
      ["NIM", student.student_id || "-"],
      ["FAKULTAS/PRODI", student.faculty_prodi || "FTTK / Teknik Informatika"],
      ["NAMA LOKASI KKN", student.group_location || student.group_name || "-"],
      ["NAMA DOSEN PENDAMPING LAPANGAN", student.dosen_name || "-"],
    ],
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 60 },
      1: { cellWidth: 100 },
    },
    styles: { fontSize: 9, cellPadding: 3.5 },
  });

  // Footer Cover
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("LEMBAGA PENELITIAN DAN PENGABDIAN KEPADA MASYARAKAT", 105, 250, { align: "center" });
  doc.text("UNIVERSITAS MARITIM RAJA ALI HAJI", 105, 257, { align: "center" });
  doc.setFontSize(10);
  doc.text(new Date().getFullYear().toString(), 105, 264, { align: "center" });

  // --- HALAMAN 2: ISI LOGBOOK MINGGUAN ---
  doc.addPage();

  // Header Box Logbook Halaman 2
  doc.setLineWidth(0.5);
  doc.rect(15, 15, 180, 28);
  doc.line(140, 15, 140, 43);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("LOGBOOK KULIAH KERJA NYATA", 50, 24);
  doc.text("UNIVERSITAS MARITIM RAJA ALI HAJI", 50, 31);

  doc.setFontSize(9);
  doc.text(`MINGGU ${weekText}`, 165, 27, { align: "center" });

  // Bar Identitas Singkat
  doc.rect(15, 43, 180, 8);
  doc.setFontSize(8.5);
  doc.text(
    `NAMA MAHASISWA/NIM/KELOMPOK: ${student.full_name} / ${student.student_id} / ${student.group_name || "-"}`,
    18,
    48.5
  );

  // Section A. JADWAL
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("A. JADWAL:", 15, 57);

  const tableBody = entries.map((item) => [
    item.day_name || "",
    item.entry_date
      ? format(new Date(item.entry_date), "dd/MM/yyyy", { locale: localeID })
      : "",
    item.time_range || "",
    item.activity_description || item.activity_name || "",
    item.documentation_url ? "Ada Dokumentasi" : "-",
  ]);

  autoTable(doc, {
    startY: 60,
    margin: { left: 15, right: 15 },
    theme: "grid",
    head: [["HARI", "TANGGAL", "JAM", "KEGIATAN", "Dokumentasi"]],
    body: tableBody.length > 0 ? tableBody : [["-", "-", "-", "Belum ada kegiatan", "-"]],
    headStyles: {
      fillColor: [230, 230, 230],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      fontSize: 8.5,
      halign: "center",
    },
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 25 },
      2: { cellWidth: 30 },
      3: { cellWidth: 75 },
      4: { cellWidth: 30, halign: "center" },
    },
  });

  // Section B. CATATAN PENTING HARIAN
  const finalY = (doc as any).lastAutoTable?.finalY || 140;
  const notesStartY = Math.min(finalY + 8, 200);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("B. CATATAN PENTING HARIAN", 15, notesStartY);

  doc.rect(15, notesStartY + 3, 180, 25);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`1. ${weeklyNotes[0] || "-"}`, 18, notesStartY + 9);
  doc.text(`2. ${weeklyNotes[1] || "-"}`, 18, notesStartY + 15);
  doc.text(`3. ${weeklyNotes[2] || "-"}`, 18, notesStartY + 21);

  // Section D. PENGESAHAN
  const pengesahanY = notesStartY + 33;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("D. PENGESAHAN", 15, pengesahanY);

  doc.rect(15, pengesahanY + 3, 90, 30);
  doc.rect(105, pengesahanY + 3, 90, 30);

  doc.setFontSize(8);
  doc.text("TANDA TANGAN LURAH/KEPALA DESA", 60, pengesahanY + 8, { align: "center" });
  doc.text("TANDA TANGAN MAHASISWA", 150, pengesahanY + 8, { align: "center" });

  doc.text(`(${student.lurah_head_name || "...................................."})`, 60, pengesahanY + 29, { align: "center" });
  doc.text(`(${student.full_name})`, 150, pengesahanY + 29, { align: "center" });

  const fileName = `LOGBOOK_KKN_MINGGU_${weekNumber}_${student.student_id}.pdf`;
  doc.save(fileName);
}
