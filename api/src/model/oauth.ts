import { z } from 'zod';
import { OAUTH_SCOPE } from '../constants.ts';

const AuthorizationCodeSchema = z
    .object({
        code: z.string(),
        state: z.string(),
    })
    .strict();

const AuthorizationErrorSchema = z
    .object({
        error: z.string(),
        state: z.string(),
    })
    .strict();

export const AuthorizationResponseSchema = AuthorizationCodeSchema.or(AuthorizationErrorSchema);
export type AuthorizationResponse = z.infer<typeof AuthorizationResponseSchema>;

const AccessTokenSuccess = z
    .object({
        access_token: z.string().nonempty(),
        refresh_token: z.string().nonempty(),
        token_type: z.literal('Bearer'),
        scope: z.literal(OAUTH_SCOPE),
        expires_in: z.number().positive().int(),
    })
    .strict();

const RefreshTokenSuccessSchema = AccessTokenSuccess.omit({ refresh_token: true }).strict();

const TokenError = z
    .object({
        error: z.enum([
            'invalid_request',
            'invalid_client',
            'invalid_grant',
            'unauthorized_client',
            'unsupported_grant_type',
        ]),
        error_description: z.literal('invalid_request'),
    })
    .strict();

export const AccessTokenResponseSchema = AccessTokenSuccess.or(TokenError);
export type AccessTokenResponse = z.infer<typeof AuthorizationResponseSchema>;

export const RefreshTokenResponseSchema = RefreshTokenSuccessSchema.or(TokenError);
export type RefreshTokenResponse = z.infer<typeof RefreshTokenResponseSchema>;
