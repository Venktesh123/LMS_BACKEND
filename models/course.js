const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class Course extends Model {
    static associate(models) {
      Course.belongsTo(models.Teacher, {
        foreignKey: "teacherId",
        as: "teacher",
      });

      Course.belongsTo(models.Semester, {
        foreignKey: "semesterId",
        as: "semester",
      });

      // Updated: Use Enrollments instead of StudentCourses
      Course.belongsToMany(models.Student, {
        through: "Enrollments",
        foreignKey: "courseId",
        otherKey: "studentId",
        as: "students",
      });

      Course.hasMany(models.Lecture, {
        foreignKey: "courseId",
        as: "lectures",
      });

      Course.hasMany(models.Assignment, {
        foreignKey: "courseId",
        as: "assignments",
      });

      Course.hasOne(models.CourseOutcome, {
        foreignKey: "courseId",
        as: "outcomes",
      });

      Course.hasOne(models.CourseSchedule, {
        foreignKey: "courseId",
        as: "schedule",
      });

      Course.hasOne(models.CourseSyllabus, {
        foreignKey: "courseId",
        as: "syllabus",
      });

      Course.hasOne(models.WeeklyPlan, {
        foreignKey: "courseId",
        as: "weeklyPlan",
      });

      Course.hasOne(models.CreditPoints, {
        foreignKey: "courseId",
        as: "creditPoints",
      });

      Course.hasOne(models.CourseAttendance, {
        foreignKey: "courseId",
        as: "attendance",
      });

      Course.hasOne(models.EContent, {
        foreignKey: "courseId",
        as: "eContent",
      });
    }
  }

  Course.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      aboutCourse: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      semesterId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "Semesters",
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
    },
    {
      sequelize,
      modelName: "Course",
    }
  );

  return Course;
};
