// utils/s3Helper.js
const AWS = require("aws-sdk");
const { v4: uuidv4 } = require("uuid");

// Configure AWS S3 with environment variables
let s3;

// Only initialize if AWS credentials are provided
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || "us-east-1",
  });
} else {
  console.warn(
    "AWS credentials not found in environment variables. S3 operations will not work."
  );
}

// Upload file to S3
const uploadFileToS3 = async (file, folder) => {
  console.log(`Uploading file to S3 in folder: ${folder}`);

  // Return a mock URL if S3 is not configured (for development)
  if (!s3 || !process.env.AWS_S3_BUCKET_NAME) {
    console.log("S3 not configured. Returning mock URL.");
    return {
      key: `${folder}/${Date.now()}-${file.name}`,
      url: `https://mock-s3-url.example.com/${folder}/${Date.now()}-${
        file.name
      }`,
      name: file.name,
    };
  }

  return new Promise((resolve, reject) => {
    // Validate file data
    if (!file || !file.data) {
      console.log("No file data found");
      return reject(new Error("No file data found"));
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
        return reject(new Error("Failed to upload file"));
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

  // Return success if S3 is not configured (for development)
  if (!s3 || !process.env.AWS_S3_BUCKET_NAME) {
    console.log("S3 not configured. Skipping delete operation.");
    return { message: "Deletion skipped - S3 not configured" };
  }

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
