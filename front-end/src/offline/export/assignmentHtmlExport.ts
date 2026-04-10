function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildOfflineAssignmentHtml(enrichedAssignment: Record<string, unknown>): string {
  const name = escapeHtml(enrichedAssignment.name ?? '—');
  const teacherName = escapeHtml(enrichedAssignment.teacher_name ?? '—');
  const lessonName = escapeHtml(enrichedAssignment.lesson_name ?? '—');
  const typeLabel =
    enrichedAssignment.type === 'written'
      ? 'تحريري'
      : enrichedAssignment.type === 'varied'
        ? 'متنوع'
        : 'عملي';
  const updatedAt = escapeHtml(
    enrichedAssignment.updated_at
      ? new Date(String(enrichedAssignment.updated_at)).toLocaleString('ar-SA', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—'
  );
  const description = escapeHtml(
    String(enrichedAssignment.description ?? '').trim() ||
      'لا يوجد وصف إضافي لهذا الواجب.'
  );
  const content = escapeHtml(enrichedAssignment.content ?? '');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>${name}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      direction: rtl;
      font-family: 'Traditional Arabic', 'Amiri', 'Arial', sans-serif;
      background: #fff;
      color: #000;
    }
    .sheet {
      padding: 18px;
      border: 2px solid #000;
      border-radius: 18px;
      margin: 18px;
    }
    .header {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0;
      border: 1px solid #000;
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 16px;
    }
    .cell {
      border-left: 1px solid #000;
      border-bottom: 1px solid #000;
      padding: 10px 12px;
    }
    .cell:nth-child(2n) {
      border-left: none;
    }
    .label {
      display: block;
      font-size: 12px;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .value {
      margin: 0;
      font-size: 15px;
      line-height: 1.7;
      white-space: pre-wrap;
      overflow-wrap: break-word;
      word-break: normal;
    }
    .section {
      border: 1px solid #000;
      border-radius: 12px;
      padding: 12px;
      margin-top: 12px;
    }
    .section h3 {
      margin: 0 0 8px;
      font-size: 16px;
    }
    pre {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
      overflow-wrap: break-word;
      font-family: inherit;
      font-size: 15px;
      line-height: 1.75;
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div class="cell"><span class="label">الواجب</span><p class="value">${name}</p></div>
      <div class="cell"><span class="label">المعلم</span><p class="value">${teacherName}</p></div>
      <div class="cell"><span class="label">الدرس</span><p class="value">${lessonName}</p></div>
      <div class="cell"><span class="label">نوع الواجب</span><p class="value">${typeLabel}</p></div>
      <div class="cell"><span class="label">آخر تعديل</span><p class="value">${updatedAt}</p></div>
    </div>
    <div class="section">
      <h3>الوصف</h3>
      <pre>${description}</pre>
    </div>
    <div class="section">
      <h3>المحتوى</h3>
      <pre>${content || '—'}</pre>
    </div>
  </div>
</body>
</html>`;
}
