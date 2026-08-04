export const NAME_RE = /^[A-Za-z][A-Za-z\s.'-]{1,79}$/;
export const PHONE_RE = /^[6-9]\d{9}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PLATE_RE = /^[A-Z0-9\- ]{4,15}$/;
export const UPI_RE = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z]{1,64}$/;

export function validateFullName(value) {
  if (!value?.trim()) return "Full name is required.";
  if (!NAME_RE.test(value.trim())) return "Enter a valid name (letters only, 2-80 characters).";
  return "";
}

export function validatePhone(value) {
  if (!value?.trim()) return "Mobile number is required.";
  if (!PHONE_RE.test(value.trim())) return "Enter a valid 10-digit mobile number.";
  return "";
}

export function validateEmail(value) {
  if (!value?.trim()) return "Email address is required.";
  if (!EMAIL_RE.test(value.trim())) return "Enter a valid email address.";
  return "";
}

export function validatePlate(value) {
  if (!value?.trim()) return "Vehicle number is required.";
  if (!PLATE_RE.test(value.trim().toUpperCase())) return "Enter a valid vehicle number (e.g. GJ01AB1234).";
  return "";
}

export function validateUpiId(value) {
  if (!value?.trim()) return "UPI ID is required.";
  if (!UPI_RE.test(value.trim())) return "Enter a valid UPI ID (e.g. name@okhdfcbank).";
  return "";
}

export function validateCardHolderName(value) {
  if (!value?.trim()) return "Card holder name is required.";
  if (!NAME_RE.test(value.trim())) return "Enter a valid name as it appears on the card.";
  return "";
}

export function validateCardNumber(value) {
  const digits = (value || "").replace(/\s/g, "");
  if (!digits) return "Card number is required.";
  if (!/^\d{13,19}$/.test(digits)) return "Card number must be 13-19 digits.";
  if (!luhnCheck(digits)) return "Enter a valid card number.";
  return "";
}

function luhnCheck(digits) {
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

export function validateExpiry(value) {
  if (!value?.trim()) return "Expiry date is required.";
  const match = /^(\d{2})\/(\d{2})$/.exec(value.trim());
  if (!match) return "Enter expiry as MM/YY.";
  const month = parseInt(match[1], 10);
  const year = 2000 + parseInt(match[2], 10);
  if (month < 1 || month > 12) return "Enter a valid month (01-12).";
  const now = new Date();
  const expiry = new Date(year, month, 0, 23, 59, 59);
  if (expiry < now) return "This card has expired.";
  return "";
}

export function validateCvv(value) {
  if (!value?.trim()) return "CVV is required.";
  if (!/^\d{3,4}$/.test(value.trim())) return "CVV must be 3-4 digits.";
  return "";
}

export function validateBankCustomerId(value) {
  if (!value?.trim()) return "Customer ID / Username is required.";
  if (value.trim().length < 4) return "Enter a valid customer ID or username.";
  return "";
}
