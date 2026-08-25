import { createReadStream } from "node:fs";
import { parse } from "csv-parse";

/**
 * Lit un CSV en streaming (ligne par ligne, sans tout charger en mémoire) —
 * nécessaire pour les fichiers KBO Open Data qui peuvent dépasser le
 * gigaoctet à l'échelle du pays. `onRow` est appelé pour chaque ligne ;
 * retourner `false` explicitement arrête la lecture plus tôt.
 */
export async function readCsvRows<T extends Record<string, string>>(
  filePath: string,
  onRow: (row: T, index: number) => boolean | void,
): Promise<number> {
  const parser = createReadStream(filePath).pipe(
    parse({
      columns: true,
      bom: true,
      trim: true,
      skip_empty_lines: true,
    }),
  );

  let index = 0;
  for await (const record of parser) {
    const result = onRow(record as T, index);
    index++;
    if (result === false) {
      parser.destroy();
      break;
    }
  }
  return index;
}
