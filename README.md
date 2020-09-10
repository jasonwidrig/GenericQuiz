# GenericQuiz
Template for a generic quiz skill on Alexa. 

Currently configured as a state capital quiz.

For APL there are images of state capitols and state flags accessed via S3 that are not included in this repo.\

The lambda for this skill uses this Layer: arn:aws:lambda:us-west-2:173334852312:layer:ask-sdk-for-nodejs:4

The lambda for this skill uses a custom role which consists of 2 AWS managed policies: AmazonS3FullAccess and AWSLambdaBasicExeuctionRole

The CORS config is for the S3 bucket set up for media files.

Setting the default encryption for S3 to AES-256 seems to work best for the persistence adapter.

