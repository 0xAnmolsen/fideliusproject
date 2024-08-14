const path = require("path");
const { execSync, spawnSync } = require("child_process");
const { writeFileSync, unlinkSync, readFileSync } = require("fs");
const {
	getFideliusVersion,
	generateRandomUUID,
	ensureDirExists,
} = require("./utils.js");

const fideliusVersion = getFideliusVersion();
const binPath = path.join(
	__dirname,
	`../fidelius-cli-${fideliusVersion}/bin/fidelius-cli`
);

const execFideliusCli = (args) => {
    const execOptions = { encoding: "utf-8", maxBuffer: 1024 * 1024 * 10 }; // Increased buffer size to 10MB
    const fideliusCommand = `${binPath} ${args.join(" ")}`;

    const result = execSync(fideliusCommand, execOptions);
    try {
        return JSON.parse(result.replace(/(\r\n|\n|\r)/gm, ""));
    } catch (error) {
        console.error(
            `ERROR · execFideliusCli · Command: ${args.join(" ")}\n${result}`
        );
    }
};

const getEcdhKeyMaterial = () => {
	const result = execFideliusCli(["gkm"]);
	return result;
};

const writeParamsToFile = (...params) => {
	const fileContents = params.join("\n");
	const filePath = path.join(
		__dirname,
		"temp",
		`${generateRandomUUID()}.txt`
	);
	ensureDirExists(filePath);
	writeFileSync(filePath, fileContents);
	return filePath;
};

const removeFileAtPath = (filePath) => unlinkSync(filePath);

// Convert image to Base64
const convertImageToBase64 = (imagePath) => {
	const imageBuffer = readFileSync(imagePath);
	return imageBuffer.toString('base64');
};

// Convert Base64 back to an image
const convertBase64ToImage = (base64String, outputPath) => {
	const imageBuffer = Buffer.from(base64String, 'base64');
	writeFileSync(outputPath, imageBuffer);
};

// Encrypt Base64 image data
const encryptImageData = ({
	imagePath,
	senderNonce,
	requesterNonce,
	senderPrivateKey,
	requesterPublicKey,
}) => {
	const base64EncodedImage = convertImageToBase64(imagePath);
	const paramsFilePath = writeParamsToFile(
		"e",
		base64EncodedImage,
		senderNonce,
		requesterNonce,
		senderPrivateKey,
		requesterPublicKey
	);
    console.log("Encrypting image...");
	const result = execFideliusCli(["-f", paramsFilePath]);
    console.log("Image encrypted.");
	//removeFileAtPath(paramsFilePath);
	console.log({ encryptedData: result?.encryptedData });
	return result;
};

// Decrypt image data
const decryptImageData = ({
	encryptedData,
	requesterNonce,
	senderNonce,
	requesterPrivateKey,
	senderPublicKey,
	outputPath
}) => {
	const paramsFilePath = writeParamsToFile(
		"d",
		encryptedData,
		requesterNonce,
		senderNonce,
		requesterPrivateKey,
		senderPublicKey
	);
    console.log("Decrypting image...");
	const result = execFideliusCli(["-f", paramsFilePath]);
	//removeFileAtPath(paramsFilePath);
    console.log("Image decrypted, converting back to file...");
	console.log({ decryptedData: result?.decryptedData });
	if (result?.decryptedData) {
		convertBase64ToImage(result.decryptedData, outputPath);
	}
	return result;
};

// Example usage with image encryption
const runImageExample = ({ imagePath }) => {
	const requesterKeyMaterial = getEcdhKeyMaterial();
	const senderKeyMaterial = getEcdhKeyMaterial();

	console.log({ requesterKeyMaterial, senderKeyMaterial });

	const encryptionResult = encryptImageData({
		imagePath,
		senderNonce: senderKeyMaterial.nonce,
		requesterNonce: requesterKeyMaterial.nonce,
		senderPrivateKey: senderKeyMaterial.privateKey,
		requesterPublicKey: requesterKeyMaterial.publicKey,
	});

	const decryptionResult = decryptImageData({
		encryptedData: encryptionResult?.encryptedData,
		requesterNonce: requesterKeyMaterial.nonce,
		senderNonce: senderKeyMaterial.nonce,
		requesterPrivateKey: requesterKeyMaterial.privateKey,
		senderPublicKey: senderKeyMaterial.publicKey,
		outputPath: path.join(__dirname, 'images/output-image.png')
	});
};

// Export the functions
module.exports = {
	getEcdhKeyMaterial,
	encryptImageData,
	decryptImageData,
	runImageExample,
};

// Run the example with an image
runImageExample({ imagePath: path.join(__dirname, 'images/example-image.jpg') });
