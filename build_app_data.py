from __future__ import annotations

import json
import zipfile
from collections import Counter, defaultdict
from datetime import date, timedelta
from pathlib import Path
from xml.etree import ElementTree as ET

import inspect_finance_workbook as xlsx


OUTPUT_DIR = Path("app")
OUTPUT_FILE = OUTPUT_DIR / "finance-data.json"
OUTPUT_JS_FILE = OUTPUT_DIR / "finance-data.js"
BASE_DATE = date(1899, 12, 30)
TRANSACTION_SHEETS = {
    "Itaú_B": ("Itau", "Banco"),
    "Itaú_C": ("Itau", "Cartao"),
    "Inter_B": ("Inter", "Banco"),
    "Inter_C": ("Inter", "Cartao"),
    "BTG_B": ("BTG", "Banco"),
    "BTG_C": ("BTG", "Cartao"),
    "BTG_I": ("BTG", "Investimento"),
    "Nu_B": ("Nubank", "Banco"),
    "Nu_C": ("Nubank", "Cartao"),
    "STD_B": ("Santander", "Banco"),
    "STD_C": ("Santander", "Cartao"),
    "CEF_B": ("Caixa Economica", "Banco"),
    "Clear_I": ("Clear", "Investimento"),
    "Rico_I": ("Rico", "Investimento"),
    "Caixa": ("Caixa Manual", "Caixa"),
}


def excel_date(value):
    if isinstance(value, (int, float)) and value > 30000:
        return (BASE_DATE + timedelta(days=int(value))).isoformat()
    return None


def parse_sheet_rows(zf, sheet, shared_strings):
    root = ET.fromstring(zf.read(sheet["path"]))
    rows = {}
    for row in root.findall("main:sheetData/main:row", xlsx.NS):
        r_idx = int(row.attrib.get("r", "0"))
        vals = {}
        for cell in row.findall("main:c", xlsx.NS):
            c_idx = xlsx.col_to_index(cell.attrib.get("r", ""))
            val, _formula = xlsx.cell_value(cell, shared_strings)
            vals[c_idx] = val
        rows[r_idx] = vals
    return rows


def infer_macro(code, amount):
    if code in {9999}:
        return "transferencia"
    if 100 <= code < 300:
        return "receita"
    if 300 <= code < 1200:
        return "despesa"
    if 1200 <= code < 1500:
        return "financiamento"
    if 1500 <= code < 2200:
        return "investimento"
    return "receita" if amount > 0 else "despesa"


def build_categories(fluxo_rows):
    categories = {}
    level1 = None
    level2 = None
    level3 = None
    level4 = None
    level3_names = {
        "Receitas Fixas",
        "Receitas Variáveis",
        "Despesas Fixas (Essencial)",
        "Despesas Fixas (Não Essencial)",
        "Despesas Temporárias",
    }
    for r in range(6, 190):
        vals = fluxo_rows.get(r, {})
        level = vals.get(2)
        code = vals.get(3)
        name = vals.get(4)
        if isinstance(code, str) and code.strip():
            label = code.strip()
            if label.startswith("(=)"):
                level1 = label
                level2 = None
                level3 = None
                level4 = None
            elif label.startswith("(+)") or label.startswith("(-)"):
                level2 = label
                level3 = None
                level4 = None
            elif label in level3_names or label.startswith("Receitas "):
                level3 = label
                level4 = None
            else:
                level4 = label
            continue
        if isinstance(code, (int, float)) and name:
            code_int = int(code)
            if level1 == "(=) Resultado Operacional":
                section = level2 or level1
                group = level4 or level3 or level2 or level1
                macro = infer_macro(code_int, -1)
            else:
                section = level1 or "Sem seção"
                group = level4 or level3 or level2 or level1 or "Sem grupo"
                macro = infer_macro(code_int, -1)
            categories[str(code_int)] = {
                "code": code_int,
                "name": str(name),
                "level1": level1 or "Sem nível 1",
                "level2": level2 or "",
                "level3": level3 or "",
                "level4": level4 or "",
                "group": group,
                "section": section,
                "level": str(level) if level not in (None, "") else "",
                "macro": macro,
            }
    return categories


def main():
    with zipfile.ZipFile(xlsx.INPUT) as zf:
        shared_strings = xlsx.parse_shared_strings(zf)
        sheets = {sheet["name"]: sheet for sheet in xlsx.parse_workbook(zf)}
        fluxo_rows = parse_sheet_rows(zf, sheets["Fluxo_Caixa"], shared_strings)
        categories = build_categories(fluxo_rows)

        transactions = []
        account_summary = defaultdict(lambda: {"count": 0, "inflow": 0.0, "outflow": 0.0})
        category_summary = defaultdict(lambda: {"count": 0, "amount": 0.0})
        monthly_summary = defaultdict(lambda: {"inflow": 0.0, "outflow": 0.0, "net": 0.0})

        for sheet_name, (institution, account_type) in TRANSACTION_SHEETS.items():
            if sheet_name not in sheets:
                continue
            rows = parse_sheet_rows(zf, sheets[sheet_name], shared_strings)
            account_name = f"{institution} - {account_type}"
            for r_idx, vals in rows.items():
                if r_idx == 1:
                    continue
                description = vals.get(1)
                amount = vals.get(3)
                code = vals.get(4)
                if not isinstance(amount, (int, float)) or code in (None, ""):
                    continue
                try:
                    code_int = int(code)
                except (TypeError, ValueError):
                    continue
                category = categories.get(str(code_int), {})
                payment_date = excel_date(vals.get(8)) or excel_date(vals.get(7)) or excel_date(vals.get(6))
                competence_date = excel_date(vals.get(6))
                year = vals.get(9)
                month = vals.get(10)
                if isinstance(year, (int, float)) and isinstance(month, (int, float)):
                    month_key = f"{int(year):04d}-{int(month):02d}"
                elif payment_date:
                    month_key = payment_date[:7]
                else:
                    month_key = "sem-data"

                tx = {
                    "id": f"{sheet_name}-{r_idx}",
                    "sheet": sheet_name,
                    "account": account_name,
                    "institution": institution,
                    "accountType": account_type,
                    "description": str(description or ""),
                    "holder": str(vals.get(2) or ""),
                    "amount": round(float(amount), 2),
                    "code": code_int,
                    "category": str(vals.get(5) or category.get("name") or "Sem categoria"),
                    "level1": category.get("level1", "Sem nível 1"),
                    "level2": category.get("level2", ""),
                    "level3": category.get("level3", ""),
                    "level4": category.get("level4", ""),
                    "group": category.get("group", "Sem grupo"),
                    "section": category.get("section", "Sem seção"),
                    "macro": infer_macro(code_int, float(amount)),
                    "competenceDate": competence_date,
                    "dueDate": excel_date(vals.get(7)),
                    "paymentDate": payment_date,
                    "month": month_key,
                    "status": "conciliado" if payment_date else "previsto",
                }
                transactions.append(tx)
                account_summary[account_name]["count"] += 1
                if amount >= 0:
                    account_summary[account_name]["inflow"] += float(amount)
                    monthly_summary[month_key]["inflow"] += float(amount)
                else:
                    account_summary[account_name]["outflow"] += float(amount)
                    monthly_summary[month_key]["outflow"] += float(amount)
                monthly_summary[month_key]["net"] += float(amount)
                category_summary[tx["category"]]["count"] += 1
                category_summary[tx["category"]]["amount"] += float(amount)

    transactions.sort(key=lambda item: (item["paymentDate"] or "9999-99-99", item["account"], item["id"]), reverse=True)
    clean_monthly = {
        key: {
            "inflow": round(value["inflow"], 2),
            "outflow": round(value["outflow"], 2),
            "net": round(value["net"], 2),
        }
        for key, value in sorted(monthly_summary.items())
        if key != "sem-data"
    }
    category_rows = [
        {"name": key, "count": value["count"], "amount": round(value["amount"], 2)}
        for key, value in category_summary.items()
    ]
    category_rows.sort(key=lambda item: abs(item["amount"]), reverse=True)

    payload = {
        "generatedAt": date.today().isoformat(),
        "source": str(xlsx.INPUT),
        "transactions": transactions,
        "categories": sorted(categories.values(), key=lambda item: item["code"]),
        "monthlySummary": clean_monthly,
        "accountSummary": [
            {
                "name": key,
                "count": value["count"],
                "inflow": round(value["inflow"], 2),
                "outflow": round(value["outflow"], 2),
                "net": round(value["inflow"] + value["outflow"], 2),
            }
            for key, value in sorted(account_summary.items())
        ],
        "categorySummary": category_rows,
        "topCategoriesByCount": Counter(tx["category"] for tx in transactions).most_common(20),
    }

    OUTPUT_DIR.mkdir(exist_ok=True)
    json_payload = json.dumps(payload, ensure_ascii=False, indent=2)
    OUTPUT_FILE.write_text(json_payload, encoding="utf-8")
    OUTPUT_JS_FILE.write_text(f"window.FINANCE_DATA = {json_payload};\n", encoding="utf-8")
    print(f"Wrote {OUTPUT_FILE} with {len(transactions)} transactions and {len(categories)} categories")


if __name__ == "__main__":
    main()
