import { mkdir } from "node:fs/promises";
try { await mkdir(".cache", { recursive: true }); } catch {}