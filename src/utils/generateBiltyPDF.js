import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { formatFreightPrice, stripCurrencyPrefix, stripWeightUnit } from './fareCalculator';

/**
 * Safely fetches the web app logo as a base64 DataURL for jsPDF embedding.
 */
const loadLogoDataUrl = async () => {
  if (typeof fetch === 'undefined' || typeof FileReader === 'undefined') return null;
  try {
    const res = await fetch('/logo.jpg?v=2');
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

/**
 * Internal helper that builds and returns the populated jsPDF document.
 */
const buildBiltyPDFDoc = async (biltyData) => {
  const doc = new jsPDF('p', 'pt', 'a4');
  const idStr = String(biltyData._id || biltyData.id || '00000000');
  const dateVal = biltyData.completedAt || biltyData.createdAt || new Date();

  const marginX = 40;
  const marginY = 40;
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  // Generate verified QR code with consignment metadata
  const qrPayload = JSON.stringify({
    biltyNo: `BLT-${idStr.slice(0, 8).toUpperCase()}`,
    shipper: biltyData.businessOwnerName || biltyData.businessName || 'Authorized Shipper',
    transporter: biltyData.transporterName || 'Fleet Transporter',
    truckPlate: biltyData.truckPlate || 'Unassigned',
    origin: biltyData.origin || 'N/A',
    destination: biltyData.destination || 'N/A',
    weight: `${stripWeightUnit(biltyData.weight) || '0'} tons`,
    freight: `PKR ${stripCurrencyPrefix(biltyData.price) || '0'}`,
    terms: biltyData.paymentTerms || 'Prepaid',
    verifiedAt: new Date(dateVal).toISOString()
  });

  const [qrDataUrl, logoDataUrl] = await Promise.all([
    QRCode.toDataURL(qrPayload, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 200,
      color: { dark: '#0B101D', light: '#FFFFFF' }
    }).catch((err) => {
      console.error('QR code generation error:', err);
      return null;
    }),
    loadLogoDataUrl()
  ]);

  // Outer Border (Charcoal Graphite)
  doc.setLineWidth(1.5);
  doc.setDrawColor(51, 65, 85);
  doc.rect(marginX, marginY, pageWidth - marginX * 2, pageHeight - marginY * 2);

  // Background Watermark (Rendered first so text & tables sit cleanly on top)
  doc.setFontSize(48);
  doc.setTextColor(245, 247, 250);
  doc.setFont('helvetica', 'bold');
  doc.text('VERIFIED E-BILTY', pageWidth / 2, pageHeight / 2 - 20, { align: 'center', angle: -30 });

  // Header Background (Deep Charcoal matching Logo Truck)
  doc.setFillColor(30, 41, 59);
  doc.rect(marginX, marginY, pageWidth - marginX * 2, 75, 'F');

  // Decorative Logistics Orange Stripe (exact Logo Chevron #F89020)
  doc.setFillColor(248, 144, 32);
  doc.rect(marginX, marginY + 75, pageWidth - marginX * 2, 5, 'F');

  // Embed Brand Logo card on Header Top-Left (exact 4:3 aspect)
  let headerTextX = marginX + 18;
  if (logoDataUrl) {
    try {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(marginX + 12, marginY + 11.5, 68, 52, 4, 4, 'F');
      doc.addImage(logoDataUrl, 'JPEG', marginX + 14, marginY + 13.5, 64, 48);
      headerTextX = marginX + 92;
    } catch {
      headerTextX = marginX + 18;
    }
  }

  // Header Text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(255, 255, 255);
  doc.text('E-CARGO-BILTY', headerTextX, marginY + 32);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(254, 215, 170);
  doc.text('Official Digital Lorry Receipt (Bilty) • National Freight Network of Pakistan', headerTextX, marginY + 48);
  doc.setFontSize(8.5);
  doc.setTextColor(226, 232, 240);
  doc.text('Ministry of Communications Compliant • Verified Consignment Record', headerTextX, marginY + 62);

  // Embed High-Res Scannable QR Code in Header Top-Right
  if (qrDataUrl) {
    // White background card for QR
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(pageWidth - marginX - 70, marginY + 7, 62, 62, 4, 4, 'F');
    doc.addImage(qrDataUrl, 'PNG', pageWidth - marginX - 68, marginY + 9, 58, 58);
  }

  // Border below header
  doc.setLineWidth(1);
  doc.setDrawColor(234, 88, 12);
  doc.line(marginX, marginY + 80, pageWidth - marginX, marginY + 80);

  // Bilty Details Section (Grid Alignment without label-value collisions)
  let currentY = marginY + 105;
  const leftLabelX = marginX + 15;
  const leftValueX = marginX + 120;
  const maxLeftValueWidth = (pageWidth / 2) - leftValueX - 10;

  doc.setFontSize(9.5);
  doc.setTextColor(0, 0, 0);

  // Left Column
  doc.setFont('helvetica', 'bold');
  doc.text('Bilty ID / No:', leftLabelX, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(`BLT-${idStr.slice(0, 8).toUpperCase()}`, leftValueX, currentY);

  currentY += 19;
  doc.setFont('helvetica', 'bold');
  doc.text('Date Issued:', leftLabelX, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${new Date(dateVal).toLocaleDateString()} ${new Date(dateVal).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, leftValueX, currentY);

  currentY += 19;
  doc.setFont('helvetica', 'bold');
  doc.text('Origin Depot:', leftLabelX, currentY);
  doc.setFont('helvetica', 'normal');
  const originText = biltyData.origin ? String(biltyData.origin) : 'N/A';
  doc.text(originText.length > 24 ? originText.substring(0, 24) + '...' : originText, leftValueX, currentY);

  currentY += 19;
  doc.setFont('helvetica', 'bold');
  doc.text('Consignor / Shipper:', leftLabelX, currentY);
  doc.setFont('helvetica', 'normal');
  const shipperName = biltyData.businessOwnerName || biltyData.businessName || 'Shipper Enterprise';
  doc.text(shipperName.length > 24 ? shipperName.substring(0, 24) + '...' : shipperName, leftValueX, currentY);

  if (biltyData.senderNTN) {
    currentY += 19;
    doc.setFont('helvetica', 'bold');
    doc.text('Sender NTN / Tax ID:', leftLabelX, currentY);
    doc.setFont('helvetica', 'normal');
    doc.text(`${biltyData.senderNTN}`, leftValueX, currentY);
  }

  // Right Column
  const rightColX = pageWidth / 2 + 10;
  const rightColValueX = rightColX + 90;
  let currentYRight = marginY + 105;

  doc.setFont('helvetica', 'bold');
  doc.text('Transporter:', rightColX, currentYRight);
  doc.setFont('helvetica', 'normal');
  const transName = biltyData.transporterName || 'Verified Transporter';
  doc.text(transName.length > 22 ? transName.substring(0, 22) + '...' : transName, rightColValueX, currentYRight);

  currentYRight += 19;
  doc.setFont('helvetica', 'bold');
  doc.text('Truck Plate:', rightColX, currentYRight);
  doc.setFont('helvetica', 'normal');
  doc.text(`${biltyData.truckPlate || 'Unassigned'}`, rightColValueX, currentYRight);

  currentYRight += 19;
  doc.setFont('helvetica', 'bold');
  doc.text('Destination Hub:', rightColX, currentYRight);
  doc.setFont('helvetica', 'normal');
  const destText = biltyData.destination ? String(biltyData.destination) : 'N/A';
  doc.text(destText.length > 22 ? destText.substring(0, 22) + '...' : destText, rightColValueX, currentYRight);

  // Payment Terms Stamp Banner
  currentYRight += 19;
  const paymentTerms = biltyData.paymentTerms || 'Prepaid';
  const isPrepaid = paymentTerms.toLowerCase().includes('prepaid');
  const isNet30 = paymentTerms.toLowerCase().includes('net-30') || paymentTerms.toLowerCase().includes('corp');
  
  const stampBg = isPrepaid ? [16, 185, 129] : isNet30 ? [51, 65, 85] : [234, 88, 12];
  doc.setFillColor(stampBg[0], stampBg[1], stampBg[2]);
  doc.roundedRect(rightColX, currentYRight - 11, 145, 18, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text(`TERMS: ${paymentTerms.toUpperCase()}`, rightColX + 72.5, currentYRight + 1, { align: 'center' });

  // Divider
  currentY = Math.max(currentY, currentYRight) + 24;
  doc.setLineWidth(0.5);
  doc.setDrawColor(200, 200, 200);
  doc.line(marginX, currentY, pageWidth - marginX, currentY);

  // Special Cargo Handling Warning Badges
  const flags = Array.isArray(biltyData.specialHandling) ? biltyData.specialHandling : [];
  if (flags.length > 0) {
    currentY += 14;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(234, 88, 12);
    doc.text('SPECIAL CARGO HANDLING INSTRUCTIONS:', marginX + 20, currentY);
    
    currentY += 8;
    let badgeX = marginX + 20;
    flags.forEach((flag) => {
      let label = flag.toUpperCase();
      let r = 245, g = 158, b = 11; // amber default
      if (flag === 'fragile') { label = 'FRAGILE GOODS'; r = 245; g = 158; b = 11; }
      if (flag === 'cold_chain') { label = 'COLD-CHAIN / PERISHABLE'; r = 6; g = 182; b = 212; }
      if (flag === 'hazmat') { label = 'HAZARDOUS MATERIAL'; r = 225; g = 29; b = 72; }
      if (flag === 'upright') { label = 'KEEP UPRIGHT - DO NOT STACK'; r = 147; g = 51; b = 234; }

      const badgeWidth = doc.getTextWidth(label) + 16;
      if (badgeX + badgeWidth > pageWidth - marginX - 20) {
        badgeX = marginX + 20;
        currentY += 18;
      }
      doc.setFillColor(r, g, b);
      doc.roundedRect(badgeX, currentY, badgeWidth, 14, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
      doc.text(label, badgeX + badgeWidth / 2, currentY + 10, { align: 'center' });
      badgeX += badgeWidth + 8;
    });
    currentY += 20;
  } else {
    currentY += 10;
  }

  // AutoTable for Cargo Particulars & Packaging
  const packaging = biltyData.packagingType || 'Cartons / Boxes';
  const chargeableWt = stripWeightUnit(biltyData.chargeableWeight || biltyData.weight) || 'N/A';
  const formattedFreight = formatFreightPrice(biltyData.price);
  
  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX + 10, right: marginX + 10 },
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 6 },
    head: [['Description of Goods', 'Packaging', 'Chargeable Weight', 'Freight Rate / Total']],
    body: [
      [
        biltyData.cargoTitle || 'General Commercial Cargo',
        packaging,
        `${chargeableWt} Metric Tons`,
        formattedFreight
      ]
    ],
  });

  // Totals Summary Box (Aligned with AutoTable boundaries, guaranteed zero overlap)
  const totalsBoxY = doc.lastAutoTable.finalY + 8;
  const totalsBoxHeight = 26;
  const tableLeftX = marginX + 10;
  const tableRightX = pageWidth - marginX - 10;
  const tableWidth = tableRightX - tableLeftX;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.8);
  doc.roundedRect(tableLeftX, totalsBoxY, tableWidth, totalsBoxHeight, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Total Agreed Freight:', tableLeftX + 14, totalsBoxY + 17);

  doc.setFontSize(11.5);
  doc.setTextColor(234, 88, 12);
  doc.text(formattedFreight, tableRightX - 14, totalsBoxY + 17, { align: 'right' });

  currentY = totalsBoxY + totalsBoxHeight + 8;

  // Delivery Notes if present
  if (biltyData.deliveryNotes) {
    currentY += 10;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(80, 80, 80);
    const wrappedNotes = doc.splitTextToSize(
      `Consignee Gate Notes: "${biltyData.deliveryNotes}"`,
      pageWidth - (marginX + 20) * 2
    );
    doc.text(wrappedNotes, marginX + 20, currentY);
    currentY += Math.max(0, wrappedNotes.length - 1) * 11;
  }

  // Terms and Conditions
  currentY += 18;
  doc.setLineWidth(0.5);
  doc.setDrawColor(200, 200, 200);
  doc.line(marginX, currentY, pageWidth - marginX, currentY);

  currentY += 14;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('Standard Terms & Carriage Conditions:', marginX + 20, currentY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(90, 90, 90);
  currentY += 12;
  doc.text('1. The transporter is fully responsible for safe conveyance and delivery of consignment via assigned transponder truck.', marginX + 20, currentY);
  currentY += 11;
  doc.text('2. All claims for shortage, in-transit damage, or transit delay must be registered within 7 calendar days of e-POD generation.', marginX + 20, currentY);
  currentY += 11;
  doc.text('3. This e-Bilty serves as a verified legal carrier manifest under Pakistani Carriage of Goods by Road Act & Sales Tax Rules.', marginX + 20, currentY);

  if (biltyData.isPickupVerified) {
    currentY += 11;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(5, 150, 105);
    doc.text('Origin Warehouse Handover: Pickup Verified (4-Digit Handover OTP Authenticated at Loading Dock)', marginX + 20, currentY);
  }

  if (biltyData.hasShortage && biltyData.receivingVerification) {
    currentY += 11;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(217, 119, 6);
    doc.text(`Carrier Shortage Endorsement: Received ${biltyData.receivingVerification.totalReceivedQty} of ${biltyData.receivingVerification.totalDeclaredQty} units (Shortage: ${biltyData.receivingVerification.totalShortageQty} missing).`, marginX + 20, currentY);
  }

  // Signatures Section with Touchscreen e-POD embedding (clamped safely inside page border)
  currentY = Math.min(currentY + 50, pageHeight - marginY - 26);
  doc.setLineWidth(0.5);
  doc.setDrawColor(0, 0, 0);
  doc.line(marginX + 20, currentY, marginX + 180, currentY);
  doc.line(pageWidth - marginX - 180, currentY, pageWidth - marginX - 20, currentY);

  // If electronic touchscreen signature was captured at delivery, embed it right above the line!
  if (biltyData.receiverSignature) {
    try {
      doc.addImage(biltyData.receiverSignature, 'PNG', pageWidth - marginX - 175, currentY - 45, 120, 40);
    } catch (e) {
      console.warn('Could not embed receiver signature:', e);
    }
  }

  currentY += 14;
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text('Transporter / Driver Signature', marginX + 20, currentY);
  
  if (biltyData.receiverSignature) {
    doc.setTextColor(16, 185, 129);
    doc.text('Consignee (e-POD Verified ✓)', pageWidth - marginX - 180, currentY);
  } else {
    doc.setTextColor(0, 0, 0);
    doc.text('Consignee Signature', pageWidth - marginX - 180, currentY);
  }

  return doc;
};

/**
 * Generates the Bilty PDF and returns a Blob URL string.
 * The caller is responsible for revoking the URL when done (URL.revokeObjectURL).
 * @param {object} biltyData
 * @returns {Promise<string>} blobUrl
 */
export const generateBiltyPDFBlob = async (biltyData) => {
  const doc = await buildBiltyPDFDoc(biltyData);
  return doc.output('bloburl');
};

/**
 * Directly triggers a browser/device download of the Bilty PDF.
 * @param {object} biltyData
 * @returns {Promise<{ok: boolean, filename?: string, error?: string}>}
 */
export const generateBiltyPDF = async (biltyData) => {
  try {
    const doc = await buildBiltyPDFDoc(biltyData);
    const idStr = String(biltyData._id || biltyData.id || '000000');
    const filename = `Bilty_${idStr.slice(0, 8).toUpperCase()}.pdf`;
    doc.save(filename);
    return { ok: true, filename };
  } catch (err) {
    console.error('PDF generation failed:', err);
    return { ok: false, error: err.message };
  }
};
