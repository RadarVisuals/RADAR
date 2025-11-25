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

  // 3. Parse & Validate CID
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

  // Regex to ensure this is actually an IPFS CID and not a malicious command
  const cidRegex = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[A-Za-z2-7]{58,})$/;
  if (!cid || typeof cid !== 'string' || !cidRegex.test(cid)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid CID format' }),
    };
  }

  // 4. Load Secret Key
  const PINATA_JWT = process.env.PINATA_JWT;

  if (!PINATA_JWT) {
    console.error('CRITICAL: PINATA_JWT is missing in Netlify Environment Variables.');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server configuration error' }),
    };
  }

  // 5. Send Delete Request to Pinata
  try {
    const response = await fetch(`https://api.pinata.cloud/pinning/unpin/${cid}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${PINATA_JWT}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`Pinata API Error (${response.status}) for CID ${cid}: ${errorData}`);
      return {
        statusCode: 502, 
        body: JSON.stringify({ error: 'Failed to communicate with storage service.' }),
      };
    }

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