/**
 * Sample image generator for PackSure AI
 * Generates realistic SVG-based commodity packaging images formatted as real browser File objects.
 * This guarantees seamless demonstration during evaluation testing.
 */

export async function createSamplePackageFiles(): Promise<File[]> {
  const images = [
    {
      name: 'choco-biscuits-front.jpg',
      label: 'Package Front (Primary Display Panel)',
      width: 600,
      height: 600,
      draw: (ctx: CanvasRenderingContext2D) => {
        // Background
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, 600, 600);

        // Package Card
        ctx.fillStyle = '#b45309';
        ctx.beginPath();
        ctx.roundRect(40, 40, 520, 520, 16);
        ctx.fill();

        // Inner frame
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.roundRect(50, 50, 500, 500, 12);
        ctx.fill();

        // Header brand
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px sans-serif';
        ctx.fillText('CRUNCHY BITES', 140, 150);

        ctx.font = 'bold 28px sans-serif';
        ctx.fillStyle = '#fef3c7';
        ctx.fillText('Choco Biscuits', 190, 200);

        // Subtitle
        ctx.font = '16px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Rich Cocoa & Baked Goodness', 170, 240);

        // Decorative cookie circle
        ctx.fillStyle = '#78350f';
        ctx.beginPath();
        ctx.arc(300, 340, 70, 0, Math.PI * 2);
        ctx.fill();

        // Chocolate chips
        ctx.fillStyle = '#451a03';
        ctx.beginPath();
        ctx.arc(280, 320, 10, 0, Math.PI * 2);
        ctx.arc(320, 330, 12, 0, Math.PI * 2);
        ctx.arc(295, 365, 9, 0, Math.PI * 2);
        ctx.fill();

        // MRP box at top right
        // bbox: [112, 88, 240, 110]
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(112, 88, 128, 22);
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 15px monospace';
        ctx.fillText('MRP: Rs.45.00', 118, 104);

        // Manufacturer info at bottom
        // bbox: [60, 430, 420, 465]
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(60, 430, 360, 35);
        ctx.fillStyle = '#0f172a';
        ctx.font = '12px sans-serif';
        ctx.fillText('Mfd By: Apex Confectionery Foods Pvt Ltd', 70, 452);

        // Footer tag
        ctx.fillStyle = '#fef3c7';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText('IMAGE 1 OF 3 • FRONT FACE PANEL', 160, 520);
      },
    },
    {
      name: 'choco-biscuits-back-declarations.jpg',
      label: 'Package Back (Mandatory Declarations Panel)',
      width: 600,
      height: 600,
      draw: (ctx: CanvasRenderingContext2D) => {
        // Background
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, 600, 600);

        // White nutrition & regulatory panel
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(40, 40, 520, 520, 12);
        ctx.fill();

        // Header
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText('STATUTORY DECLARATIONS & INFO', 80, 80);

        // Expiry Date Box
        // bbox: [290, 85, 470, 115]
        ctx.fillStyle = '#f1f5f9';
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1;
        ctx.fillRect(290, 85, 180, 30);
        ctx.strokeRect(290, 85, 180, 30);
        ctx.fillStyle = '#dc2626';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText('BEST BEFORE 12/2026', 300, 105);

        // Ingredients
        ctx.fillStyle = '#334155';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText('INGREDIENTS:', 60, 140);
        ctx.font = '12px sans-serif';
        ctx.fillText('Wheat Flour, Sugar, Palm Oil, Cocoa Solids (4.5%),', 60, 160);
        ctx.fillText('Invert Sugar Syrup, Leavening Agents (E500ii, E503ii), Salt.', 60, 180);

        // Nutrition Table
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(60, 205, 480, 70);
        ctx.strokeStyle = '#cbd5e1';
        ctx.strokeRect(60, 205, 480, 70);
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText('NUTRITIONAL VALUES (PER 100g): Energy 475kcal | Protein 6.2g', 70, 230);
        ctx.fillText('Carbohydrate 69.5g (Sugars 28.0g) | Total Fat 19.2g', 70, 255);

        // Net Quantity (Defective without unit)
        // bbox: [120, 300, 210, 330]
        ctx.fillStyle = '#fef2f2';
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1;
        ctx.fillRect(120, 300, 90, 30);
        ctx.strokeRect(120, 300, 90, 30);
        ctx.fillStyle = '#b91c1c';
        ctx.font = 'bold 15px sans-serif';
        ctx.fillText('NET QTY: 250', 125, 320);

        // Country of Origin
        ctx.fillStyle = '#334155';
        ctx.font = '13px sans-serif';
        ctx.fillText('Country of Origin: India', 60, 370);
        ctx.fillText('Batch No: APX-2024-B19', 60, 400);

        // Green Veg Logo
        ctx.strokeStyle = '#16a34a';
        ctx.lineWidth = 2;
        ctx.strokeRect(480, 360, 30, 30);
        ctx.fillStyle = '#16a34a';
        ctx.beginPath();
        ctx.arc(495, 375, 7, 0, Math.PI * 2);
        ctx.fill();

        // FSSAI Logo & Lic
        // bbox: [60, 520, 360, 550]
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(60, 520, 300, 30);
        ctx.fillStyle = '#1e3a8a';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText('fssai  Lic. No. 10019022009871', 70, 540);

        // Footer tag
        ctx.fillStyle = '#64748b';
        ctx.font = '11px sans-serif';
        ctx.fillText('IMAGE 2 OF 3 • BACK DECLARATIONS PANEL', 150, 580);
      },
    },
    {
      name: 'choco-biscuits-side-care.jpg',
      label: 'Package Side (Customer Care & Storage)',
      width: 600,
      height: 600,
      draw: (ctx: CanvasRenderingContext2D) => {
        // Background
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, 600, 600);

        // Card
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.roundRect(40, 40, 520, 520, 12);
        ctx.fill();

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText('CONSUMER SUPPORT & CARE', 80, 90);

        // Consumer Care line
        // bbox: [70, 180, 430, 212]
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(70, 180, 360, 32);
        ctx.fillStyle = '#0f172a';
        ctx.font = '14px monospace';
        ctx.fillText('Email: care@apexconfectionery.in', 80, 202);

        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#334155';
        ctx.fillText('Toll Free: 1800-200-8899 (Mon-Sat 9AM to 6PM)', 70, 250);
        ctx.fillText('Registered Address: Plot 44, Industrial Area, Sector 5,', 70, 280);
        ctx.fillText('Gurugram, Haryana - 122001, India.', 70, 305);

        // Storage Instructions
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 15px sans-serif';
        ctx.fillText('STORAGE CONDITIONS:', 70, 360);
        ctx.font = '13px sans-serif';
        ctx.fillStyle = '#475569';
        ctx.fillText('Store in a cool, hygienic and dry place away from direct sunlight.', 70, 385);
        ctx.fillText('Once opened, transfer contents to an airtight container.', 70, 405);

        // Barcode visualization
        ctx.fillStyle = '#0f172a';
        for (let i = 0; i < 40; i++) {
          const w = (i % 3 === 0 ? 4 : 2);
          ctx.fillRect(160 + i * 6, 440, w, 50);
        }
        ctx.font = '12px monospace';
        ctx.fillText('8 901030 445892', 200, 505);

        // Footer tag
        ctx.fillStyle = '#64748b';
        ctx.font = '11px sans-serif';
        ctx.fillText('IMAGE 3 OF 3 • SIDE PANEL & CONSUMER CARE', 140, 575);
      },
    },
  ];

  const files: File[] = [];

  for (const imgSpec of images) {
    const canvas = document.createElement('canvas');
    canvas.width = imgSpec.width;
    canvas.height = imgSpec.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      imgSpec.draw(ctx);
    }

    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b || new Blob()), 'image/jpeg', 0.95);
    });

    const file = new File([blob], imgSpec.name, { type: 'image/jpeg' });
    files.push(file);
  }

  return files;
}

export async function createCompliantPackageFiles(): Promise<File[]> {
  const images = [
    {
      name: 'organic-oats-front.jpg',
      label: 'Package Front (Primary Display Panel)',
      width: 600,
      height: 600,
      draw: (ctx: CanvasRenderingContext2D) => {
        ctx.fillStyle = '#064e3b';
        ctx.fillRect(0, 0, 600, 600);

        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.roundRect(40, 40, 520, 520, 16);
        ctx.fill();

        ctx.fillStyle = '#ecfdf5';
        ctx.beginPath();
        ctx.roundRect(50, 50, 500, 500, 12);
        ctx.fill();

        ctx.fillStyle = '#065f46';
        ctx.font = 'bold 36px sans-serif';
        ctx.fillText('NATURES PURE', 160, 140);

        ctx.font = 'bold 26px sans-serif';
        ctx.fillStyle = '#047857';
        ctx.fillText('Organic Whole Grain Oats', 130, 185);

        ctx.font = '15px sans-serif';
        ctx.fillStyle = '#065f46';
        ctx.fillText('100% Rolled Oats • High Dietary Fiber', 165, 220);

        // MRP box
        // bbox: [110, 80, 340, 115]
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#059669';
        ctx.lineWidth = 1.5;
        ctx.fillRect(110, 80, 230, 35);
        ctx.strokeRect(110, 80, 230, 35);
        ctx.fillStyle = '#064e3b';
        ctx.font = 'bold 15px monospace';
        ctx.fillText('₹ 180.00 (Incl. of all taxes)', 116, 103);

        // Unit Sale Price
        // bbox: [110, 120, 260, 145]
        ctx.fillStyle = '#d1fae5';
        ctx.fillRect(110, 120, 150, 25);
        ctx.fillStyle = '#065f46';
        ctx.font = 'bold 13px monospace';
        ctx.fillText('₹ 0.36 / g', 120, 137);

        // Graphic
        ctx.fillStyle = '#fef3c7';
        ctx.beginPath();
        ctx.arc(300, 330, 65, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#d97706';
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText('100% WHOLE', 240, 335);

        // Manufacturer
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(55, 430, 490, 35);
        ctx.fillStyle = '#064e3b';
        ctx.font = '12px sans-serif';
        ctx.fillText('Mfd By: Pure Earth Organics Ltd, Plot 12, Food Park, Jaipur, RJ - 302013', 65, 452);

        ctx.fillStyle = '#047857';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText('SCENARIO 1: FULLY COMPLIANT • SURFACE 1', 140, 525);
      },
    },
    {
      name: 'organic-oats-back.jpg',
      label: 'Package Back (Mandatory Declarations Panel)',
      width: 600,
      height: 600,
      draw: (ctx: CanvasRenderingContext2D) => {
        ctx.fillStyle = '#022c22';
        ctx.fillRect(0, 0, 600, 600);

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(40, 40, 520, 520, 12);
        ctx.fill();

        ctx.fillStyle = '#064e3b';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText('STATUTORY DECLARATIONS (PCR 2011)', 70, 80);

        // Net Quantity (Compliant with unit 'g')
        // bbox: [120, 280, 240, 315]
        ctx.fillStyle = '#ecfdf5';
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.5;
        ctx.fillRect(120, 280, 120, 35);
        ctx.strokeRect(120, 280, 120, 35);
        ctx.fillStyle = '#065f46';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText('NET QTY: 500 g', 125, 303);

        // Country of Origin
        // bbox: [120, 340, 220, 370]
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(120, 340, 100, 30);
        ctx.fillStyle = '#0f172a';
        ctx.font = '13px sans-serif';
        ctx.fillText('Origin: India', 125, 360);

        // Expiry Date Box
        ctx.fillStyle = '#f0fdf4';
        ctx.fillRect(290, 85, 200, 30);
        ctx.fillStyle = '#166534';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText('BEST BEFORE 03/2027', 300, 105);

        // FSSAI
        // bbox: [60, 480, 360, 510]
        ctx.fillStyle = '#f0fdf4';
        ctx.fillRect(60, 480, 300, 30);
        ctx.fillStyle = '#065f46';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText('fssai  Lic. No. 11220334000123', 70, 500);

        // Green Veg symbol
        ctx.strokeStyle = '#16a34a';
        ctx.lineWidth = 2;
        ctx.strokeRect(480, 340, 30, 30);
        ctx.fillStyle = '#16a34a';
        ctx.beginPath();
        ctx.arc(495, 355, 7, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#64748b';
        ctx.font = '11px sans-serif';
        ctx.fillText('SCENARIO 1: FULLY COMPLIANT • SURFACE 2', 150, 580);
      },
    },
    {
      name: 'organic-oats-side.jpg',
      label: 'Package Side (Care & Nutrition)',
      width: 600,
      height: 600,
      draw: (ctx: CanvasRenderingContext2D) => {
        ctx.fillStyle = '#064e3b';
        ctx.fillRect(0, 0, 600, 600);

        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.roundRect(40, 40, 520, 520, 12);
        ctx.fill();

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText('CONSUMER SUPPORT & CARE', 80, 90);

        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(70, 180, 360, 32);
        ctx.fillStyle = '#0f172a';
        ctx.font = '14px monospace';
        ctx.fillText('Email: care@pureearthorganics.in', 80, 202);

        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#334155';
        ctx.fillText('Toll Free: 1800-111-2233 (Mon-Fri 10AM-5PM)', 70, 250);
        ctx.fillText('Packaging Date: 15/09/2025 • Batch: PEO-2025-09', 70, 280);

        ctx.fillStyle = '#64748b';
        ctx.font = '11px sans-serif';
        ctx.fillText('SCENARIO 1: FULLY COMPLIANT • SURFACE 3', 140, 575);
      },
    },
  ];

  const files: File[] = [];
  for (const imgSpec of images) {
    const canvas = document.createElement('canvas');
    canvas.width = imgSpec.width;
    canvas.height = imgSpec.height;
    const ctx = canvas.getContext('2d');
    if (ctx) imgSpec.draw(ctx);
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b || new Blob()), 'image/jpeg', 0.95);
    });
    files.push(new File([blob], imgSpec.name, { type: 'image/jpeg' }));
  }
  return files;
}

export async function createReviewRequiredPackageFiles(): Promise<File[]> {
  const images = [
    {
      name: 'herbal-chai-front.jpg',
      label: 'Package Front (Curved Pouch)',
      width: 600,
      height: 600,
      draw: (ctx: CanvasRenderingContext2D) => {
        ctx.fillStyle = '#78350f';
        ctx.fillRect(0, 0, 600, 600);

        ctx.fillStyle = '#92400e';
        ctx.beginPath();
        ctx.roundRect(40, 40, 520, 520, 16);
        ctx.fill();

        ctx.fillStyle = '#fffbeb';
        ctx.beginPath();
        ctx.roundRect(50, 50, 500, 500, 12);
        ctx.fill();

        ctx.fillStyle = '#451a03';
        ctx.font = 'bold 34px sans-serif';
        ctx.fillText('HIMALAYAN RESERVE', 110, 140);

        ctx.font = 'bold 24px sans-serif';
        ctx.fillStyle = '#78350f';
        ctx.fillText('Artisan Spiced Herbal Chai', 135, 185);

        // MRP
        // bbox: [110, 80, 340, 115]
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#b45309';
        ctx.fillRect(110, 80, 230, 35);
        ctx.strokeRect(110, 80, 230, 35);
        ctx.fillStyle = '#451a03';
        ctx.font = 'bold 15px monospace';
        ctx.fillText('₹ 240.00 (Incl. of all taxes)', 116, 103);

        // USP
        // bbox: [110, 120, 260, 145]
        ctx.fillStyle = '#fef3c7';
        ctx.fillRect(110, 120, 150, 25);
        ctx.fillStyle = '#92400e';
        ctx.font = 'bold 13px monospace';
        ctx.fillText('₹ 1.20 / g', 120, 137);

        // Manufacturer (partially near curved fold)
        // bbox: [50, 420, 390, 455]
        ctx.fillStyle = 'rgba(254, 243, 199, 0.7)';
        ctx.fillRect(50, 420, 340, 35);
        ctx.fillStyle = '#78350f';
        ctx.font = '11px sans-serif';
        ctx.fillText('Mfd By: Himalayan Botanicals & Herbs Co.', 55, 442);

        ctx.fillStyle = '#b45309';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText('SCENARIO 3: REVIEW REQUIRED • SURFACE 1', 140, 525);
      },
    },
    {
      name: 'herbal-chai-back.jpg',
      label: 'Package Back (Declarations & Dot-Matrix Stamp)',
      width: 600,
      height: 600,
      draw: (ctx: CanvasRenderingContext2D) => {
        ctx.fillStyle = '#1c1917';
        ctx.fillRect(0, 0, 600, 600);

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(40, 40, 520, 520, 12);
        ctx.fill();

        ctx.fillStyle = '#292524';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText('DECLARATIONS & BATCH CODE', 80, 80);

        // Faint dot-matrix stamp (causes low OCR confidence)
        // bbox: [280, 90, 460, 120]
        ctx.fillStyle = '#f5f5f4';
        ctx.fillRect(280, 90, 180, 30);
        ctx.fillStyle = '#a8a29e'; // Faint gray simulating faded dot-matrix print
        ctx.font = 'bold 12px monospace';
        ctx.fillText('LOT #98 EXP: 08/2026?', 285, 110);

        // Net quantity
        // bbox: [120, 280, 240, 315]
        ctx.fillStyle = '#fafaf9';
        ctx.strokeStyle = '#d6d3d1';
        ctx.fillRect(120, 280, 120, 35);
        ctx.strokeRect(120, 280, 120, 35);
        ctx.fillStyle = '#44403c';
        ctx.font = 'bold 15px sans-serif';
        ctx.fillText('NET WT: 200 g', 125, 303);

        // FSSAI
        // bbox: [60, 480, 360, 510]
        ctx.fillStyle = '#f5f5f4';
        ctx.fillRect(60, 480, 300, 30);
        ctx.fillStyle = '#1e3a8a';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText('fssai  Lic. No. 10021011000456', 70, 500);

        ctx.fillStyle = '#78716c';
        ctx.font = '11px sans-serif';
        ctx.fillText('SCENARIO 3: REVIEW REQUIRED • SURFACE 2', 140, 580);
      },
    },
    {
      name: 'herbal-chai-side.jpg',
      label: 'Package Side (Care & Storage)',
      width: 600,
      height: 600,
      draw: (ctx: CanvasRenderingContext2D) => {
        ctx.fillStyle = '#292524';
        ctx.fillRect(0, 0, 600, 600);

        ctx.fillStyle = '#fafaf9';
        ctx.beginPath();
        ctx.roundRect(40, 40, 520, 520, 12);
        ctx.fill();

        ctx.fillStyle = '#1c1917';
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText('CUSTOMER CARE & BREWING', 80, 90);

        ctx.fillStyle = '#e7e5e4';
        ctx.fillRect(70, 180, 360, 32);
        ctx.fillStyle = '#292524';
        ctx.font = '14px monospace';
        ctx.fillText('care@himalayanherbs.in', 80, 202);

        ctx.fillStyle = '#78716c';
        ctx.font = '11px sans-serif';
        ctx.fillText('SCENARIO 3: REVIEW REQUIRED • SURFACE 3', 140, 575);
      },
    },
  ];

  const files: File[] = [];
  for (const imgSpec of images) {
    const canvas = document.createElement('canvas');
    canvas.width = imgSpec.width;
    canvas.height = imgSpec.height;
    const ctx = canvas.getContext('2d');
    if (ctx) imgSpec.draw(ctx);
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b || new Blob()), 'image/jpeg', 0.95);
    });
    files.push(new File([blob], imgSpec.name, { type: 'image/jpeg' }));
  }
  return files;
}

/**
 * Universal scenario dispatcher
 */
export async function createSamplePackageFilesForScenario(
  scenario: 'compliant' | 'non-compliant' | 'review-required'
): Promise<File[]> {
  switch (scenario) {
    case 'compliant':
      return createCompliantPackageFiles();
    case 'review-required':
      return createReviewRequiredPackageFiles();
    case 'non-compliant':
    default:
      return createSamplePackageFiles();
  }
}
