import { z } from 'zod';

export const OAUTH_SCOPE = 'user-follow-modify user-read-private';

const AuthorizationCode = z.object({
    code: z.string(),
    state: z.string(),
});

const AuthorizationError = z.object({
    error: z.string(),
    state: z.string(),
});

export const AuthorizationResponse = AuthorizationCode.or(AuthorizationError);

const AuthenticationSuccess = z.object({
    access_token: z.string().nonempty(),
    refresh_token: z.string().nonempty(),
    token_type: z.literal('Bearer'),
    scope: z.literal(OAUTH_SCOPE),
    expires_in: z.number().positive().int(),
});

const AuthenticationError = z.object({
    error: z.enum([
        'invalid_request',
        'invalid_client',
        'invalid_grant',
        'unauthorized_client',
        'unsupported_grant_type',
    ]),
    error_description: z.literal('invalid_request'),
});

export const AuthenticationResponse = AuthenticationSuccess.or(AuthenticationError);
