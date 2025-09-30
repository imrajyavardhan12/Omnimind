/**
 * Secure storage utility for sensitive data in localStorage
 * 
 * Security Note: This provides obfuscation, not true encryption.
 * For production apps handling highly sensitive data, consider:
 * 1. Server-side API key management
 * 2. OAuth flows
 * 3. Secure backend proxy for API calls
 * 
 * This implementation prevents casual inspection but should not
 * be relied upon as the sole security measure.
 */

// Generate a consistent key from hostname for XOR encryption
function getEncryptionKey(): string {
  if (typeof window === 'undefined') {
    return 'omnimind-server-key'
  }
  
  const baseKey = process.env.ENCRYPTION_KEY || window.location.hostname
  // Create a 32-character key
  return baseKey.padEnd(32, '0').slice(0, 32)
}

/**
 * Simple XOR encryption for obfuscation
 * Better than plain base64 but not cryptographically secure
 */
function xorEncrypt(text: string, key: string): string {
  let result = ''
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(
      text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
    )
  }
  return result
}

/**
 * XOR decryption (same operation as encryption)
 */
function xorDecrypt(encrypted: string, key: string): string {
  return xorEncrypt(encrypted, key)
}

/**
 * Encrypt text for storage
 */
export function encrypt(text: string): string {
  try {
    if (typeof window === 'undefined') {
      return text
    }
    
    const key = getEncryptionKey()
    const xored = xorEncrypt(text, key)
    // Base64 encode the XOR result for safe storage
    return btoa(encodeURIComponent(xored))
  } catch (error) {
    console.error('Encryption failed:', error)
    return text
  }
}

/**
 * Decrypt text from storage
 */
export function decrypt(encryptedText: string): string {
  try {
    if (typeof window === 'undefined') {
      return encryptedText
    }
    
    const key = getEncryptionKey()
    const decoded = decodeURIComponent(atob(encryptedText))
    return xorDecrypt(decoded, key)
  } catch (error) {
    console.error('Decryption failed:', error)
    return encryptedText
  }
}

/**
 * Securely store a value in localStorage with encryption
 */
export function secureStore(key: string, value: string): void {
  if (typeof window === 'undefined') return
  
  try {
    const encrypted = encrypt(value)
    localStorage.setItem(key, encrypted)
  } catch (error) {
    console.error('Failed to store securely:', error)
  }
}

/**
 * Retrieve and decrypt a value from localStorage
 */
export function secureRetrieve(key: string): string | null {
  if (typeof window === 'undefined') return null
  
  try {
    const encrypted = localStorage.getItem(key)
    if (!encrypted) return null
    
    return decrypt(encrypted)
  } catch (error) {
    console.error('Failed to retrieve securely:', error)
    // If decryption fails, remove corrupted data
    localStorage.removeItem(key)
    return null
  }
}

/**
 * Remove a value from secure storage
 */
export function secureRemove(key: string): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.removeItem(key)
  } catch (error) {
    console.error('Failed to remove securely:', error)
  }
}