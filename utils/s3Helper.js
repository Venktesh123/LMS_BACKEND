// utils/s3Helper.js
const AWS = require("aws-sdk");
const { v4: uuidv4 } = require("uuid");
const { ErrorHandler } = require("../middleware/errorHandler");

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// Upload file to S3
const uploadFileToS3 = async (file, folder) => {
  console.log(`Uploading file to S3 in folder: ${folder}`);

  return new Promise((resolve, reject) => {
    // Validate file data
    if (!file || !file.data) {
      console.log("No file data found");
      return reject(new ErrorHandler("No file data found", 400));
    }

    // Create a unique filename
    const fileName = `${folder}/${uuidv4()}-${file.name.replace(/\s+/g, "-")}`;

    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: fileName,
      Body: file.data,
      ContentType: file.mimetype,
    };

    console.log("S3 upload params prepared");

    s3.upload(params, (err, data) => {
      if (err) {
        console.log("S3 upload error:", err);
        return reject(new ErrorHandler("Failed to upload file", 500));
      }

      console.log("File uploaded successfully:", data.Location);
      resolve({
        key: params.Key,
        url: data.Location,
        name: file.name,
      });
    });
  });
};

// Delete file from S3
const deleteFileFromS3 = async (key) => {
  console.log("Deleting file from S3:", key);

  return new Promise((resolve, reject) => {
    if (!key) {
      console.log("No file key provided");
      return resolve({ message: "No file key provided" });
    }

    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: key,
    };

    s3.deleteObject(params, (err, data) => {
      if (err) {
        console.log("S3 delete error:", err);
        return reject(err);
      }

      console.log("File deleted successfully from S3");
      resolve(data);
    });
  });
};

module.exports = {
  s3,
  uploadFileToS3,
  deleteFileFromS3,
};
