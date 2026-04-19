import test from "node:test";
import assert from "node:assert/strict";

import {
  analyzeExtractedTextQuality,
  cleanArabicText,
} from "../src/utils/textExtraction.js";

test("flags Arabic custom-font mojibake for OCR fallback", () => {
  const mojibakeText = `
    ‰Ë_« ”—b«
    Ô tŽ«u1⁄2√Ë Ô ¡U*«
    U???uK<« lO?D2???ð ö?? ̈...U???O???(«
    —U×3«Ë ̈—UN1⁄2_«Ë ̈—UD _« ÁUO
  `;

  const quality = analyzeExtractedTextQuality(mojibakeText);

  assert.equal(quality.needsOcr, true);
  assert.equal(quality.reason, "garbled_arabic_font_encoding");
});

test("accepts normal Arabic Unicode text without OCR fallback", () => {
  const arabicText =
    "الماء مهم للحياة ولا يمكن الاستغناء عنه، ويجب المحافظة عليه وعدم الإسراف في استعماله.";

  const quality = analyzeExtractedTextQuality(arabicText);

  assert.equal(quality.needsOcr, false);
  assert.equal(quality.reason, null);
  assert.equal(quality.arabicRatio, 1);
});

test("normalizes Arabic presentation forms during cleanup", () => {
  assert.equal(cleanArabicText("ﻻ ﻳﻤﻜﻦ ﺍﻻﺳﺘﻐﻨﺎء"), "لا يمكن الاستغناء");
});

test("repairs common Arabic OCR noise without keeping Latin hallucinations", () => {
  const dirtyText = `
    aslgilg الماء
    لماء له أهمية كبيرة في الحياة؛ فلا تستطيعالمخلوقات
    كالإنسان»؛ والحيوان» والثبات الاستغناء عنالماء.
    قال تعالى: ل ETI شوحwon
    مثل: مياه Glas والبحار» والانهار» والآبار. وهذايصح
    وهو الذي وقعت فيه النجاسة فغيرت لونه؛ أو ريحه؛ أو Chord وهذا أيضاً
    توجه بالسؤال الآتي إلى من تعتقد أنه قادرعلى الإجابة cae ثم اكتب الإجابة فىدفترك.
    إذا لم نجد الماء من أجل csp JI فماذانفعل؟
    $08
  `;

  const cleaned = cleanArabicText(dirtyText, { repairOcr: true });

  assert.match(cleaned, /الماء له أهمية كبيرة في الحياة/u);
  assert.match(cleaned, /تستطيع المخلوقات/u);
  assert.match(cleaned, /والحيوان، والنبات/u);
  assert.match(cleaned, /عن الماء/u);
  assert.match(cleaned, /قال تعالى:/u);
  assert.match(cleaned, /مياه الأمطار والبحار/u);
  assert.match(cleaned, /وهذا يصح/u);
  assert.match(cleaned, /أو طعمه وهذا/u);
  assert.match(cleaned, /قادر على/u);
  assert.match(cleaned, /في دفترك/u);
  assert.match(cleaned, /من أجل الوضوء فماذا نفعل/u);
  assert.doesNotMatch(cleaned, /\b(?:aslgilg|ETI|won|Glas|Chord|cae|csp|JI)\b/u);
  assert.doesNotMatch(cleaned, /\$08/u);
});
