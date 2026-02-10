import re
from pathlib import Path

schema_path = Path(r"c:\Users\shubi\OneDrive\Desktop\Original\co piolet\supabase\_schema_dump.sql")
text = schema_path.read_text(encoding="utf-8", errors="ignore").splitlines()

tables = {}
i = 0
while i < len(text):
    line = text[i].strip()
    match = re.match(
        r"CREATE TABLE\s+(?:ONLY\s+)?(?:(?:\"(?P<schema>[^\"]+)\"\.)?\"(?P<table>[^\"]+)\"|(?:(?P<schema2>\w+)\.)?(?P<table2>\w+))\s*\(",
        line,
        re.IGNORECASE,
    )
    if match:
        schema = match.group("schema") or match.group("schema2") or "public"
        table = match.group("table") or match.group("table2")
        key = f"{schema}.{table}"
        cols = []
        i += 1
        while i < len(text):
            current = text[i].strip()
            if current.startswith(");"):
                break
            if not current or current.startswith("--"):
                i += 1
                continue
            if re.match(r"(CONSTRAINT|PRIMARY KEY|UNIQUE|CHECK|FOREIGN KEY)", current, re.IGNORECASE):
                i += 1
                continue
            current = current.rstrip(",")
            col_match = re.match(r"\"?(?P<col>[^\"\s]+)\"?\s+(?P<type>.+)", current)
            if col_match:
                col = col_match.group("col")
                coltype = col_match.group("type")
                nullable = "NOT NULL" if re.search(r"\bNOT NULL\b", coltype, re.IGNORECASE) else "NULL"
                coltype_clean = re.split(r"\bDEFAULT\b", coltype, flags=re.IGNORECASE)[0].strip()
                cols.append((col, coltype_clean, nullable))
            i += 1
        tables[key] = cols
    i += 1

out_path = Path(r"c:\Users\shubi\OneDrive\Desktop\Original\co piolet\supabase\_schema_tables.txt")
with out_path.open("w", encoding="utf-8") as handle:
    for table_name in sorted(tables):
        handle.write(f"[{table_name}]\n")
        for col, coltype, nullable in tables[table_name]:
            handle.write(f"- {col}: {coltype} ({nullable})\n")
        handle.write("\n")

print(f"Wrote {len(tables)} tables to {out_path}")
