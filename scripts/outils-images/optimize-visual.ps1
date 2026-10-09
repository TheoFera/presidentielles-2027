param([Parameter(Mandatory=$true)][string]$Source, [Parameter(Mandatory=$true)][string]$Destination, [int]$MaxHeight = 512, [switch]$KeepCanvas, [int[]]$Crop)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing.Common,System.Drawing.Primitives -TypeDefinition @'
using System.Drawing;
public static class SpriteBounds {
 public static int[] Find(Bitmap bitmap) {
  int l=bitmap.Width,t=bitmap.Height,r=-1,b=-1;
  for(int y=0;y<bitmap.Height;y++) for(int x=0;x<bitmap.Width;x++) {
   if(bitmap.GetPixel(x,y).A>20) { l=System.Math.Min(l,x);r=System.Math.Max(r,x);t=System.Math.Min(t,y);b=System.Math.Max(b,y); }
  }
  return new int[]{l,t,r,b};
 }
}
'@
$bitmap = [Drawing.Bitmap]::new((Resolve-Path -LiteralPath $Source).Path)
try {
  $left = 0; $top = 0; $right = $bitmap.Width - 1; $bottom = $bitmap.Height - 1
  if ($Crop) {
    $left = $Crop[0]; $top = $Crop[1]; $right = $left + $Crop[2] - 1; $bottom = $top + $Crop[3] - 1
  } elseif (!$KeepCanvas) {
    $bounds = [SpriteBounds]::Find($bitmap)
    $left=$bounds[0]; $top=$bounds[1]; $right=$bounds[2]; $bottom=$bounds[3]
  }
  if ($right -lt $left) { throw 'Image entièrement transparente.' }
  $cropWidth = $right - $left + 1; $cropHeight = $bottom - $top + 1
  $scale = [Math]::Min(1.0, $MaxHeight / $cropHeight)
  $outWidth = [Math]::Max(1,[int][Math]::Round($cropWidth * $scale)); $outHeight = [Math]::Max(1,[int][Math]::Round($cropHeight * $scale))
  $output = [Drawing.Bitmap]::new($outWidth,$outHeight,[Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [Drawing.Graphics]::FromImage($output)
  try {
    $graphics.CompositingMode = [Drawing.Drawing2D.CompositingMode]::SourceCopy
    $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.DrawImage($bitmap,[Drawing.Rectangle]::new(0,0,$outWidth,$outHeight),[Drawing.Rectangle]::new($left,$top,$cropWidth,$cropHeight),[Drawing.GraphicsUnit]::Pixel)
    $outputPath = [IO.Path]::GetFullPath((Join-Path (Get-Location) $Destination))
    [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($outputPath)) | Out-Null
    $output.Save($outputPath,[Drawing.Imaging.ImageFormat]::Png)
    [PSCustomObject]@{file=$Destination;width=$outWidth;height=$outHeight;source_crop=@($left,$top,$cropWidth,$cropHeight)} | ConvertTo-Json -Compress
  } finally { $graphics.Dispose(); $output.Dispose() }
} finally { $bitmap.Dispose() }
