const { Component } = require('@serverless/core')
const zip = require('bestzip')
const AWS = require('aws-sdk');


class PHPFunction extends Component {
  static DEFAULT_S3KEY = 'build.zip';
  static DEFAULT_S3BUCKET = 'phplayer-bucket-mmcgrath';

  async default(inputs = {}) {
    //If passed in from serverless.yml, set it
    const S3KEY = inputs.deploymentBucket || this.constructor.DEFAULT_S3KEY;

    //Setup The bundle
    let archive = zip({ source: ['src/hello.php'], destination: S3KEY });

    try {
      await archive.then(() => this.state.S3KEY = S3KEY)
    } catch (err) {
      console.error('Error while attempting to create deployment bundle', err.message);
      process.exit(1)
    }
    await this.save();


    const bucket = await this.load('@serverless/aws-s3');

    await bucket({
      accelerated: true,
      name: 'phplayer-bucket-mmcgrath'
    })

    await bucket.upload({ file: 'build.zip' })

    /** Lambda Code Starts */
    const params = {
      Code: {
        S3Bucket: this.constructor.DEFAULT_S3BUCKET,
        S3Key: this.state.S3KEY,
      },
      FunctionName: 'php-layer-function',
      Handler: 'hello',
      Role: 'arn:aws:iam::284327142304:role/serverless-lambda',
      Runtime: 'provided',
      Description: 'php lambda',
      Layers: [
        'arn:aws:lambda:us-east-1:284327142304:layer:php-73-runtime:1',
        'arn:aws:lambda:us-east-1:284327142304:layer:php-73-runtime-vendor:1',
      ],
      MemorySize: 128,
      Publish: true,
      Timeout: 900
    };


    const lambdaFunction = new AWS.Lambda({
      apiVersion: '2015-03-31',
      credentials: this.context.credentials.aws,
      region: 'us-east-1'
    });

    const response = await lambdaFunction.createFunction(params, function (err, data) {
      if (err) console.log(err, err.stack); // an error occurred
      else console.log(data);           // successful response
    }).promise();

    console.log('RESPONSE: ', response)

    return {}
  }




}

module.exports = PHPFunction
