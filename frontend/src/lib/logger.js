// Lightweight logger — silenced in production builds
const isDev = process.env.NODE_ENV !== "production";

export const logger = {
  error: (...args) => {
    if (isDev) console.error(...args);
  },
  warn: (...args) => {
    if (isDev) console.warn(...args);
  },
  log: (...args) => {
    if (isDev) console.log(...args);
  },
};
