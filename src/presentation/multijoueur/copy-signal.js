export async function copySignal(value, status) {
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
    else throw new Error();
    status.textContent = 'Copié ! Vous pouvez partager ce code.';
  } catch {
    const input = document.createElement('textarea'); input.value = value; input.readOnly = true;
    input.style.cssText = 'position:fixed;left:0;top:0;opacity:0;width:1px;height:1px;';
    document.body.append(input); input.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } finally { input.remove(); }
    status.textContent = copied ? 'Copié ! Vous pouvez partager ce code.' : 'Copie indisponible. Utilisez « Mode texte » pour sélectionner le code.';
  }
}
