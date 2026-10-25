/** Recipient details as printed on the invoice. Frozen when issued. */
export type InvoiceBillTo = {
  name: string;
  companyName: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  address: string | null;
  city: string | null;
  stateCode: string | null;
  pincode: string | null;
};

/** Business details as printed on the invoice. Captured when issued. */
export type InvoiceSupplier = {
  legalName: string;
  gstin: string | null;
  address: string | null;
  stateCode: string | null;
  phone: string | null;
  email: string | null;
  /** Missing on invoices issued before logos were supported. */
  logoUrl?: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankIfsc: string | null;
  bankName: string | null;
  upiId: string | null;
};
