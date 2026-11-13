/** File formats the phone book can be exported to. Values are the file extensions. */
export enum ExportFormat {
	Excel = 'xlsx',
	Pdf = 'pdf'
}

export const EXPORT_FORMAT_LABELS: Record<ExportFormat, string> = {
	[ExportFormat.Excel]: 'Excel (.xlsx)',
	[ExportFormat.Pdf]: 'PDF (.pdf)'
};
