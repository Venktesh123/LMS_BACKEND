const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class CourseSchedule extends Model {
    static associate(models) {
      CourseSchedule.belongsTo(models.Course, {
        foreignKey: "courseId",
        as: "course",
      });
    }
  }

  CourseSchedule.init(
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
      classStartDate: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      classEndDate: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      midSemesterExamDate: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      endSemesterExamDate: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      classDaysAndTimes: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
    },
    {
      sequelize,
      modelName: "CourseSchedule",
    }
  );

  return CourseSchedule;
};
