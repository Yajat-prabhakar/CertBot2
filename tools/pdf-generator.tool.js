import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Generate personalized certificate by stamping name on template
 * @param {Buffer} templateBuffer - PDF template as buffer
 * @param {string} participantName - Name to stamp on certificate
 * @param {Object} config - Configuration (nameX, nameY, fontSize, fontStyle)
 * @returns {Promise<Buffer>} - Modified PDF as buffer
 */
export async function generateCertificate(templateBuffer, participantName, config) {
  try {
    console.log(`[PDF] Generating certificate for: ${participantName}`);

    // Load the PDF template
    const pdfDoc = await PDFDocument.load(templateBuffer);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];

    // Embed font
    const fontMap = {
      'Helvetica': StandardFonts.Helvetica,
      'Helvetica-Bold': StandardFonts.HelveticaBold,
      'Times-Roman': StandardFonts.TimesRoman,
      'Times-Bold': StandardFonts.TimesRomanBold,
    };

    const fontKey = config.font_style || 'Helvetica-Bold';
    const font = await pdfDoc.embedFont(fontMap[fontKey] || StandardFonts.HelveticaBold);

    // Get page dimensions for reference
    const { width, height } = firstPage.getSize();
    console.log(`[PDF] Page size: ${width}x${height}`);

    // Draw participant name
    firstPage.drawText(participantName, {
      x: config.name_x || 300,
      y: config.name_y || 400,
      size: config.font_size || 24,
      font: font,
      color: rgb(0, 0, 0),
    });

    // Draw current date below name
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    firstPage.drawText(currentDate, {
      x: config.name_x || 300,
      y: (config.name_y || 400) - 40,
      size: 12,
      font: await pdfDoc.embedFont(StandardFonts.Helvetica),
      color: rgb(0.4, 0.4, 0.4),
    });

    // Save PDF
    const pdfBytes = await pdfDoc.save();
    console.log(`[PDF] Certificate generated (${pdfBytes.length} bytes)`);

    return Buffer.from(pdfBytes);
  } catch (error) {
    console.error('[PDF] Error generating certificate:', error.message);
    throw error;
  }
}
