export const getBaseUrl = (context) => {
    const { req } = context;
    const protocol = req.protocol;
    const host = req.get('host');
    return `${protocol}://${host}`
};