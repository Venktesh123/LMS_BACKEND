// scripts/test-prod-connection.js
process.env.NODE_ENV = "production";
require("dotenv").config();
const { testConnection } = require("../config/database");

async function runTest() {
  try {
    console.log("Testing PRODUCTION database connection...");
    await testConnection();
    console.log("✅ Production connection test completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Production connection test failed with exception:", error);
    process.exit(1);
  }
}

runTest();
