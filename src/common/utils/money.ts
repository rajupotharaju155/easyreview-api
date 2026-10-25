/** Rupees to integer paise, so sums and differences have no float error. */
export const toPaise = (rupees: number): number => Math.round(rupees * 100);

export const toRupees = (paise: number): number => paise / 100;
