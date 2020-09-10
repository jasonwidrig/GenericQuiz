const QsAndAs = require('./QsAndAs.js').QsAndAs;
const text = require('./text.js').text;
const sfx = require('./sfx.js').sfx;

const loggingEnabled = require('./metaData.js').metaData.loggingEnabled;
const numberOfQuestions = require('./metaData.js').metaData.gameLength;

const AWS = require('aws-sdk');
const s3SigV4Client = new AWS.S3({
    signatureVersion: 'v4'
});

class basicAPLVideo {
    constructor() {
        this.type = "APL",
        this.version = "1.4",
        this.settings = {},
        this.theme = "dark",
        this.import =  [
            {
                name: "alexa-layouts",
                version: "1.0.0"
            }
        ],
        this.mainTemplate = {
            parameters: [
                "payload"
            ],
            items: [
                {
                    type: "Container",
                    height: "100vh",
                    width: "100vw",
                    items: [
                        {
                            type: "Image",
                            source: "",
                            scale: "bestfill",
                            position: "absolute",
                            width: "100vw",
                            height: "100vh"
                        }
                    ]
                }
            ]
        }
    }
}

class basicAPLASequence {
    constructor() {
        this.type = "APLA",
        this.version = "0.8",
        this.description = "This is the minimal APL A document for an arbitrary audio sequence consisting of multiple clips",
        this.mainTemplate = {
            parameters: [
                "payload"
            ],
            item: {
                type: "Sequencer",
                description: "The Sequencer component plays a series of audio clips one after another.",
                items: []
            }
        };
    }
}

class oneClipWithOneSFXAndOneDelay {
    constructor(clipInfo) {
        this.type = "Mixer",
        this.description = "One TTS mixed with one SFX and an adjustable default delay of the SFX of 2000ms",
        this.items = [
            {
                type:"Sequencer",
                description:"These are the sfx for one clip",
                items:[
                    {
                        type:"Silence",
                        duration:2000
                        
                    },
                    {
                        type:"Audio",
                        source:clipInfo.soundEffect
                    }
                ]
            },
            {
                type:"Speech",
                description:"speech volume is turned up because it gets quiet when mixed with SFX",
                content:clipInfo.text,
                filter: [
                        {
                            "type":"Volume",
                            "amount": 2.5
                        }
                ]

            }
        ];
    }
}

class oneClipWithNoSFX {
    constructor(clipInfo) {
        this.type = "Speech",
        this.description = "One TTS with no SFX",
        this.content = clipInfo;
    }
}

//
// export functions
//
function logIt(inputObject) {

    if (loggingEnabled) {
        var x
        for (x in inputObject) {
            console.log("LOG IT says " + inputObject[x].logMessage, inputObject[x].logItem)
        } 
    }
}

function isEmpty(obj) {
    for(var key in obj) {
        if(obj.hasOwnProperty(key))
            return false;
    }
    return true;
}

function makeResponseObject(inputObject) {

    logIt({
        firstItem:{logMessage:'in make response and inputObject is ',logItem:inputObject}
    });
    
    var outputObject = {};
    
    var whichResponse = inputObject.response;
    var responseInput = inputObject.responseInput;

    switch (whichResponse) {
        case 'launch':
            outputObject = makeLaunchResponse(responseInput);
            break;
        case 'answer':
            outputObject = makeAnswerResponse(responseInput);
            break;
        case 'help':
            outputObject = makeHelpResponse(responseInput);
            break;
        case 'yesNo':
            outputObject = makeYesNoResponse(responseInput);
            break;
        default:
            outputObject = "no audio object";
    }
    logIt({
        firstItem:{logMessage:'in make response and outputobject is ',logItem:outputObject}
    });

    return outputObject;
}

function fillResponseBuilder (inputObject) {
    
    logIt({
        firstItem:{logMessage:'in fillResponseBuilder and inputObject is',logItem:inputObject},
    });

    var responseBuilder = inputObject.responseBuilder;
    
    var videoObject = inputObject.responseObject.videoObject;
    var audioObject = inputObject.responseObject.audioObject;
    var cardObject = inputObject.responseObject.cardObject;

    if (videoObject !== 'no video object') {
        // https://cloudconvert.com/
        responseBuilder
            .addDirective({
                type: 'Alexa.Presentation.APL.RenderDocument',
                version: '1.0',
                document: videoObject.document,
                datasources: videoObject.datasources
            });    
    }
    
    if (audioObject !== 'no audio object') {
        if (audioObject.document) { // if it's APL-A
            responseBuilder
                .addDirective({
                    "type": "Alexa.Presentation.APLA.RenderDocument",
                    "token": "launch_a",
                    "document": audioObject.document,
                    "datasources": audioObject.datasources
                })
                .reprompt(audioObject.reprompt)
                .getResponse();

        } else {
            logIt({
                firstItem:{logMessage:'in fillResponseBuilder and finished is ',logItem:inputObject.responseObject.finished},
            });
            if (inputObject.responseObject.finished === true) {
                responseBuilder
                    .speak(audioObject.text)
                    .withShouldEndSession(true)
            } else {
                responseBuilder
                    .speak(audioObject.text)
                    .reprompt(audioObject.reprompt)
            }
        }
    }
    
    if (cardObject !== 'no card object') {
        responseBuilder
            .withStandardCard(cardObject.title, cardObject.content, cardObject.smallUrl, cardObject.largeUrl  )
    }
    
    logIt({
        firstItem:{logMessage:'in fillResponseBuilder and responseBuilder is',logItem:responseBuilder},
    });


}

async function cleanUpAfterResponse(inputObject) {
    
    logIt({
        firstItem:{logMessage:'in cleanUpAfterResponse and inputObject is ',logItem:inputObject}
    });
    
    var outputObject;
    
    var responseObject = inputObject.responseObject;
    
    var attributesManager = inputObject.attributesManager;
    
    var sessionAttributes = inputObject.sessionAttributes;
    
    var s3Attributes = inputObject.s3Attributes;
    
    attributesManager.setSessionAttributes(sessionAttributes);
    
    attributesManager.setPersistentAttributes(s3Attributes);
    
    await attributesManager.savePersistentAttributes();

    logIt({
        firstItem:{logMessage:'in cleanUpAfterResponse and outputObject is ',logItem:outputObject}
    });    
    
    return outputObject;
}

function setSessionAttributes(inputObject) {
    
    logIt({firstItem:{logMessage:'Entering setSessionAttributes with inputObject ',logItem:inputObject}});
    
    var outputObject = {};
    
    switch (inputObject.whichKind) {
        case 'reset':
            outputObject = inputObject;
            
            outputObject.numberCorrect = 0;

            var nextQuestionSet = (inputObject.currentQuestionSet + 1);
            
            if (((nextQuestionSet + 1)  * numberOfQuestions) > QsAndAs.length) {
                // need to reset the list
                outputObject.currentQuestionSet = 0;
                outputObject.whichQuestion = 0;
                outputObject.randomQuestionOrderList = makeRandomQuestionOrderList(QsAndAs.length);
            } else {
                outputObject.currentQuestionSet = nextQuestionSet;
                outputObject.whichQuestion = (nextQuestionSet * numberOfQuestions); 
                outputObject.randomQuestionOrderList = inputObject.randomQuestionOrderList;
            }    

            break;
        case 'initialize':
            //outputObject = inputObject;
        
            outputObject.numberCorrect = 0;
            
            outputObject.supportsAPL = supportsAPL(inputObject.handlerInput); 
            
            var nextQuestionSet2 = (inputObject.currentQuestionSet + 1);

            if (((nextQuestionSet2 + 1)  * numberOfQuestions) > QsAndAs.length) {
                // need to reset the list
                outputObject.currentQuestionSet = 0;
                outputObject.randomQuestionOrderList =  makeRandomQuestionOrderList(QsAndAs.length);
                outputObject.whichQuestion = 0;
            } else {
                if (inputObject.beenHereTimes > 0) {
                    outputObject.currentQuestionSet = nextQuestionSet2;
                    outputObject.whichQuestion = (nextQuestionSet2 * numberOfQuestions); 
                } else {
                    outputObject.whichQuestion = 0; 
                    outputObject.currentQuestionSet = 0;
                }
                outputObject.randomQuestionOrderList = inputObject.randomQuestionOrderList;
            }
            outputObject.yesNo = '';
            outputObject.lastReprompt = "";
            outputObject.lastSpeech = "";
            break;
        default:
            outputObject = "failed to set sessionAttributes";
    }
    
    logIt({firstItem:{logMessage:'Exiting setSessionAttributes with outputObject ',logItem:outputObject}});

    return outputObject;

}

function fillEmptyS3Object(inputObject) {
    var outputObject = {};
    
    outputObject.randomQuestionOrderList = makeRandomQuestionOrderList(QsAndAs.length);
    
    outputObject.currentQuestionSet = 0;
    
    outputObject.beenHereTimes = 0;
    
    return outputObject;
}

// 
// internal functions
//

function supportsAPL(handlerInput) {
  const supportedInterfaces = handlerInput.requestEnvelope.context.System.device.supportedInterfaces;
  const aplInterface = supportedInterfaces['Alexa.Presentation.APL'];
  return (aplInterface !== null) && (aplInterface !== undefined);
}


function getAPLURL(fileName) {
    
    // change this function when we host things in a different spot
    
    fileName = "Media/" + fileName;

    const bucketName = 'statecapitalquiz'; 
   
    const s3PreSignedUrl = s3SigV4Client.getSignedUrl('getObject', {
        Bucket: bucketName,
        Key: fileName,
        Expires: 60*1 // the Expires is capped for 1 minute
    });
    
    return s3PreSignedUrl;

}

function makeRandomQuestionOrderList(inputListSize) {
    
    // this function picks outputListSize non repeating numbers from 0 to inputListSize - 1
    // and outputs them in an array 
    
    var i;
    
    var randomI;
    
    var outputObject = [];
    

    for (i=0; i<inputListSize; i++) {
        
        do {
            randomI = Math.floor(Math.random() * inputListSize);
        } while (outputObject.indexOf(randomI)>-1);
        
        outputObject.push(randomI);
        
    }

    return outputObject;

}

function makeLaunchResponse(inputObject) {
    var outputObject = {};
    
     logIt({
        firstItem:{logMessage:'in makeLaunchResponse and inputObject is ',logItem:inputObject}
    });
    
    if ((Math.random() * 2) <1) {
        inputObject.questionType = 'reverse';
    } else {
        inputObject.questionType = 'normal';
    }

    outputObject.audioObject = makeLaunchAudio(inputObject);
    outputObject.videoObject = makeLaunchVideo(inputObject);
    outputObject.cardObject = "no card object";
    if (inputObject.questionType === "normal" ) {
        outputObject.correctAnswer = QsAndAs[inputObject.randomQuestionOrderList[inputObject.whichQuestion]].answer[0];
    } else {
        outputObject.correctAnswer = QsAndAs[inputObject.randomQuestionOrderList[inputObject.whichQuestion]].question;
    }
    
     logIt({
        firstItem:{logMessage:'in makeLaunchResponse and outputObject is ',logItem:outputObject}
    });
    
    return outputObject;
}

function makeHelpResponse(inputObject) {
    var outputObject = {};
    
     logIt({
        firstItem:{logMessage:'in makeHelpResponse and inputObject is ',logItem:inputObject}
    });

    outputObject.audioObject = makeHelpAudio(inputObject);
    outputObject.videoObject = "no video object"
    outputObject.cardObject = "no card object";

     logIt({
        firstItem:{logMessage:'in makeHelpResponse and outputObject is ',logItem:outputObject}
    });
    
    return outputObject;
}

function makeAnswerResponse(inputObject) {
    var outputObject = {};
    
     logIt({
        firstItem:{logMessage:'in makeAnswerResponse and inputObject is ',logItem:inputObject}
    });
    
    if ((Math.random() * 2) <1) {
        inputObject.questionType = 'reverse';
    } else {
        inputObject.questionType = 'normal';
    }

    outputObject.audioObject = makeAnswerAudio(inputObject);
    outputObject.videoObject = makeAnswerVideo(inputObject);
    outputObject.cardObject = "no card object";
    
    inputObject.whichQuestion++;
    
    if (inputObject.whichQuestion<((inputObject.currentQuestionSet + 1) * numberOfQuestions)) {
        if (inputObject.questionType === "normal" ) {
            outputObject.correctAnswer = QsAndAs[inputObject.randomQuestionOrderList[inputObject.whichQuestion]].answer[0];
        } else {
            outputObject.correctAnswer = QsAndAs[inputObject.randomQuestionOrderList[inputObject.whichQuestion]].question;
        }
    } else {
        outputObject.finished = true;
    }
    
     logIt({
        firstItem:{logMessage:'in makeAnswerResponse and outputObject is ',logItem:outputObject}
    });
    
    return outputObject;
}

function makeYesNoResponse(inputObject) {

    var outputObject = {};
    
    logIt({
       firstItem:{logMessage:'in makeYesNoResponse and inputObject is ',logItem:inputObject}
   });

       
    var answer = inputObject.yesNoAnswer;
    var topic = inputObject.yesNoTopic;
    
    var videoObject = "no video object";
   
    switch (topic) {
        case 'keep playing':
            if (answer === "no") {
                // do some no business
                outputObject.finished = true;
            } 
            break;
        case 'play again':
            if (answer === "yes") {
                //do some yes business
                var currentQuestionSet = inputObject.currentQuestionSet;
                if ((Math.random() * 2) <1) {
                    inputObject.questionType = 'reverse';
                } else {
                    inputObject.questionType = 'normal';
                }
                if (((currentQuestionSet + 1) * numberOfQuestions) > QsAndAs.length) {
                // need to reset the list
                    outputObject.currentQuestionSet = 0;
                    outputObject.randomQuestionOrderList = makeRandomQuestionOrderList(QsAndAs.length);
                    inputObject.whichQuestion = 0;
                } else {
                    inputObject.whichQuestion = (currentQuestionSet * numberOfQuestions); 
                }
                if (inputObject.questionType === "normal" ) {
                    outputObject.correctAnswer = QsAndAs[inputObject.randomQuestionOrderList[ inputObject.whichQuestion]].answer[0];
                } else {
                    outputObject.correctAnswer = QsAndAs[inputObject.randomQuestionOrderList[ inputObject.whichQuestion]].question;
                }
                videoObject = makeYesNoVideo(inputObject);
            } else {
                if (answer === "no") {
                    // do some no business
                    outputObject.finished = true;
                }
            }
            break;
        default:
            outputObject = "no audio object";
    }
    
    outputObject.audioObject = makeYesNoAudio(inputObject);
    outputObject.videoObject = videoObject;
    outputObject.cardObject = "no card object";

   
    logIt({
       firstItem:{logMessage:'in makeYesNoResponse and outputObject is ',logItem:outputObject}
   });
   
   return outputObject;

}

//
// audio functions
//

function fillAPLASequencerArray(inputObject) {
    
    var thisClip;
    var outputObject;
    
    logIt({firstItem:{logMessage:'in fillAPLASequencerArray and inputObject.sourceArray is ',logItem:inputObject.sourceArray}});

    var sourceArray = inputObject.sourceArray;
    var APLAtype = inputObject.APLAtype;
    
    if (APLAtype === 'basic sequence' ) {
        outputObject = new basicAPLASequence();
        for (var whichClip = 0; whichClip < sourceArray.length; whichClip++) {
                logIt({firstItem:{logMessage:'in fillAPLASequencerArray and sourceArray[whichClip] is ',logItem:sourceArray[whichClip]}});

            if (sourceArray[whichClip].soundEffect) {
                thisClip = new oneClipWithOneSFXAndOneDelay(sourceArray[whichClip]);
                if (sourceArray[whichClip].delay) thisClip.items[0].items[0].duration = sourceArray[whichClip].delay;
            } else {
                thisClip = new oneClipWithNoSFX(sourceArray[whichClip]);
            }
            outputObject.mainTemplate.item.items.push(thisClip);
        }    
    }

    return outputObject;
}

function makeLaunchAudio(inputObject) {

    logIt({firstItem:{logMessage:'Calling makeLaunchAudio with inputObject ',logItem:inputObject}});

    var outputObject = {document:{},reprompt:""};
    
    var APLAssetsArray = [];
    
    // do intro bit
    
    var whichTone = sfx.launchTones[Math.floor(Math.random() * sfx.launchTones.length)];
    
    var whichIntro;
    
    if (inputObject.beenHereTimes === 0) {
        whichIntro = text.intro;
    } else {
        whichIntro = text.welcome1[Math.floor(Math.random() * text.welcome1.length)] + text.welcome2[Math.floor(Math.random() * text.welcome1.length)];    
    }
    var launchAudioObject = {text:whichIntro, soundEffect:whichTone,delay:1};
    
    APLAssetsArray.push(launchAudioObject);
    
    // do first question bit

    var QandAObject = QsAndAs[inputObject.randomQuestionOrderList[inputObject.whichQuestion]];
    
    logIt({
        firstItem:{logMessage:'in makeLaunchAudio with QsAndAs ',logItem:QsAndAs},
        secondItem:{logMessage:'in makeLaunchAudio with QandAObject ',logItem:QandAObject}
        
    });

    
    QandAObject.questionType = inputObject.questionType;
    
    var firstQuestionAudio = makeQuestionAudio(QandAObject);
    
    APLAssetsArray.push(firstQuestionAudio.text);
    
    // add it to APLA and set reprompt
    
    outputObject.document = fillAPLASequencerArray({APLAtype:'basic sequence', sourceArray:APLAssetsArray});
    
    outputObject.reprompt = firstQuestionAudio.reprompt;
    
    logIt({firstItem:{logMessage:'Leaving makeLaunchAudio with outputObject ',logItem:outputObject}});

    return outputObject;
}

function makeYesNoAudio(inputObject) {

    logIt({firstItem:{logMessage:'Calling makeYesNoAudio with inputObject ',logItem:inputObject}});

    var outputObject = {text:"",reprompt:""};
    var answer = inputObject.yesNoAnswer;
    var topic = inputObject.yesNoTopic;
    var append = inputObject.append;
    
    if (answer === "neither") {
        outputObject.text = text.dontUnderstand + append;
        outputObject.reprompt = append;
        return outputObject;
    }

    switch (topic) {
        case 'keep playing':
            if (answer === "yes") {
                //do some yes business
                outputObject.text = text.keepPlayingYes + append;
                outputObject.reprompt = append;
            } else {
                // do some no business
                outputObject.text = text.keepPlayingNo;
            }
            break;
        case 'play again':
            if (answer === "yes") {
                //do some yes business
                var QandAObject = QsAndAs[inputObject.randomQuestionOrderList[inputObject.whichQuestion]];
                QandAObject.questionType = inputObject.questionType;
                append = makeQuestionAudio(QandAObject);
                outputObject.text = text.playAgainYes + append.text;
                outputObject.reprompt = append.reprompt;
            } else {
                // do some no business
                outputObject.text = text.keepPlayingNo;
            }
            break;
        case 'swear and quit':
            if (answer === "yes") {
                outputObject.text = text.swearingYes;
            } else {
                outputObject.text = text.swearingNo + append;
                outputObject.reprompt = append;
            };
            break;
        default:
            outputObject = "no audio object";
    }
    
    logIt({firstItem:{logMessage:'Leaving makeYesNoAudio with outputObject ',logItem:outputObject}});

    return outputObject;
}

function makeQuestionAudio(inputObject) {

    logIt({
        firstItem:{logMessage:'Calling makeQuestionAudio with inputObject ',logItem:inputObject},
    });
    

    var outputObject = {text:"",reprompt:""};
    var postfix = "";
    
    if (inputObject.questionType === "normal") { // what's the capital city of the state
        var whichState = inputObject.question;
        if ((Math.random() * 2) > 1) { //question
            postfix = "? ";
            if ((Math.random() * 2) > 1) { // short
                 outputObject.text = text.questionShort[ Math.floor(Math.random() * text.questionShort.length)];
            } else { // long
                 outputObject.text = text.questionLong[ Math.floor(Math.random() * text.questionLong.length)] + inputObject.prefix;
            }
        } else { // direction
            postfix = ". ";
            if ((Math.random() * 2) > 1) { // short
                 outputObject.text = text.directionShort[ Math.floor(Math.random() * text.directionShort.length)];
            } else { // long
                 outputObject.text = text.directionLong[ Math.floor(Math.random() * text.directionLong.length)] + inputObject.prefix;
            }
        }
        outputObject.text = outputObject.text + whichState + postfix;
    } else {// what's the state with this capital
        var whichCapital = inputObject.answer[0];
        if ((Math.random() * 2) > 1) { //question
            postfix = "? ";
            outputObject.text = text.reverseQuestion[ Math.floor(Math.random() * text.reverseQuestion.length)];
        } else { // direction
            postfix = ". ";
            outputObject.text = text.reverseDirection[ Math.floor(Math.random() * text.reverseDirection.length)];
        }
        outputObject.text = outputObject.text + whichCapital + postfix;
    }
    outputObject.reprompt = outputObject.text;

    logIt({firstItem:{logMessage:'Leaving makeQuestionAudio with outputObject ',logItem:outputObject}});

    return outputObject;
}

function makeHelpAudio(inputObject) {

    logIt({
        firstItem:{logMessage:'Calling makeHelpAudio with inputObject ',logItem:inputObject},
    });
    
    var outputObject = {text:"",reprompt:""};
    var randomQuestion = QsAndAs[Math.floor(Math.random() * QsAndAs.length)];
    var randomQuestion2 = QsAndAs[Math.floor(Math.random() * QsAndAs.length)];
    
    outputObject.text = text.help[0] + randomQuestion.question + text.help[1] + randomQuestion.answer[0] + 
                        text.help[2] + randomQuestion2.answer[0] + text.help[3] + randomQuestion2.question +
                        text.help[4];
    outputObject.reprompt = text.helpReprompt;

    return outputObject;
}

function makeAnswerAudio(inputObject) {
    
    logIt({
        firstItem:{logMessage:'Calling makeAnswerAudio with inputObject ',logItem:inputObject},
    });
    
    var outputObject = {document:{},reprompt:""};
    
    var APLAssetsArray = [];

    var textObject = "";
    
    var answerType = inputObject.answerType;
    
    var whichQuestion = inputObject.whichQuestion;
    
    var currentQuestion = QsAndAs[inputObject.randomQuestionOrderList[whichQuestion]];
    
    logIt({
        firstItem:{logMessage:'in makeAnswerAudio with currentQuestion ',logItem:currentQuestion},
    });

    var rightAnswer = currentQuestion.answer[0];
    var rightState = currentQuestion.question;
    var soundEffect = "";
    
    var rightPrefix;
    var rightAnswer1;

    if ((Math.random() * 2) < 1) { //long
        rightPrefix = currentQuestion.prefix ;
        rightAnswer1 = text.rightAnswerLong1[Math.floor(Math.random() * text.rightAnswerLong1.length)];
    } else {
        rightPrefix = "";
        rightAnswer1 = text.rightAnswerShort1[Math.floor(Math.random() * text.rightAnswerShort1.length)];
    }

    if (answerType === "correct") { 
        textObject = text.correctAnswer[Math.floor(Math.random() * text.correctAnswer.length)] + rightAnswer1 + rightPrefix + rightState;
        textObject = textObject + '<prosody volume="loud">' + text.rightAnswer2 +  '</prosody>';
        textObject = textObject + rightAnswer + ". ";
        soundEffect = sfx.rightSounds[Math.floor(Math.random() * sfx.rightSounds.length)];
    } else {
        textObject = inputObject.incorrectAnswer + text.incorrectAnswer[Math.floor(Math.random() * text.incorrectAnswer.length)] + rightAnswer1 + rightPrefix + rightState + text.rightAnswer2 + rightAnswer + ". ";
        soundEffect = sfx.wrongSounds[Math.floor(Math.random() * sfx.wrongSounds.length)];
    }
    
    APLAssetsArray.push({text:textObject, soundEffect:soundEffect, delay:1});

    whichQuestion++;
    
    var append;

    if (whichQuestion < ((inputObject.currentQuestionSet + 1) * numberOfQuestions)) {
        var QandAObject = QsAndAs[inputObject.randomQuestionOrderList[whichQuestion]];
        QandAObject.questionType = inputObject.questionType;
        append = makeQuestionAudio(QandAObject);
    } else {
        append = makeFinishedAudio(inputObject);
    }
    
    APLAssetsArray.push(append.text);
    
    outputObject.document = fillAPLASequencerArray({APLAtype:'basic sequence', sourceArray:APLAssetsArray});

    outputObject.reprompt = append.reprompt;

    logIt({firstItem:{logMessage:'Leaving makeAnswerAudio with outputObject ',logItem:outputObject}});

    return outputObject;
}

function makeFinishedAudio(inputObject) {
    
    logIt({
        firstItem:{logMessage:'Calling makeFinishedAudio with inputObject ',logItem:inputObject},
    });
    
    var outputObject = {};
    
    outputObject.text = text.finished1[ Math.floor(Math.random() * text.finished1.length)] + inputObject.numberCorrect + text.finished2[ Math.floor(Math.random() * text.finished2.length)] + text.finished3[ Math.floor(Math.random() * text.finished3.length)];
    outputObject.reprompt = text.finished3[ Math.floor(Math.random() * text.finished3.length)];

    logIt({firstItem:{logMessage:'Leaving makeFinishedAudio with outputObject ',logItem:outputObject}});

    return outputObject;
}

//
// video functions
//

function makeLaunchVideo(inputObject) {
    
    logIt({
        firstItem:{logMessage:'Calling makeLaunchVideo with inputObject ',logItem:inputObject},
    });
    
    var outputObject;

    if (inputObject.supportsAPL === true) {
        outputObject = {};
        outputObject.document = new basicAPLVideo();
    
        
        var prefix = "";
        if (inputObject.questionType === "normal") {
            prefix = "flags/";
        } else {
            prefix = "capitols/";
        }
    
        var whichOne = Math.floor(Math.random() * QsAndAs[inputObject.randomQuestionOrderList[inputObject.whichQuestion]].digraph.length);
        var imageURL = getAPLURL(prefix + QsAndAs[inputObject.randomQuestionOrderList[inputObject.whichQuestion]].digraph[whichOne] + ".jpg");
    
        outputObject.document.mainTemplate.items[0].items[0].source = imageURL;
    } else {
        outputObject = "no video object";
    }

    logIt({
        firstItem:{logMessage:'Leaving makeLaunchVideo with imageURL ',logItem:imageURL},
    });

    return outputObject;
}

function makeAnswerVideo(inputObject) {

    var outputObject;
    
    if (inputObject.supportsAPL === true){
        outputObject = {};

        outputObject.document = new basicAPLVideo();
    
        logIt({
            firstItem:{logMessage:'Calling makeAnswerVideo with inputObject ',logItem:inputObject},
        });
        
        var whichQuestion = (inputObject.whichQuestion + 1);
        
        var imageURL;
    
        if (whichQuestion < ((inputObject.currentQuestionSet + 1) * numberOfQuestions)) {
            var prefix = "";
            if (inputObject.questionType === "normal") {
                prefix = "flags/";
            } else {
                prefix = "capitols/";
            }
            var whichOne = Math.floor(Math.random() * QsAndAs[inputObject.randomQuestionOrderList[whichQuestion]].digraph.length)
            imageURL = getAPLURL(prefix + QsAndAs[inputObject.randomQuestionOrderList[whichQuestion]].digraph[whichOne] + ".jpg");
        } else {
            imageURL = getAPLURL("USA.jpg");
        }
        
        outputObject.document.mainTemplate.items[0].items[0].source = imageURL;
    } else {
        outputObject = "no video object";    
    }

    logIt({
        firstItem:{logMessage:'Leaving makeAnswerVideo with outputObject ',logItem:outputObject},
    });

    return outputObject;
}

function makeYesNoVideo(inputObject) {
    
    logIt({
        firstItem:{logMessage:'Calling makeYesNoVideo with inputObject ',logItem:inputObject},
    });

    var outputObject;
    
    if (inputObject.supportsAPL === true){
        outputObject = {};

        outputObject.document = new basicAPLVideo();
    
        var whichQuestion = inputObject.whichQuestion;
        
        var imageURL;
    
        var prefix = "";
        if (inputObject.questionType === "normal") {
            prefix = "flags/";
        } else {
            prefix = "capitols/";
        }
    
        var whichOne = Math.floor(Math.random() * QsAndAs[inputObject.randomQuestionOrderList[whichQuestion]].digraph.length);
        imageURL = getAPLURL(prefix + QsAndAs[inputObject.randomQuestionOrderList[whichQuestion]].digraph[whichOne] + ".jpg");
    
        outputObject.document.mainTemplate.items[0].items[0].source = imageURL;
    } else {
        outputObject = "no video object";    
    }


    logIt({
        firstItem:{logMessage:'Leaving makeYesNoVideo with outputObject ',logItem:outputObject},
    });

    return outputObject;
}


exports.logIt = logIt;
exports.isEmpty = isEmpty;
exports.fillEmptyS3Object = fillEmptyS3Object;
exports.makeResponseObject = makeResponseObject;
exports.fillResponseBuilder = fillResponseBuilder;
exports.cleanUpAfterResponse = cleanUpAfterResponse;
exports.setSessionAttributes = setSessionAttributes;
