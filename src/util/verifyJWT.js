import dotenv from 'dotenv';
import JWT from 'jsonwebtoken';

// Initialize .env
dotenv.config();

// GLOBAL VARIABLES
const {
  JWT_SECRET,
  JWT_ISSUER,
  JWT_AUDIENCE,
  JWT_SUBJECT
} = process.env;

/**
 * Promisified wrapper for `JWT.verify`.
 * @param {string} jwt - Encoded JWT
 */
export function verifyJWT(jwt) {
  return new Promise((resolve, reject) => {
    JWT.verify(jwt, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      subject: JWT_SUBJECT,
      algorithms: [ 'HS256' ]
    }, (err, decoded) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(decoded);
    });
  });
}
