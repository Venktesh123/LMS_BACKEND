// models/enrollment.js
const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class Enrollment extends Model {
    static associate(models) {
      // Define associations here if needed
      Enrollment.belongsTo(models.Student, {
        foreignKey: "studentId",
        as: "student",
      });

      Enrollment.belongsTo(models.Course, {
        foreignKey: "courseId",
        as: "course",
      });
    }
  }

  Enrollment.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      studentId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "Students",
          key: "id",
        },
      },
      courseId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "Courses",
          key: "id",
        },
      },
      enrollmentDate: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      status: {
        type: DataTypes.ENUM("active", "completed", "dropped"),
        allowNull: false,
        defaultValue: "active",
      },
    },
    {
      sequelize,
      modelName: "Enrollment",
      tableName: "Enrollments",
    }
  );

  return Enrollment;
};
