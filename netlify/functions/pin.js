export const handler = async (event) => {
  // 1. SECURITY: Strict Origin Check
  const origin = event.headers.origin || event.headers.Origin;
  const allowedOrigins = [
    'https://radar725.netlify.app',
    'https://www.radar725.netlify.app'
  ];
  
  const isLocalhost = origin && (
    origin.includes('localhost') || 
    origin.includes('127.0.0.1')
  );

  if (origin && !allowedOrigins.includes(origin) && !isLocalhost) {
     return { 
       statusCode: 403, 
       body: JSON.stringify({ error: 'Forbidden: Request prohibited from this origin.' }) 
     };
  }

  // 2. Method Check
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  // 3. Load the Secret Key
  const PINATA_JWT = process.env.PINATA_JWT;

  // --- DEBUG LOGGING START ---
  console.log("--- DEBUG: PINATA UPLOAD STARTED ---");
  if (!PINATA_JWT) {
      console.error("DEBUG ERROR: PINATA_JWT is undefined/null");
  } else {
      // Print first 10 chars to verify it matches your NEW key, not the old one
      console.log("DEBUG: PINATA_JWT loaded. Starts with:", PINATA_JWT.substring(0, 10) + "...");
  }
  // --- DEBUG LOGGING END ---

  if (!PINATA_JWT) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server configuration error: PINATA_JWT missing.' }),
    };
  }

  // 4. Parse Data
  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid JSON body' }),
    };
  }

  const { pinataContent, pinataMetadata } = payload;

  if (!pinataContent) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing pinataContent in payload' }),
    };
  }

  // 5. Prepare Pinata Request
  const upstreamBody = {
    pinataOptions: {
      cidVersion: 1,
    },
    pinataMetadata: pinataMetadata || {
      name: `RADAR_Upload_${new Date().toISOString()}`,
    },
    pinataContent: pinataContent,
  };

  // 6. Send to Pinata
  try {
    const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PINATA_JWT}`,
      },
      body: JSON.stringify(upstreamBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // Log the specific error from Pinata to your terminal
      console.error(`DEBUG: Pinata API Failed. Status: ${response.status}. Response: ${errorText}`);
      return {
        statusCode: 502,
        body: JSON.stringify({ error: `Pinata Error: ${errorText}` }),
      };
    }

    const result = await response.json();

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };

  } catch (error) {
    console.error('Internal Server Error during Pinata upload:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error during upload' }),
    };
  }
};