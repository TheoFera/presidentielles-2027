param(
  [string]$OutputDirectory = 'artifacts/npc-audit',
  [switch]$Militant
)

Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$biomes = 'bobo', 'banlieue', 'periurbain', 'campagne', 'retraites', 'riches'
foreach ($biome in $biomes) {
  $sheet = New-Object System.Drawing.Bitmap(900, 1200)
  $graphics = [System.Drawing.Graphics]::FromImage($sheet)
  $labelFont = New-Object System.Drawing.Font('Arial', 13)
  try {
    $graphics.Clear([System.Drawing.Color]::FromArgb(238, 226, 204))
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    for ($variant = 0; $variant -lt 20; $variant++) {
      $source = if ($Militant) { "assets/images/habitants/militants/npc-$biome-$variant-militant.png" }
        else { "assets/images/habitants/neutres/npc-$biome-$variant.png" }
      if (-not $Militant -and $biome -eq 'banlieue' -and $variant -eq 9) {
        $source = 'assets/images/habitants/neutres/npc-banlieue-9-fixed.png'
      }
      if (-not (Test-Path -LiteralPath $source)) {
        $graphics.DrawString("$biome-$variant : absent", $labelFont, [System.Drawing.Brushes]::DarkRed,
          ($variant % 5) * 180 + 10, [math]::Floor($variant / 5) * 300 + 120)
        continue
      }
      $image = [System.Drawing.Image]::FromFile((Resolve-Path $source))
      try {
        $column = $variant % 5
        $row = [math]::Floor($variant / 5)
        $width = [int]($image.Width * 0.94)
        $height = [int]($image.Height * 0.94)
        $left = $column * 180 + [int]((180 - $width) / 2)
        $top = $row * 300 + 18
        $graphics.DrawImage($image, $left, $top, $width, $height)
        $graphics.DrawString("$biome-$variant", $labelFont, [System.Drawing.Brushes]::Black, $column * 180 + 18, $row * 300 + 270)
      } finally { $image.Dispose() }
    }
    $sheet.Save((Join-Path $OutputDirectory "$biome.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $labelFont.Dispose()
    $graphics.Dispose()
    $sheet.Dispose()
  }
}
