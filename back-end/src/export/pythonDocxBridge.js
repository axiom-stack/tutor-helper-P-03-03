import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../scripts",
);

const DEFAULT_PYTHON_PATH =
  process.env.PYTHON_BIN || process.env.PYTHON_PATH || "python3";

function isMissingPythonPackageError(error) {
  const message = `${error?.message ?? ""}\n${error?.traceback ?? ""}`;
  return /No module named ['"]docx['"]|ModuleNotFoundError: No module named docx/u.test(
    message,
  );
}

function isPythonUnavailableError(error) {
  const code = String(error?.code ?? "");
  if (code === "ERR_MODULE_NOT_FOUND" || code === "MODULE_NOT_FOUND") {
    return true;
  }

  const message = `${error?.message ?? ""}\n${error?.traceback ?? ""}`;
  return /spawn .*python3.*ENOENT|python3: not found|No such file or directory|command not found/u.test(
    message,
  );
}

async function loadPythonShell() {
  try {
    const mod = await import("python-shell");
    const PythonShell =
      mod.PythonShell ?? mod.default?.PythonShell ?? mod.default ?? null;
    if (PythonShell && typeof PythonShell.run === "function") {
      return PythonShell;
    }
  } catch (error) {
    if (isPythonUnavailableError(error)) {
      return null;
    }
    throw error;
  }

  return null;
}

async function cleanupTempArtifacts(tempDir, outputPath) {
  await Promise.allSettled([
    outputPath ? fs.unlink(outputPath) : Promise.resolve(),
    tempDir ? fs.rm(tempDir, { recursive: true, force: true }) : Promise.resolve(),
  ]);
}

/**
 * Run a Python script that writes a DOCX file to a temp path.
 *
 * Returns `null` when the Python bridge or python-docx package is unavailable
 * so callers can gracefully fall back to the legacy JavaScript builder.
 *
 * @param {object} options
 * @param {string} options.scriptName
 * @param {object} options.payload
 * @param {string} [options.outputFileName]
 * @param {string} [options.pythonPath]
 * @returns {Promise<Buffer|null>}
 */
export async function renderDocxWithPython({
  scriptName,
  payload,
  outputFileName,
  pythonPath = DEFAULT_PYTHON_PATH,
}) {
  const PythonShell = await loadPythonShell();
  if (!PythonShell) {
    return null;
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tutor-helper-docx-"));
  const outputPath = path.join(
    tempDir,
    outputFileName || `${path.basename(scriptName, path.extname(scriptName))}.docx`,
  );

  try {
    const options = {
      mode: "json",
      pythonPath,
      pythonOptions: ["-u"],
      scriptPath: SCRIPT_DIR,
      args: [outputPath],
      stdinData: JSON.stringify(payload),
      encoding: "utf8",
      env: process.env,
      cwd: process.cwd(),
    };

    await PythonShell.run(scriptName, options);
    return await fs.readFile(outputPath);
  } catch (error) {
    if (isMissingPythonPackageError(error) || isPythonUnavailableError(error)) {
      return null;
    }
    throw error;
  } finally {
    await cleanupTempArtifacts(tempDir, outputPath);
  }
}
