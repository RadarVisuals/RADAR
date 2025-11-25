// src/services/PinataService.js

/**
 * Uploads a JavaScript object as a JSON file to IPFS via the internal Netlify function.
 * This protects the API keys by keeping them on the server.
 *
 * @param {object} jsonData The JavaScript object to be uploaded.
 * @param {string} [pinataName='RADAR_Workspace'] An optional name for the pin.
 * @returns {Promise<string>} A promise that resolves with the IPFS Content Identifier (CID).
 * @throws {Error} Throws an error if the network request fails.
 */
export async function uploadJsonToPinata(jsonData, pinataName = 'RADAR_Workspace') {
  // Construct the metadata for the file
  const metadata = {
    name: `${pinataName}_${new Date().toISOString()}`,
  };

  try {
    // Call our own backend function instead of Pinata directly
    // Ensure your Netlify redirect rules map /api/* to /.netlify/functions/*
    // If running locally with `netlify dev`, this path works automatically.
    const response = await fetch('/api/pin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pinataContent: jsonData,
        pinataMetadata: metadata,
      }),
    });

    if (!response.ok) {
      let errorMessage = `Server Upload Error (${response.status})`;
      try {
        const errorData = await response.json();
        if (errorData.error) errorMessage += `: ${errorData.error}`;
      } catch (e) {
        // Ignore JSON parse error if body is not JSON
      }
      throw new Error(errorMessage);
    }

    // Parse result
    const result = await response.json();

    // The CID is returned in the 'IpfsHash' property from Pinata
    if (!result.IpfsHash) {
      throw new Error("Upload response did not include an IpfsHash (CID).");
    }
    
    if (import.meta.env.DEV) {
      console.log(`[PinataService] Successfully pinned JSON via Backend. CID: ${result.IpfsHash}, Timestamp: ${result.Timestamp}`);
    }
    
    return result.IpfsHash;

  } catch (error) {
    if (import.meta.env.DEV) {
      console.error("[PinataService] An error occurred during the upload process:", error);
    }
    throw error;
  }
}