const ENCRYPTION_KEY = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || 'default-key-change-in-production'

export function encrypt(text: string): string {
  try {
    if (typeof window === 'undefined') {
      return text
    }
    
    // Simple base64 encoding for client-side storage
    // In production, use proper encryption library like crypto-js
    return btoa(encodeURIComponent(text))
  } catch (error) {
    console.error('Encryption failed:', error)
    return text
  }
}

export function decrypt(encryptedText: string): string {
  try {
    if (typeof window === 'undefined') {
      return encryptedText
    }
    
    // Simple base64 decoding
    // In production, use proper decryption
    return decodeURIComponent(atob(encryptedText))
  } catch (error) {
    console.error('Decryption failed:', error)
    return encryptedText
  }
}

export function secureStore(key: string, value: string): void {
  if (typeof window === 'undefined') return
  
  try {
    const encrypted = encrypt(value)
    localStorage.setItem(key, encrypted)
  } catch (error) {
    console.error('Failed to store securely:', error)
  }
}

export function secureRetrieve(key: string): string | null {
  if (typeof window === 'undefined') return null
  
  try {
    const encrypted = localStorage.getItem(key)
    if (!encrypted) return null
    
    return decrypt(encrypted)
  } catch (error) {
    console.error('Failed to retrieve securely:', error)
    return null
  }
}

export function secureRemove(key: string): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.removeItem(key)
  } catch (error) {
    console.error('Failed to remove securely:', error)
  }
}