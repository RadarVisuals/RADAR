// src/services/PinataService.js

// The base URL for the Pinata PinJSONToIPFS API endpoint.
const PINATA_API_URL = 'https://api.pinata.cloud/pinning/pinJSONToIPFS';

// Retrieve the Pinata JWT from environment variables.
// It's crucial this is set in your .env file for this service to work.
const PINATA_JWT = import.meta.env.VITE_PINATA_JWT;

if (!PINATA_JWT && import.meta.env.DEV) {
  // A prominent warning for developers if the JWT is missing during development.
  // This helps catch configuration errors early.
  console.warn(
    "⚠️ [PinataService] VITE_PINATA_JWT is not defined in your .env file. " +
    "The service will not be able to upload files to Pinata. " +
    "Please get a JWT from your Pinata account (https://app.pinata.cloud/keys) and add it to your .env file."
  );
}

/**
 * Uploads a JavaScript object as a JSON file to IPFS via the Pinata pinning service.
 * This function handles the API request, authentication, and error handling.
 *
 * @param {object} jsonData The JavaScript object to be uploaded. It will be stringified to JSON.
 * @param {string} [pinataName='RADAR_Workspace'] An optional name for the pin, which helps identify it in your Pinata account.
 * @returns {Promise<string>} A promise that resolves with the IPFS Content Identifier (CID, e.g., 'Qm...').
 * @throws {Error} Throws an error if the Pinata JWT is not configured, if the network request fails, or if the Pinata API returns an error.
 */
export async function uploadJsonToPinata(jsonData, pinataName = 'RADAR_Workspace') {
  // Fail fast if the essential JWT is missing.
  if (!PINATA_JWT) {
    throw new Error("Pinata JWT is not configured. Cannot upload to IPFS.");
  }

  // The body of the request needs to be a specific structure that Pinata expects.
  const requestBody = {
    pinataOptions: {
      cidVersion: 1, // Use CIDv1 for better compatibility and case-insensitivity.
    },
    pinataMetadata: {
      // The name helps you identify the file in your Pinata dashboard.
      name: `${pinataName}_${new Date().toISOString()}`,
    },
    // The actual JSON data you want to pin.
    pinataContent: jsonData,
  };

  try {
    const response = await fetch(PINATA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // The JWT is passed as a Bearer token in the Authorization header.
        'Authorization': `Bearer ${PINATA_JWT}`,
      },
      body: JSON.stringify(requestBody),
    });

    // Handle non-successful HTTP responses.
    if (!response.ok) {
      // Try to parse the error response from Pinata for a more specific message.
      const errorData = await response.json().catch(() => ({ error: 'Could not parse Pinata error response.' }));
      // Throw an error that includes the HTTP status and the message from Pinata.
      throw new Error(`Pinata API Error (${response.status}): ${errorData.error || response.statusText}`);
    }

    // If the request was successful, parse the JSON response.
    const result = await response.json();

    // The CID is returned in the 'IpfsHash' property of the response.
    if (!result.IpfsHash) {
      throw new Error("Pinata API response did not include an IpfsHash (CID).");
    }
    
    if (import.meta.env.DEV) {
      console.log(`[PinataService] Successfully pinned JSON. CID: ${result.IpfsHash}, Timestamp: ${result.Timestamp}`);
    }
    
    return result.IpfsHash;

  } catch (error) {
    if (import.meta.env.DEV) {
      console.error("[PinataService] An error occurred during the upload process:", error);
    }
    // Re-throw the error so the calling function (e.g., ConfigurationService) can handle it.
    throw error;
  }
}