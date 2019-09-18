const { Component } = require('@serverless/core')
const zip = require('bestzip')

class PHPFunction extends Component {
  static DEFAULT_S3KEY = './build.zip';

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








    return {}
  }




}

module.exports = PHPFunction
