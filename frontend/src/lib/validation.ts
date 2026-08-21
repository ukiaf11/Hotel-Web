export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const validateEmail = (value: string) =>
  EMAIL_RE.test(value.trim()) ? '' : 'Enter a valid email address.'

export const validatePhone = (value: string) => {
  const digits = value.replace(/\D/g, '')
  if (!value.trim()) return 'Phone number is required.'
  return digits.length >= 10 && digits.length <= 15
    ? ''
    : 'Phone number must contain between 10 and 15 digits.'
}

export const validatePassword = (value: string) => {
  if (value.length < 8) return 'Password must be at least 8 characters long.'
  if (!/[A-Z]/.test(value)) return 'Password must contain at least one uppercase letter.'
  if (!/\d/.test(value)) return 'Password must contain at least one digit.'
  return ''
}

export const validateRequired = (value: string, label = 'This field') =>
  value.trim() ? '' : `${label} is required.`

export const passwordScore = (value: string) => {
  let score = 0
  if (value.length >= 8) score++
  if (value.length >= 12) score++
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++
  if (/\d/.test(value)) score++
  if (/[^\w\s]/.test(value)) score++
  return Math.min(score, 5)
}
