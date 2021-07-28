import { z } from 'zod';

export const OAUTH_SCOPE = 'user-follow-modify user-read-private';

export const AuthorizationCode = z.object({
    code: z.string(),
    state: z.string(),
});

export const AuthorizationError = z.object({
    error: z.string(),
    state: z.string(),
});

export const AuthorizationResponse = AuthorizationCode.or(AuthorizationError);

export const TokenResponse = z.object({
    access_token: z.string().nonempty(),
    refresh_token: z.string().nonempty(),
    token_type: z.literal('Bearer'),
    scope: z.literal(OAUTH_SCOPE),
    expires_in: z.number().positive().int(),
});
