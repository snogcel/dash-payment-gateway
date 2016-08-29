'use strict';

var Writable = require('stream').Writable;
var bodyParser = require('body-parser');
var compression = require('compression');
var BaseService = require('./service');
var inherits = require('util').inherits;
var morgan = require('morgan');
var bitcore = require('bitcore-lib-dash');
var _ = bitcore.deps._;
var $ = bitcore.util.preconditions;

var AppConfig = require('../config/AppConfig');
var Bootstrap = require('../service/Bootstrap');
var UserService = require('../service/UserService');
var ReceiverService = require('../service/ReceiverService');
var EventEmitter = require('events').EventEmitter;


/**
 * A service for Bitcore to enable decentralized payment processing.
 */
var DashPaymentService = function(options) {
    BaseService.call(this, options);

    if (!_.isUndefined(options.routePrefix)) {
        this.routePrefix = options.routePrefix;
    } else {
        this.routePrefix = this.name;
    }

    this.subscriptions = {
        dps: []
    };

};

DashPaymentService.dependencies = ['bitcoind', 'web'];

inherits(DashPaymentService, BaseService);


DashPaymentService.prototype.getRoutePrefix = function() {
    return this.routePrefix;
};

DashPaymentService.prototype.start = function(callback) {
    var self = this;

    this.node.services.bitcoind.on('tx', this.transactionEventHandler.bind(this));
    this.node.services.bitcoind.on('txlock', this.transactionLockEventHandler.bind(this));
    this.node.services.bitcoind.on('block', this.blockEventHandler.bind(this));

    Bootstrap.initialize(function(err, results){
        if ( err ){
            self.node.log.error(err);
            process.exit(1);
        }else{
            self.node.log.info(results);
        }
    });

    setImmediate(callback);
};

DashPaymentService.prototype.createLogInfoStream = function() {
    var self = this;

    function Log(options) {
        Writable.call(this, options);
    }
    inherits(Log, Writable);

    Log.prototype._write = function (chunk, enc, callback) {
        self.node.log.info(chunk.slice(0, chunk.length - 1)); // remove new line and pass to logger
        callback();
    };
    var stream = new Log();

    return stream;
};

DashPaymentService.prototype.getRemoteAddress = function(req) {
    if (req.headers['cf-connecting-ip']) {
        return req.headers['cf-connecting-ip'];
    }
    return req.socket.remoteAddress;
};

DashPaymentService.prototype.setupRoutes = function(app) {

    var self = this;

    //Setup logging
    morgan.token('remote-forward-addr', function(req){
        return self.getRemoteAddress(req);
    });
    var logFormat = ':remote-forward-addr ":method :url" :status :res[content-length] :response-time ":user-agent" ';
    var logStream = this.createLogInfoStream();
    app.use(morgan(logFormat, {stream: logStream}));

    //Enable compression
    app.use(compression());

    //Enable urlencoded data
    app.use(bodyParser.urlencoded({extended: true}));

    //Enable CORS
    app.use(function(req, res, next) {

        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, HEAD, PUT, POST, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Content-Length, Cache-Control, cf-connecting-ip');

        var method = req.method && req.method.toUpperCase && req.method.toUpperCase();

        if (method === 'OPTIONS') {
            res.statusCode = 204;
            res.end();
        } else {
            next();
        }
    });

    // Create Receiver
    app.post('/createReceiver', function(req,res){

        var fiatCode    = req.body.currency;
        var fiatAmount  = req.body.amount;
        var username    = req.body.email;
        var description = req.body.description;
        var callbackUrl = req.body.callbackUrl;

        var user = UserService.findOrCreate(username, function(err, user){
            if ( err ){
                res.send(err);
            }else{
                ReceiverService.createReceiver(username, fiatCode, fiatAmount, description, callbackUrl, function(err, receiver){
                    if ( err ){
                        res.send(err);
                    }else{
                        ReceiverService.listenForPayment(receiver);
                        res.send({
                            receiver_id: receiver.receiver_id,
                            username: receiver.username,
                            dash_payment_address: receiver.dash_payment_address,
                            amount_fiat: receiver.amount_fiat,
                            type_fiat: receiver.type_fiat,
                            base_fiat: receiver.base_fiat,
                            amount_duffs: receiver.amount_duffs,
                            created_date: receiver.created_date,
                            description: receiver.description
                        });
                    }
                });
            }
        });
    });

    /**
     *   Example callback URL - Not for use in a production environment. This endpoint is used only for testing, to output the
     *   the results of a callback URL without having to run a completely separate server during development.
     */
    app.post('/cb', function(req,res){

        for (var i = 0; i < self.subscriptions.dps.length; i++) {
            self.subscriptions.dps[i].emit('callback', JSON.stringify(req.body, null, 3));
        }

        console.log('**********************************************************************************************');
        console.log('Received a call from the payment gateway - a payment must have been made.');
        console.log('**********************************************************************************************');
        console.log(JSON.stringify(req.body, null, 3));
        console.log('**********************************************************************************************');

        res.send('OK')

    });


    // Not Found
    app.use(function(req, res) {
        res.status(404).jsonp({
            status: 404,
            url: req.originalUrl,
            error: 'Not found'
        });
    });

};

DashPaymentService.prototype.getPublishEvents = function() {
    return [
        {
            name: 'dps',
            scope: this,
            subscribe: this.subscribe.bind(this),
            unsubscribe: this.unsubscribe.bind(this),
            extraEvents: ['callback']
        }
    ];
};

DashPaymentService.prototype.subscribe = function(emitter) {
    $.checkArgument(emitter instanceof EventEmitter, 'First argument is expected to be an EventEmitter');

    var emitters = this.subscriptions.dps;
    var index = emitters.indexOf(emitter);
    if(index === -1) {
        emitters.push(emitter);
    }
};

DashPaymentService.prototype.unsubscribe = function(emitter) {
    $.checkArgument(emitter instanceof EventEmitter, 'First argument is expected to be an EventEmitter');

    var emitters = this.subscriptions.dps;
    var index = emitters.indexOf(emitter);
    if(index > -1) {
        emitters.splice(index, 1);
    }
};

DashPaymentService.prototype.blockEventHandler = function(hashBuffer) {

};

DashPaymentService.prototype.transactionEventHandler = function(txBuffer) {

};

DashPaymentService.prototype.transactionLockEventHandler = function(txBuffer) {

};


module.exports = DashPaymentService;