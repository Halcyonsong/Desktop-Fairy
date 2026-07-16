const fs = require('fs');
const path = require('path');

const frontendRoot = path.resolve(__dirname, '..');
const projectRoot = path.resolve(frontendRoot, '..');
const bundleResourcesRoot = path.join(frontendRoot, 'bundle-resources');
const backendTargetDir = path.join(projectRoot, 'target');
const scriptsSourceDir = path.join(projectRoot, 'local-model-scripts');
const runtimeSourceDir = path.join(projectRoot, 'runtime');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function cleanDir(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyDir(sourceDir, targetDir) {
  fs.cpSync(sourceDir, targetDir, { recursive: true, force: true });
}

function resolveBackendJar() {
  if (!fs.existsSync(backendTargetDir)) {
    throw new Error(`Backend target directory not found: ${backendTargetDir}`);
  }

  const jarFile = fs
    .readdirSync(backendTargetDir)
    .filter((name) => name.endsWith('.jar'))
    .filter((name) => !name.endsWith('.jar.original'))
    .filter((name) => !name.includes('sources'))
    .filter((name) => !name.includes('javadoc'))
    .sort((a, b) => b.localeCompare(a))[0];

  if (!jarFile) {
    throw new Error(`No runnable backend jar found in: ${backendTargetDir}`);
  }

  return path.join(backendTargetDir, jarFile);
}

function assertBundledRuntime() {
  const bundledJavaPath = path.join(runtimeSourceDir, 'jre', 'bin', 'java.exe');
  if (!fs.existsSync(bundledJavaPath)) {
    throw new Error(`Bundled Java runtime not found: ${bundledJavaPath}`);
  }
}

function main() {
  const backendJarPath = resolveBackendJar();
  const backendOutputDir = path.join(bundleResourcesRoot, 'backend');
  const scriptsOutputDir = path.join(bundleResourcesRoot, 'local-model-scripts');
  const runtimeOutputDir = path.join(bundleResourcesRoot, 'runtime');

  cleanDir(bundleResourcesRoot);
  ensureDir(backendOutputDir);

  fs.copyFileSync(backendJarPath, path.join(backendOutputDir, 'Desktop-Fairy.jar'));

  if (!fs.existsSync(scriptsSourceDir)) {
    throw new Error(`Local model scripts directory not found: ${scriptsSourceDir}`);
  }
  copyDir(scriptsSourceDir, scriptsOutputDir);

  assertBundledRuntime();
  copyDir(runtimeSourceDir, runtimeOutputDir);

  console.log('Prepared desktop bundle resources successfully.');
  console.log(`Backend jar: ${backendJarPath}`);
  console.log(`Bundle resources: ${bundleResourcesRoot}`);
}

main();
