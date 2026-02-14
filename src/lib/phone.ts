/**
 * Validates a WhatsApp phone number.
 * Accepts formats like: +5511999999999, 5511999999999, (11)99999-9999, 11999999999
 * Returns the cleaned number in international format (digits only with country code).
 */
export function validateWhatsAppPhone(phone: string): { valid: boolean; cleaned: string; error?: string } {
  if (!phone || !phone.trim()) {
    return { valid: false, cleaned: "", error: "Telefone é obrigatório" };
  }

  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, "");

  // Brazilian numbers: 10-11 digits without country code, 12-13 with
  if (digits.length < 10) {
    return { valid: false, cleaned: digits, error: "Número muito curto. Use formato: (DDD) 9XXXX-XXXX" };
  }

  if (digits.length > 15) {
    return { valid: false, cleaned: digits, error: "Número muito longo" };
  }

  let finalNumber = digits;

  // If starts with 55 and has 12-13 digits, it's already with BR country code
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    finalNumber = digits;
  }
  // If 10-11 digits, add BR country code
  else if (digits.length === 10 || digits.length === 11) {
    finalNumber = "55" + digits;
  }
  // Other international numbers (already has country code)
  else if (digits.length >= 12) {
    finalNumber = digits;
  }

  return { valid: true, cleaned: finalNumber };
}

/**
 * Formats a phone number for display
 */
export function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  
  // Brazilian format
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);
    if (rest.length === 9) {
      return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
    }
    return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  }
  
  return phone;
}
