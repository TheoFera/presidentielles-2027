param(
  [string]$InputFile = 'assets/generated/npc/npc-casting-board-v2.png',
  [string]$OutputDirectory = 'assets/generated/npc-v2'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;

public static class NpcBoardExtractor {
  sealed class Component {
    public int Id, Area, MinX, MinY, MaxX, MaxY;
    public int Width { get { return MaxX - MinX + 1; } }
    public int Height { get { return MaxY - MinY + 1; } }
    public double CenterX { get { return (MinX + MaxX) / 2.0; } }
    public double CenterY { get { return (MinY + MaxY) / 2.0; } }
  }

  static bool IsBackground(Color color) {
    int minimum = Math.Min(color.R, Math.Min(color.G, color.B));
    int maximum = Math.Max(color.R, Math.Max(color.G, color.B));
    // Le fond de la planche varie du blanc au beige/gris très clair. Un seuil
    // trop strict conservait ces variations, reliait parfois deux rangées et
    // créait un halo blanc. Les silhouettes restent protégées par leur contour
    // sombre fermé, y compris lorsque les vêtements sont blancs.
    return minimum >= 208 && maximum - minimum <= 38;
  }

  static void SeedBackground(Bitmap source, bool[] queued, Queue<int> queue, int x, int y) {
    int index = y * source.Width + x;
    if (!queued[index] && IsBackground(source.GetPixel(x, y))) {
      queued[index] = true;
      queue.Enqueue(index);
    }
  }

  static void CleanWhiteMatte(Bitmap sprite) {
    using (var original = (Bitmap)sprite.Clone()) {
      for (int y = 0; y < sprite.Height; y++) {
        for (int x = 0; x < sprite.Width; x++) {
          Color color = original.GetPixel(x, y);
          if (color.A == 0) continue;
          bool touchesTransparency = false;
          for (int oy = -2; oy <= 2 && !touchesTransparency; oy++) {
            for (int ox = -2; ox <= 2; ox++) {
              int nx = x + ox, ny = y + oy;
              if (nx >= 0 && nx < sprite.Width && ny >= 0 && ny < sprite.Height && original.GetPixel(nx, ny).A == 0) {
                touchesTransparency = true;
                break;
              }
            }
          }
          if (!touchesTransparency) continue;
          int minimum = Math.Min(color.R, Math.Min(color.G, color.B));
          int maximum = Math.Max(color.R, Math.Max(color.G, color.B));
          if (minimum < 120 || maximum - minimum > 48) continue;
          if (minimum >= 165) sprite.SetPixel(x, y, Color.Transparent);
          else sprite.SetPixel(x, y, Color.FromArgb(255, 38, 38, 38));
        }
      }
    }
  }

  static void RemoveBackgroundBetweenLegs(Bitmap sprite) {
    int width = sprite.Width, height = sprite.Height;
    var visited = new bool[width * height];
    var queue = new Queue<int>();
    var pixels = new List<int>();

    // Le fond visible entre deux jambes peut être entièrement enfermé par les
    // contours et l'ombre portée. Il échappe donc au détourage depuis les bords.
    // On ne retire ici que les petites zones claires, centrales et verticales
    // du bas du corps afin de préserver les chemises et pantalons blancs.
    for (int y = height / 2; y < height; y++) {
      for (int x = 0; x < width; x++) {
        int start = y * width + x;
        Color startColor = sprite.GetPixel(x, y);
        if (visited[start] || startColor.A == 0 || !IsBackground(startColor)) continue;

        visited[start] = true;
        queue.Enqueue(start);
        pixels.Clear();
        int minX = x, maxX = x, minY = y, maxY = y;
        while (queue.Count > 0) {
          int index = queue.Dequeue();
          pixels.Add(index);
          int px = index % width, py = index / width;
          minX = Math.Min(minX, px); maxX = Math.Max(maxX, px);
          minY = Math.Min(minY, py); maxY = Math.Max(maxY, py);
          for (int oy = -1; oy <= 1; oy++) {
            for (int ox = -1; ox <= 1; ox++) {
              if (ox == 0 && oy == 0) continue;
              int nx = px + ox, ny = py + oy;
              if (nx < 0 || nx >= width || ny < height / 2 || ny >= height) continue;
              int neighbor = ny * width + nx;
              Color color = sprite.GetPixel(nx, ny);
              if (!visited[neighbor] && color.A > 0 && IsBackground(color)) {
                visited[neighbor] = true;
                queue.Enqueue(neighbor);
              }
            }
          }
        }

        int componentWidth = maxX - minX + 1;
        int componentHeight = maxY - minY + 1;
        double componentCenterX = (minX + maxX) / 2.0;
        // Certaines poses décalent le bassin par rapport au centre de l'image
        // (chevelure volumineuse, personnage légèrement de trois quarts).
        bool central = componentCenterX >= width * 0.30 && componentCenterX <= width * 0.70;
        bool narrow = componentWidth <= Math.Max(4, (int)Math.Round(width * 0.22));
        bool lowerBody = minY >= (int)Math.Round(height * 0.48) && maxY >= (int)Math.Round(height * 0.68);
        bool vertical = componentHeight >= Math.Max(4, componentWidth / 2);
        if (central && narrow && lowerBody && vertical) {
          foreach (int index in pixels) sprite.SetPixel(index % width, index / width, Color.Transparent);
        }
      }
    }
  }

  public static void Extract(string inputFile, string outputDirectory) {
    string[] biomes = { "bobo", "banlieue", "periurbain", "campagne", "retraites", "riches" };
    const int columns = 20;
    // La planche source ne contient pas davantage de détail utile : 256 px
    // suffisent pour le rendu haute densité tout en limitant le poids mobile.
    const int targetHeight = 256;
    Directory.CreateDirectory(outputDirectory);

    using (var source = new Bitmap(inputFile)) {
      int width = source.Width, height = source.Height;
      var background = new bool[width * height];
      var queued = new bool[width * height];
      var queue = new Queue<int>();
      for (int x = 0; x < width; x++) { SeedBackground(source, queued, queue, x, 0); SeedBackground(source, queued, queue, x, height - 1); }
      for (int y = 0; y < height; y++) { SeedBackground(source, queued, queue, 0, y); SeedBackground(source, queued, queue, width - 1, y); }
      while (queue.Count > 0) {
        int index = queue.Dequeue();
        if (background[index]) continue;
        background[index] = true;
        int x = index % width, y = index / width;
        if (x > 0) SeedBackground(source, queued, queue, x - 1, y);
        if (x + 1 < width) SeedBackground(source, queued, queue, x + 1, y);
        if (y > 0) SeedBackground(source, queued, queue, x, y - 1);
        if (y + 1 < height) SeedBackground(source, queued, queue, x, y + 1);
      }

      var labels = new int[width * height];
      var components = new List<Component>();
      int nextId = 1;
      for (int y = 0; y < height; y++) {
        for (int x = 0; x < width; x++) {
          int start = y * width + x;
          if (background[start] || labels[start] != 0) continue;
          var component = new Component { Id = nextId, MinX = x, MaxX = x, MinY = y, MaxY = y };
          labels[start] = nextId;
          queue.Enqueue(start);
          while (queue.Count > 0) {
            int index = queue.Dequeue();
            int px = index % width, py = index / width;
            component.Area++;
            component.MinX = Math.Min(component.MinX, px); component.MaxX = Math.Max(component.MaxX, px);
            component.MinY = Math.Min(component.MinY, py); component.MaxY = Math.Max(component.MaxY, py);
            int neighbor;
            if (px > 0) { neighbor = index - 1; if (!background[neighbor] && labels[neighbor] == 0) { labels[neighbor] = nextId; queue.Enqueue(neighbor); } }
            if (px + 1 < width) { neighbor = index + 1; if (!background[neighbor] && labels[neighbor] == 0) { labels[neighbor] = nextId; queue.Enqueue(neighbor); } }
            if (py > 0) { neighbor = index - width; if (!background[neighbor] && labels[neighbor] == 0) { labels[neighbor] = nextId; queue.Enqueue(neighbor); } }
            if (py + 1 < height) { neighbor = index + width; if (!background[neighbor] && labels[neighbor] == 0) { labels[neighbor] = nextId; queue.Enqueue(neighbor); } }
          }
          components.Add(component);
          nextId++;
        }
      }

      var characters = components
        .Where(c => c.Height >= 70 && c.Width >= 20 && c.Area >= 500)
        .OrderByDescending(c => c.Area)
        .Take(biomes.Length * columns)
        .OrderBy(c => c.CenterY)
        .ToList();
      if (characters.Count != biomes.Length * columns)
        throw new InvalidDataException(string.Format("120 silhouettes attendues, {0} détectées.", characters.Count));

      for (int row = 0; row < biomes.Length; row++) {
        var rowCharacters = characters.Skip(row * columns).Take(columns).OrderBy(c => c.CenterX).ToList();
        for (int column = 0; column < columns; column++) {
          var character = rowCharacters[column];
          const int padding = 3;
          int cropX = Math.Max(0, character.MinX - padding);
          int cropY = Math.Max(0, character.MinY - padding);
          int cropRight = Math.Min(width, character.MaxX + padding + 1);
          // Le moteur pose le bord inférieur du PNG sur la ligne de sol, comme
          // pour les candidats : aucune marge transparente sous les chaussures.
          int cropBottom = Math.Min(height, character.MaxY + 1);
          int cropWidth = cropRight - cropX, cropHeight = cropBottom - cropY;
          using (var cropped = new Bitmap(cropWidth, cropHeight, PixelFormat.Format32bppArgb)) {
            for (int py = 0; py < cropHeight; py++) {
              for (int px = 0; px < cropWidth; px++) {
                int sourceX = cropX + px, sourceY = cropY + py;
                cropped.SetPixel(px, py, labels[sourceY * width + sourceX] == character.Id ? source.GetPixel(sourceX, sourceY) : Color.Transparent);
              }
            }
            RemoveBackgroundBetweenLegs(cropped);
            CleanWhiteMatte(cropped);
            int targetWidth = Math.Max(1, (int)Math.Round(cropped.Width * (double)targetHeight / cropped.Height));
            using (var sprite = new Bitmap(targetWidth, targetHeight, PixelFormat.Format32bppArgb))
            using (var graphics = Graphics.FromImage(sprite)) {
              graphics.Clear(Color.Transparent);
              graphics.CompositingMode = CompositingMode.SourceCopy;
              graphics.CompositingQuality = CompositingQuality.HighQuality;
              graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
              graphics.SmoothingMode = SmoothingMode.HighQuality;
              graphics.DrawImage(cropped, 0, 0, targetWidth, targetHeight);
              sprite.Save(Path.Combine(outputDirectory, string.Format("npc-{0}-{1}.png", biomes[row], column)), ImageFormat.Png);
            }
          }
        }
      }
    }
  }
}
'@

[NpcBoardExtractor]::Extract((Resolve-Path $InputFile).Path, (Join-Path (Get-Location) $OutputDirectory))
Write-Output "120 sprites PNJ extraits dans $OutputDirectory."
