from __future__ import annotations

import json
import re
import zipfile
from collections import Counter, defaultdict
from pathlib import Path
from xml.etree import ElementTree as ET


INPUT = Path(r"C:\Users\diego\OneDrive\01 - Financeiro_Diego\Novo financeiro\Financeiro_Diego_Consolidado.xlsx")
OUTPUT = Path("financeiro_analysis.json")
NS = {
    "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "rel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "pkgrel": "http://schemas.openxmlformats.org/package/2006/relationships",
}


def q(name: str) -> str:
    return f"{{{NS['main']}}}{name}"


def col_to_index(cell_ref: str) -> int:
    letters = re.match(r"[A-Z]+", cell_ref or "")
    if not letters:
        return 0
    total = 0
    for ch in letters.group(0):
        total = total * 26 + (ord(ch) - 64)
    return total


def parse_shared_strings(zf: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in zf.namelist():
        return []
    root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
    strings = []
    for si in root.findall("main:si", NS):
        parts = []
        for t in si.findall(".//main:t", NS):
            parts.append(t.text or "")
        strings.append("".join(parts))
    return strings


def parse_workbook(zf: zipfile.ZipFile):
    wb = ET.fromstring(zf.read("xl/workbook.xml"))
    rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
    rel_map = {
        rel.attrib["Id"]: rel.attrib["Target"]
        for rel in rels.findall("pkgrel:Relationship", NS)
    }
    sheets = []
    for sheet in wb.findall("main:sheets/main:sheet", NS):
        rid = sheet.attrib.get(f"{{{NS['rel']}}}id")
        target = rel_map.get(rid, "")
        if not target.startswith("xl/"):
            target = "xl/" + target.lstrip("/")
        sheets.append({
            "name": sheet.attrib.get("name"),
            "sheet_id": sheet.attrib.get("sheetId"),
            "path": target,
            "state": sheet.attrib.get("state", "visible"),
        })
    return sheets


def cell_value(cell: ET.Element, shared_strings: list[str]):
    typ = cell.attrib.get("t")
    formula = cell.find("main:f", NS)
    value = cell.find("main:v", NS)
    inline = cell.find("main:is/main:t", NS)
    raw = value.text if value is not None else None
    displayed = None
    if typ == "s" and raw is not None:
        try:
            displayed = shared_strings[int(raw)]
        except (ValueError, IndexError):
            displayed = raw
    elif typ == "inlineStr":
        displayed = inline.text if inline is not None else ""
    elif typ == "b" and raw is not None:
        displayed = raw == "1"
    elif raw is not None:
        try:
            displayed = float(raw) if "." in raw else int(raw)
        except ValueError:
            displayed = raw
    return displayed, formula.text if formula is not None else None


def detect_header(rows: dict[int, dict[int, object]]) -> int:
    best_score, best_row = -1, 1
    for r in range(1, min(max(rows.keys(), default=1), 40) + 1):
        vals = rows.get(r, {})
        values = list(vals.values())
        non_empty = sum(v not in (None, "") for v in values)
        stringish = sum(isinstance(v, str) and bool(v.strip()) for v in values)
        keyword_hits = 0
        text = " ".join(str(v).lower() for v in values if v not in (None, ""))
        for kw in ["data", "valor", "descr", "categoria", "conta", "status", "venc", "tipo", "saldo"]:
            if kw in text:
                keyword_hits += 2
        score = non_empty + min(stringish, 10) + keyword_hits
        if score > best_score:
            best_score, best_row = score, r
    return best_row


def ordered_row(rows, row_idx, max_col):
    return [rows.get(row_idx, {}).get(c) for c in range(1, max_col + 1)]


def classify_columns(headers):
    terms = {
        "data": ["data", "venc", "pagamento", "compet"],
        "valor": ["valor", "saldo", "total", "receita", "despesa", "entrada", "saida", "saída"],
        "categoria": ["categoria", "grupo", "tipo", "class", "plano"],
        "conta": ["conta", "banco", "cartao", "cartão"],
        "status": ["status", "pago", "recebido", "quitado"],
        "pessoa_empresa": ["cliente", "fornecedor", "favorecido", "pagador", "empresa"],
        "descricao": ["descr", "hist", "lanç", "lanc", "obs", "memo", "detalhe"],
    }
    found = defaultdict(list)
    for idx, raw in enumerate(headers, start=1):
        if raw in (None, ""):
            continue
        text = str(raw).strip().lower()
        for key, needles in terms.items():
            if any(n in text for n in needles):
                found[key].append({"col": idx, "name": str(raw)})
    return dict(found)


def summarize_sheet(zf, sheet, shared_strings):
    root = ET.fromstring(zf.read(sheet["path"]))
    dim = root.find("main:dimension", NS)
    rows: dict[int, dict[int, object]] = {}
    formulas = []
    formula_count = 0
    max_col = 0
    max_row = 0
    for row in root.findall("main:sheetData/main:row", NS):
        r_idx = int(row.attrib.get("r", "0"))
        max_row = max(max_row, r_idx)
        for cell in row.findall("main:c", NS):
            ref = cell.attrib.get("r", "")
            c_idx = col_to_index(ref)
            max_col = max(max_col, c_idx)
            val, formula = cell_value(cell, shared_strings)
            if val not in (None, ""):
                rows.setdefault(r_idx, {})[c_idx] = val
            if formula:
                formula_count += 1
                if len(formulas) < 25:
                    formulas.append({"cell": ref, "formula": formula[:300]})

    header_row = detect_header(rows)
    sample_col_count = min(max_col, 50)
    headers = ordered_row(rows, header_row, sample_col_count)
    sample_rows = []
    for r in range(header_row + 1, min(max_row, header_row + 20) + 1):
        vals = ordered_row(rows, r, sample_col_count)
        if any(v not in (None, "") for v in vals):
            sample_rows.append(vals)
        if len(sample_rows) >= 10:
            break

    profiles = []
    for col_idx, header in enumerate(headers, start=1):
        if header in (None, ""):
            continue
        values = []
        for r in range(header_row + 1, min(max_row, header_row + 500) + 1):
            v = rows.get(r, {}).get(col_idx)
            if v not in (None, ""):
                values.append(v)
        nums = [v for v in values if isinstance(v, (int, float))]
        profile = {
            "col": col_idx,
            "header": str(header),
            "non_empty_in_first_500": len(values),
            "type_counts": dict(Counter(type(v).__name__ for v in values[:300])),
            "sample_values": values[:8],
        }
        if nums:
            profile["numeric_min"] = min(nums)
            profile["numeric_max"] = max(nums)
        profiles.append(profile)

    tables = []
    table_parts = root.findall("main:tableParts/main:tablePart", NS)
    if table_parts:
        rel_path = sheet["path"].replace("xl/worksheets/", "xl/worksheets/_rels/") + ".rels"
        if rel_path in zf.namelist():
            rels = ET.fromstring(zf.read(rel_path))
            rel_map = {
                rel.attrib["Id"]: rel.attrib["Target"]
                for rel in rels.findall("pkgrel:Relationship", NS)
            }
            for part in table_parts:
                rid = part.attrib.get(f"{{{NS['rel']}}}id")
                target = rel_map.get(rid)
                if target:
                    table_path = "xl/" + target.replace("../", "")
                    if table_path in zf.namelist():
                        table_root = ET.fromstring(zf.read(table_path))
                        tables.append({
                            "name": table_root.attrib.get("name"),
                            "displayName": table_root.attrib.get("displayName"),
                            "ref": table_root.attrib.get("ref"),
                            "columns": [
                                c.attrib.get("name")
                                for c in table_root.findall("main:tableColumns/main:tableColumn", NS)
                            ],
                        })

    return {
        **sheet,
        "dimension": dim.attrib.get("ref") if dim is not None else None,
        "max_row_seen": max_row,
        "max_col_seen": max_col,
        "non_empty_rows": len(rows),
        "header_row_guess": header_row,
        "headers_guess": headers,
        "sample_rows": sample_rows,
        "column_classification": classify_columns(headers),
        "column_profiles": profiles[:50],
        "formula_count": formula_count,
        "formula_samples": formulas,
        "tables": tables,
    }


def main():
    with zipfile.ZipFile(INPUT) as zf:
        shared_strings = parse_shared_strings(zf)
        sheets = parse_workbook(zf)
        summaries = [summarize_sheet(zf, sheet, shared_strings) for sheet in sheets]

    result = {
        "source": str(INPUT),
        "sheet_count": len(summaries),
        "sheets": summaries,
    }
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"sheet_count={len(summaries)}")
    for sheet in summaries:
        print(f"{sheet['name']}: {sheet['dimension']} rows={sheet['max_row_seen']} cols={sheet['max_col_seen']} formulas={sheet['formula_count']} tables={len(sheet['tables'])}")


if __name__ == "__main__":
    main()
