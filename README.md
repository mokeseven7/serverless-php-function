# PHP Function - AWS Custom Runtime API

This sererless component allows you to execute a PHP funciton in AWS lambda via the custom runtime API. This serverless components uses techniques from [This Article](https://aws.amazon.com/blogs/apn/aws-lambda-custom-runtime-for-php-a-practical-example/), from the AWS blog, as well as the great work done by [pagnihotry](https://github.com/pagnihotry/PHP-Lambda-Runtime) figuring out how to bootstrap the PHP runtime.

This tutorial consists of two major parts. First, we will compile PHP from source, using an ec2 instance that mimicks the runtime AWS lambda uses. During this step we will also install composer, so that our function may utilize external dependencies, psr-4 autoload, and the rest of the goodness composer brings to the table. Ultimatly, this first step will result in creating what aws calls a "layer". These "layers" are the bridge aws exposes to us to be able to actually ultilize a custom runtime. Since our "boostrap file" (more on this in a minuet), will utilize guzzle so we dont have to write CURL directly, this is a required step weather your function uses 3rd party libraries or not.

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

update system packages, and install neccisary dependendies to compile php:

```bash
sudo yum update -y
sudo yum install autoconf bison gcc gcc-c++ libcurl-devel libxml2-devel -y
sudo yum upgrade -y
```

This might take a few minuets.

Download and compile an earlier version of open ssl in order to ensure compadiblity with the AWS lambda VM.

```bash
curl -sL http://www.openssl.org/source/openssl-1.0.1k.tar.gz | tar -xvz
cd openssl-1.0.1k
./config && make && sudo make install
cd ~
```

Download the PHP 7.3.0 source

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
$ /home/ec2-user/php-7-bin/bin/php -v
```

Should output:

```bash
PHP 7.3.0 (cli) (built: Dec 11 2018 17:45:29) ( NTS )
Copyright (c) 1997-2018 The PHP Group
Zend Engine v3.3.0-dev, Copyright (c) 1998-2018 Zend Technologies
```
