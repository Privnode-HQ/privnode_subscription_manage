// Minimal shims for libraries we use server-side.
// Prefer installing proper @types packages in production.

declare module "pg" {
  export type Pool = any;
  export type PoolClient = any;

  const pg: {
    Pool: any;
  };

  export default pg;
}

declare module "nodemailer" {
  export function createTransport(...args: any[]): any;
}

