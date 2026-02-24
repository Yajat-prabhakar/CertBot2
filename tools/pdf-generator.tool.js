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
    const name = participantName.toUpperCase();
    console.log(`[PDF] Generating certificate for: ${name}`);

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
    const fontSize = config.font_size || 24;
    const textWidth = font.widthOfTextAtSize(name, fontSize);

    // Calculate X coordinate based on alignment
    let nameX = config.name_x || 300;
    if (config.text_alignment === 'center') {
      nameX = (width / 2) - (textWidth / 2);
    }

    const nameY = config.name_y || config.text_y_position || 300;

    firstPage.drawText(name, {
      x: nameX,
      y: nameY,
      size: fontSize,
      font: font,
      color: rgb(0, 0, 0),
    });

    // Draw current date below name
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const dateFontSize = 12;
    const dateFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const dateWidth = dateFont.widthOfTextAtSize(currentDate, dateFontSize);

    let dateX = nameX; // Default to same as name
    if (config.text_alignment === 'center') {
      dateX = (width / 2) - (dateWidth / 2);
    }

    firstPage.drawText(currentDate, {
      x: dateX,
      y: nameY - 60,
      size: dateFontSize,
      font: dateFont,
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
