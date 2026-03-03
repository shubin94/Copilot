declare module "zod-validation-error" {
  import type { ZodError } from "zod";

  export function fromZodError(error: ZodError): { message: string };
}
