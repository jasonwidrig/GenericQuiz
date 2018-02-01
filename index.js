'use strict';

var questions = require('./QsandAs').QsandAs;
const assets = require('./skillSpecificAssets').assets;

exports.handler = function (event, context) {
    try {
      
       
        // Amazon APPID check

        //if (event.session.application.applicationId !== "AMAZON_PPID") {
        //     context.fail("Invalid Application ID");
        //}

        if (event.request.type === "LaunchRequest") {
            onLaunch(event.request,
                event.session,
                function callback(sessionAttributes, speechletResponse) {
                    context.succeed(buildResponse(sessionAttributes, speechletResponse));
                });
        } else if (event.request.type === "IntentRequest") {
            onIntent(event.request,
                event.session,
                function callback(sessionAttributes, speechletResponse) {
                    context.succeed(buildResponse(sessionAttributes, speechletResponse));
                });
        } else if (event.request.type === "SessionEndedRequest") {
            onSessionEnded(event.request, event.session);
            context.succeed();
        }
    } catch (e) {
        context.fail("Exception: " + e);
    }
};


/**
 * Called when the user invokes the skill without specifying what they want.
 */
function onLaunch(launchRequest, session, callback) {
    console.log("onLaunch triggered");
     
    getWelcomeResponse(callback);
}

/**
 * Called when the user specifies an intent for this skill.
 */
function onIntent(intentRequest, session, callback) {
     
    var intent = intentRequest.intent,
        intentName = intentRequest.intent.name;

   console.log("onIntent triggered with intent = " + intentName);
        
    // handle yes/no intent after the user has been prompted
    if (session.attributes && session.attributes.userPromptedToContinue) {
        delete session.attributes.userPromptedToContinue;
        if ("AMAZON.NoIntent" === intentName) {
            handleFinishSessionRequest(intent, session, callback);
        } else if ("AMAZON.YesIntent" === intentName) {
            handleRepeatRequest(intent, session, callback);
        }
    }

    // dispatch custom intents to handlers here
    if ("AnswerIntent" === intentName) {
        handleAnswerRequest(intent, session, callback);
    } else if ("AnswerOnlyIntent" === intentName) {
        handleAnswerRequest(intent, session, callback);
    } else if ("DontKnowIntent" === intentName) {
        handleDontKnowRequest(intent, session, callback);
    } else if ("AMAZON.YesIntent" === intentName) {
        handleAnswerRequest(intent, session, callback);
    } else if ("AMAZON.NoIntent" === intentName) {
        handleAnswerRequest(intent, session, callback);
    } else if ("AMAZON.StartOverIntent" === intentName) {
        getWelcomeResponse(callback);
    } else if ("StartQuizIntent" === intentName) {
        getWelcomeResponse(callback);
    } else if ("AMAZON.RepeatIntent" === intentName) {
        handleRepeatRequest(intent, session, callback);
    } else if ("AMAZON.HelpIntent" === intentName) {
        if (!session.attributes) {
            getWelcomeResponse(callback);
        } else { 
            handleGetHelpRequest(intent, session, callback);
        }
    } else if ("AMAZON.StopIntent" === intentName) {
        handleFinishSessionRequest(intent, session, callback);
    } else if ("AMAZON.CancelIntent" === intentName) {
        handleFinishSessionRequest(intent, session, callback);
    } else {
        throw "Invalid intent";
    }
}

/**
 * Called when the user ends the session.
 * Is not called when the skill returns shouldEndSession=true.
 */
function onSessionEnded(sessionEndedRequest, session) {
    console.log("onSessionEnded requestId=" + sessionEndedRequest.requestId
        + ", sessionId=" + session.sessionId);

    // Add any cleanup logic here
}

// ------- Skill specific business logic -------


function getWelcomeResponse(callback) {
    
    console.log("starting session welcome");
    
     var sessionAttributes = {},
        speechOutput = assets.INTRO_MESSAGE.replace("%s", assets.GAME_LENGTH.toString()),

        shouldEndSession = false,

        gameQuestions = populateGameQuestions(),

        currentQuestionIndex = 0,
        spokenQuestion = Object.keys(questions[gameQuestions[currentQuestionIndex]]),
        repromptText = spokenQuestion.toString();

    speechOutput += repromptText;
    sessionAttributes = {
        "speechOutput": repromptText,
        "repromptText": repromptText,
        "currentQuestionIndex": currentQuestionIndex,
        "correctAnswerIndex": 0,
        "questions": gameQuestions,
        "score": 0,
        "correctAnswerText":
            questions[gameQuestions[currentQuestionIndex]][Object.keys(questions[gameQuestions[currentQuestionIndex]])[0]][0]
    };
    callback(sessionAttributes,
        buildSpeechletResponse(speechOutput, repromptText, shouldEndSession));
}

function populateGameQuestions() {
    var gameQuestions = [];
    var indexList = [];
    var index = questions.length;

    if (assets.GAME_LENGTH > index){
        throw "Invalid Game Length.";
    }

    for (var i = 0; i < questions.length; i++){
        indexList.push(i);
    }

    // Pick GAME_LENGTH random questions from the list to ask the user, make sure there are no repeats.
    for (var j = 0; j < assets.GAME_LENGTH; j++){
        var rand = Math.floor(Math.random() * index);
        index -= 1;

        var temp = indexList[index];
        indexList[index] = indexList[rand];
        indexList[rand] = temp;
        gameQuestions.push(indexList[index]);
    }

    return gameQuestions;
}

function populateRoundAnswers(gameQuestionIndexes, correctAnswerIndex, correctAnswerTargetLocation) {

    var answers = questions[gameQuestionIndexes[correctAnswerIndex]][Object.keys(questions[gameQuestionIndexes[correctAnswerIndex]])[0]];

    var index = answers.length;

    if (index < 1){
        throw "Not enough answers for question.";
    }
   
    return answers;
}

function handleAnswerRequest(intent, session, callback) {
    
    // let's handle the weird circumstance where they say "my answer is" and don't provide an answer
    // the empty slot in the value field makes weird things happen when you check for an answer
    
    if (intent.slots.Answer.value) {
        var speechOutput = "";
        var sessionAttributes = {};
        var gameInProgress = session.attributes && session.attributes.questions;
        var answerIsCorrect = isAnswerCorrect(session, intent);

        if (!gameInProgress) {
            // If the user responded with an answer but there is no game in progress, ask the user
            // if they want to start a new game. Set a flag to track that we've prompted the user.
            sessionAttributes.userPromptedToContinue = true;
            speechOutput = assets.NO_GAME_IN_PROGRESS_MESSAGE;
            callback(sessionAttributes, buildSpeechletResponse(speechOutput, speechOutput, false));
        }  else {
            var gameQuestions = session.attributes.questions,

                correctAnswerIndex = parseInt(session.attributes.correctAnswerIndex),
                currentScore = parseInt(session.attributes.score),
                currentQuestionIndex = parseInt(session.attributes.currentQuestionIndex),
                correctAnswerText = session.attributes.correctAnswerText;

            var speechOutputAnalysis = "";

            if (answerIsCorrect) {
                currentScore++;
                speechOutputAnalysis = assets.RIGHT_ANSWER_WORD;
            } else {
                speechOutputAnalysis = assets.WRONG_ANSWER_WORD +  assets.CORRECT_ANSWER_MESSAGE.replace("%s", correctAnswerText);
            }
            if (currentQuestionIndex == assets.GAME_LENGTH - 1) {
                
                speechOutput =  assets.YOUR_ANSWER_MESSAGE.replace("%s", intent.slots.Answer.value);
                speechOutput += speechOutputAnalysis + assets.FINAL_SCORE_PART1_MESSAGE.replace("%s", currentScore.toString()) + assets.FINAL_SCORE_PART2_MESSAGE.replace("%s", assets.GAME_LENGTH.toString());
                callback(session.attributes,
                    buildSpeechletResponse(speechOutput, "", true));
            } else {
                currentQuestionIndex += 1;
                var spokenQuestion = Object.keys(questions[gameQuestions[currentQuestionIndex]]);
           
                var repromptText =  spokenQuestion ;
                
                repromptText +=  "";
                
                speechOutput +=  assets.YOUR_ANSWER_MESSAGE.replace("%s", intent.slots.Answer.value);
                speechOutput += speechOutputAnalysis + assets.YOUR_SCORE_MESSAGE.replace("%s", currentScore.toString()) + repromptText;

                sessionAttributes = {
                    "speechOutput": repromptText,
                    "repromptText": repromptText,
                    "currentQuestionIndex": currentQuestionIndex,
                    "questions": gameQuestions,
                    "score": currentScore,
                    "correctAnswerText":
                        questions[gameQuestions[currentQuestionIndex]][Object.keys(questions[gameQuestions[currentQuestionIndex]])[0]][0]
                };
                callback(sessionAttributes,
                    buildSpeechletResponse(speechOutput, repromptText, false));
            }
        }
    } else {
        console.log("Answer intent triggered but slot has no value");
        handleDontKnowRequest(intent, session,callback);     
    }
}

function handleDontKnowRequest(intent, session, callback) {
    var speechOutput = "";
     var sessionAttributes = {};
     var gameInProgress = session.attributes && session.attributes.questions;
     
     
     
 
     if (!gameInProgress) {
         // If the user responded with an answer but there is no game in progress, ask the user
         // if they want to start a new game. Set a flag to track that we've prompted the user.
         sessionAttributes.userPromptedToContinue = true;
         speechOutput = assets.NO_GAME_IN_PROGRESS_MESSAGE;
         callback(sessionAttributes,
         buildSpeechletResponse(speechOutput, speechOutput, false));
     }  else {

        var gameQuestions = session.attributes.questions,

        correctAnswerIndex = parseInt(session.attributes.correctAnswerIndex),
        currentScore = parseInt(session.attributes.score),
        currentQuestionIndex = parseInt(session.attributes.currentQuestionIndex),
        correctAnswerText = session.attributes.correctAnswerText;
       
         var speechOutputAnalysis = assets.DONT_KNOW_WORD + assets.CORRECT_ANSWER_MESSAGE.replace('%s', correctAnswerText);
 
         // if currentQuestionIndex is 4, we've reached 5 questions (zero-indexed) and can exit the game session
         if (currentQuestionIndex == assets.GAME_LENGTH - 1) {
            
             speechOutput += speechOutputAnalysis + assets.FINAL_SCORE_PART1_MESSAGE.replace('%s', currentScore.toString())  + assets.FINAL_SCORE_PART2_MESSAGE.replace('%s', assets.GAME_LENGTH.toString());
             speechOutput += assets.SIGN_OFF_MESSAGE;
             callback(session.attributes,
                 buildSpeechletResponse(speechOutput, "", true));
         } else {
             currentQuestionIndex += 1;
             var spokenQuestion = Object.keys(questions[gameQuestions[currentQuestionIndex]]);
             // Generate a random index for the correct answer, from 0 to 3
             correctAnswerIndex = Math.floor(Math.random() * (1));
             var roundAnswers = populateRoundAnswers(gameQuestions, currentQuestionIndex, correctAnswerIndex),
 
             questionIndexForSpeech = currentQuestionIndex + 1,
             repromptText =  spokenQuestion.toString() ;
            
             speechOutput += speechOutputAnalysis + assets.YOUR_SCORE_MESSAGE.replace("%s", currentScore.toString()) + repromptText;
 
             sessionAttributes = {
                 "speechOutput": repromptText,
                 "repromptText": repromptText,
                 "currentQuestionIndex": currentQuestionIndex,
                 "correctAnswerIndex": correctAnswerIndex + 1,
                 "questions": gameQuestions,
                 "score": currentScore,
                 "correctAnswerText":
                     questions[gameQuestions[currentQuestionIndex]][Object.keys(questions[gameQuestions[currentQuestionIndex]])[0]][0]
             };
             callback(sessionAttributes,
                 buildSpeechletResponse(speechOutput, repromptText, false));
         }
     }
 }

function handleRepeatRequest(intent, session, callback) {
    // Repeat the previous speechOutput and repromptText from the session attributes if available
    // else start a new game session
    if (!session.attributes || !session.attributes.speechOutput) {
        getWelcomeResponse(callback);
    } else {
        callback(session.attributes,
            buildSpeechletResponseWithoutCard(session.attributes.speechOutput, session.attributes.repromptText, false));
    }
}

function handleGetHelpRequest(intent, session, callback) {
    // Provide a help prompt for the user, explaining how the game is played. Then, continue the game
    // if there is one in progress, or provide the option to start another one.

    // Set a flag to track that we're in the Help state.
    session.attributes.userPromptedToContinue = true;
    
    console.log("help triggered")

    var shouldEndSession = false;
    callback(session.attributes, 
    buildSpeechletResponse(assets.HELP_MESSAGE, assets.HELP_REPROMPT_MESSAGE, shouldEndSession));
}

function handleFinishSessionRequest(intent, session, callback) {
    // End the session with a "Good bye!" if the user wants to quit the game
    callback(session.attributes,
        buildSpeechletResponseWithoutCard(assets.SIGN_OFF_MESSAGE, "", true));
}

function isAnswerSlotValid(intent) {
    var answerSlotFilled = intent.slots && intent.slots.Answer && intent.slots.Answer.value;
    var answerSlotIsInt = answerSlotFilled && !isNaN(parseInt(intent.slots.Answer.value));
    return answerSlotFilled;
}

function isAnswerCorrect(session, intent) {

    var casedAnswerGiven = intent.slots.Answer.value.toUpperCase();
    
    var gameQuestions = session.attributes.questions;
    
    var currentQuestionIndex = parseInt(session.attributes.currentQuestionIndex);
    
    var numberOfAnswers = questions[gameQuestions[currentQuestionIndex]][Object.keys(questions[gameQuestions[currentQuestionIndex]])[0]].length;
  
    var casedPossibleAnswer = "";
  
    var index = 0;

    var answerIsCorrect = false;

    console.log("Answer given is " + casedAnswerGiven);

    while (index<numberOfAnswers) {

        casedPossibleAnswer = questions[gameQuestions[currentQuestionIndex]][Object.keys(questions[gameQuestions[currentQuestionIndex]])[0]][index].toUpperCase();

        if (casedAnswerGiven == casedPossibleAnswer ) {
            answerIsCorrect = true;
            index = numberOfAnswers;
        } else {
            ++index;
        }
    }

 
    
    return answerIsCorrect;
}

function formatTheAnswer(intent) {

   

    var answerIsCorrect = false;

    return answerIsCorrect;
}

// ------- Helper functions to build responses -------


function buildSpeechletResponse(output, repromptText, shouldEndSession) {
    return {
        outputSpeech: {
            type: "PlainText",
            text: output
        },
        card: {
            type: "Simple",
            title: assets.CARD_TITLE,
            content: output
        },
        reprompt: {
            outputSpeech: {
                type: "PlainText",
                text: repromptText
            }
        },
        shouldEndSession: shouldEndSession
    };
}

function buildSpeechletResponseWithoutCard(output, repromptText, shouldEndSession) {
    return {
        outputSpeech: {
            type: "PlainText",
            text: output
        },
        reprompt: {
            outputSpeech: {
                type: "PlainText",
                text: repromptText
            }
        },
        shouldEndSession: shouldEndSession
    };
}

function buildResponse(sessionAttributes, speechletResponse) {
    return {
        version: "1.0",
        sessionAttributes: sessionAttributes,
        response: speechletResponse
    };
}