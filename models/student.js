const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class Student extends Model {
    static associate(models) {
      Student.belongsTo(models.User, {
        foreignKey: "userId",
        as: "user",
      });

      Student.belongsTo(models.Teacher, {
        foreignKey: "teacherId",
        as: "teacher",
      });

      // Updated: Use Enrollments instead of StudentCourses
      Student.belongsToMany(models.Course, {
        through: "Enrollments",
        foreignKey: "studentId",
        otherKey: "courseId",
        as: "courses",
      });

      Student.hasMany(models.Submission, {
        foreignKey: "studentId",
        as: "submissions",
      });
    }
  }

  Student.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
      },
      teacherId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "Teachers",
          key: "id",
        },
      },
      teacherEmail: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      program: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      semester: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "Student",
    }
  );

  return Student;
};
