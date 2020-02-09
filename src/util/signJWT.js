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
 * Promisified wrapper for `JWT.sign`.
 * @param {any} payload
 * @param {number} expiresIn - The time period (in seconds) for which the access token is valid.
 * @returns {Promise<string>}
 */
export function signJWT(payload, expiresIn) {
  return new Promise((resolve, reject) => {
    JWT.sign(payload, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      subject: JWT_SUBJECT,
      algorithm: 'HS256',
      expiresIn
    }, (err, encoded) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(encoded);
    });
  });
}
