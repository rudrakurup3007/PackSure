/**
 * Sample image generator for PackSure AI
 * Generates realistic SVG-based commodity packaging images formatted as real browser File objects.
 * This guarantees seamless demonstration during hackathon testing.
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
