var env = process.env.NODE_ENV || 'development';
var bitcore = require('bitcore-lib-dash');

var config = {
    development: {
        app: {
            name: 'dash-payment-processor'
        },
        insight: 'http://localhost:3001/',
        wallet: {
            seed: 'tpub....', // ELECTRUM or BIP32
            network: bitcore.Networks.testnet
        },
        port: process.env.PORT || 9001,
        logLevel: 'DEBUG', // EMERGENCY|ALERT|CRITICAL|ERROR|WARNING|NOTICE|INFO|DEBUG
        worldcoin: {
            name: 'WorldCoinIndex',
            orgUrl: 'https://www.worldcoinindex.com',
            url: 'https://www.worldcoinindex.com/apiservice/json',
            apiKey: '' // get one from https://www.worldcoinindex.com/apiservice
        }
    },
    production: {
        app: {
            name: 'dash-payment-processor'
        },
        insight: 'http://localhost:3001/',
        wallet: {
            seed: 'xpub....', // ELECTRUM or BIP32
            network: bitcore.Networks.mainnet
        },
        port: process.env.PORT || 9001,
        logLevel: 'ERROR', // EMERGENCY|ALERT|CRITICAL|ERROR|WARNING|NOTICE|INFO|DEBUG
        worldcoin: {
            name: 'WorldCoinIndex',
            orgUrl: 'https://www.worldcoinindex.com',
            url: 'https://www.worldcoinindex.com/apiservice/json',
            apiKey: '' // get one from https://www.worldcoinindex.com/apiservice
        }
    }
};

module.exports = config[env];
