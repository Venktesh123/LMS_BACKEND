const { Sequelize } = require("sequelize");
const config = require("./config")[process.env.NODE_ENV || "development"];

// Force dialect to be postgres
config.dialect = "postgres";

// Create sequelize instance with environment-specific configuration
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
    pool: config.pool || {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  }
);

// Test database connection with enhanced error reporting
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log("Database connection established successfully.");
    console.log(
      `Connected to: ${config.host}:${config.port}/${config.database}`
    );
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    return true;
  } catch (error) {
    console.error("Unable to connect to the database:", error);
    console.error("Connection details (redacted password):", {
      host: config.host,
      port: config.port,
      database: config.database,
      username: config.username,
      ssl: config.dialectOptions?.ssl ? "Enabled" : "Disabled",
    });
    process.exit(1);
  }
};

module.exports = {
  sequelize,
  testConnection,
};
