import dotenv from "dotenv";
import path from "path";
import type { InitOptions } from "payload/config";
import type { Payload } from "payload";
import nodemailer from "nodemailer";

// Load local env first (commonly used by Next.js), then fall back to .env
// Try loading .env.local (project root) and fall back to .env
dotenv.config({
  path: path.resolve(__dirname, "../.env.local"),
});

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

const transporter = nodemailer.createTransport({
  host: "smtp.resend.com",
  secure: true,
  port: 465,
  auth: {
    user: "resend",
    pass: process.env.RESEND_API_KEY,
  },
});

let cached = (global as any).payload;

if (!cached) {
  cached = (global as any).payload = {
    client: null,
    promise: null,
  };
}

interface IArgs {
  initOptions?: Partial<InitOptions>;
}

export const getPayloadClient = async ({
  initOptions,
}: IArgs = {}): Promise<Payload> => {
  if (!process.env.PAYLOAD_SECRET) {
    throw new Error("PAYLOAD_SECRET is missing");
  }

  if (cached.client) {
    return cached.client;
  }

  if (!cached.promise) {
    // Import payload lazily to avoid runtime import errors when payload's
    // dependencies (like the DB adapter) are not properly configured in dev.
    cached.promise = (async () => {
      const payloadModule = await import("payload");
      const runtimePayload = payloadModule.default;

      return runtimePayload.init({
        email: {
          transport: transporter,
          //TODO: change email
          fromAddress: "onboarding@resend.dev",
          // fromAddress: process.env.EMAIL as string,
          fromName: "Digital Marketplace",
        },
  secret: process.env.PAYLOAD_SECRET as string,
        local: initOptions?.express ? false : true,
        ...(initOptions || {}),
      });
    })();
  }

  try {
    cached.client = await cached.promise;
  } catch (e: unknown) {
    cached.promise = null;
    throw e;
  }

  return cached.client;
};
