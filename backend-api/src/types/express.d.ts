import { UserRecord } from 'firebase-admin/auth';

declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        email?: string;
        [key: string]: any;
      };
      requestId?: string;
      locale?: string;
      userRole?: string;
      resourceData?: any;
    }
  }
}
