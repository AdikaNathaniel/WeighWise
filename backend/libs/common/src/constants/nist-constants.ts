export interface ControlChartConstants {
  n: number;
  A2: number;
  D3: number;
  D4: number;
}

/**
 * X-bar/R control chart constants by subgroup size, per the NIST/SEMATECH
 * Engineering Statistics Handbook, Section 6.3.2.1 (same source table used
 * in the original SPC Calculator spreadsheet).
 */
export const NIST_CONSTANTS_TABLE: ControlChartConstants[] = [
  { n: 2, A2: 1.88, D3: 0, D4: 3.267 },
  { n: 3, A2: 1.023, D3: 0, D4: 2.575 },
  { n: 4, A2: 0.729, D3: 0, D4: 2.282 },
  { n: 5, A2: 0.577, D3: 0, D4: 2.115 },
  { n: 6, A2: 0.483, D3: 0, D4: 2.004 },
  { n: 7, A2: 0.419, D3: 0.076, D4: 1.924 },
  { n: 8, A2: 0.373, D3: 0.136, D4: 1.864 },
  { n: 9, A2: 0.337, D3: 0.184, D4: 1.816 },
  { n: 10, A2: 0.308, D3: 0.223, D4: 1.777 },
];

export function getControlChartConstants(n: number): ControlChartConstants {
  const constants = NIST_CONSTANTS_TABLE.find((row) => row.n === n);
  if (!constants) {
    throw new Error(
      `No NIST control chart constants available for subgroup size n=${n}. Supported range: 2-10.`,
    );
  }
  return constants;
}
