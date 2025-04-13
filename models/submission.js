const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class Submission extends Model {
    static associate(models) {
      Submission.belongsTo(models.Assignment, {
        foreignKey: "assignmentId",
        as: "assignment",
      });

      Submission.belongsTo(models.Student, {
        foreignKey: "studentId",
        as: "student",
      });
    }
  }

  Submission.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      assignmentId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "Assignments",
          key: "id",
        },
      },
      studentId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "Students",
          key: "id",
        },
      },
      submissionFile: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      submissionDate: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      grade: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      feedback: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM("submitted", "graded", "returned"),
        allowNull: false,
        defaultValue: "submitted",
      },
      isLate: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: "Submission",
    }
  );

  return Submission;
};
