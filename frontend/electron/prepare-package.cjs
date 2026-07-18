const fs = require('fs');
const path = require('path');

const frontendRoot = path.resolve(__dirname, '..');
const projectRoot = path.resolve(frontendRoot, '..');
const bundleResourcesRoot = path.join(frontendRoot, 'bundle-staging');
const backendTargetDir = path.join(projectRoot, 'target');
const scriptsSourceDir = path.join(projectRoot, 'local-model-scripts');
const runtimeSourceDir = path.join(projectRoot, 'runtime');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function listFilesRecursively(rootDir) {
  const entries = [];

  function walk(currentDir, relativeDir = '') {
    const children = fs.readdirSync(currentDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));

    for (const child of children) {
      const absolutePath = path.join(currentDir, child.name);
      const relativePath = relativeDir ? path.join(relativeDir, child.name) : child.name;

      if (child.isDirectory()) {
        walk(absolutePath, relativePath);
        continue;
      }

      const stat = fs.statSync(absolutePath);
      entries.push({
        relativePath,
        size: stat.size,
        mtimeMs: Math.trunc(stat.mtimeMs),
      });
    }
  }

  if (!fs.existsSync(rootDir)) {
    return entries;
  }

  walk(rootDir);
  return entries;
}

function isSameFileContent(sourcePath, targetPath) {
  if (!fs.existsSync(targetPath)) {
    return false;
  }

  const sourceStat = fs.statSync(sourcePath);
  const targetStat = fs.statSync(targetPath);

  return sourceStat.size === targetStat.size && Math.trunc(sourceStat.mtimeMs) === Math.trunc(targetStat.mtimeMs);
}

function isSameDirectoryContent(sourceDir, targetDir) {
  if (!fs.existsSync(targetDir)) {
    return false;
  }

  const sourceEntries = listFilesRecursively(sourceDir);
  const targetEntries = listFilesRecursively(targetDir);
  if (sourceEntries.length !== targetEntries.length) {
    return false;
  }

  return sourceEntries.every((sourceEntry, index) => {
    const targetEntry = targetEntries[index];
    return Boolean(
      targetEntry
      && sourceEntry.relativePath === targetEntry.relativePath
      && sourceEntry.size === targetEntry.size
      && sourceEntry.mtimeMs === targetEntry.mtimeMs,
    );
  });
}

function copyDir(sourceDir, targetDir) {
  if (isSameDirectoryContent(sourceDir, targetDir)) {
    console.log(`Directory unchanged, skip copy: ${targetDir}`);
    return;
  }

  const tempTargetDir = `${targetDir}.tmp`;

  try {
    fs.rmSync(tempTargetDir, { recursive: true, force: true });
    fs.cpSync(sourceDir, tempTargetDir, { recursive: true, force: true });

    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
    fs.renameSync(tempTargetDir, targetDir);
  } catch (error) {
    try {
      if (fs.existsSync(tempTargetDir)) {
        fs.rmSync(tempTargetDir, { recursive: true, force: true });
      }
    } catch {
      // ignore cleanup failures
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to replace bundled directory. The destination may be locked by a running Desktop Fairy process. Source: ${sourceDir}; Target: ${targetDir}; Cause: ${message}`,
    );
  }
}

function copyFileWithReplace(sourcePath, targetPath) {
  if (isSameFileContent(sourcePath, targetPath)) {
    console.log(`Backend jar unchanged, skip copy: ${targetPath}`);
    return;
  }

  const tempTargetPath = `${targetPath}.tmp`;
  fs.copyFileSync(sourcePath, tempTargetPath);

  try {
    if (fs.existsSync(targetPath)) {
      fs.rmSync(targetPath, { force: true });
    }
    fs.renameSync(tempTargetPath, targetPath);
  } catch (error) {
    try {
      if (fs.existsSync(tempTargetPath)) {
        fs.rmSync(tempTargetPath, { force: true });
      }
    } catch {
      // ignore cleanup failures
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to replace bundled backend jar. The destination file may be locked by a running Desktop Fairy process. Close the desktop app and retry. Source: ${sourcePath}; Target: ${targetPath}; Cause: ${message}`,
    );
  }

  const sourceStat = fs.statSync(sourcePath);
  fs.utimesSync(targetPath, sourceStat.atime, sourceStat.mtime);
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

  ensureDir(bundleResourcesRoot);
  ensureDir(backendOutputDir);

  copyFileWithReplace(backendJarPath, path.join(backendOutputDir, 'Desktop-Fairy.jar'));

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
