import 'express';

declare global {
  namespace Express {
    interface Request {
      session: ValidSessionObject|LoginSessionObject|null;
      signedCookies: {
        sid?: string;
        mode?: string;
      };
    }
  }
}
