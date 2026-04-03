from __future__ import annotations

import shutil
import sys
import zipfile
from pathlib import Path

from lxml import etree

W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
XML_NS = "http://www.w3.org/XML/1998/namespace"

NSMAP = {
    "mc": "http://schemas.openxmlformats.org/markup-compatibility/2006",
    "o": "urn:schemas-microsoft-com:office:office",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "m": "http://schemas.openxmlformats.org/officeDocument/2006/math",
    "v": "urn:schemas-microsoft-com:vml",
    "wp": "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing",
    "w10": "urn:schemas-microsoft-com:office:word",
    "w": W_NS,
    "wne": "http://schemas.microsoft.com/office/word/2006/wordml",
    "sl": "http://schemas.openxmlformats.org/schemaLibrary/2006/main",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "pic": "http://schemas.openxmlformats.org/drawingml/2006/picture",
    "c": "http://schemas.openxmlformats.org/drawingml/2006/chart",
    "lc": "http://schemas.openxmlformats.org/drawingml/2006/lockedCanvas",
    "dgm": "http://schemas.openxmlformats.org/drawingml/2006/diagram",
    "wps": "http://schemas.microsoft.com/office/word/2010/wordprocessingShape",
    "wpg": "http://schemas.microsoft.com/office/word/2010/wordprocessingGroup",
    "w14": "http://schemas.microsoft.com/office/word/2010/wordml",
    "w15": "http://schemas.microsoft.com/office/word/2012/wordml",
    "w16": "http://schemas.microsoft.com/office/word/2018/wordml",
    "w16cex": "http://schemas.microsoft.com/office/word/2018/wordml/cex",
    "w16cid": "http://schemas.microsoft.com/office/word/2016/wordml/cid",
    None: "http://schemas.microsoft.com/office/tasks/2019/documenttasks",
    "cr": "http://schemas.microsoft.com/office/comments/2020/reactions",
}

XPATH_NSMAP = {prefix: uri for prefix, uri in NSMAP.items() if prefix is not None}

HEADER_NAMESPACE_DECLARATIONS = (
    (
        "wp",
        "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing",
    ),
    (
        "r",
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    ),
)


def qn(local_name: str) -> str:
    return f"{{{W_NS}}}{local_name}"


def xml_qn(local_name: str) -> str:
    return f"{{{XML_NS}}}{local_name}"


def set_w_attr(element: etree._Element, local_name: str, value: str | int) -> None:
    element.set(qn(local_name), str(value))


def make_border(parent: etree._Element, side: str, color: str = "000000", size: str = "4") -> None:
    border = etree.SubElement(parent, qn(side))
    set_w_attr(border, "val", "single")
    set_w_attr(border, "sz", size)
    set_w_attr(border, "space", "0")
    set_w_attr(border, "color", color)


def make_paragraph(
    text: str,
    *,
    align: str = "center",
    size: int = 24,
    bold: bool = False,
    color: str | None = None,
    space_before: int = 0,
    space_after: int = 0,
    top_border: tuple[str, str] | None = None,
    bottom_border: tuple[str, str] | None = None,
) -> etree._Element:
    paragraph = etree.Element(qn("p"))
    ppr = etree.SubElement(paragraph, qn("pPr"))

    bidi = etree.SubElement(ppr, qn("bidi"))
    set_w_attr(bidi, "val", "1")

    jc = etree.SubElement(ppr, qn("jc"))
    set_w_attr(jc, "val", align)

    if space_before or space_after:
        spacing = etree.SubElement(ppr, qn("spacing"))
        set_w_attr(spacing, "before", space_before)
        set_w_attr(spacing, "after", space_after)
        set_w_attr(spacing, "lineRule", "auto")

    if top_border or bottom_border:
        pbdr = etree.SubElement(ppr, qn("pBdr"))
        if top_border:
            top_color, top_size = top_border
            make_border(pbdr, "top", color=top_color, size=top_size)
        if bottom_border:
            bottom_color, bottom_size = bottom_border
            make_border(pbdr, "bottom", color=bottom_color, size=bottom_size)

    run = etree.SubElement(paragraph, qn("r"))
    rpr = etree.SubElement(run, qn("rPr"))
    rfonts = etree.SubElement(rpr, qn("rFonts"))
    for attr in ("ascii", "hAnsi", "cs", "eastAsia"):
        set_w_attr(rfonts, attr, "Arial")

    if bold:
        b = etree.SubElement(rpr, qn("b"))
        set_w_attr(b, "val", "1")
        bcs = etree.SubElement(rpr, qn("bCs"))
        set_w_attr(bcs, "val", "1")

    sz = etree.SubElement(rpr, qn("sz"))
    set_w_attr(sz, "val", size)
    sz_cs = etree.SubElement(rpr, qn("szCs"))
    set_w_attr(sz_cs, "val", size)

    rtl = etree.SubElement(rpr, qn("rtl"))
    set_w_attr(rtl, "val", "1")

    if color:
        color_el = etree.SubElement(rpr, qn("color"))
        set_w_attr(color_el, "val", color)

    text_el = etree.SubElement(run, qn("t"))
    text_el.set(xml_qn("space"), "preserve")
    text_el.text = text

    return paragraph


def make_cell(
    row: etree._Element,
    width: int,
    paragraphs: list[etree._Element],
    *,
    vertical_align: str = "center",
    margin_top: int = 80,
    margin_bottom: int = 80,
    margin_left: int = 120,
    margin_right: int = 120,
) -> etree._Element:
    cell = etree.SubElement(row, qn("tc"))
    tcpr = etree.SubElement(cell, qn("tcPr"))

    tcw = etree.SubElement(tcpr, qn("tcW"))
    set_w_attr(tcw, "w", width)
    set_w_attr(tcw, "type", "dxa")

    valign = etree.SubElement(tcpr, qn("vAlign"))
    set_w_attr(valign, "val", vertical_align)

    tcmar = etree.SubElement(tcpr, qn("tcMar"))
    for side, value in (
        ("top", margin_top),
        ("bottom", margin_bottom),
        ("left", margin_left),
        ("right", margin_right),
    ):
        margin = etree.SubElement(tcmar, qn(side))
        set_w_attr(margin, "w", value)
        set_w_attr(margin, "type", "dxa")

    for paragraph in paragraphs:
        cell.append(paragraph)

    return cell


def build_header_xml() -> etree._Element:
    total_width = 10466
    ministry_width = 3663
    title_width = 3140
    school_width = total_width - ministry_width - title_width

    hdr = etree.Element(qn("hdr"), nsmap=NSMAP)

    tbl = etree.SubElement(hdr, qn("tbl"))
    tbl_pr = etree.SubElement(tbl, qn("tblPr"))

    tbl_w = etree.SubElement(tbl_pr, qn("tblW"))
    set_w_attr(tbl_w, "w", total_width)
    set_w_attr(tbl_w, "type", "dxa")

    jc = etree.SubElement(tbl_pr, qn("jc"))
    set_w_attr(jc, "val", "center")

    borders = etree.SubElement(tbl_pr, qn("tblBorders"))
    for side in ("top", "left", "bottom", "right", "insideH", "insideV"):
        make_border(borders, side, color="000000", size="4")

    layout = etree.SubElement(tbl_pr, qn("tblLayout"))
    set_w_attr(layout, "type", "fixed")

    bidi = etree.SubElement(tbl_pr, qn("bidiVisual"))
    set_w_attr(bidi, "val", "1")

    tbl_grid = etree.SubElement(tbl, qn("tblGrid"))
    for width in (ministry_width, title_width, school_width):
        col = etree.SubElement(tbl_grid, qn("gridCol"))
        set_w_attr(col, "w", width)

    row = etree.SubElement(tbl, qn("tr"))
    tr_pr = etree.SubElement(row, qn("trPr"))
    cant_split = etree.SubElement(tr_pr, qn("cantSplit"))
    set_w_attr(cant_split, "val", "0")

    make_cell(
        row,
        ministry_width,
        [
            make_paragraph("الجمهورية اليمنية", bold=True, size=24, align="center", space_after=20),
            make_paragraph("وزارة التربية والتعليم", bold=True, size=24, align="center", space_after=20),
            make_paragraph("محافظة عدن", bold=True, size=22, align="center"),
        ],
    )

    make_cell(
        row,
        title_width,
        [
            make_paragraph(
                "{{exam_title}}",
                bold=True,
                size=34,
                color="1f497d",
                align="center",
                space_before=20,
                space_after=30,
                top_border=("1f497d", "6"),
                bottom_border=("1f497d", "6"),
            ),
            make_paragraph("{{grade_level}}", bold=True, size=22, align="center", space_after=15),
            make_paragraph(
                "الفصل الدراسي {{semester}} ({{academic_year}})",
                bold=True,
                size=22,
                align="center",
            ),
        ],
    )

    make_cell(
        row,
        school_width,
        [
            make_paragraph("{{%%school_logo}}", align="center", size=12, space_after=20),
            make_paragraph("مدرسة: {{institution_name}}", bold=True, size=22, align="right", space_after=15),
            make_paragraph("الدرجة الكلية: {{total_marks}}", bold=True, size=22, align="right"),
        ],
    )

    return hdr


def ensure_header_namespace_declarations(header_xml: bytes) -> bytes:
    root_start = header_xml.find(b"<w:hdr")
    if root_start < 0:
        return header_xml

    root_end = header_xml.find(b">", root_start)
    if root_end < 0:
        return header_xml

    opening_tag = header_xml[root_start:root_end]
    insertions: list[bytes] = []
    for prefix, uri in HEADER_NAMESPACE_DECLARATIONS:
      token = f"xmlns:{prefix}=".encode("utf-8")
      if token not in opening_tag:
          insertions.append(f' xmlns:{prefix}="{uri}"'.encode("utf-8"))

    if not insertions:
        return header_xml

    return header_xml[:root_end] + b"".join(insertions) + header_xml[root_end:]


def set_paragraph_alignment(paragraph: etree._Element, align: str) -> None:
    ppr = paragraph.find(qn("pPr"))
    if ppr is None:
        ppr = etree.Element(qn("pPr"))
        paragraph.insert(0, ppr)

    jc = ppr.find(qn("jc"))
    if jc is None:
        jc = etree.SubElement(ppr, qn("jc"))
    set_w_attr(jc, "val", align)


def retouch_document_xml(document_xml: bytes) -> bytes:
    root = etree.fromstring(document_xml)
    target_texts = {
        "بيانات الامتحان",
        "بيانات الطالب",
        "التعليمات العامة",
        "توزيع الدرجات",
        "انتهت الأسئلة",
    }

    for paragraph in root.xpath(".//w:p", namespaces=XPATH_NSMAP):
        text = "".join(paragraph.xpath(".//w:t/text()", namespaces=XPATH_NSMAP)).strip()
        if not text:
            continue

        if text in target_texts or text.startswith("القسم الأول:") or text.startswith("القسم الثاني:") or text.startswith("القسم الثالث:") or text.startswith("القسم الرابع:"):
            set_paragraph_alignment(paragraph, "center")

        if text in {"{{school_logo}}", "{{school_logo_url}}", "{%school_logo}", "{%school_logo_url}", "{{%school_logo}}", "{{%school_logo_url}}"}:
            for text_node in paragraph.xpath(".//w:t", namespaces=XPATH_NSMAP):
                if text_node.text and text_node.text.strip() in {
                    "{{school_logo}}",
                    "{{school_logo_url}}",
                    "{%school_logo}",
                    "{%school_logo_url}",
                    "{{%school_logo}}",
                    "{{%school_logo_url}}",
                }:
                    text_node.text = "{{%%school_logo}}"
            set_paragraph_alignment(paragraph, "center")

    return etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone="yes")


def rewrite_docx(template_path: Path) -> None:
    template_path = template_path.resolve()
    temp_path = template_path.with_suffix(".tmp.docx")

    with zipfile.ZipFile(template_path, "r") as source, zipfile.ZipFile(temp_path, "w", compression=zipfile.ZIP_DEFLATED) as target:
        for item in source.infolist():
            data = source.read(item.filename)
            if item.filename == "word/header1.xml":
                header_root = build_header_xml()
                data = etree.tostring(header_root, xml_declaration=True, encoding="UTF-8", standalone="yes")
                data = ensure_header_namespace_declarations(data)
            elif item.filename == "word/document.xml":
                data = retouch_document_xml(data)

            target.writestr(item, data)

    shutil.move(temp_path, template_path)


def main() -> int:
    template_arg = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("template.docx")
    rewrite_docx(template_arg)
    print(f"Updated {template_arg}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
