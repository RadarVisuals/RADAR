export const handler = async (event) => {
  // 1. SECURITY: Strict Origin Check
  // This ensures only YOUR website can trigger this function.
  const origin = event.headers.origin || event.headers.Origin;
  const allowedOrigins = [
    'https://radar725.netlify.app',
    'https://www.radar725.netlify.app'
  ];
  
  // Allow localhost for your own testing
  const isLocalhost = origin && (
    origin.includes('localhost') || 
    origin.includes('127.0.0.1')
  );

  // If the request comes from a browser (has origin) and isn't on the list -> Block it.
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

  // 3. Load the Secret Key (Server-Side Only)
  const PINATA_JWT = process.env.PINATA_JWT;

  if (!PINATA_JWT) {
    console.error('CRITICAL: PINATA_JWT is missing in Netlify Environment Variables.');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server configuration error.' }),
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
      console.error(`Pinata API Error (${response.status}): ${errorText}`);
      return {
        statusCode: 502,
        body: JSON.stringify({ error: 'Failed to pin to storage provider.' }),
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