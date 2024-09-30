import isURL from 'validator/lib/isURL.js';

export const getBaseUrl = (context) => {
    const { req } = context;
    const protocol = req.protocol;
    const host = req.get('host');
    return `${protocol}://${host}`
};

export const validateUrls = (urls) => {
    const urlOptions = {
        protocols: ['http', 'https'],
        require_protocol: true,
    };
    for (const url of urls) {
        if (!isURL(url, urlOptions)) {
            throw new Error(`Invalid URL: ${url}`);
        }
    }
};