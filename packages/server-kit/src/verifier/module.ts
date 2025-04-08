/*
 * Copyright (c) 2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { KeyObject } from 'node:crypto';
import {
    Client,
    ClientResponseErrorTokenHook,
} from '@authup/core-http-kit';
import { ErrorCode } from '@authup/errors';
import { isObject } from '@authup/kit';
import {
    JWKType,
    JWTError,
} from '@authup/specs';
import type {
    JWTAlgorithm,
    OAuth2JsonWebKey,
    OAuth2TokenIntrospectionResponse,
    OAuth2TokenPayload,
} from '@authup/specs';
import {
    decodePemToSpki,
    extractTokenHeader,
    verifyToken,
} from '@authup/server-kit';
import { importJWK } from 'jose';
import { TokenVerifierMemoryCache, TokenVerifierRedisCache, isTokenVerifierCache } from './cache';
import type { TokenVerifierCache } from './cache';
import type { TokenVerificationData, TokenVerificationDataInput, TokenVerifierOptions } from './types';

export class TokenVerifier {
    protected interceptorMounted : boolean | undefined;

    protected client: Client;

    protected cache : TokenVerifierCache;

    constructor(options: TokenVerifierOptions) {
        let cache : TokenVerifierCache | undefined;

        if (options.cache) {
            if (isTokenVerifierCache(options.cache)) {
                this.cache = options.cache;
            } else if (options.cache.type === 'redis') {
                this.cache = new TokenVerifierRedisCache(options.cache.client);
            } else {
                this.cache = new TokenVerifierMemoryCache();
            }
        }

        this.cache = cache || new TokenVerifierMemoryCache();

        this.client = new Client({ baseURL: options.baseURL });

        if (options.creator) {
            if (
                typeof options.creator !== 'function' &&
                typeof options.creator.baseURL === 'undefined'
            ) {
                options.creator.baseURL = options.baseURL;
            }

            const hook = new ClientResponseErrorTokenHook({
                tokenCreator: options.creator,
                baseURL: options.baseURL,
            });

            hook.mount(this.client);

            this.interceptorMounted = true;
        }
    }

    async verify(token: string) : Promise<TokenVerificationData> {
        if (this.interceptorMounted) {
            return this.verifyRemote(token);
        }

        return this.verifyLocal(token);
    }

    async verifyLocal(token: string) : Promise<TokenVerificationData> {
        let output = await this.cache.get(token);
        if (output) {
            return output;
        }

        const header = extractTokenHeader(token);
        if (!header) {
            throw JWTError.headerInvalid('The token header could not be extracted.');
        }

        let jwk : OAuth2JsonWebKey;

        try {
            // todo: this should be cashed as well :)
            jwk = await this.client.getJwk(header.kid);
        } catch (e) {
            /* istanbul ignore next */
            throw JWTError.payloadPropertyInvalid('kid');
        }

        const keyObject = await importJWK(jwk);

        /* istanbul ignore next */
        if (!(keyObject instanceof KeyObject) || keyObject.type !== 'public') {
            throw JWTError.payloadInvalid('The jwt key is not valid.');
        }

        const publicKey = keyObject.export({
            format: 'pem',
            type: 'spki',
        });

        let payload : OAuth2TokenPayload;

        try {
            payload = await verifyToken(token, {
                type: JWKType.RSA,
                key: decodePemToSpki(
                    Buffer.isBuffer(publicKey) ?
                        publicKey.toString('utf-8') :
                        publicKey,
                ),
                ...(jwk.alg ? { algorithms: [jwk.alg as JWTAlgorithm.RS256] } : {}),
            }) as OAuth2TokenPayload;
        } catch (e) {
            throw JWTError.payloadInvalid('The token could not be verified.');
        }

        const secondsDiff = payload.exp - payload.iat;
        if (secondsDiff <= 0) {
            throw JWTError.expired();
        }

        output = this.transform(payload);

        await this.cache.set(token, output, secondsDiff);

        return output;
    }

    async verifyRemote(token: string) : Promise<TokenVerificationData> {
        let output = await this.cache.get(token);
        if (output) {
            return output;
        }

        let payload : OAuth2TokenIntrospectionResponse;

        try {
            payload = await this.client.token.introspect({ token }, {
                authorizationHeaderInherit: true,
            });
        } catch (e) {
            /* istanbul ignore next */
            if (!isObject(e)) {
                throw new JWTError({
                    message: 'An unexpected token occurred.',
                });
            }

            if (
                isObject(e.response) &&
                isObject(e.response.data)
            ) {
                const code = typeof e.response.data.code === 'string' ?
                    e.response.data.code :
                    ErrorCode.JWT_INVALID;

                const message = typeof e.response.data.message === 'string' ?
                    e.response.data.message :
                    undefined;

                throw new JWTError({
                    statusCode: e.response.status,
                    code,
                    message,
                });
            }

            /* istanbul ignore next */
            throw new JWTError({
                message: e.message || 'An unexpected error occurred.',
                cause: e as Error,
            });
        }

        const secondsDiff = payload.exp - payload.iat;
        /* istanbul ignore next */
        if (secondsDiff <= 0) {
            throw JWTError.expired();
        }

        output = this.transform(payload);

        await this.cache.set(token, output, secondsDiff);

        return output;
    }

    protected transform(input: TokenVerificationDataInput) : TokenVerificationData {
        return {
            ...input,
            permissions: input.permissions || [],
        };
    }
}
