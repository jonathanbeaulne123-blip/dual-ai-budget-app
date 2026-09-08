/** Quality describes the image. It never substitutes facts for missing OCR fields. */
export type CaptureQuality={overridden:boolean;issues:readonly string[]};
export function captureQualityWarnings(quality?:CaptureQuality):string[]{return quality?[...(quality.overridden?['Captured despite image quality. Review the extracted facts carefully.']:[]),...quality.issues.map(issue=>`Image quality: ${issue}`)]:[];}
