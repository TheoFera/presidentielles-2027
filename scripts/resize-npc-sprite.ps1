param(
  [Parameter(Mandatory = $true)][string]$Source,
  [Parameter(Mandatory = $true)][string]$Target,
  [int]$Width,
  [int]$Height,
  [string]$Reference
)

Add-Type -AssemblyName System.Drawing
if ($Reference) {
  $referenceImage = [System.Drawing.Image]::FromFile($Reference)
  try {
    $Width = $referenceImage.Width
    $Height = $referenceImage.Height
  } finally { $referenceImage.Dispose() }
}
if ($Width -le 0 -or $Height -le 0) { throw 'Indiquer une taille ou un portrait de référence.' }
$original = [System.Drawing.Bitmap]::FromFile($Source)
$resized = New-Object System.Drawing.Bitmap($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($resized)
try {
  $graphics.Clear([System.Drawing.Color]::Transparent)
  $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.DrawImage($original, 0, 0, $Width, $Height)
  $resized.Save($Target, [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  $graphics.Dispose()
  $resized.Dispose()
  $original.Dispose()
}
