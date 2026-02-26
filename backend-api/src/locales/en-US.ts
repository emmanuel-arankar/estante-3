import { TranslationKeys } from './pt-BR';

export const enUS: TranslationKeys = {
    common: {
        internalError: 'An internal server error occurred.',
        validationError: 'Invalid request data',
        maintenanceMode: 'System is under maintenance. Please try again later.',
        rateLimit: 'Too many requests. Please try again in 15 minutes.',
        timeout: 'The request took too long to respond.',
        unauthorized: 'Unauthorized. Please log in.',
        forbidden: 'You do not have permission to perform this action.',
        notFound: 'Resource not found.',
    },
    auth: {
        loginSuccess: 'Login successful.',
        userCreated: 'User created successfully.',
        nicknameTaken: 'This nickname is already in use.',
    },
    chat: {
        messageSent: 'Message sent.',
        messageDeleted: 'Message deleted.',
    },
    users: {
        profileUpdated: 'Profile updated successfully.',
        avatarUpdated: 'Avatar updated.',
        userNotFound: 'User not found.',
    }
};
