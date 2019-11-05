# PHP Function - AWS Custom Runtime API

This sererless component allows you to execute a PHP funciton in AWS lambda via the custom runtime API. This serverless components uses techniques from [This Article](https://aws.amazon.com/blogs/apn/aws-lambda-custom-runtime-for-php-a-practical-example/), from the AWS blog, as well as the great work done by [pagnihotry](https://github.com/pagnihotry/PHP-Lambda-Runtime) figuring out how to bootstrap the PHP runtime.

This tutorial consists of two major parts. First, we will compile PHP from source, using an ec2 instance that mimicks the runtime AWS lambda uses. During this step we will also install composer, so that our function may utilize external dependencies, psr-4 autoload, and the rest of the goodness composer brings to the table. Ultimatly, this first step will result in creating what aws calls a "layer". These "layers" are the bridge aws exposes to us to be able to actually ultilize a custom runtime. Since our "boostrap file" (more on this in a minuet), will utilize guzzle so we dont have to write CURL directly, this is a required step weather your function uses 3rd party libraries or not.

In the second step, we will compile our php function, and bundle it with the runtime we created in the first step. This process creates what AWS calls layers, and in the bridge between the program and the runtime it runs in.

# What you'll need

-   AWS Account
-   Ability to create the following resources:
    a. ec2 instance
    b. Lambda Function
    c. Lambda Layer
-   AWS IAM user, (sample policy below)
-   Serverless framework and AWS SDK installed and configured on your local machine.

# Setup

ensure both the serverless framework, and aws sdk are installed on you local machine. The following two commands should return version information:

```bash
$ sls -v

Framework Core: 1.52.0
Plugin: 2.0.0
SDK: 2.1.1
```

```bash
aws -v

aws-cli/1.16.238
Python/2.7.10
Darwin/18.7.0
botocore/1.12.228
```

There are plently of tutorials to get started if you do not get something simliar to the above output. The guide on the serverless framework's website covers both, and is my personal favorite:

Installing Serverless Framework:
https://serverless.com/framework/docs/providers/aws/guide/installation/

Once you have confirmed the above two binaries are configured, move on to "Getting Started"

# Getting Started

The following step assumes you are familiar with creating Ec2 instances, and know how to ssh into a machine.

Start by creating a new ec2 instance, using the (2018.03.0) version of Amazon Linux (ami-00eb20669e0990cb4). Ensure the PEM bound to the instance has root ssh access, and that port 22 is open to (at least) your local machine.

After the new instance boots up, ssh into the instance.

I will be doing most of the work out the ec2's home directory, and you are free to do the same, or use any directory that suites you. If you use a directory other than home, just ensure you keep the same directory strucutre, or be sure to make the needed moficiations to any of the below sample commands.

### Update system packages, and install neccisary dependendies to compile php:

```bash
sudo yum update -y
sudo yum install autoconf bison gcc gcc-c++ libcurl-devel libxml2-devel -y
sudo yum upgrade -y
```

This might take a few minuets.

Download and compile an earlier version of open ssl in order to ensure compadiblity with the AWS lambda VM.

### Install OpenSSL 1.0

```bash
curl -sL http://www.openssl.org/source/openssl-1.0.1k.tar.gz | tar -xvz
cd openssl-1.0.1k
./config && make && sudo make install
cd ~
```

### Download the PHP 7.3 source

```bash
mkdir ~/php-7-bin
curl -sL https://github.com/php/php-src/archive/php-7.3.0.tar.gz | tar -xvz
cd php-src-php-7.3.0
```

Here we will compile the php source downloaded in the previous step, as well as pass the --with-openssl flag to ensure its compiled with the correct open ssl version. This step will take about 10 minuets, so step back, make yourself a cup of coffee, and pray to the c++ gods for no errors.

```bash
./buildconf --force
./configure --prefix=/home/ec2-user/php-7-bin/ --with-openssl=/usr/local/ssl --with-curl --with-zlib
make install
```

Once completed, veriy the complilation was successful by attempting to output the php cli version information:

```bash
/home/ec2-user/php-7-bin/bin/php -v
```

Should output:

```bash
PHP 7.3.0 (cli) (built: Dec 11 2018 17:45:29) ( NTS )
Copyright (c) 1997-2018 The PHP Group
Zend Engine v3.3.0-dev, Copyright (c) 1998-2018 Zend Technologies
```

If you get the above output, congratulations! You're ready to move onto step two.

### Creating the lambda runtime layer

Now that we have php compiled in an environment that replicates the lambda runtime, we need to add a few dependencies. Lets start with composer.

If you had poked around at all to see what was downloaded in the previous step, move back into home before proceeding:

```bash
cd ~
```

Lets start by creating ourselves a new directory to work in:

```bash
mkdir -p ~/php-example/bin/
cd ~/php-example
```

Next, lets move the php executable in our working directory to keep things easy:

```bash
cp ~/php-7-bin/bin/php ./bin
```

Next, lets get the composer binary, and stick it in our new bin directory:

```bash
curl -sS https://getcomposer.org/installer | ./bin/php
```

If successful, the output should read something like this:

```bash
All settings correct for using Composer
Downloading...

Composer (version 1.9.1) successfully installed to: /home/ec2-user/php-example/composer.phar
Use it: php composer.phar
```

Next, lets work on creating our bootstrap file, which will tell lambda how to execute our code with our custom runtime.

from the root of our workspace folder (/home/ec2-user/php-example), create a boostrap file, and make it executable:

```bash
touch ./bootstrap && chmod +x ./bootstrap
```

Next, lets install guzzle so we can use it in our boostrap files handler function:

```
./bin/php composer.phar require guzzlehttp/guzzle
```

You should now have the following directory structure:

```bash
/home/ec2-user/php-example/
| bin/
|    |-- php
|-- bootstrap
|-- composer.json
|-- composer.lock
|-- composer.phar
|-- vendor/
|   |-- autoload.php
|   |-- guzzlehttp
```

Next, lets work on the code nessisary to actually boostrap our environment.

Using vim, or the cli editor of your choice, paste the following contents into the bootstrap file:

```php
#!/opt/bin/php
<?php

// This invokes Composer's autoloader so that we'll be able to use Guzzle and any other 3rd party libraries we need.
require __DIR__ . '/vendor/autoload.php';

// This is the request processing loop. Barring unrecoverable failure, this loop runs until the environment shuts down.
do {
    // Ask the runtime API for a request to handle.
    $request = getNextRequest();

    // Obtain the function name from the _HANDLER environment variable and ensure the function's code is available.
    $handlerFunction = array_slice(explode('.', $_ENV['_HANDLER']), -1)[0];
    require_once $_ENV['LAMBDA_TASK_ROOT'] . '/src/' . $handlerFunction . '.php';

    // Execute the desired function and obtain the response.
    $response = $handlerFunction($request['payload']);

    // Submit the response back to the runtime API.
    sendResponse($request['invocationId'], $response);
} while (true);
```

The bootstrap is the main engine that will drive our example; it can be written in any language that Lambda’s underlying Amazon Linux environment is able to run. Since this is a PHP example, both the custom runtime and the bootstrap script itself are written in PHP, and they will be executed using the PHP binary we compiled earlier for Amazon Linux.

Lambda will place the files from our various layers under /opt, so our /home/ec2-user/php-example/bin/php file will ultimately end up being /opt/bin/php. The #!/opt/bin/php shebang declaration at the top of our bootstrap will instruct the program loader to use our PHP binary to execute the remainder of the code.

Next, we'll need to implement two functions in order for our code to actually excute. Add the following to the boostrap file:

```php
function getNextRequest()
{
    $client = new \GuzzleHttp\Client();
    $response = $client->get('http://' . $_ENV['AWS_LAMBDA_RUNTIME_API'] . '/2018-06-01/runtime/invocation/next');

    return [
      'invocationId' => $response->getHeader('Lambda-Runtime-Aws-Request-Id')[0],
      'payload' => json_decode((string) $response->getBody(), true)
    ];
}
```

And

```php
function sendResponse($invocationId, $response)
{
    $client = new \GuzzleHttp\Client();
    $client->post(
    'http://' . $_ENV['AWS_LAMBDA_RUNTIME_API'] . '/2018-06-01/runtime/invocation/' . $invocationId . '/response',
       ['body' => $response]
    );
}
```

If you've made it this far, give yourself a pat on the back. We are moments away from finishing our custom runtime layer, and being able to jump into some actual code!

We'll need to upload everything we've created so far as a zip file to lambda, so lets create that zip now:

```bash
zip -r runtime.zip bin bootstrap
```

Finally, we'll need a way to actually upload this zip file to aws, and using the aws cli sounds like the easiest option.

First, install the cli:

```bash
sudo pip install --upgrade awscli
```

Next, create an IAM user within the aws web console with full lambda permissions. Download the key and secret, and use them to configure the aws cli:

```bash
aws configure
```

AWS Access Key ID [None]: **_
AWS Secret Access Key [None]: _**
Default region name [None]: us-west-2
Default output format [None]: json

Feel free to change the default region, and output format if desired.

With the aws cli configure, we are now ready to publish our layer to lambda:

```bash
aws lambda publish-layer-version \
    --layer-name php-73-runtime \
    --zip-file fileb://runtime.zip \
    --region us-west-2
```

Upon success, you should recieve a JSON object response, that looks simliar to the following:

```json
{
	"Content": {
		"CodeSize": 11586149,
		"CodeSha256": "0jhAF6gKlUbUfTp3Js9Za3ryFt6C4oxbc2HTZ413fOU=",
		"Location": "https://awslambda-us-west-2-layers.s3.us-west-2.amazonaws.com/snapshots/869029932727/php-73-runtime-d4a7728e-f036-4208-881c-65fc70af9c38?versionId=7ZmnaCrgWUc1Pkd2_eJl9kdLbFgDrwiu&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEE4aCXVzLXdlc3QtMiJHMEUCIHY11iwRcNYByok0zW6ekfTNhSgzUT%2FybyWPGsrKZ48mAiEAyl0m%2Fqqc6o2kT1bOumsSHRj3TgG0M7Oh5kXXYPBqdhkq0QIIZhACGgw1MDIyOTcwNzYxNjMiDPVLe22xBib5QQF3HSquAiIho8NVzRVUZ9HQMhR7l7Ln%2BdjzO4%2FMpLIL%2FtC18nwBChR86iAyl3EntFsYVsLB51LCrzO%2BFVmyKLbk%2FqtNPX4x6%2FeY2WCQdSifwGFnt0fOCMVI5P87rFLhhRbY%2BwjFqY0FUI23wnm0jtfF%2B%2BsNFvOy6Yj6uReg1tH00f0l%2BiCL9%2BE4jxbiz%2BULq9NJCn11tGpwAaAEDmduEkfiQp4%2F%2FQM%2BblhS4XGpGKCZ1jhIU5FL88f%2FkES%2BrUoDf68GGLlRvu5LD924DaOmx6jSRQ9FUqbQTIeuyEve73WFYRVjORK4GB7K22v0G%2FaAc3SThwso32soo72kvOhOee811vls6RhTcAZbp0pntxd2P7wcQePGMdCsNRnKbpP0zgG0gaTEfz6ZfA9v%2BIFu67YTxwC%2BMI3Yh%2B4FOs4CmrF92J6a63VugfZ40lxdQ%2FmvGK8V%2Br4yHrgvRx4U%2Fawa%2FrW2%2BfI1VriewToG0r9o6fLaI%2FYGMCKi0J4RMqQQVpjq70knrPjMFws9hFuYoAQANn9%2BSwUoZSV0d9TQb5lRlxegBYkNvheItL6DF1YkyY9x6O%2BDWUajHepLxtvi7G7zb3KNn2b%2BKbqartTBFTubEizRKxfM9RgdNpwpl4ITud4AvmiXpHGvPY3FhyjojuCQkQNYVFXZ3ZCQ0EDr5tp2y3hG5bzTCRZA49UO8G6UwNqcEChAz%2F%2FniLdQLOT7Q15bF9FiOnUNE5ghRti2bnMHMErFctW35N1r9DwErDtQxUDkwalqL22wybJDKD2uBHLoCj2XvHCgP4XGDRQ9LR5qdI2osRPCm%2FlSUFLvqo1ILDiNMjonTf8LOZPZrvobKv7LZh5mdF0V1hg5k%2ByRpQ%3D%3D&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20191105T224344Z&X-Amz-SignedHeaders=host&X-Amz-Expires=600&X-Amz-Credential=ASIAXJ4Z5EHBTKA2LYV2%2F20191105%2Fus-west-2%2Fs3%2Faws4_request&X-Amz-Signature=5aa4e4d847084b53760449134e1b60eef8de479756c31c306649b5565644f0ab"
	},
	"LayerVersionArn": "arn:aws:lambda:us-west-2:869029932727:layer:php-73-runtime:1",
	"Version": 1,
	"Description": "",
	"CreatedDate": "2019-11-05T22:43:52.196+0000",
	"LayerArn": "arn:aws:lambda:us-west-2:869029932727:layer:php-73-runtime"
}
```

Make note of both the LayerVersionArn, and the LayerArn.

Congratulations! You've just compiled php from source, boostraped the lambda environment to run PHP, and created a lambda layer! Next, we'll get to actually writing some php code!
