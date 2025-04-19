// scripts/test-connection.js
require("dotenv").config();
const { testConnection } = require("../config/database");

async function runTest() {
  try {
    console.log(
      `Testing ${process.env.NODE_ENV || "development"} database connection...`
    );
    await testConnection();
    console.log("✅ Connection test completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Connection test failed with exception:", error);
    process.exit(1);
  }
}

runTest();
