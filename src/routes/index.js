// NATIVE IMPORTS
import querystring from 'querystring';

// DEPENDENCIES
import dotenv from 'dotenv';
import express from 'express';

// Initialize .env
dotenv.config();

// GLOBAL VARIABLES
const router = express.Router();
const { CLIENT_ID } = process.env;

router
  .get('/', (req, res) => {
    res.render('index', { title: 'Spotify Timeline' });
  })
  .get('/login', (req, res) => {
    const AUTHORIZATION_CODE = req.query['code'];
    if (AUTHORIZATION_CODE)
      res.json(AUTHORIZATION_CODE);
    else {
      const params = {
        client_id: CLIENT_ID,
        response_type: 'code',
        redirect_uri: 'http://localhost:3000/login',
        scope: 'user-follow-read'
      };
      res.redirect(`https://accounts.spotify.com/authorize?${querystring.stringify(params)}`);
    }
  });

export { router };
