import html2canvas from "html2canvas";
import jsPDF from "jspdf";

/**
 * Capture a DOM node as a canvas, then trigger a PNG download.
 */
export async function downloadPng(node, filename) {
  if (!node) return;
  const canvas = await html2canvas(node, {
    backgroundColor: "#ffffff",
    scale: 2,
    useCORS: true,
    logging: false,
  });
  const dataUrl = canvas.toDataURL("image/png");
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Capture a DOM node and download as a PDF that fits A4.
 */
export async function downloadPdf(node, filename) {
  if (!node) return;
  const canvas = await html2canvas(node, {
    backgroundColor: "#ffffff",
    scale: 2,
    useCORS: true,
    logging: false,
  });
  const imgData = canvas.toDataURL("image/png");
  // A4 in points: 595 x 842
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 24;
  const maxWidth = pageWidth - margin * 2;
  const ratio = canvas.height / canvas.width;
  const renderWidth = maxWidth;
  const renderHeight = renderWidth * ratio;

  if (renderHeight <= pageHeight - margin * 2) {
    pdf.addImage(imgData, "PNG", margin, margin, renderWidth, renderHeight);
  } else {
    // Slice into pages
    let position = 0;
    const sliceHeightPx = ((pageHeight - margin * 2) / renderWidth) * canvas.width;
    while (position < canvas.height) {
      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = Math.min(sliceHeightPx, canvas.height - position);
      const ctx = sliceCanvas.getContext("2d");
      ctx.drawImage(
        canvas,
        0,
        position,
        canvas.width,
        sliceCanvas.height,
        0,
        0,
        canvas.width,
        sliceCanvas.height
      );
      const sliceData = sliceCanvas.toDataURL("image/png");
      const sliceRenderHeight = (sliceCanvas.height / canvas.width) * renderWidth;
      if (position > 0) pdf.addPage();
      pdf.addImage(sliceData, "PNG", margin, margin, renderWidth, sliceRenderHeight);
      position += sliceCanvas.height;
    }
  }
  pdf.save(filename);
}
