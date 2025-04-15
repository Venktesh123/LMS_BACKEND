"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create CourseOutcomes table
    await queryInterface.createTable("CourseOutcomes", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      courseId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "Courses",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      outcomes: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    // Create CourseSchedules table
    await queryInterface.createTable("CourseSchedules", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      courseId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "Courses",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      classStartDate: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      classEndDate: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      midSemesterExamDate: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      endSemesterExamDate: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      classDaysAndTimes: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    // Create CourseSyllabuses table
    await queryInterface.createTable("CourseSyllabuses", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      courseId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "Courses",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      modules: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    // Create WeeklyPlans table
    await queryInterface.createTable("WeeklyPlans", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      courseId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "Courses",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      weeks: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    // Create CreditPoints table
    await queryInterface.createTable("CreditPoints", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      courseId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "Courses",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      lecture: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      tutorial: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      practical: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      project: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    // Create CourseAttendances table
    await queryInterface.createTable("CourseAttendances", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      courseId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "Courses",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      sessions: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
  },

  async down(queryInterface, Sequelize) {
    // Drop tables in reverse order to avoid foreign key constraints
    await queryInterface.dropTable("CourseAttendances");
    await queryInterface.dropTable("CreditPoints");
    await queryInterface.dropTable("WeeklyPlans");
    await queryInterface.dropTable("CourseSyllabuses");
    await queryInterface.dropTable("CourseSchedules");
    await queryInterface.dropTable("CourseOutcomes");
  },
};
