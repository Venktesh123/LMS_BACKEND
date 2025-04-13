const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class StudentCourse extends Model {
    static associate(models) {
      // No direct associations as this is a junction table
    }
  }

  StudentCourse.init(
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
      modelName: "StudentCourse",
      tableName: "StudentCourses",
    }
  );

  return StudentCourse;
};
