# PHP Function - AWS Custom Runtime API

This sererless component allows you to execute a PHP funciton in AWS lambda via the custom runtime API. This serverless components uses techniques from [This Article](https://aws.amazon.com/blogs/apn/aws-lambda-custom-runtime-for-php-a-practical-example/), from the AWS blog, as well as the great work done by (pagnihotry)[https://github.com/pagnihotry/PHP-Lambda-Runtime] figuring out how to bootstrap the PHP runtime.

# What you'll need

-   AWS Account
-   Ability to create the following resources:
    a. ec2 instance
    b. Lambda Function
    c. Lambda Layer
-   AWS IAM user, (sample policy below)
-   Serverless framework and AWS SDK installed and configured on your local machine.

# Getting Started

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
