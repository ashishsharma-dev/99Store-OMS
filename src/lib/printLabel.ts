/**
 * Thermal Label Print Utility
 *
 * Opens a blank popup window containing ONLY the label HTML and
 * minimal 4x6in print CSS, then triggers print() on that window.
 * This avoids all issues with printing the entire dashboard page.
 */
export function printThermalLabel(containerId: string): void {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`[printThermalLabel] Element #${containerId} not found.`);
    return;
  }

  const labelHtml = container.innerHTML;
  const logoUrl = window.location.origin + '/99-logo.png';

  const printWindow = window.open('', '_blank', 'width=400,height=620');
  if (!printWindow) {
    alert('Pop-up blocked! Please allow pop-ups for this site and try again.');
    return;
  }

  printWindow.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Thermal Label</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    @page {
      size: 4in 6in;
      margin: 0;
    }

    html, body {
      width: 4in;
      height: 6in;
      background: #fff;
      color: #000;
      font-family: sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* The container that holds all thermal-shipping-label divs */
    #print-root {
      width: 4in;
    }

    /* Each individual label page - 4x6 page container with flexbox centering */
    .thermal-shipping-label {
      width: 4in !important;
      height: 6in !important;
      max-height: 6in !important;
      box-sizing: border-box !important;
      overflow: hidden !important;
      page-break-after: always !important;
      break-after: page !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      background: #fff !important;
      display: flex !important;
      justify-content: center !important;
      align-items: center !important;
      padding: 0.12in !important;
    }

    /* The actual visual label - sized 3.76in x 5.76in to sit dead center inside 4x6 paper */
    .healvita-label {
      width: 3.76in !important;
      height: 5.76in !important;
      max-height: 5.76in !important;
      border: 2px solid #000 !important;
      box-sizing: border-box !important;
      font-size: 8px !important;
      line-height: 1.1 !important;
      overflow: hidden !important;
      background: #fff !important;
      color: #000 !important;
      display: flex !important;
      flex-direction: column !important;
      font-family: sans-serif !important;
      margin: 0 auto !important;
    }

    /* Reduce all section paddings to fit content */
    .healvita-label > div {
      padding: 3px 4px !important;
    }

    /* Scale down the large amount text */
    .healvita-label div[style*="font-size: 28px"],
    .healvita-label div[style*="font-size:28px"] {
      font-size: 20px !important;
    }

    /* Tables */
    .healvita-label table {
      font-size: 6.5px !important;
      width: 100% !important;
    }

    .healvita-label th,
    .healvita-label td {
      padding: 1px 2px !important;
    }

    /* Barcodes */
    .healvita-label svg {
      max-height: 32px !important;
    }

    /* QR code */
    .healvita-label img[alt="Scan QR"] {
      width: 48px !important;
      height: 48px !important;
    }

    /* Logo */
    .healvita-label img[alt="99Store Logo"] {
      width: 36px !important;
    }

    /* Headings */
    .healvita-label h2 {
      font-size: 13px !important;
    }
  </style>
</head>
<body>
  <div id="print-root">${labelHtml}</div>
  <script>
    // Replace relative logo src with absolute URL so it loads in the popup
    document.querySelectorAll('img[src="/99-logo.png"]').forEach(function(img) {
      img.src = '${logoUrl}';
    });

    // Wait for images to load, then print
    var images = document.querySelectorAll('img');
    var loaded = 0;
    var total = images.length;

    function tryPrint() {
      window.focus();
      window.print();
      setTimeout(function() { window.close(); }, 500);
    }

    if (total === 0) {
      tryPrint();
    } else {
      images.forEach(function(img) {
        if (img.complete) {
          loaded++;
          if (loaded >= total) tryPrint();
        } else {
          img.onload = img.onerror = function() {
            loaded++;
            if (loaded >= total) tryPrint();
          };
        }
      });
    }
  </script>
</body>
</html>`);

  printWindow.document.close();
}
