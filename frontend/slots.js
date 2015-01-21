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

var app = angular.module('slots',[]);

app.constant('config', {
    FPS: 60
});

app.factory('sounds', function() {
    var snd_win = new Audio("sounds/win.wav");
    var snd_reel_stop = new Array();
    snd_reel_stop[0] = new Audio("sounds/reel_stop.wav");
    snd_reel_stop[1] = new Audio("sounds/reel_stop.wav");
    snd_reel_stop[2] = new Audio("sounds/reel_stop.wav");

    var sounds = {};

    sounds.playWin = function() {
        try {
            snd_win.currentTime = 0;
            snd_win.load();  // workaround for chrome currentTime bug
            snd_win.play();
        } catch(err) {
            console.error(err);
        };
    };

    sounds.playReelStop = function(i) {
        try {
            snd_reel_stop[i].currentTime = 0;
            snd_reel_stop[i].load();  // workaround for chrome currentTime bug
            snd_reel_stop[i].play();
        } catch(err) {
            console.error(err);
        };
    };

    return sounds;
});

app.factory('game', function() {
    var symbol_count = 11;
    var match_payout = new Array(symbol_count);
    match_payout[7] = 4; // 3Down
    match_payout[6] = 6; // 2Down
    match_payout[5] = 8; // 1Down
    match_payout[1] = 10; // 1Up
    match_payout[2] = 15; // 2Up
    match_payout[3] = 20; // 3Up
    match_payout[4] = 25; // OrangeRed
    match_payout[0] = 50; // AlienHead
    match_payout[9] = 75; // Bacon
    match_payout[10] = 100; // Narwhal
    match_payout[8] = 250; // CakeDay

    var payout_ups = 6; // Any 3 Ups
    var payout_downs = 2; // Any 3 Downs

    var game = {};

    // given an input line of symbols, determine the payout
    game.calc_line = function(s1, s2, s3) {
      // perfect match
      if (s1 == s2 && s2 == s3) {
        return match_payout[s1];
      }

      // special case #1: triple ups
      if ((s1 == 1 || s1 == 2 || s1 == 3) &&
          (s2 == 1 || s2 == 2 || s2 == 3) &&
          (s3 == 1 || s3 == 2 || s3 == 3)) {
        return payout_ups;
      }

      // special case #2: triple down
      if ((s1 == 5 || s1 == 6 || s1 == 7) &&
          (s2 == 5 || s2 == 6 || s2 == 7) &&
          (s3 == 5 || s3 == 6 || s3 == 7)) {
        return payout_downs;
      }

      // special case #3: bacon goes with everything
      if (s1 == 9) {
        if (s2 == s3) return match_payout[s2];

        // wildcard trip ups
        if ((s2 == 1 || s2 == 2 || s2 == 3) &&
            (s3 == 1 || s3 == 2 || s3 == 3)) return payout_ups;

        // wildcard trip downs
        if ((s2 == 5 || s2 == 6 || s2 == 7) &&
            (s3 == 5 || s3 == 6 || s3 == 7)) return payout_downs;

      }
      if (s2 == 9) {
        if (s1 == s3) return match_payout[s1];

        // wildcard trip ups
        if ((s1 == 1 || s1 == 2 || s1 == 3) &&
            (s3 == 1 || s3 == 2 || s3 == 3)) return payout_ups;

        // wildcard trip downs
        if ((s1 == 5 || s1 == 6 || s1 == 7) &&
            (s3 == 5 || s3 == 6 || s3 == 7)) return payout_downs;

      }
      if (s3 == 9) {
        if (s1 == s2) return match_payout[s1];

        // wildcard trip ups
        if ((s1 == 1 || s1 == 2 || s1 == 3) &&
            (s2 == 1 || s2 == 2 || s2 == 3)) return payout_ups;

        // wildcard trip downs
        if ((s1 == 5 || s1 == 6 || s1 == 7) &&
            (s2 == 5 || s2 == 6 || s2 == 7)) return payout_downs;
      }

      // check double-bacon
      if (s2 == 9 && s3 == 9) return match_payout[s1];
      if (s1 == 9 && s3 == 9) return match_payout[s2];
      if (s1 == 9 && s2 == 9) return match_payout[s3];

      // no reward
      return 0;
    };

    // calculate the reward
    game.calc_reward = function(playing_lines, result) {
      var reward = {
          payout: 0,
          partial_payouts: {}
      };

      var partial_payout;

      // Line 1
      partial_payout = game.calc_line(result[0][1], result[1][1], result[2][1]);
      if (partial_payout > 0) {
        reward.partial_payouts[1] = partial_payout;
        reward.payout += partial_payout;
      }

      if (playing_lines > 1) {
        // Line 2
        partial_payout = game.calc_line(result[0][0], result[1][0], result[2][0]);
        if (partial_payout > 0) {
          reward.partial_payouts[2] = partial_payout;
          reward.payout += partial_payout;
        }

        // Line 3
        partial_payout = game.calc_line(result[0][2], result[1][2], result[2][2]);
        if (partial_payout > 0) {
          reward.partial_payouts[3] = partial_payout;
          reward.payout += partial_payout;
        }
      }

      if (playing_lines > 3) {
        // Line 4
        partial_payout = game.calc_line(result[0][0], result[1][1], result[2][2]);
        if (partial_payout > 0) {
          reward.partial_payouts[4] = partial_payout;
          reward.payout += partial_payout;
        }

        // Line 5
        partial_payout = game.calc_line(result[0][2], result[1][1], result[2][0]);
        if (partial_payout > 0) {
          reward.partial_payouts[5] = partial_payout;
          reward.payout += partial_payout;
        }
      }

      return reward;
    }

    return game;
});

app.controller("SlotsController", ['$scope', '$interval', 'config', 'game', 'sounds', function($scope, $interval, config, game, sounds) {

$interval(function() {
    logic();
    render();
}, 1000 / config.FPS);

// html elements
var ctx;     // context

var symbols_loaded = false;
var reels_bg_loaded = false;

// art
var symbols = new Image();
var reels_bg = new Image();

symbols.src = "images/reddit_icons_small.png";
reels_bg.src = "images/reels_bg.png";

// enums
var STATE_REST = 0;
var STATE_SPINUP = 1;
var STATE_SPINMAX = 2;
var STATE_SPINDOWN = 3;
var STATE_REWARD = 4;

// config
var reel_count = 3;
var reel_positions = 32;
var symbol_size = 32;

var reel_pixel_length = reel_positions * symbol_size;
var row_count = 3;
var stopping_distance = 528;
var max_reel_speed = 32;
var spinup_acceleration = 2;
var spindown_acceleration = 1;
var starting_credits = 100;
var reward_delay = 3; // how many frames between each credit tick
var reward_delay_grand = 1; // delay for grand-prize winning
var reward_grand_threshhold = 25; // count faster if the reward is over this size

var reel_area_left = 32;
var reel_area_top = 32;
var reel_area_width = 96;
var reel_area_height = 96;

// set up reels
var reels = new Array(reel_count);
reels[0] = new Array(2,1,7,1,2,7,6,7,3,10,1,6,1,7,3,4,3,2,4,5,0,6,10,5,6,5,8,3,0,9,5,4);
reels[1] = new Array(6,0,10,3,6,7,9,2,5,2,3,1,5,2,1,10,4,5,8,4,7,6,0,1,7,6,3,1,5,9,7,4);
reels[2] = new Array(1,4,2,7,5,6,4,10,7,5,2,0,6,4,10,1,7,6,3,0,5,7,2,3,9,3,5,6,1,8,1,3);

var reel_position = new Array(reel_count);
for (var i=0; i<reel_count; i++) {
  reel_position[i] = Math.floor(Math.random() * reel_positions) * symbol_size;
}

var stopping_position = new Array(reel_count);
var start_slowing = new Array(reel_count);

// reel spin speed in pixels per frame
var reel_speed = new Array(reel_count);
for (var i=0; i<reel_count; i++) {
  reel_speed[i] = 0;
}

var result = new Array(reel_count);
for (var i=0; i<reel_count; i++) {
  result[i] = new Array(row_count);
}

$scope.game_state = STATE_REST;
$scope.credits = starting_credits;

$scope.reward = {
    payout: 0,
    partial_payouts: {}
};
var reward_delay_counter = 0;

//---- Render Functions ---------------------------------------------

function draw_symbol(symbol_index, x, y) {
  var symbol_pixel = symbol_index * symbol_size;
  ctx.drawImage(symbols, 0,symbol_pixel,symbol_size,symbol_size, x+reel_area_left,y+reel_area_top,symbol_size,symbol_size);
}

function render_reel() {

  // clear reel
  ctx.drawImage(reels_bg, reel_area_left, reel_area_top);

  // set clipping area
  ctx.beginPath();
  ctx.rect(reel_area_left, reel_area_top, reel_area_width, reel_area_height);
  ctx.clip();

  var reel_index;
  var symbol_offset;
  var symbol_index;
  var x;
  var y;

  for (var i=0; i<reel_count; i++) {
    for (var j=0; j<row_count +1; j++) {

      reel_index = Math.floor(reel_position[i] / symbol_size) + j;
      symbol_offset = reel_position[i] % symbol_size;

      // reel wrap
      if (reel_index >= reel_positions) reel_index -= reel_positions;

      // symbol lookup
      symbol_index = reels[i][reel_index];

      x = i * symbol_size;
      y = j * symbol_size - symbol_offset;

      draw_symbol(symbol_index, x, y);

    }
  }
}

function highlight_line(line_num) {

  ctx.strokeStyle = "orange";
  var ss = symbol_size;

  // top row
  if (line_num == 2 || line_num == 4) {
    ctx.strokeRect(reel_area_left, reel_area_top, symbol_size-1, symbol_size-1); // top left
  }
  if (line_num == 2) {
    ctx.strokeRect(reel_area_left + ss, reel_area_top, ss-1, ss-1); // top middle
  }
  if (line_num == 2 || line_num == 5) {
    ctx.strokeRect(reel_area_left + ss + ss, reel_area_top, ss-1, ss-1); // top right
  }

  // middle row
  if (line_num == 1) {
    ctx.strokeRect(reel_area_left, reel_area_top + ss, ss-1, ss-1); // top left
  }
  if (line_num == 1 || line_num == 4 || line_num == 5) {
    ctx.strokeRect(reel_area_left + ss, reel_area_top + ss, ss-1, ss-1); // top middle
  }
  if (line_num == 1) {
    ctx.strokeRect(reel_area_left + ss + ss, reel_area_top + ss, ss-1, ss-1); // top right
  }

  // bottom row
  if (line_num == 3 || line_num == 5) {
    ctx.strokeRect(reel_area_left, reel_area_top + ss + ss, ss-1, ss-1); // top left
  }
  if (line_num == 3) {
    ctx.strokeRect(reel_area_left + ss, reel_area_top + ss + ss, ss-1, ss-1); // top middle
  }
  if (line_num == 3 || line_num == 4) {
    ctx.strokeRect(reel_area_left + ss + ss, reel_area_top + ss + ss, ss-1, ss-1); // top right
  }

}

// render all art needed in the current frame
function render() {

  if ($scope.game_state == STATE_SPINUP || $scope.game_state == STATE_SPINMAX || $scope.game_state == STATE_SPINDOWN) {
    render_reel();
  }

}


//---- Logic Functions ---------------------------------------------

function set_stops(entropy) {
  var rnd = entropy;

  for (var i=0; i<reel_count; i++) {

    start_slowing[i] = false;

    var stop_index = rnd % reel_positions;
    rnd = Math.floor(rnd / reel_positions);

    stopping_position[i] = stop_index * symbol_size;

    stopping_position[i] += stopping_distance;
    if (stopping_position[i] >= reel_pixel_length) stopping_position[i] -= reel_pixel_length;

    // convenient here to remember the winning positions
    for (var j=0; j<row_count; j++) {
      result[i][j] = stop_index + j;
      if (result[i][j] >= reel_positions) result[i][j] -= reel_positions;

      // translate reel positions into symbol
      result[i][j] = reels[i][result[i][j]];
    }
  }
}

function move_reel(i) {
  reel_position[i] -= reel_speed[i];

  // wrap
  if (reel_position[i] < 0) {
    reel_position[i] += reel_pixel_length;
  }
}

// handle reels accelerating to full speed
function logic_spinup() {

  for (var i=0; i<reel_count; i++) {

    // move reel at current speed
    move_reel(i);

    // accelerate speed
    reel_speed[i] += spinup_acceleration;

  }

  // if reels at max speed, begin spindown
  if (reel_speed[0] == max_reel_speed) {


    $scope.game_state = STATE_SPINMAX;
  }
}

function logic_spinmax() {
  for (var i=0; i<reel_count; i++) {

    // move reel at current speed
    move_reel(i);
  }
}

// handle reel movement as the reels are coming to rest
function logic_spindown() {

  // if reels finished moving, begin rewards
  if (reel_speed[reel_count-1] == 0) {

    var reward = game.calc_reward($scope.playing_lines, result);
    angular.forEach(reward.partial_payouts, function(value, key) {
        highlight_line(key);
    });

    if (reward.payout > 0) {
        sounds.playWin();
    }
    $scope.reward = reward;
    $scope.game_state = STATE_REWARD;
  }

  for (var i=0; i<reel_count; i++) {

    // move reel at current speed
    move_reel(i);

    // start slowing this reel?
    if (start_slowing[i] == false) {

      // if the first reel, or the previous reel is already slowing
      var check_position = false;
      if (i == 0) check_position = true;
      else if (start_slowing[i-1]) check_position = true;

      if (check_position) {

        if (reel_position[i] == stopping_position[i]) {
          start_slowing[i] = true;
        }
      }
    }
    else {
      if (reel_speed[i] > 0) {
        reel_speed[i] -= spindown_acceleration;

        if (reel_speed[i] == 0) {
          sounds.playReelStop(i);
        }

      }
    }
  }

}

// count up the reward credits, play sound effects, etc.
function logic_reward() {

  if ($scope.reward.payout == 0) {
    $scope.game_state = STATE_REST;
    return;
  }

  // don't tick up rewards each frame, too fast
  if (reward_delay_counter > 0) {
    reward_delay_counter--;
    return;
  }

  $scope.reward.payout--;
  $scope.credits++;

  if ($scope.reward.payout < reward_grand_threshhold) {
    reward_delay_counter = reward_delay;
  }
  else { // speed up big rewards
    reward_delay_counter += reward_delay_grand;
  }

}

// update all logic in the current frame
function logic() {

  // SPINMAX TO SPINDOWN happens on an input event
  // REST to SPINUP happens on an input event

  if ($scope.game_state == STATE_SPINUP) {
    logic_spinup();
  }
  else if ($scope.game_state == STATE_SPINMAX) {
    logic_spinmax();
  }
  else if ($scope.game_state == STATE_SPINDOWN) {
    logic_spindown();
  }
  else if ($scope.game_state == STATE_REWARD) {
    logic_reward();
  }

}


    //---- Input Functions ---------------------------------------------

    $scope.handleKey = function(evt) {
      if (evt.keyCode == 32) { // spacebar
        if ($scope.game_state == STATE_SPINMAX) {
            $scope.stop();
            return;
        };
        if ($scope.game_state != STATE_REST) return;

        if ($scope.credits >= 5) $scope.spin(5);
        else if ($scope.credits >= 3) $scope.spin(3);
        else if ($scope.credits >= 1) $scope.spin(1);

      }
    };

    $scope.spin = function(line_choice) {

      if ($scope.game_state != STATE_REST) return;
      if ($scope.credits < line_choice) return;

      $scope.credits -= line_choice;
      $scope.playing_lines = line_choice;

      $scope.reward.partial_payouts = {};
      $scope.generateEntropy();

      $scope.game_state = STATE_SPINUP;

    };

    $scope.generateEntropy = function() {
        $scope.entropy = Math.floor(Math.random() * Math.pow(32, 3));
    };

    $scope.stop = function() {
        if ($scope.game_state != STATE_SPINMAX) return;

        // calculate the final results now, so that spindown is ready
        set_stops($scope.entropy);
        $scope.game_state = STATE_SPINDOWN;
    };

    //---- Init Functions -----------------------------------------------

    $scope.init = function() {
      var can = document.getElementById("slots");
      ctx = can.getContext("2d");

      symbols.onload = function() {
        symbols_loaded = true;
        if (symbols_loaded && reels_bg_loaded) render_reel();
      };

      reels_bg.onload = function() {
        reels_bg_loaded = true;
        if (symbols_loaded && reels_bg_loaded) render_reel();
      };
    };

    $scope.init();

}]);
