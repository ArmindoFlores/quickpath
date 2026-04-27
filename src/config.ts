const REVERSE_DOMAIN: string = import.meta.env.VITE_REVERSE_DOMAIN;
const APP_KEY = `${REVERSE_DOMAIN}.${import.meta.env.VITE_APP_NAME}`;

export const config = {
    REVERSE_DOMAIN,
    APP_KEY,
};
