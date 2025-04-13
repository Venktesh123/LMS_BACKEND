const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class CourseAttendance extends Model {
    static associate(models) {
      CourseAttendance.belongsTo(models.Course, {
        foreignKey: "courseId",
        as: "course",
      });
    }
  }

  CourseAttendance.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      courseId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "Courses",
          key: "id",
        },
      },
      sessions: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
    },
    {
      sequelize,
      modelName: "CourseAttendance",
    }
  );

  return CourseAttendance;
};
