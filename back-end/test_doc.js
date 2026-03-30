import { Document, Packer, Paragraph, TextRun } from "docx";
import fs from "fs";

const doc = new Document({
  styles: {
    default: {
      document: {
        run: {
          rightToLeft: true,
          language: {
            value: "ar-SA",
            bidirectional: "ar-SA",
          },
        },
        paragraph: {
          alignment: "right",
          bidirectional: true,
        },
      },
    },
  },
  sections: [
    {
      properties: { bidi: true },
      children: [
        new Paragraph({
          children: [new TextRun("هذا اختبار")],
        }),
      ],
    },
  ],
});
Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync("test.docx", buffer);
  console.log("Written test.docx");
});
