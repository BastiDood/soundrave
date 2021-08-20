import { z } from 'zod';
import { OAUTH_SCOPE } from '../constants.ts';

const AuthorizationCodeSchema = z.object({
    code: z.string(),
    state: z.string(),
});

const AuthorizationErrorSchema = z.object({
    error: z.string(),
    state: z.string(),
});

export const AuthorizationResponseSchema = AuthorizationCodeSchema.or(AuthorizationErrorSchema);

export type AuthorizationResponse = z.infer<typeof AuthorizationResponseSchema>;

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

export const AuthenticationResponseSchema = AuthenticationSuccess.or(AuthenticationError);

export type AuthenticationResponse = z.infer<typeof AuthorizationResponseSchema>;
