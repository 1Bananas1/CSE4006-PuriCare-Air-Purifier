const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Middleware to verify Google ID tokens
async function authenticateFirebaseToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No token provided',
      });
    }

    const token = authHeader.split('Bearer ')[1];

    console.log('Received token:', token.substring(0, 50) + '...');
    console.log('Token length:', token.length);

    // Decode token payload for debugging (without verification)
    let tokenAudience = null;
    try {
      const base64Payload = token.split('.')[1];
      const decodedPayload = JSON.parse(Buffer.from(base64Payload, 'base64').toString());
      tokenAudience = decodedPayload.aud;
      console.log('🔍 Token audience (aud):', tokenAudience);
      console.log('🔍 Expected audience:', process.env.GOOGLE_CLIENT_ID);
      console.log('🔍 Token issuer (iss):', decodedPayload.iss);
      console.log('🔍 Match:', tokenAudience === process.env.GOOGLE_CLIENT_ID ? '✅ YES' : '❌ NO');
    } catch (e) {
      console.error('Failed to decode token for debugging:', e);
    }

    // Verify the Google ID token
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    // Attach user info to request (use Google's sub as uid)
    req.user = {
      uid: payload.sub, // Google's unique user ID
      email: payload.email,
      emailVerified: payload.email_verified,
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid or expired token',
    });
  }
}

module.exports = { authenticateFirebaseToken };
