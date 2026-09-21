import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { config } from "@/lib/config";
import {
  defaultRoutes,
  forwardingRoutesSchema,
  type ForwardingRoute,
} from "@/lib/routes";

const routesFilePath = path.isAbsolute(config.routesFilePath)
  ? config.routesFilePath
  : path.join(/* turbopackIgnore: true */ process.cwd(), config.routesFilePath);

let mutationQueue: Promise<unknown> = Promise.resolve();

async function readRoutesFile(): Promise<ForwardingRoute[]> {
  try {
    const content = await readFile(routesFilePath, "utf8");
    return forwardingRoutesSchema.parse(JSON.parse(content));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }

    await writeRoutesFile(defaultRoutes);
    return structuredClone(defaultRoutes);
  }
}

async function writeRoutesFile(routes: ForwardingRoute[]): Promise<void> {
  const validatedRoutes = forwardingRoutesSchema.parse(routes);
  const directory = path.dirname(routesFilePath);
  const temporaryPath = `${routesFilePath}.tmp`;

  await mkdir(directory, { recursive: true });
  await writeFile(temporaryPath, `${JSON.stringify(validatedRoutes, null, 2)}\n`, "utf8");
  await rename(temporaryPath, routesFilePath);
}

export async function getRoutes(): Promise<ForwardingRoute[]> {
  await mutationQueue;
  return readRoutesFile();
}

export function updateRoutes(
  mutate: (routes: ForwardingRoute[]) => ForwardingRoute[],
): Promise<ForwardingRoute[]> {
  const operation = mutationQueue.then(async () => {
    const currentRoutes = await readRoutesFile();
    const nextRoutes = mutate(structuredClone(currentRoutes));

    await writeRoutesFile(nextRoutes);
    return nextRoutes;
  });

  mutationQueue = operation.catch(() => undefined);
  return operation;
}
