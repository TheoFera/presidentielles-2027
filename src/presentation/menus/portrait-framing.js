// Un gros plan commun aux avatars et aux petites cases de sélection.
// Repères mesurés sur la première pose : le centre du visage diffère de celui du corps.
const headCenters = { glucksmann: .52, roussel: .48, arthaud: .52, dupont_aignan: .52, retailleau: .55, attal: .52 };
// Cadres adaptés : un peu plus de recul pour NDA et les tenues de Marine Le Pen.
const headSizes = { dupont_aignan: .39, le_pen: .44 };
const portraits = new Map();

export function framePortrait(src, faction) {
  const key = `${faction}:${src}`;
  if (!portraits.has(key)) {
    const job = new Promise((resolve, reject) => {
      const image = new Image();
      image.onerror = () => reject(new Error('Portrait indisponible.'));
      image.onload = () => {
        try {
          const size = image.naturalHeight * (headSizes[faction] ?? .4);
          const center = image.naturalWidth * (headCenters[faction] ?? .5);
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = 512;
          // Petite marge au-dessus des cheveux ; le cou reste visible sous le visage.
          canvas.getContext('2d').drawImage(image, center - size / 2, -image.naturalHeight * .015, size, size, 0, 0, 512, 512);
          canvas.toBlob(blob => blob ? resolve(URL.createObjectURL(blob)) : reject(new Error('Portrait indisponible.')), 'image/png');
        } catch (error) { reject(error); }
      };
      image.src = src;
    });
    portraits.set(key, job);
    // Une erreur de chargement temporaire ne bloque pas les affichages suivants.
    void job.catch(() => portraits.delete(key));
  }
  return portraits.get(key);
}
