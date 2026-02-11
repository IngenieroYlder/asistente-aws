import { formatInTimeZone } from 'date-fns-tz';

const TIMEZONE = 'America/Bogota'; // UTC-5

export const formatTime = (date) => {
    if (!date) return '';
    try {
        return formatInTimeZone(new Date(date), TIMEZONE, 'h:mm a');
    } catch (e) {
        return 'Invalid Date';
    }
};

export const formatDate = (date) => {
    if (!date) return '';
    try {
        return formatInTimeZone(new Date(date), TIMEZONE, 'dd/MM/yyyy');
    } catch (e) {
        return 'Invalid Date';
    }
};
