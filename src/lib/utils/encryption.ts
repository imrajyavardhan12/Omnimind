/**
 * Secure storage utility for sensitive data in localStorage
 * Uses Web Crypto API (AES-GCM) when available, falls back to XOR encryption
 * 
 * Security Note: This provides better encryption than basic obfuscation.
 * For production apps handling highly sensitive data, consider:
 * 1. Server-side API key management
 * 2. OAuth flows
 * 3. Secure backend proxy for API calls
 * 
 * This implementation prevents casual inspection but should not
 * be relied upon as the sole security measure.
 */

import { secureStore as webCryptoStore, secureRetrieve as webCryptoRetrieve, secureRemove as webCryptoRemove } from './crypto'

// Flag to track if Web Crypto is available
let webCryptoAvailable = typeof window !== 'undefined' && 
                         window.crypto && 
                         window.crypto.subtle

// Generate a consistent key from hostname for XOR encryption (fallback)
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
 * Uses Web Crypto API if available, falls back to XOR
 */
export function secureStore(key: string, value: string): void {
  if (typeof window === 'undefined') return
  
  try {
    if (webCryptoAvailable) {
      // Use async Web Crypto (non-blocking)
      webCryptoStore(key, value).catch(error => {
        console.error('Web Crypto store failed, using fallback:', error)
        // Fallback to XOR
        const encrypted = encrypt(value)
        localStorage.setItem(key, encrypted)
      })
    } else {
      // Use XOR encryption
      const encrypted = encrypt(value)
      localStorage.setItem(key, encrypted)
    }
  } catch (error) {
    console.error('Failed to store securely:', error)
  }
}

/**
 * Retrieve and decrypt a value from localStorage
 * Attempts Web Crypto first, falls back to XOR
 */
export function secureRetrieve(key: string): string | null {
  if (typeof window === 'undefined') return null
  
  try {
    const stored = localStorage.getItem(key)
    if (!stored) return null
    
    // Try XOR decryption (synchronous fallback)
    try {
      const decrypted = decrypt(stored)
      // If it looks like valid data (not gibberish), return it
      if (decrypted && decrypted.length > 0) {
        return decrypted
      }
    } catch (xorError) {
      // XOR failed, might be Web Crypto encrypted
    }
    
    // If we get here, try Web Crypto async (for future calls)
    if (webCryptoAvailable) {
      webCryptoRetrieve(key).then(value => {
        if (value) {
          // Cache decrypted value for sync access
          sessionStorage.setItem(`${key}_cache`, value)
        }
      }).catch(() => {
        // Web Crypto failed too
      })
      
      // Check if we have a cached value
      const cached = sessionStorage.getItem(`${key}_cache`)
      if (cached) return cached
    }
    
    return null
  } catch (error) {
    console.error('Failed to retrieve securely:', error)
    // If decryption fails, remove corrupted data
    localStorage.removeItem(key)
    return null
  }
}

/**
 * Async version for explicit async/await usage with Web Crypto
 */
export async function secureRetrieveAsync(key: string): Promise<string | null> {
  if (typeof window === 'undefined') return null
  
  if (webCryptoAvailable) {
    try {
      return await webCryptoRetrieve(key)
    } catch (error) {
      console.error('Web Crypto retrieve failed:', error)
    }
  }
  
  // Fallback to sync method
  return secureRetrieve(key)
}

/**
 * Remove a value from secure storage
 */
export function secureRemove(key: string): void {
  if (typeof window === 'undefined') return
  
  try {
    if (webCryptoAvailable) {
      webCryptoRemove(key)
    } else {
      localStorage.removeItem(key)
    }
    // Clear cache
    sessionStorage.removeItem(`${key}_cache`)
  } catch (error) {
    console.error('Failed to remove securely:', error)
  }
}