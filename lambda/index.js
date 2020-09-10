const Alexa = require('ask-sdk-core');
const persistenceAdapter = require('ask-sdk-s3-persistence-adapter');

//
// helper functions
//
const makeResponseObject = require('./helperFunctions.js').makeResponseObject;
const fillResponseBuilder = require('./helperFunctions.js').fillResponseBuilder;
const cleanUpAfterResponse = require('./helperFunctions.js').cleanUpAfterResponse;
const isEmpty = require('./helperFunctions.js').isEmpty;
const fillEmptyS3Object = require('./helperFunctions.js').fillEmptyS3Object;
const setSessionAttributes = require('./helperFunctions.js').setSessionAttributes;

//
// utils
//
const logIt = require('./helperFunctions.js').logIt;

//
//global vars
//
var sessionAttributes = {};
var s3Attributes = {};

//
//handlers
//
const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
    },
    async handle(handlerInput) {
       
        logIt({
           userIs:{logMessage:'in launch handler for state cap quiz and user is ',logItem:whichUser},
        });
        
        const attributesManager = handlerInput.attributesManager;
        
        var inputObject = {};
        var responseObject = {};
        
        // set the s3 stuff

        s3Attributes = await attributesManager.getPersistentAttributes() || {};

        if (isEmpty(s3Attributes)) {
            // it's the first time this user has been here so let's set some hooks and zeroes
            s3Attributes = fillEmptyS3Object();
        } else {
            s3Attributes.beenHereTimes++;
        }

        logIt({
           userIs:{logMessage:'in launch handler for state cap quiz and s3Attributes are ',logItem:s3Attributes}
        });

        // set the session stuff
        
        var initObject = s3Attributes;
        initObject.whichKind = "initialize";
        initObject.handlerInput = handlerInput;
        
        sessionAttributes = setSessionAttributes(initObject);
        
        s3Attributes.currentQuestionSet = sessionAttributes.currentQuestionSet;
        

        // set the input object stuff to go to the response object builder
        
        inputObject.whichQuestion = sessionAttributes.whichQuestion;
        inputObject.randomQuestionOrderList = s3Attributes.randomQuestionOrderList;
        inputObject.beenHereTimes = s3Attributes.beenHereTimes;
        inputObject.supportsAPL = sessionAttributes.supportsAPL;

        // generate response object 
        
        responseObject = makeResponseObject({response:'launch', responseInput:inputObject});
        
        // clean up after response
        
        sessionAttributes.currentlyAskingQuestion = true;
        sessionAttributes.correctAnswer = responseObject.correctAnswer;
        
        cleanUpAfterResponse({responseObject:responseObject,
                                attributesManager:attributesManager,
                                sessionAttributes:sessionAttributes,
                                s3Attributes:s3Attributes
        });
        
        // push out response
        
        sessionAttributes.lastSpeech = responseObject.audioObject.reprompt;

        fillResponseBuilder({responseObject:responseObject,responseBuilder:handlerInput.responseBuilder});
        
        return handlerInput.responseBuilder
            .getResponse();
            
            
    }
};

const HelpIntentHandler = {
    
    canHandle(handlerInput) {
        return (handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent' ) ;
    },
    async handle(handlerInput) {
        
        logIt({
            intentItem:{logMessage:'in help handler and intent object is ',logItem:handlerInput.requestEnvelope.request.intent},
        });
        
        var responseObject = {};
        var inputObject = {};
        var attributesManager = handlerInput.attributesManager;

        // set up attributes

        // generate response

        responseObject = makeResponseObject({response:'help', responseInput:inputObject});

        // clean up attributes
        
        sessionAttributes.yesNo = "keep playing";

        cleanUpAfterResponse({responseObject:responseObject,
            attributesManager:attributesManager,
            sessionAttributes:sessionAttributes,
            s3Attributes:s3Attributes
        });        
        // push out response
        
        sessionAttributes.lastReprompt = responseObject.audioObject.reprompt;

        fillResponseBuilder({responseObject:responseObject,responseBuilder:handlerInput.responseBuilder});
        
        return handlerInput.responseBuilder
            .getResponse();
    }
};

const AnswerIntentHandler = {
    
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && (handlerInput.requestEnvelope.request.intent.name === 'AnswerIntent' ||
                sessionAttributes.currentlyAskingQuestion === true) ;
    },
    async handle(handlerInput) {
        
        logIt({
            intentItem:{logMessage:'in AnswerIntentHandler and intent object is ',logItem:handlerInput.requestEnvelope.request.intent},
            secondItem:{logMessage:'in AnswerIntentHandler and sessionAttributes are ',logItem:sessionAttributes}
        });
        
        var responseObject = {};
        var inputObject = {};
        var attributesManager = handlerInput.attributesManager;
        
            // set up attributes
        
        // if it's a valid answer see if it is the right answer
        
        inputObject.whichQuestion = sessionAttributes.whichQuestion;
        inputObject.currentQuestionSet = sessionAttributes.currentQuestionSet;

        var currentAnswer = sessionAttributes.correctAnswer.toUpperCase();
        
        if (handlerInput.requestEnvelope.request.intent.name === 'AnswerIntent') {
            if (handlerInput.requestEnvelope.request.intent.slots) { // if it's recognized as an answer
                var theirAnswer;
                if (handlerInput.requestEnvelope.request.intent.slots.stateSlot.value) {
                    theirAnswer = handlerInput.requestEnvelope.request.intent.slots.stateSlot.value
                } else {
                    if (handlerInput.requestEnvelope.request.intent.slots.citySlot.value) {
                        theirAnswer = handlerInput.requestEnvelope.request.intent.slots.citySlot.value
                    } else {
                        theirAnswer = "That"  
                    }
                }
                if (theirAnswer.toUpperCase() === currentAnswer) {
                    // it's a match
                    sessionAttributes.numberCorrect++;
                    inputObject.answerType = 'correct';
                } else {
                    // real city wrong answer
                    inputObject.answerType = 'incorrect';
                    inputObject.incorrectAnswer = theirAnswer;
                }
            } else { // it's just some nonsense
                inputObject.answerType = 'not a city';
                inputObject.incorrectAnswer = "That";
            }
        } else {
            inputObject.answerType = 'not a city';
            inputObject.incorrectAnswer = "That";
        }
        
        inputObject.numberCorrect = sessionAttributes.numberCorrect;
        inputObject.randomQuestionOrderList = s3Attributes.randomQuestionOrderList;
        inputObject.supportsAPL = sessionAttributes.supportsAPL;

        // generate response

        responseObject = makeResponseObject({response:'answer', responseInput:inputObject});

        // clean up attributes
        
        if (responseObject.finished === true) {
            sessionAttributes.yesNo = "play again";
            sessionAttributes.currentlyAskingQuestion =  false;
			sessionAttributes.correctAnswer = "";
        } else {
            sessionAttributes.whichQuestion++;
            sessionAttributes.correctAnswer = responseObject.correctAnswer;
        }
        


        cleanUpAfterResponse({responseObject:responseObject,
            attributesManager:attributesManager,
            sessionAttributes:sessionAttributes,
            s3Attributes:s3Attributes
        });      

        sessionAttributes.lastSpeech = responseObject.audioObject.reprompt;

        // push out response
        
        fillResponseBuilder({responseObject:responseObject,responseBuilder:handlerInput.responseBuilder});
        
        return handlerInput.responseBuilder
            .getResponse();
    }
};

const YesNoIntentHandler = {
    canHandle(handlerInput) {
        return (handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && (sessionAttributes.yesNo !== ""));
    },
    async handle(handlerInput) {
        
        logIt({
            intentItem:{logMessage:'in YesNoIntentHandler and intent object is ',logItem:handlerInput.requestEnvelope.request.intent},
            secondItem:{logMessage:'in YesNoIntentHandler and sessionAttributes are ',logItem:sessionAttributes},
            thirdItem:{logMessage:'in YesNoIntentHandler and requestEnvelope is ',logItem:handlerInput.requestEnvelope}
        });

        
        var responseObject = {};
        var inputObject = {};
        var attributesManager = handlerInput.attributesManager;
        
        inputObject.yesNoTopic = sessionAttributes.yesNo;
        

        if (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.YesIntent' ) {
            inputObject.yesNoAnswer = "yes";
            if (inputObject.yesNoTopic === "play again") {
                var resetObject = sessionAttributes;
                resetObject.whichKind = "reset";
                sessionAttributes = setSessionAttributes(resetObject);
                inputObject.currentQuestionSet = sessionAttributes.currentQuestionSet;
                inputObject.whichQuestion = sessionAttributes.whichQuestion;
                inputObject.randomQuestionOrderList = sessionAttributes.randomQuestionOrderList;
                s3Attributes.randomQuestionOrderList = sessionAttributes.randomQuestionOrderList;
                s3Attributes.currentQuestionSet = sessionAttributes.currentQuestionSet;
            }
            
            inputObject.append = sessionAttributes.lastSpeech;
            sessionAttributes.yesNo = "";
            sessionAttributes.lastReprompt = "";
        } else {
            if (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.NoIntent' ) {
                inputObject.yesNoAnswer = "no"
                inputObject.append = sessionAttributes.lastSpeech;
                sessionAttributes.yesNo = "";
                sessionAttributes.lastReprompt = "";
            } else {
                inputObject.yesNoAnswer = "neither"
                inputObject.append = sessionAttributes.lastSpeech;
            }
        }

        // set attributes
        
        inputObject.supportsAPL = sessionAttributes.supportsAPL;
    
        // set input object


        responseObject = makeResponseObject({response:"yesNo", responseInput:inputObject});
        
        if (responseObject.correctAnswer) {
            sessionAttributes.correctAnswer = responseObject.correctAnswer;
        }

        cleanUpAfterResponse({responseObject:responseObject,
                                attributesManager:attributesManager,
                                sessionAttributes:sessionAttributes,
                                s3Attributes:s3Attributes
        });
        // push out response

        fillResponseBuilder({responseObject:responseObject,responseBuilder:handlerInput.responseBuilder});
        
        return handlerInput.responseBuilder
            .getResponse();

    }
};

const RepeatIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.RepeatIntent';
    },
    async handle(handlerInput) {
        
        logIt({
            intentItem:{logMessage:'in repeat handler and intent object is ',logItem:handlerInput.requestEnvelope.request.intent},
        });

        const speechText = sessionAttributes.lastSpeech;
        
        return handlerInput.responseBuilder
            .speak(`Sure. ${speechText}`)
            .reprompt(speechText)
            .getResponse();

    }
};

const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.CancelIntent'
                || handlerInput.requestEnvelope.request.intent.name === 'AMAZON.StopIntent'
                || handlerInput.requestEnvelope.request.intent.name === 'AMAZON.NavigateHomeIntent');
    },
    async handle(handlerInput) {
        
        logIt({
            intentItem:{logMessage:'in CancelAndStopIntentHandler handler and intent object is ',logItem:handlerInput.requestEnvelope.request.intent},
        });
        
        const speechText = 'Goodbye!';
        return handlerInput.responseBuilder
            .speak(speechText)
            .withShouldEndSession(true)
            .getResponse();
    }
};

const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
    },
    async handle(handlerInput) {
        // Any cleanup logic goes here.
        
        var attributesManager = handlerInput.attributesManager;
        
        attributesManager.setPersistentAttributes(s3Attributes);
        
        await attributesManager.savePersistentAttributes();

        logIt({
            firstItem:{logMessage:'in session ended handler and requestEnvelope is ',logItem:handlerInput.requestEnvelope},
            secondItem:{logMessage:'in session ended handler and s3Attributes is ',logItem:s3Attributes}
        });
        
        return handlerInput.responseBuilder.getResponse();
    }
};

// The intent reflector is used for interaction model testing and debugging.
// It will simply repeat the intent the user said. You can create custom handlers
// for your intents by defining them above, then also adding them to the request
// handler chain below.

const IntentReflectorHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest';
    },
    handle(handlerInput) {
        
        logIt({
            intentItem:{logMessage:'in reflector handler and intent object is ',logItem:handlerInput.requestEnvelope.request.intent},
        });
        
        const intentName = handlerInput.requestEnvelope.request.intent.name;
        const speechText = `You just triggered ${intentName}`;

        return handlerInput.responseBuilder
            .speak(speechText)
            //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
            .getResponse();
    }
};

const FallbackIntentHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput) {
        
        logIt({
            firstItem:{logMessage:'in fallback handler and handler input is ',logItem:handlerInput},
            secondItem:{logMessage:'in fallback handler and requestEnvelope is ',logItem:handlerInput.requestEnvelope},
            thirdItem:{logMessage:'in fallback handler and intent is ',logItem:handlerInput.requestEnvelope.request.intent}
        });
        
        var speech = {text:"", reprompt:""};
        
        logIt({
            firstItem:{logMessage:'in fallback intent handler and handler input envelope is: ',logItem:handlerInput.requestEnvelope},
            secondItem:{logMessage:'in fallback intent handler and sessionAttributes.lastSpeech  ',logItem:sessionAttributes.lastSpeech},
        });
        
        speech.text = "I couldn't figure out what you wanted me to do. Let's try this again: " + sessionAttributes.lastSpeech;
        speech.reprompt = sessionAttributes.lastSpeech;

        return handlerInput.responseBuilder
            .speak(speech.text)
            .reprompt(speech.reprompt)
            .getResponse();
    }
};

// Generic error handling to capture any syntax or routing errors. If you receive an error
// stating the request handler chain is not found, you have not implemented a handler for
// the intent being invoked or included it in the skill builder below.

const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        
        const speechText = 'An error has been encountered';

        logIt({
            firstItem:{logMessage:'The ' + handlerInput.requestEnvelope + ' handler had the error: ',logItem:error.message},
           // firstItem:{logMessage:'The ' + handlerInput.requestEnvelope.request.intent.name + ' handler had the error: ',logItem:error.message},
           // secondItem:{logMessage:'The error request envelope is  ',logItem:handlerInput.requestEnvelope},
        });

        return handlerInput.responseBuilder
            .speak(speechText)
            .reprompt(speechText)
            .getResponse();
    }
};

// This handler acts as the entry point for your skill, routing all request and response
// payloads to the handlers above. Make sure any new handlers or interceptors you've
// defined are included below. The order matters - they're processed top to bottom.
exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        YesNoIntentHandler,
        HelpIntentHandler,
        RepeatIntentHandler,
        CancelAndStopIntentHandler,
        AnswerIntentHandler,
        SessionEndedRequestHandler,
        FallbackIntentHandler,
        IntentReflectorHandler,
    ) // make sure IntentReflectorHandler is last so it doesn't override your custom intent handlers
    .withPersistenceAdapter( new persistenceAdapter.S3PersistenceAdapter({bucketName: 'newquiztemplate'}))
    .addErrorHandlers(ErrorHandler)
    .lambda();
