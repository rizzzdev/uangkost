declare global {
  namespace App {
    interface Locals {
      user?: {
        id: string;
        name: string;
        roles: string[];
      };
      accessDenied?: boolean;
    }
  }
}

export {};
