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
    onclone: (clonedDoc) => {
      // PDF 템플릿은 인라인 스타일만 사용하므로 전역 CSS(Tailwind 등) 제거
      // → html2canvas가 lab() 같은 미지원 색상 함수 파싱 시도 자체를 방지
      clonedDoc.querySelectorAll('link[rel="stylesheet"], style').forEach(el => el.remove())
    },
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
