// Construit l'application Android à partir du jeu.
//   npm run android        → android/app/build/outputs/bundle/release/app-release.aab (à envoyer au Play Store)
//   npm run android:test   → android/app/build/outputs/apk/debug/app-debug.apk (à installer sur un téléphone de test)
import { spawnSync } from 'node:child_process';
import { existsSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPages } from './build-pages.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const android = join(root, 'android');
const release = !process.argv.includes('--test');
const env = { ...process.env };

// Java fourni avec Android Studio, si aucun autre n'est configuré.
if (!env.JAVA_HOME) {
  const studio = ['C:/Program Files/Android/Android Studio/jbr', '/Applications/Android Studio.app/Contents/jbr/Contents/Home', '/opt/android-studio/jbr']
    .find(path => existsSync(path));
  if (studio) env.JAVA_HOME = studio;
}
// Emplacement du SDK Android, mémorisé dans android/local.properties (fichier local, non partagé).
const localProperties = join(android, 'local.properties');
if (!existsSync(localProperties)) {
  const sdk = env.ANDROID_HOME || env.ANDROID_SDK_ROOT || (env.LOCALAPPDATA && join(env.LOCALAPPDATA, 'Android', 'Sdk'));
  if (!sdk || !existsSync(sdk)) throw new Error('SDK Android introuvable : installez Android Studio, puis relancez cette commande.');
  // Format .properties : le « : » du lecteur Windows doit être précédé d'une barre oblique inverse.
  writeFileSync(localProperties, `sdk.dir=${sdk.replaceAll('\\', '/').replace(':', '\\:')}\n`);
}

const report = await buildPages(undefined, { app: true });
console.log(`Jeu exporté : ${(report.bytes / 1024 ** 2).toFixed(1)} Mio${report.webp ? '' : ' (sans WebP : installez ffmpeg pour une application plus légère)'}.`);

const task = release ? 'bundleRelease' : 'assembleDebug';
const gradle = join(android, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
const result = process.platform === 'win32'
  ? spawnSync('cmd.exe', ['/d', '/s', '/c', `""${gradle}" ${task} --console=plain"`], { cwd: android, env, stdio: 'inherit', windowsVerbatimArguments: true })
  : spawnSync(gradle, [task, '--console=plain'], { cwd: android, env, stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);

const output = release
  ? join(android, 'app/build/outputs/bundle/release/app-release.aab')
  : join(android, 'app/build/outputs/apk/debug/app-debug.apk');
console.log(`\nApplication prête : ${output} (${(statSync(output).size / 1024 ** 2).toFixed(1)} Mio).`);
if (release && !existsSync(join(android, 'keystore.properties'))) {
  console.log('Attention : ce fichier n\'est pas signé. Créez votre clé (voir android/LISEZMOI.md) avant de l\'envoyer au Play Store.');
}
