/*
 * Copyright (c) 2023-2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { ErrorCode, TokenError } from '@authup/kit';

type Context = {
    code?: `${ErrorCode}`,
    status?: number,
    message?: string
};
export function createResponseError(input: Context | TokenError) : Error {
    let context : Context;
    if (input instanceof TokenError) {
        context = {
            code: input.getOption('code') as `${ErrorCode}`,
            status: input.getOption('statusCode'),
            message: input.message,
        };
    } else {
        context = input;
    }

    const error = new TokenError();
    Object.assign(error, {
        response: {
            data: {
                code: context.code || ErrorCode.TOKEN_INVALID,
                message: context.message || 'foo',
            },
            status: context.status || 400,
        },
    });

    return error;
}
