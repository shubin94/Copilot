$schemaPath = "c:\Users\shubi\OneDrive\Desktop\Original\co piolet\supabase\_schema_dump.sql"
$outPath = "c:\Users\shubi\OneDrive\Desktop\Original\co piolet\supabase\_schema_tables.txt"

$text = Get-Content -Path $schemaPath -Raw
$tables = [ordered]@{}

$regexQuoted = [regex]::new('CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(?:ONLY\s+)?"(?<schema>[^"]+)"\."(?<table>[^"]+)"\s*\((?<cols>.*?)\);', [System.Text.RegularExpressions.RegexOptions]::Singleline)
$regexUnquoted = [regex]::new('CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(?:ONLY\s+)?(?<schema>\w+)\.(?<table>\w+)\s*\((?<cols>.*?)\);', [System.Text.RegularExpressions.RegexOptions]::Singleline)

$allMatches = @()
$allMatches += $regexQuoted.Matches($text)
$allMatches += $regexUnquoted.Matches($text)

foreach ($match in $allMatches) {
    $schema = $match.Groups['schema'].Value
    if ([string]::IsNullOrEmpty($schema)) { $schema = 'public' }
    $table = $match.Groups['table'].Value
    $key = "$schema.$table"

    $cols = New-Object System.Collections.Generic.List[object]
    $colLines = $match.Groups['cols'].Value -split "`r?`n"
    foreach ($line in $colLines) {
        $current = $line.Trim()
        if ([string]::IsNullOrWhiteSpace($current) -or $current.StartsWith('--')) { continue }
        if ($current -match '^(CONSTRAINT|PRIMARY KEY|UNIQUE|CHECK|FOREIGN KEY)') { continue }

        $current = $current.TrimEnd(',')
        $colMatch = [regex]::Match($current, '"?(?<col>[^"\s]+)"?\s+(?<type>.+)')
        if ($colMatch.Success) {
            $col = $colMatch.Groups['col'].Value
            $colType = $colMatch.Groups['type'].Value
            $nullable = if ($colType -match '\bNOT NULL\b') { 'NOT NULL' } else { 'NULL' }
            $colTypeClean = ($colType -split '\bDEFAULT\b')[0].Trim()
            $cols.Add(@($col, $colTypeClean, $nullable))
        }
    }

    $tables[$key] = $cols
}

$sb = New-Object System.Text.StringBuilder
foreach ($tableKey in $tables.Keys) {
    [void]$sb.AppendLine("[$tableKey]")
    foreach ($col in $tables[$tableKey]) {
        [void]$sb.AppendLine("- $($col[0]): $($col[1]) ($($col[2]))")
    }
    [void]$sb.AppendLine("")
}

$sb.ToString() | Set-Content -Path $outPath
Write-Output "Wrote $($tables.Count) tables to $outPath"
