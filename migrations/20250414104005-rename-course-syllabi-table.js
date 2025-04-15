"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if the old table exists
    try {
      // Try to directly rename using SQL query
      await queryInterface.sequelize.query(
        'ALTER TABLE IF EXISTS "CourseSyllabi" RENAME TO "CourseSyllabuses"'
      );

      // Also try the standard method as a fallback
      await queryInterface.renameTable("CourseSyllabi", "CourseSyllabuses");
    } catch (error) {
      console.log("Migration error:", error.message);
      // If the error is about the table not existing, we can ignore it
      if (!error.message.includes("does not exist")) {
        throw error;
      }
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      await queryInterface.renameTable("CourseSyllabuses", "CourseSyllabi");
    } catch (error) {
      console.log("Migration rollback error:", error.message);
      // If the error is about the table not existing, we can ignore it
      if (!error.message.includes("does not exist")) {
        throw error;
      }
    }
  },
};
