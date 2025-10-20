/**
 * Enhanced encryption utilities using Web Crypto API
 * 
 * SECURITY NOTE: This provides client-side encryption for API keys stored in localStorage.
 * While this is better than plain text or base64, it's not fully secure since:
 * - The encryption key is derived from browser data (can be accessed by JS)
 * - A determined attacker with access to the browser can decrypt
 * 
 * For production apps handling sensitive data, consider:
 * - Server-side API key storage with user authentication
 * - Backend proxy for API calls (keys never leave server)
 * - Hardware security modules (HSM) for key management
 */

// Helper to get a consistent browser fingerprint for key derivation
async function getBrowserFingerprint(): Promise<string> {
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.colorDepth,
    screen.width,
    screen.height,
    new Date().getTimezoneOffset(),
    !!window.sessionStorage,
    !!window.localStorage,
  ]
  
  // Add a persistent random ID stored in localStorage
  let browserId = localStorage.getItem('omnimind_browser_id')
  if (!browserId) {
    browserId = crypto.randomUUID()
    localStorage.setItem('omnimind_browser_id', browserId)
  }
  components.push(browserId)
  
  return components.join('|')
}

// Derive an encryption key from browser fingerprint
async function deriveKey(fingerprint: string): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const data = encoder.encode(fingerprint)
  
  // Hash the fingerprint to get consistent key material
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  
  // Import as a key
  return crypto.subtle.importKey(
    'raw',
    hashBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Encrypt a value using AES-GCM
 */
export async function secureEncrypt(value: string): Promise<string> {
  try {
    const fingerprint = await getBrowserFingerprint()
    const key = await deriveKey(fingerprint)
    
    // Generate a random IV (Initialization Vector)
    const iv = crypto.getRandomValues(new Uint8Array(12))
    
    // Encrypt the data
    const encoder = new TextEncoder()
    const data = encoder.encode(value)
    
    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    )
    
    // Combine IV and encrypted data
    const encryptedArray = new Uint8Array(encryptedBuffer)
    const combined = new Uint8Array(iv.length + encryptedArray.length)
    combined.set(iv, 0)
    combined.set(encryptedArray, iv.length)
    
    // Convert to base64 for storage
    return btoa(String.fromCharCode(...Array.from(combined)))
  } catch (error) {
    console.error('Encryption failed:', error)
    // Fallback to base64 if Web Crypto is not available
    return btoa(value)
  }
}

/**
 * Decrypt a value encrypted with secureEncrypt
 */
export async function secureDecrypt(encryptedValue: string): Promise<string | null> {
  try {
    const fingerprint = await getBrowserFingerprint()
    const key = await deriveKey(fingerprint)
    
    // Decode from base64
    const combined = Uint8Array.from(atob(encryptedValue), c => c.charCodeAt(0))
    
    // Extract IV and encrypted data
    const iv = combined.slice(0, 12)
    const data = combined.slice(12)
    
    // Decrypt
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    )
    
    // Convert back to string
    const decoder = new TextDecoder()
    return decoder.decode(decryptedBuffer)
  } catch (error) {
    console.error('Decryption failed:', error)
    // Try fallback base64 decode for backwards compatibility
    try {
      return atob(encryptedValue)
    } catch {
      return null
    }
  }
}

/**
 * Store encrypted data in localStorage
 */
export async function secureStore(key: string, value: string): Promise<void> {
  const encrypted = await secureEncrypt(value)
  localStorage.setItem(key, encrypted)
}

/**
 * Retrieve and decrypt data from localStorage
 */
export async function secureRetrieve(key: string): Promise<string | null> {
  const encrypted = localStorage.getItem(key)
  if (!encrypted) return null
  
  return secureDecrypt(encrypted)
}

/**
 * Remove data from localStorage
 */
export function secureRemove(key: string): void {
  localStorage.removeItem(key)
}

/**
 * Check if a key exists in localStorage
 */
export function secureHas(key: string): boolean {
  return localStorage.getItem(key) !== null
}
