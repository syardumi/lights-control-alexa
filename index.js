/**
    Copyright 2016 Imagine It Productions or its affiliates. All Rights Reserved.

    Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at

    or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
*/

/**
 * App ID for the skill
 */
var APP_ID = ""; //replace with "amzn1.echo-sdk-ams.app.[your-unique-value-here]";

var http = require('http');
var AWS = require('aws-sdk');
var DynamoDb = new AWS.DynamoDB({apiVersion: '2012-08-10'});
var Particle = new (require('particle-api-js'))();

/**
 * The AlexaSkill prototype and helper functions
 */
var AlexaSkill = require('./AlexaSkill');
var Creds = require('./Creds');

/**
 * ButterscotchPudding is a child of AlexaSkill.
 * To read more about inheritance in JavaScript, see the link below.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Introduction_to_Object-Oriented_JavaScript#Inheritance
 */
var ButterscotchPudding = function () {
    AlexaSkill.call(this, APP_ID);
};

// Extend AlexaSkill
ButterscotchPudding.prototype = Object.create(AlexaSkill.prototype);
ButterscotchPudding.prototype.constructor = ButterscotchPudding;

ButterscotchPudding.prototype.eventHandlers.onSessionStarted = function (sessionStartedRequest, session) {
    console.log("ButterscotchPudding onSessionStarted requestId: " + sessionStartedRequest.requestId
        + ", sessionId: " + session.sessionId);
    // any initialization logic goes here
};

ButterscotchPudding.prototype.eventHandlers.onLaunch = function (launchRequest, session, response) {
    console.log("ButterscotchPudding onLaunch requestId: " + launchRequest.requestId + ", sessionId: " + session.sessionId);
    handleRequest(response);
};

/**
 * Overridden to show that a subclass can override this function to teardown session state.
 */
ButterscotchPudding.prototype.eventHandlers.onSessionEnded = function (sessionEndedRequest, session) {
    console.log("ButterscotchPudding onSessionEnded requestId: " + sessionEndedRequest.requestId
        + ", sessionId: " + session.sessionId);
    // any cleanup logic goes here
};

ButterscotchPudding.prototype.intentHandlers = {
    "switchLightsState": function (intent, session, response) {
        handleRequest(response, intent);
    },

    "AMAZON.HelpIntent": function (intent, session, response) {
        response.ask("You can say Butterscotch Pudding to toggle the lights in the Cantina, or, tell the Cantina to switch the lights on or off in a certain room, or, you can say exit... What can I help you with?", "What can I help you with?");
    },

    "AMAZON.StopIntent": function (intent, session, response) {
        var speechOutput = "Goodbye";
        response.tell(speechOutput);
    },

    "AMAZON.CancelIntent": function (intent, session, response) {
        var speechOutput = "Goodbye";
        response.tell(speechOutput);
    }
};

/**
 * Gets a random new fact from the list and returns to the user.
 */
function handleRequest(response, intent) {

	var toggleContents, action, switch_pos, location, raw_loc;

	//figure out the location first
	if (intent != undefined) {
		if (intent.hasOwnProperty('slots') && intent.slots.hasOwnProperty('roomlights') && intent.slots.roomlights.value != undefined) {
			location = intent.slots.roomlights.value.replace(/ /g,'');
			raw_loc = intent.slots.roomlights.value;
		}
		else {
			location = 'livingroom';
			raw_loc = 'living room';
		}
	}
	else {
		location = 'livingroom';
		raw_loc = 'living room';
	}

	//get the switch value
	DynamoDb.getItem(
		{ 
			Key: {
				"switchID": { S: raw_loc }
			},
			TableName: "Switch"
		}, 
		function(err, data) {
		
			if (err) { console.log (err); return; }
			
			console.log("switch was "+data.Item.toggle.S);
			
			toggleContents = data.Item.toggle.S;
			
			//toggle the switch
			if (toggleContents == 'on')
				toggleContents = 'off';
			else
				toggleContents = 'on';

			//set the action and switch position
			if (intent != undefined) {
				if (intent.hasOwnProperty('slots') && intent.slots.hasOwnProperty('switch') && intent.slots.switch.value != undefined) {
					switch_pos = intent.slots.switch.value;
				}else {
					switch_pos = toggleContents;
				}

				action = intent.name;
			}
			else {
				action = 'switchLightsState';
				switch_pos = toggleContents;
			}

			console.log('switch was set to '+switch_pos);
			
			//hit the Particle API for turning lights on/off
			Particle.login(Creds.obj).then(
			  function(data){
				console.log('API call completed on promise resolve: ', data.body.access_token);
				Particle.publishEvent({ name: action, data: switch_pos+","+location, auth: data.body.access_token }).then(
				  function(event_data) {
					if (event_data.body.ok) { console.log("Event published successfully") }
					
					//set the switch persistent state
					DynamoDb.updateItem(
					{ 
						Key: {
							"switchID": { S: raw_loc }				
						},
						TableName: "Switch",
						AttributeUpdates: {
							"toggle": {
								Value: {
									S: switch_pos
								}
							}
						}
					}, function(err, newData) {
				
						response.tellWithCard('May the lights be with you!', "Butterscotch Pudding", "The BP service used "+action+" to turn the lights "+switch_pos+" in the "+raw_loc+"("+location+")");			
					});
				  },
				  function(err) {
					console.log("Failed to publish event: " + JSON.stringify(err))
				  }
				);
			  },
			  function(err) {
				console.log('API call completed on promise fail: ', err);
			  }
			);			
		}
	);
	
}

// Create the handler that responds to the Alexa Request.
exports.handler = function (event, context) {
    // Create an instance of the ButterscotchPudding skill.
    var bp = new ButterscotchPudding();
    bp.execute(event, context);
};

