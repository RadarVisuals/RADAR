// netlify/functions/unpin.js

export const handler = async (event) => {
  // Netlify automatically provides the handler function with an 'event' object.

  // 1. Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  // 2. Parse the CID from the request body
  let cid;
  try {
    const body = JSON.parse(event.body);
    cid = body.cid;
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid JSON body' }),
    };
  }

  // 3. Validate the CID format (CIDv0 or CIDv1)
  const cidRegex = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[A-Za-z2-7]{58,})$/;
  if (!cid || typeof cid !== 'string' || !cidRegex.test(cid)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid or missing CID format' }),
    };
  }

  // 4. Get your secret Pinata JWT from Netlify's environment variables
  const PINATA_JWT = process.env.PINATA_JWT; // Use a non-prefixed variable for backend secrets

  if (!PINATA_JWT) {
    console.error('Server Error: PINATA_JWT environment variable is not set on Netlify.');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server configuration error' }),
    };
  }

  // 5. Call the Pinata API to unpin the file
  try {
    // Use the globally available fetch in the Netlify runtime
    const response = await fetch(`https://api.pinata.cloud/pinning/unpin/${cid}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${PINATA_JWT}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`Pinata API Error (${response.status}) for CID ${cid}: ${errorData}`);
      // Don't expose detailed Pinata errors to the client for security.
      return {
        statusCode: 502, // Bad Gateway, since we had an issue with an upstream service
        body: JSON.stringify({ error: 'Failed to communicate with pinning service.' }),
      };
    }

    // 6. Return a success response
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: `Unpin request for ${cid} successful.` }),
    };

  } catch (error) {
    console.error(`Internal error while trying to unpin CID ${cid}:`, error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'An internal server error occurred.' }),
    };
  }
};