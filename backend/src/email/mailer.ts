import { resolve } from 'node:path';
import type { Env } from '../env.js';
import { FileMailProvider } from './file-provider.js';
import type { MailProvider } from './provider.js';
import { ResendMailProvider } from './resend.js';

/**
 * The mail provider for this environment: Resend when a key is configured --
 * always, in production, which `env.ts` enforces -- and otherwise the file sink,
 * so development never sends to a real inbox and never loses a link.
 */
export function createMailProvider(
  env: Pick<Env, 'RESEND_API_KEY' | 'MAIL_FROM' | 'MAIL_REPLY_TO' | 'MAIL_OUTPUT_DIR'>,
): MailProvider {
  if (env.RESEND_API_KEY !== undefined) {
    return new ResendMailProvider({
      apiKey: env.RESEND_API_KEY,
      from: env.MAIL_FROM,
      ...(env.MAIL_REPLY_TO === undefined ? {} : { replyTo: env.MAIL_REPLY_TO }),
    });
  }
  return new FileMailProvider(resolve(env.MAIL_OUTPUT_DIR));
}
