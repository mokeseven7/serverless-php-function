const LambdaOptions = {
	FunctionName: 'php-function-hello',
	Description: "first try using the runtime api to create the layers",
	Handler: "hello",
	MemorySize: 128,
	Publish: true,
	Role: "arn:aws:iam::284327142304:role/serverless-lambda",
	Runtime: 'provided',
	Timeout: 900,
	Layers: [
		'arn:aws:lambda:us-east-1:284327142304:layer:php-73-runtime',
		'arn:aws:lambda:us-east-1:284327142304:layer:php-73-runtime-vendor'
	]
}


const S3Options = {
	name: 'phplayer-bucket-mmcgrath',
	dir: 'function',
	zip: true,
	key: new Date().toISOString()
}

const LayerOptions = {
	description: 'phplayer',
	code: path.join(__dirname + '/runtime'),
	runtime: 'provided',
	bucket: 'phplayer-bucket-mmcgrath',
	region: 'us-east-1',
	include: ['*'],
}


module.exports = {
	LambdaOptions,
	S3Options,
	LayerOptions
}