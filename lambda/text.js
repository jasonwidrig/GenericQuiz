const numberOfQuestions = require('./metaData.js').metaData.gameLength;

const INTRO_TEXT = "Let's learn about state capitals. I will ask you about " + numberOfQuestions.toString() + " states and their capitals. Let's begin. ";
const WELCOME_BACK1_TEXT = ["Welcome back. " ,"Glad to have you back. ", "I'm glad you're back. ", "Thanks for coming back. " ];
const WELCOME_BACK2_TEXT = ["Let's start another quiz! ", "Here's a new quiz for you: ", "Here's another quiz! ", "Let's start a new quiz! "];

const QUESTION_LONG_TEXT  = ["What is the capital of the ",  "What is the capital city of the ", "Where is the capitol of the "];
const DIRECTION_LONG_TEXT  = [ "Name the capital of the ", "Tell me the capital of the "];
const QUESTION_SHORT_TEXT  = ["What is the capital of ", "What is the capital city of ", "Where is the capitol of "];
const DIRECTION_SHORT_TEXT  = [ "Name the capital of ", "Tell me the capital of "];

const REVERSE_QUESTION  = ["What state's capital city is ",  "What state's capital is ", "What state's capitol is in "];
const REVERSE_DIRECTION  = [ "Name the state that's capital is ", "Tell me the state with the capital city of "];

const HELP_TEXT = ["I will ask you about a state and you will respond with the capital city. For example, if I ask about ", 
                    " you would answer " ,
                    ". Also, I may name a capital city and ask you about the state, like I would ask about ",
                    " and you would answer ",
                    ". To repeat the last question, say, repeat. Would you like to keep playing?"];
const HELP_REPROMPT_TEXT = "To give an answer, respond with the name of the capital city for the state or the state for the capital city. Would you like to keep playing?";

const KEEP_PLAYING_NO_TEXT = "Thanks for playing. Goodbye!";
const KEEP_PLAYING_YES_TEXT = "Okay! Let's get back to it! ";

const PLAY_AGAIN_YES_TEXT = "Okay! Here are " + numberOfQuestions.toString() + " more questions about state capitals! ";
const PLAY_AGAIN_NO_TEXT = "Hope you had fun. Goodbye!";

const DONT_UNDERSTAND_TEXT = "I'm sorry but I don't understand your response. Let's try this again: ";

const INCORRECTANSWER_TEXT = [" is not the right answer. ", " is wrong. ", " is not correct. ", " is not it. "];
const RIGHTANSWER1_LONG_TEXT = ["The capital of the ", "The capital city of the "];
const RIGHTANSWER1_SHORT_TEXT = ["The capital of ", "The capital city of ", "The state capital of "];
const RIGHTANSWER2_TEXT = " is ";
const CORRECTANSWER_TEXT = ["Correct! ","That's right! ","Exactly! ","You got it! ", "Right on! "];

const FINISHED1_TEXT = ["You have completed the quiz. You got ","You have finished this quiz. You answered ", "You are done with this quiz. You had " ];
const FINISHED2_TEXT = [" right out of " + numberOfQuestions.toString() + " questions. "," right out of " + numberOfQuestions.toString() + ". "," state capitals right out of " + numberOfQuestions.toString() + ". "];
const FINISHED3_TEXT = ["Do you want to keep playing? ","Do you want to try " + numberOfQuestions.toString() + " more questions? ","Would you like to try another quiz? "];

const text = {
    intro:INTRO_TEXT,
    questionLong:QUESTION_LONG_TEXT,
    questionShort:QUESTION_SHORT_TEXT,
    directionLong:DIRECTION_LONG_TEXT,
    directionShort:DIRECTION_SHORT_TEXT,
    reverseQuestion:REVERSE_QUESTION,
    reverseDirection:REVERSE_DIRECTION,
    incorrectAnswer:INCORRECTANSWER_TEXT,
    rightAnswerLong1:RIGHTANSWER1_LONG_TEXT,
    rightAnswerShort1:RIGHTANSWER1_SHORT_TEXT,
    rightAnswer2:RIGHTANSWER2_TEXT,
    correctAnswer:CORRECTANSWER_TEXT,
    finished1:FINISHED1_TEXT,
    finished2:FINISHED2_TEXT,
    finished3:FINISHED3_TEXT,
    help:HELP_TEXT,
    helpReprompt:HELP_REPROMPT_TEXT,
    keepPlayingNo:KEEP_PLAYING_NO_TEXT,
    keepPlayingYes:KEEP_PLAYING_YES_TEXT,
    dontUnderstand:DONT_UNDERSTAND_TEXT,
    playAgainYes:PLAY_AGAIN_YES_TEXT,
    playAgainNo:PLAY_AGAIN_NO_TEXT,
    welcome1:WELCOME_BACK1_TEXT,
    welcome2:WELCOME_BACK2_TEXT,
};

exports.text = text;
