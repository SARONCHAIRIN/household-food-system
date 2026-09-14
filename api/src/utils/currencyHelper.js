// src/utils/currencyHelper.js

/**
 * Converts amounts between KHR and USD based on transaction exchange rate (default: 4000 KHR = 1 USD)
 */
const convertAmount = (amount, fromCurrency, toCurrency, exchangeRate = 4000) => {
    const num = Number(amount);
    if (fromCurrency === toCurrency) return num;

    if (fromCurrency === 'USD' && toCurrency === 'KHR') {
        return Math.round(num * exchangeRate);
    }

    if (fromCurrency === 'KHR' && toCurrency === 'USD') {
        return Number((num / exchangeRate).toFixed(2));
    }

    return num;
};

/**
 * Formats monetary amounts according to currency standards
 */
const formatCurrency = (amount, currency = 'KHR') => {
    if (currency === 'KHR') {
        return `${Math.round(Number(amount)).toLocaleString()} ៛`;
    }
    return `$${Number(amount).toFixed(2)}`;
};

module.exports = {
    convertAmount,
    formatCurrency,
};