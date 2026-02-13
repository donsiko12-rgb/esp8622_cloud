module.exports = {
    telegram: {
        token: '8305361977:AAHXyMZKbqMdGjB8Xtg-Rz44oH6SodumUcQ',
        chatId: '286692210'
    },
    alerts: {
        low: 10,  // Alert if level < 10%
        high: 90, // Alert if level > 90%
        cooldown: 60 * 60 * 1000 // 1 hour cooldown between same-type alerts
    }
};
