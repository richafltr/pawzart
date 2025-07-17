/**
 * Query Parameter Utility
 * Parses URL parameters for runtime configuration
 */

/**
 * Get runtime parameter from URL query string
 * @param {string} key - Parameter name
 * @param {*} fallback - Default value if not found
 * @returns {*} Parsed value or fallback
 */
export function getRuntimeParam(key, fallback) {
  const url = new URL(window.location.href);
  const val = url.searchParams.get(key);
  
  if (val === null) return fallback;
  
  // Try to parse as number first
  const num = Number(val);
  if (!isNaN(num)) return num;
  
  // Try to parse as boolean
  if (val === 'true') return true;
  if (val === 'false') return false;
  
  // Return as string
  return val;
}

/**
 * Get all runtime parameters as object
 * @returns {Object} All URL parameters
 */
export function getAllParams() {
  const params = {};
  const url = new URL(window.location.href);
  
  for (const [key, value] of url.searchParams) {
    params[key] = getRuntimeParam(key, value);
  }
  
  return params;
}