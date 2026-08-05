import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
// @ts-ignore
import ImageModule from "docxtemplater-image-module-free";
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

export interface AuthorityItem {
  id: string;
  title: string;
  name: string;
}

export interface StudentLogbookProfile {
  full_name: string;
  student_id: string; // NIM
  faculty_prodi?: string;
  group_name?: string;
  group_location?: string;
  dosen_name?: string;
  lurah_head_name?: string;
  authorities?: AuthorityItem[];
}

export interface WeekBundleData {
  weekNumber: number;
  entries: LogbookEntryItem[];
  weeklyNotes: string[];
}

const ROMAN_WEEKS = ["I (PERTAMA)", "II (KEDUA)", "III (KETIGA)", "IV (KEEMPAT)", "V (KELIMA)"];

export function cropImageToAspectRatio(
  dataUrl: string,
  targetRatio: number = 4 / 3,
  targetWidth: number = 800,
  targetHeight: number = 600
): Promise<string> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !dataUrl || !dataUrl.startsWith("data:image/")) {
      return resolve(dataUrl);
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(dataUrl);

        const sourceWidth = img.width;
        const sourceHeight = img.height;
        const sourceRatio = sourceWidth / sourceHeight;

        let drawWidth = sourceWidth;
        let drawHeight = sourceHeight;
        let offsetX = 0;
        let offsetY = 0;

        if (sourceRatio > targetRatio) {
          drawWidth = sourceHeight * targetRatio;
          offsetX = (sourceWidth - drawWidth) / 2;
        } else {
          drawHeight = sourceWidth / targetRatio;
          offsetY = (sourceHeight - drawHeight) / 2;
        }

        canvas.width = targetWidth;
        canvas.height = targetHeight;

        ctx.drawImage(
          img,
          offsetX,
          offsetY,
          drawWidth,
          drawHeight,
          0,
          0,
          canvas.width,
          canvas.height
        );

        resolve(canvas.toDataURL("image/jpeg", 0.88));
      } catch (e) {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function parseDocumentationPhotos(rawUrl?: string | null): string[] {
  if (!rawUrl || !rawUrl.trim()) return [];
  const trimmed = rawUrl.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const arr = JSON.parse(trimmed);
      if (Array.isArray(arr)) {
        return arr.filter((x) => typeof x === "string" && x.trim());
      }
    } catch (e) {}
  }
  return [trimmed];
}

const imageSizeMap = new Map<string, [number, number]>();

export function combineImagesToCollage(
  images: string[],
  targetWidth: number = 800,
  singleHeight: number = 600
): Promise<string> {
  return new Promise((resolve) => {
    if (!images || images.length === 0) return resolve("");
    if (images.length === 1) {
      return cropImageToAspectRatio(images[0], 4 / 3, targetWidth, singleHeight).then((url) => {
        imageSizeMap.set(url, [132, 99]);
        return url;
      }).then(resolve);
    }

    if (typeof window === "undefined") {
      return resolve(images[0]);
    }

    const count = Math.min(images.length, 5);
    const loadedImages: HTMLImageElement[] = [];
    let loadedCount = 0;

    images.slice(0, count).forEach((src, idx) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        loadedImages[idx] = img;
        loadedCount++;
        if (loadedCount === count) {
          drawCollage();
        }
      };
      img.onerror = () => {
        loadedCount++;
        if (loadedCount === count) {
          drawCollage();
        }
      };
      img.src = src;
    });

    function drawCollage() {
      try {
        const gap = 36;
        const totalHeight = count * singleHeight + (count - 1) * gap;

        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = totalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(images[0]);

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, targetWidth, totalHeight);

        for (let i = 0; i < count; i++) {
          if (loadedImages[i]) {
            const currentY = i * (singleHeight + gap);
            drawCover(ctx, loadedImages[i], 0, currentY, targetWidth, singleHeight);
          }
        }

        const collageUrl = canvas.toDataURL("image/jpeg", 0.88);
        const cellHeight = Math.round(132 * (totalHeight / targetWidth));
        imageSizeMap.set(collageUrl, [132, cellHeight]);

        resolve(collageUrl);
      } catch (e) {
        resolve(images[0]);
      }
    }

    function drawCover(
      ctx: CanvasRenderingContext2D,
      img: HTMLImageElement,
      x: number,
      y: number,
      w: number,
      h: number
    ) {
      const imgRatio = img.width / img.height;
      const cellRatio = w / h;
      let sW = img.width;
      let sH = img.height;
      let sX = 0;
      let sY = 0;

      if (imgRatio > cellRatio) {
        sW = img.height * cellRatio;
        sX = (img.width - sW) / 2;
      } else {
        sH = img.width / cellRatio;
        sY = (img.height - sH) / 2;
      }

      ctx.drawImage(img, sX, sY, sW, sH, x, y, w, h);
    }
  });
}

export async function exportLogbookToDocx(
  student: StudentLogbookProfile,
  entriesOrBundles: LogbookEntryItem[] | WeekBundleData[],
  weeklyNotesOrPhoto?: string[] | string | ArrayBuffer | null,
  weekNumberOrPhoto?: number | string | ArrayBuffer | null,
  photoUrlOrBuffer?: string | ArrayBuffer | null
) {
  try {
    let bundles: WeekBundleData[] = [];
    let photo: string | ArrayBuffer | null | undefined = photoUrlOrBuffer;

    if (
      Array.isArray(entriesOrBundles) &&
      entriesOrBundles.length > 0 &&
      "weekNumber" in entriesOrBundles[0]
    ) {
      bundles = entriesOrBundles as WeekBundleData[];
      photo = weeklyNotesOrPhoto as any;
    } else {
      bundles = [
        {
          weekNumber: typeof weekNumberOrPhoto === "number" ? weekNumberOrPhoto : 1,
          entries: (entriesOrBundles as LogbookEntryItem[]) || [],
          weeklyNotes: Array.isArray(weeklyNotesOrPhoto) ? weeklyNotesOrPhoto : [],
        },
      ];
    }

    let response = await fetch("/templates/template_logbook_kkn_prepared.docx");
    if (!response.ok) {
      response = await fetch("/templates/template_logbook_kkn.docx");
    }
    if (!response.ok) {
      throw new Error("File template_logbook_kkn.docx tidak ditemukan di public/templates/");
    }

    const content = await response.arrayBuffer();

    let hasPhoto = false;
    let photoBuffer: ArrayBuffer | null = null;
    if (photo) {
      try {
        if (typeof photo === "string" && photo.trim()) {
          const res = await fetch(photo);
          if (res.ok) {
            photoBuffer = await res.arrayBuffer();
          }
        } else if (photo instanceof ArrayBuffer) {
          photoBuffer = photo;
        }
        if (photoBuffer) {
          hasPhoto = true;
        }
      } catch (imgErr) {
        console.warn("Gagal mengambil pas foto 4x6:", imgErr);
      }
    }

    // Gabungkan seluruh entri dari seluruh minggu pilihan dalam 1 tabel kontinu & urutkan kronologis
    const allRawEntries: LogbookEntryItem[] = [];
    const allNotesList: string[] = [];

    bundles.forEach((bundle) => {
      allRawEntries.push(...(bundle.entries || []));
      if (Array.isArray(bundle.weeklyNotes)) {
        bundle.weeklyNotes.forEach((n) => {
          if (n && n.trim()) {
            allNotesList.push(n.trim());
          }
        });
      }
    });

    const sortedEntries = allRawEntries.sort(
      (a, b) => new Date(a.entry_date || "").getTime() - new Date(b.entry_date || "").getTime()
    );

    const formattedEntries = await Promise.all(
      sortedEntries.map(async (item, index) => {
        let docVal: any = "-";

        if (item.documentation_url) {
          const photos = parseDocumentationPhotos(item.documentation_url);
          if (photos.length > 0) {
            const processedPhotos = await Promise.all(
              photos.map(async (photo) => {
                if (photo.startsWith("data:image/")) {
                  return photo;
                } else if (photo.startsWith("http")) {
                  try {
                    const res = await fetch(photo);
                    if (res.ok) {
                      const blob = await res.blob();
                      return await new Promise<string>((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.readAsDataURL(blob);
                      });
                    }
                  } catch (e) {}
                }
                return photo;
              })
            );

            const validPhotos = processedPhotos.filter((p) => p && p.startsWith("data:image/"));
            if (validPhotos.length > 0) {
              docVal = await combineImagesToCollage(validPhotos, 800, 600);
            } else if (photos[0]) {
              docVal = photos[0];
            }
          }
        }

        return {
          no: index + 1,
          day_name: item.day_name || "",
          entry_date: item.entry_date
            ? format(new Date(item.entry_date), "dd/MM/yyyy")
            : "",
          time_range: item.time_range || "",
          activity_description: item.activity_description || item.activity_name || "",
          documentation: docVal,
        };
      })
    );

    let weekLabelText = "";
    if (bundles.length === 1) {
      const wText = ROMAN_WEEKS[bundles[0].weekNumber - 1] || `${bundles[0].weekNumber}`;
      weekLabelText = `MINGGU ${wText}`;
    } else if (bundles.length === 5) {
      weekLabelText = "KESELURUHAN (MINGGU I - V)";
    } else {
      const wList = bundles.map((b) => ROMAN_WEEKS[b.weekNumber - 1] || `${b.weekNumber}`).join(", ");
      weekLabelText = `MINGGU ${wList}`;
    }

    const imageOpts = {
      centered: true,
      setParser: function (tag: string) {
        if (tag === "documentation") {
          return {
            type: "placeholder",
            value: "documentation",
            module: "open-xml-templating/docxtemplater-image-module",
            centered: true,
          };
        }
        return null;
      },
      getImage: function (tagValue: any) {
        if (typeof tagValue === "string" && tagValue.startsWith("data:image/")) {
          const base64Data = tagValue.includes(",") ? tagValue.split(",")[1] : tagValue;
          const binaryString = atob(base64Data);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          return bytes.buffer;
        }
        return null;
      },
      getSize: function (_imgBuffer: any, tagValue: any) {
        if (typeof tagValue === "string" && imageSizeMap.has(tagValue)) {
          return imageSizeMap.get(tagValue)!;
        }
        return [132, 99];
      },
    };

    const imageModule = new ImageModule(imageOpts);
    const origRender = imageModule.render.bind(imageModule);

    imageModule.render = function (part: any, options: any) {
      const tagValue = options.scopeManager.getValue(part.value, { part });
      if (tagValue && typeof tagValue === "string" && !tagValue.startsWith("data:image/")) {
        let textVal = tagValue.trim();
        if (!textVal || textVal === "-") {
          return { value: textVal || "-" };
        }

        let rawUrl = textVal.replace(/^Dokumentasi:\s*/i, "").trim();
        const isUrl = rawUrl.match(/^(https?:\/\/|[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)/i);

        if (isUrl) {
          let fullUrl = rawUrl;
          if (!fullUrl.startsWith("http://") && !fullUrl.startsWith("https://")) {
            fullUrl = "https://" + fullUrl;
          }
          const escapedUrl = fullUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
          const hyperlinkXml = `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:fldSimple w:instr="HYPERLINK &quot;${escapedUrl}&quot;"><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:color w:val="0563C1"/><w:u w:val="single"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:b/></w:rPr><w:t>Buka Link Dokumentasi ↗</w:t></w:r></w:fldSimple></w:r></w:p>`;
          return { value: hyperlinkXml };
        }

        return { value: textVal };
      }
      return origRender(part, options);
    };

    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
      modules: [imageModule],
      paragraphLoop: true,
      linebreaks: true,
    });

    let lurahHeadTitle = "TANDA TANGAN LURAH / KEPALA DESA";
    let lurahHeadName = "( .................................... )";

    if (student.authorities && student.authorities.length > 0) {
      const firstAuth = student.authorities[0];
      const firstTitle = firstAuth.title ? firstAuth.title.trim().toUpperCase() : "LURAH / KEPALA DESA";
      const firstName = firstAuth.name ? firstAuth.name.trim() : "....................................";

      lurahHeadTitle = firstTitle.startsWith("TANDA TANGAN") ? firstTitle : `TANDA TANGAN ${firstTitle}`;
      lurahHeadName = `( ${firstName} )`;

      if (student.authorities.length > 1) {
        const extraAuthoritiesText = student.authorities
          .slice(1)
          .map((auth) => {
            const t = auth.title ? auth.title.trim().toUpperCase() : "PIHAK BERWENANG";
            const fullT = t.startsWith("TANDA TANGAN") ? t : `TANDA TANGAN ${t}`;
            const n = auth.name ? auth.name.trim() : "....................................";
            return `\n\n\n\n${fullT}\n\n\n\n( ${n} )`;
          })
          .join("");

        lurahHeadName += extraAuthoritiesText;
      }
    } else if (student.lurah_head_name) {
      lurahHeadName = `( ${student.lurah_head_name.trim()} )`;
    }

    doc.render({
      full_name: student.full_name || "",
      student_id: student.student_id || "",
      faculty_prodi: student.faculty_prodi || "FTTK / Teknik Informatika",
      group_location: student.group_location || student.group_name || "-",
      dosen_name: student.dosen_name || "-",
      lurah_head_title: lurahHeadTitle,
      lurah_head_name: lurahHeadName,
      year: new Date().getFullYear().toString(),
      week_label: weekLabelText,
      group_info: `${student.full_name} / ${student.student_id} / ${student.group_name || "-"}`,
      entries: formattedEntries,
      note_1: allNotesList[0] || "-",
      note_2: allNotesList[1] || "-",
      note_3: allNotesList[2] || "-",
    });

    const renderedZip = doc.getZip();
    let documentXml = renderedZip.file("word/document.xml")?.asText() || "";

    // Embed Pas Foto 4x6 jika ada
    if (hasPhoto && photoBuffer) {
      try {
        renderedZip.file("word/media/pasfoto_profile.png", photoBuffer);

        let relsXml = renderedZip.file("word/_rels/document.xml.rels")?.asText() || "";
        if (!relsXml.includes('Id="rIdPasFoto4x6"')) {
          relsXml = relsXml.replace(
            "</Relationships>",
            '<Relationship Id="rIdPasFoto4x6" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/pasfoto_profile.png"/></Relationships>'
          );
          renderedZip.file("word/_rels/document.xml.rels", relsXml);
        }

        const newPhotoParagraph = '<w:p><w:r><w:rPr><w:noProof/></w:rPr><w:drawing><wp:anchor distT="0" distB="180000" distL="0" distR="0" simplePos="0" relativeHeight="251661312" behindDoc="0" locked="0" layoutInCell="1" hidden="0" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="column"><wp:posOffset>2336800</wp:posOffset></wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>0</wp:posOffset></wp:positionV><wp:extent cx="1270000" cy="1546225"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapTopAndBottom distT="0" distB="180000"/><wp:docPr id="9999" name="PasFoto4x6"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="9999" name="pasfoto4x6.png"/><pic:cNvPicPr preferRelativeResize="0"/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdPasFoto4x6"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1270000" cy="1546225"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:ln/></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r></w:p>';

        const tblIdx = documentXml.indexOf("<w:tbl>");
        if (tblIdx !== -1) {
          documentXml = documentXml.substring(0, tblIdx) + newPhotoParagraph + documentXml.substring(tblIdx);
        }
        renderedZip.file("word/document.xml", documentXml);
      } catch (xmlErr) {
        console.warn("Gagal menyisipkan pas foto 4x6:", xmlErr);
      }
    }

    const out = renderedZip.generate({
      type: "blob",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    let fileName = "";
    if (bundles.length === 1) {
      fileName = `LOGBOOK_KKN_MINGGU_${bundles[0].weekNumber}_${student.student_id || "MAHASISWA"}.docx`;
    } else if (bundles.length === 5) {
      fileName = `LOGBOOK_KKN_SEMUA_MINGGU_${student.student_id || "MAHASISWA"}.docx`;
    } else {
      const weekNums = bundles.map((b) => b.weekNumber).join("_");
      fileName = `LOGBOOK_KKN_MINGGU_${weekNums}_${student.student_id || "MAHASISWA"}.docx`;
    }

    saveAs(out, fileName);
  } catch (error: any) {
    console.error("Error generating DOCX logbook:", error);
    throw error;
  }
}

export async function exportLogbookToPdf(
  student: StudentLogbookProfile,
  entriesOrBundles: LogbookEntryItem[] | WeekBundleData[],
  weeklyNotesOrPhoto?: string[] | string | ArrayBuffer | null,
  weekNumberOrPhoto?: number | string | ArrayBuffer | null,
  photoUrlOrBuffer?: string | ArrayBuffer | null
) {
  let bundles: WeekBundleData[] = [];
  let photo: string | ArrayBuffer | null | undefined = photoUrlOrBuffer;

  if (
    Array.isArray(entriesOrBundles) &&
    entriesOrBundles.length > 0 &&
    "weekNumber" in entriesOrBundles[0]
  ) {
    bundles = entriesOrBundles as WeekBundleData[];
    photo = weeklyNotesOrPhoto as any;
  } else {
    bundles = [
      {
        weekNumber: typeof weekNumberOrPhoto === "number" ? weekNumberOrPhoto : 1,
        entries: (entriesOrBundles as LogbookEntryItem[]) || [],
        weeklyNotes: Array.isArray(weeklyNotesOrPhoto) ? weeklyNotesOrPhoto : [],
      },
    ];
  }

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  // --- HALAMAN 1: COVER / SAMPUL ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("BUKU CATATAN HARIAN (LOGBOOK)", 105, 30, { align: "center" });
  doc.text("KULIAH KERJA NYATA (KKN)", 105, 38, { align: "center" });
  doc.text("UNIVERSITAS MARITIM RAJA ALI HAJI", 105, 46, { align: "center" });

  // Frame Foto 4x6
  doc.rect(87, 65, 36, 48);

  if (photo) {
    try {
      let dataUrl = "";
      if (typeof photo === "string" && photo.trim()) {
        dataUrl = photo;
      }
      if (dataUrl) {
        doc.addImage(dataUrl, "JPEG", 87.5, 65.5, 35, 47);
      } else {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text("Foto 4x6", 105, 91, { align: "center" });
      }
    } catch (e) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text("Foto 4x6", 105, 91, { align: "center" });
    }
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Foto 4x6", 105, 91, { align: "center" });
  }

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

  // --- HALAMAN ISI LOGBOOK (Tabel Tunggal Berkelanjutan) ---
  doc.addPage();
  const allRawEntries: LogbookEntryItem[] = [];
  const allNotesList: string[] = [];

  bundles.forEach((bundle) => {
    allRawEntries.push(...(bundle.entries || []));
    if (Array.isArray(bundle.weeklyNotes)) {
      bundle.weeklyNotes.forEach((n) => {
        if (n && n.trim()) {
          allNotesList.push(n.trim());
        }
      });
    }
  });

  const sortedEntries = allRawEntries.sort(
    (a, b) => new Date(a.entry_date || "").getTime() - new Date(b.entry_date || "").getTime()
  );

  let weekText = "";
  if (bundles.length === 1) {
    weekText = `MINGGU ${ROMAN_WEEKS[bundles[0].weekNumber - 1] || bundles[0].weekNumber}`;
  } else if (bundles.length === 5) {
    weekText = "KESELURUHAN (MINGGU I - V)";
  } else {
    const wList = bundles.map((b) => ROMAN_WEEKS[b.weekNumber - 1] || `${b.weekNumber}`).join(", ");
    weekText = `MINGGU ${wList}`;
  }

  // Header Box Logbook Halaman
  doc.setLineWidth(0.5);
  doc.rect(15, 15, 180, 28);
  doc.line(140, 15, 140, 43);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("LOGBOOK KULIAH KERJA NYATA", 50, 24);
  doc.text("UNIVERSITAS MARITIM RAJA ALI HAJI", 50, 31);

  doc.setFontSize(9);
  doc.text(weekText, 165, 27, { align: "center" });

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

  const tableBody = sortedEntries.map((item) => [
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
  doc.text(`1. ${allNotesList[0] || "-"}`, 18, notesStartY + 9);
  doc.text(`2. ${allNotesList[1] || "-"}`, 18, notesStartY + 15);
  doc.text(`3. ${allNotesList[2] || "-"}`, 18, notesStartY + 21);

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

  let fileName = "";
  if (bundles.length === 1) {
    fileName = `LOGBOOK_KKN_MINGGU_${bundles[0].weekNumber}_${student.student_id || "MAHASISWA"}.pdf`;
  } else if (bundles.length === 5) {
    fileName = `LOGBOOK_KKN_SEMUA_MINGGU_${student.student_id || "MAHASISWA"}.pdf`;
  } else {
    const weekNums = bundles.map((b) => b.weekNumber).join("_");
    fileName = `LOGBOOK_KKN_MINGGU_${weekNums}_${student.student_id || "MAHASISWA"}.pdf`;
  }

  doc.save(fileName);
}
