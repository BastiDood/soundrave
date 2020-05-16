import 'express';

declare global {
  namespace Express {
    interface Session extends BaseSession { }
  }
}
