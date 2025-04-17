"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add the attachments column to the Assignments table
    await queryInterface.addColumn("Assignments", "attachments", {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: [],
    });
  },
  async down(queryInterface, Sequelize) {
    // Remove the column if needed
    await queryInterface.removeColumn("Assignments", "attachments");
  },
};
