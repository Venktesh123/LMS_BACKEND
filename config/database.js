const { Sequelize } = require("sequelize");
const config = require("./config")[process.env.NODE_ENV || "development"];

// Force dialect to be postgres
config.dialect = "postgres";

const sequelize = new Sequelize(
  config.database,
  config.username,
  config.password,
  {
    host: config.host,
    port: config.port,
    dialect: "postgres", // explicitly set to postgres
    logging: config.logging === false ? false : console.log,
    dialectOptions: config.dialectOptions,
  }
);

// Test database connection
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log("Database connection established successfully.");
  } catch (error) {
    console.error("Unable to connect to the database:", error);
    process.exit(1);
  }
};

module.exports = {
  sequelize,
  testConnection,
};
