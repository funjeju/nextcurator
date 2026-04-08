export async function downloadPdf(element: HTMLElement, filename: string) {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ])

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: false,
    backgroundColor: '#ffffff',
    logging: false,
    imageTimeout: 10000,
  })

  const imgData = canvas.toDataURL('image/png')
  const pxToMm = 0.264583
  const widthMm = canvas.width / 2 * pxToMm
  const heightMm = canvas.height / 2 * pxToMm

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [widthMm, heightMm],
  })

  pdf.addImage(imgData, 'PNG', 0, 0, widthMm, heightMm)
  pdf.save(filename)
}
