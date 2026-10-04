// Construit l'application Android à partir du jeu.
//   npm run android        → android/app/build/outputs/bundle/release/app-release.aab (à envoyer au Play Store)
//   npm run android:test   → android/app/build/outputs/apk/debug/app-debug.apk (à installer sur un téléphone de test)
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPages } from './build-pages.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const android = join(root, 'android');
const release = !process.argv.includes('--test');
const env = { ...process.env };

// Java compatible avec Gradle 8.14 : versions 17 à 24. Android Studio fournit parfois une version
// trop récente (Java 25 : « Unsupported class file major version 69 ») ; on prend alors un autre Java
// installé, par exemple celui téléchargé par Android Studio dans ~/.jdks.
const javaVersion = home => {
  try { return Number(readFileSync(join(home, 'release'), 'utf8').match(/JAVA_VERSION="(\d+)/)?.[1]) || 0; } catch { return 0; }
};
const compatibleJava = home => javaVersion(home) >= 17 && javaVersion(home) <= 24;
if (!env.JAVA_HOME || !compatibleJava(env.JAVA_HOME)) {
  const jdks = join(homedir(), '.jdks');
  const candidates = [
    ...(existsSync(jdks) ? readdirSync(jdks).map(name => join(jdks, name)) : []),
    'C:/Program Files/Android/Android Studio/jbr', '/Applications/Android Studio.app/Contents/jbr/Contents/Home', '/opt/android-studio/jbr',
  ];
  const java = candidates.find(compatibleJava);
  if (java) env.JAVA_HOME = java;
  else if (!env.JAVA_HOME) env.JAVA_HOME = candidates.find(path => existsSync(path));
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
