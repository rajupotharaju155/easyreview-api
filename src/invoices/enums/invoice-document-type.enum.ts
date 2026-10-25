export enum InvoiceDocumentType {
  /** GST-registered supplier charging GST. */
  TAX_INVOICE = 'tax_invoice',
  /** GST-registered supplier of exempt supplies, or a composition dealer. No tax charged. */
  BILL_OF_SUPPLY = 'bill_of_supply',
  /** Business not registered under GST. No tax charged. */
  INVOICE = 'invoice',
}

/** Document types issued under a GSTIN. */
export function requiresSupplierGstin(type: InvoiceDocumentType): boolean {
  return type !== InvoiceDocumentType.INVOICE;
}

export function chargesGst(type: InvoiceDocumentType): boolean {
  return type === InvoiceDocumentType.TAX_INVOICE;
}
