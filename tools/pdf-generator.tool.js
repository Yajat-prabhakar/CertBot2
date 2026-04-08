import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

import { ConfigError } from '../lib/errors.js';
import { logError, logInfo, serializeError } from '../lib/logger.js';

function clampColorChannel(value) {
  return Math.max(0, Math.min(1, value));
}

function normalizeColorValue(value) {
  return clampColorChannel(value > 1 ? value / 255 : value);
}

function parseHexColor(hexColor) {
  const normalized = hexColor.replace('#', '').trim();
  if (![3, 6].includes(normalized.length)) {
    throw new Error('Hex color must have 3 or 6 characters');
  }

  const expanded = normalized.length === 3
    ? normalized.split('').map((char) => `${char}${char}`).join('')
    : normalized;

  const red = Number.parseInt(expanded.slice(0, 2), 16) / 255;
  const green = Number.parseInt(expanded.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(expanded.slice(4, 6), 16) / 255;

  if ([red, green, blue].some(Number.isNaN)) {
    throw new Error('Invalid hex color');
  }

  return rgb(red, green, blue);
}

function resolveTextColor(colorValue) {
  if (!colorValue) {
    return rgb(0, 0, 0);
  }

  try {
    if (typeof colorValue === 'string') {
      return parseHexColor(colorValue);
    }

    if (typeof colorValue === 'object') {
      const red = normalizeColorValue(colorValue.r ?? colorValue.red ?? 0);
      const green = normalizeColorValue(colorValue.g ?? colorValue.green ?? 0);
      const blue = normalizeColorValue(colorValue.b ?? colorValue.blue ?? 0);
      return rgb(red, green, blue);
    }
  } catch (error) {
    throw new ConfigError('Certificate text color is invalid', {
      code: 'TEMPLATE_COLOR_INVALID',
      cause: error,
    });
  }

  throw new ConfigError('Certificate text color is invalid', {
    code: 'TEMPLATE_COLOR_INVALID',
  });
}

function getDateYPosition(nameY, fontSize) {
  const verticalGap = Math.max(fontSize * 1.6, 32);
  return nameY - verticalGap;
}

export async function generateCertificate(templateBuffer, participantName, config = {}, options = {}) {
  const { requestId } = options;
  const name = String(participantName).trim().toUpperCase();

  try {
    if (!templateBuffer || templateBuffer.length === 0) {
      throw new ConfigError('Certificate template is empty or missing', {
        code: 'TEMPLATE_BUFFER_INVALID',
      });
    }

    let pdfDoc;
    try {
      pdfDoc = await PDFDocument.load(templateBuffer);
    } catch (error) {
      throw new ConfigError('Certificate template is not a valid PDF document', {
        code: 'TEMPLATE_PDF_INVALID',
        cause: error,
      });
    }

    const pages = pdfDoc.getPages();
    const firstPage = pages[0];

    if (!firstPage) {
      throw new ConfigError('Certificate template does not contain any pages', {
        code: 'TEMPLATE_PDF_EMPTY',
      });
    }

    const fontMap = {
      Helvetica: StandardFonts.Helvetica,
      'Helvetica-Bold': StandardFonts.HelveticaBold,
      'Times-Roman': StandardFonts.TimesRoman,
      'Times-Bold': StandardFonts.TimesRomanBold,
    };

    const fontKey = config.font_style || 'Helvetica-Bold';
    const fontSize = Number(config.font_size) || 24;
    const font = await pdfDoc.embedFont(fontMap[fontKey] || StandardFonts.HelveticaBold);
    const dateFontSize = Math.max(Math.round(fontSize * 0.5), 12);
    const dateFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const textColor = resolveTextColor(config.text_color || config.font_color);

    const { width, height } = firstPage.getSize();
    const textWidth = font.widthOfTextAtSize(name, fontSize);

    let nameX = Number(config.name_x) || 300;
    if (config.text_alignment === 'center') {
      nameX = (width / 2) - (textWidth / 2);
    }

    const nameY = Number(config.name_y || config.text_y_position) || 300;

    firstPage.drawText(name, {
      x: nameX,
      y: nameY,
      size: fontSize,
      font,
      color: textColor,
    });

    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const dateWidth = dateFont.widthOfTextAtSize(currentDate, dateFontSize);
    let dateX = nameX;
    if (config.text_alignment === 'center') {
      dateX = (width / 2) - (dateWidth / 2);
    }

    firstPage.drawText(currentDate, {
      x: dateX,
      y: getDateYPosition(nameY, fontSize),
      size: dateFontSize,
      font: dateFont,
      color: resolveTextColor(config.date_color || config.text_color || config.font_color),
    });

    const pdfBytes = await pdfDoc.save();

    logInfo('PDFGenerator', 'CertificateGenerated', {
      participantName: name,
      fontKey,
      fontSize,
      pageWidth: width,
      pageHeight: height,
      outputBytes: pdfBytes.length,
    }, requestId);

    return Buffer.from(pdfBytes);
  } catch (error) {
    logError('PDFGenerator', 'CertificateGenerationFailed', {
      participantName: name,
      error: serializeError(error),
    }, requestId);
    throw error;
  }
}
