/**

Copyright (c) 2015 Joris Bontje
Copyright (c) 2012 Clint Bellanger

MIT License:

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.


Sounds by Brandon Morris (CC-BY 3.0)
Art by Clint Bellanger (CC-BY 3.0)

*/

"use strict";

var app = angular.module('slethController', ['slots.config', 'slots.game', 'slots.reels', 'slots.directives', 'ngAnimate', 'angular-lodash', 'angularMoment']);

app.factory('moment', function() {
    var moment = window.moment;
    window.monent = undefined;
    return moment;
});

app.factory('web3', function() {
    var web3 = require('web3');
    web3.setProvider(new web3.providers.HttpSyncProvider("http://localhost:8080/"));
    return web3;
});

app.controller("SlethController", ['$http', '$interval', '$log', '$q', '$routeParams', '$scope', 'config', 'game', 'moment', 'web3', function($http, $interval, $log, $q, $routeParams, $scope, config, game, moment, web3) {

    /* global BigNumber:false */
    var two_256 = new BigNumber(2).toPower(256);

    $scope.canvasSize = 160 * config.reel_scale;

    $scope.slethAddress = $routeParams.contractAddress;
    $scope.defaultGas = web3.fromDecimal(10000);
    $scope.contract = $q.defer();

    $scope.bet = 0;
    $scope.player = {};
    $scope.stats = {};
    $scope.round = {};
    $scope.messages = [];
    $scope.web3 = {};
    $scope.state = game.STATE_NEW;

    $scope.rounds = [];

    $interval(function() {
        game.logic();
    }, 1000 / config.FPS);

    $http.get('sleth.abi.json').then(function(res) {
        var contract = web3.eth.contract($scope.slethAddress, res.data);
        $scope.contract.resolve(contract);
    });

    $scope.updateChain = function() {
        var accounts = web3.eth.accounts;
        $scope.player.address = accounts[0];

        var playerBalance = web3.eth.balanceAt(accounts[0]);
        $scope.player.balance = web3.toDecimal(playerBalance) / Math.pow(10, 18) || 0;
        $scope.player.coins = Math.floor($scope.player.balance);

        var slethBalance = web3.eth.balanceAt($scope.slethAddress);
        $scope.stats.slethBalance = web3.toDecimal(slethBalance) / Math.pow(10, 18) || 0;
        $scope.stats.slethAddress = $scope.slethAddress;

        $scope.web3.blockNumber = web3.eth.number;
        if ($scope.canClaim($scope.round)) {
            $scope.claim($scope.round);
        }
    };

    $scope.updatePlayer = function() {
        $scope.contract.promise.then(function(contract) {
            var res = contract.call().get_current_round();
            $scope.player.round = res.toNumber();
        });
    };

    $scope.updateStats = function() {
        $scope.contract.promise.then(function(contract) {
            var res = contract.call().get_stats();
            $scope.stats.total_spins = res[1].toNumber();
            $scope.stats.total_coins_won = res[2].toNumber();
        });
    };

    $scope.updateRound = function() {
        var roundNumber = $scope.player.round;
        if(roundNumber) {
            $scope.contract.promise.then(function(contract) {
                var res = contract.call().get_round(roundNumber);
                var round = {
                    number: roundNumber,
                    player: '0x' + (res[0].isNeg() ? res[0].plus(two_256) : res[0]).toString(16),
                    block: res[1].toNumber(),
                    time: res[2].toNumber(),
                    bet: res[3].toNumber(),
                    result: res[4].toNumber(),
                    entropy: '0x' + (res[5].isNeg() ? res[5].plus(two_256) : res[5]).toString(16),
                    rnd: res[6].toNumber(),
                    status: res[7].toNumber()
                };

                var changed = !angular.equals(round, $scope.round);
                $scope.round = round;

                if (changed) {
                    if (round.status === 1 && (game.state === game.STATE_NEW)) {
                        $scope.bet = round.bet;
                        game.spin(round.bet);
                    } else if (round.status === 2 && (game.state !== game.STATE_NEW)) {
                        $scope.bet = 0;
                        game.set_stops(round.rnd);
                        var message = "Results for round #" + roundNumber + ": you won ";
                        if (round.result) {
                            message += round.result + " coins :)";
                        } else {
                            message += "nothing :(";
                        }
                        $scope.logMessage(message);
                        $scope.rounds.unshift(round);
                    }

                    if ($scope.canClaim($scope.round)) {
                        $scope.claim($scope.round);
                    }
                }
            });
        }
    };

    $scope.spin = function(bet) {
        if (bet) {
            if (game.state !== game.STATE_NEW && game.state !== game.STATE_REST) return;
            if ($scope.player.coins < bet) return;

            $scope.clearMessages();

            var value = web3.fromDecimal(bet * Math.pow(10, 18));
            $scope.contract.promise.then(function(contract) {
                contract.transact({gas: $scope.defaultGas, value: value}).spin(bet);

                $scope.bet = bet;

                game.spin(bet);
                $scope.logMessage("Spinning... " + bet);
                $scope.updatePlayer();
                $scope.updateStats();
            });
        }
    };

    $scope.canClaim = function(round) {
        return round.status === 1 && ($scope.web3.blockNumber > round.block);
    };

    $scope.claim = function(round) {
        if (round.number) {
            $scope.contract.promise.then(function(contract) {
                contract.transact({gas: $scope.defaultGas}).claim(round.number);

                $scope.logMessage("Claiming round #" + round.number + "...");
                $scope.updatePlayer();
                $scope.updateStats();
                $scope.updateRound();
            });
        }
    };

    $scope.$on('slots:reward', function(evt, reward) {
        $scope.reward = reward;
        // check if the locally calculated reward matches with the contract results
        $scope.reward.verified = (reward.payout === $scope.round.result);
        if ($scope.reward.verified) {
            $scope.logMessage("Reward verified");
        } else {
            $scope.logMessage("Reward NOT verified");
        }
    });

    $scope.$on('keypress', function (evt, obj) {
        if (obj.which === 32) { // spacebar
            if (game.state !== game.STATE_NEW && game.state !== game.STATE_REST) return;

            if ($scope.player.coins >= 5) {
                $scope.spin(5);
            } else if ($scope.player.coins >= 3) {
                $scope.spin(3);
            } else if ($scope.player.coins >= 1) {
                $scope.spin(1);
            }
        }
    });

    $scope.clearMessages = function() {
        $scope.messages = [];
    };

    $scope.logMessage = function(message) {
        $log.info(message);
        $scope.messages.push(message);
    };

    // test if web3 is available
    try {
        $scope.web3.available = (web3.eth.coinbase !== "");
        $scope.contractExists = (web3.eth.codeAt($scope.slethAddress) !== "0x0000000000000000000000000000000000000000000000000000000000000000");
    } catch(e) {
        $log.error(e);
        $scope.web3.error = e;
    }

    $scope.$on('slots:state', function(evt, state) {
        $scope.state = state;
    });

    function init() {
        if (!$scope.contractExists) {
            $scope.web3.error = {'name': "Contract Not Found", 'message': "The specified contract couldn't be found on the blockchain"};
            return;
        }

        $scope.$watch('player.round', $scope.updateRound);

        web3.eth.watch('chain').changed(function(res) {
            $scope.updateChain();
            $scope.updatePlayer();
            $scope.updateRound();
            $scope.updateStats();
        });

        $scope.updateChain();
        $scope.updatePlayer();
        $scope.updateStats();
    }

    if ($scope.web3.available) {
        init();
    }
}]);
