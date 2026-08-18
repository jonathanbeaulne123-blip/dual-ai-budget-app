"""Locate exact IDs and formula references inside an ODS workbook.

Uses only Python's standard library so the audit is repeatable without adding
another project dependency. It never modifies the workbook.
"""

from __future__ import annotations

import argparse
import json
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


NS = {
    "office": "urn:oasis:names:tc:opendocument:xmlns:office:1.0",
    "table": "urn:oasis:names:tc:opendocument:xmlns:table:1.0",
    "text": "urn:oasis:names:tc:opendocument:xmlns:text:1.0",
}


def column_name(index: int) -> str:
    result = ""
    while index:
        index, remainder = divmod(index - 1, 26)
        result = chr(65 + remainder) + result
    return result


def cell_text(cell: ET.Element) -> str:
    paragraphs = []
    for paragraph in cell.findall("text:p", NS):
        paragraphs.append("".join(paragraph.itertext()))
    if paragraphs:
        return "\n".join(paragraphs)

    for attribute in (
        f"{{{NS['office']}}}string-value",
        f"{{{NS['office']}}}date-value",
        f"{{{NS['office']}}}time-value",
        f"{{{NS['office']}}}boolean-value",
        f"{{{NS['office']}}}value",
    ):
        value = cell.get(attribute)
        if value is not None:
            return value
    return ""


def read_sheets(path: Path) -> dict[str, dict[tuple[int, int], dict[str, str]]]:
    with zipfile.ZipFile(path) as workbook_zip:
        root = ET.fromstring(workbook_zip.read("content.xml"))

    sheets: dict[str, dict[tuple[int, int], dict[str, str]]] = {}
    for table in root.findall(".//table:table", NS):
        sheet_name = table.get(f"{{{NS['table']}}}name", "Unnamed")
        cells: dict[tuple[int, int], dict[str, str]] = {}
        row_number = 1

        for row in table.findall("table:table-row", NS):
            row_repeat = int(row.get(f"{{{NS['table']}}}number-rows-repeated", "1"))
            row_cells: list[tuple[int, dict[str, str]]] = []
            column_number = 1

            for cell in list(row):
                if cell.tag not in {
                    f"{{{NS['table']}}}table-cell",
                    f"{{{NS['table']}}}covered-table-cell",
                }:
                    continue
                column_repeat = int(
                    cell.get(f"{{{NS['table']}}}number-columns-repeated", "1")
                )
                value = cell_text(cell)
                formula = cell.get(f"{{{NS['table']}}}formula", "")
                if value or formula:
                    for offset in range(column_repeat):
                        row_cells.append(
                            (column_number + offset, {"value": value, "formula": formula})
                        )
                column_number += column_repeat

            if row_cells:
                for row_offset in range(row_repeat):
                    for column, payload in row_cells:
                        cells[(row_number + row_offset, column)] = payload
            row_number += row_repeat

        sheets[sheet_name] = cells
    return sheets


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--include-row",
        action="store_true",
        help="Include the matching row keyed by row-4 headers.",
    )
    parser.add_argument("workbook", type=Path)
    parser.add_argument("targets", nargs="+")
    args = parser.parse_args()

    sheets = read_sheets(args.workbook)
    matches = []
    for sheet_name, cells in sheets.items():
        for (row, column), payload in cells.items():
            value = payload["value"]
            formula = payload["formula"]
            for target in args.targets:
                match_type = None
                if value == target:
                    match_type = "value"
                elif target in formula:
                    match_type = "formula"
                if not match_type:
                    continue

                header = cells.get((4, column), {}).get("value", "")
                result = {
                    "target": target,
                    "sheet": sheet_name,
                    "cell": f"{column_name(column)}{row}",
                    "header": header,
                    "match_type": match_type,
                    "value": value,
                    "formula": formula,
                }
                if args.include_row:
                    row_context = {}
                    for (context_row, context_column), context_payload in cells.items():
                        if context_row != row:
                            continue
                        context_header = cells.get((4, context_column), {}).get(
                            "value", ""
                        )
                        context_key = context_header or column_name(context_column)
                        row_context[context_key] = context_payload["value"]
                    result["row_context"] = row_context
                matches.append(result)

    print(json.dumps(matches, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
