import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const parseEnvValue = (rawValue) => {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return '';
  }

  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
};

const parseEnvFile = (content) => {
  const result = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const normalized = line.startsWith('export ') ? line.slice(7).trim() : line;
    const separatorIndex = normalized.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = normalized.slice(0, separatorIndex).trim();
    const value = parseEnvValue(normalized.slice(separatorIndex + 1));
    if (!key) {
      continue;
    }

    result[key] = value;
  }

  return result;
};

export const loadProjectEnv = (projectRoot, options = {}) => {
  const override = options.override ?? true;
  const files = [
    path.resolve(projectRoot, '.env'),
    path.resolve(projectRoot, '.env.local'),
    path.resolve(os.homedir(), '.codex', '.env'),
  ];

  const loaded = {
    files: [],
    values: {},
  };

  for (const filePath of files) {
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
    const values = parseEnvFile(content);
    for (const [key, value] of Object.entries(values)) {
      if (override || typeof process.env[key] === 'undefined') {
        process.env[key] = value;
      }
      loaded.values[key] = value;
    }

    loaded.files.push(filePath);
  }

  return loaded;
};

