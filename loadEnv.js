import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)));

export const ENV_KEY_NAMES = [
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "GOOGLE_API_KEY",
  "XAI_API_KEY",
];

export function loadEnv() {
  const basePath = path.join(rootDir, ".env");
  const localPath = path.join(rootDir, ".env.local");
  let loadedAny = false;

  if (fs.existsSync(basePath)) {
    dotenv.config({ path: basePath });
    loadedAny = true;
  }

  if (fs.existsSync(localPath)) {
    dotenv.config({ path: localPath, override: true });
    loadedAny = true;
  }

  return { rootDir, loadedAny, basePath, localPath };
}

export function getEnvKeyStatus() {
  return Object.fromEntries(
    ENV_KEY_NAMES.map((key) => [key, !!process.env[key]?.trim()]),
  );
}

const { loadedAny, basePath } = loadEnv();

if (!loadedAny) {
  console.warn(
    `[vibedraftr] No .env file found. Expected ${basePath} (or .env.local).`,
  );
}
